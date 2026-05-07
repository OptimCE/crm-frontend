import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { Button } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextModule } from 'primeng/inputtext';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import {
  CreateSharingOperationDTO,
  SharingOperationDTO,
  UpdateSharingOperationDTO,
} from '../../../../shared/dtos/sharing_operation.dtos';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';

interface SharingOperationCategory {
  key: SharingOperationType;
  value: string;
}

interface SharingOperationFormValue {
  name: string;
  type: SharingOperationType;
  municipalities: MunicipalityPartialDTO[];
}

interface SharingOperationCreationUpdateData {
  operation?: SharingOperationDTO;
}

@Component({
  selector: 'app-sharing-operation-creation-update',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    RadioButtonModule,
    AutoComplete,
    Button,
    ErrorHandlerComponent,
    TranslatePipe,
  ],
  templateUrl: './sharing-operation-creation-update.html',
  styleUrl: './sharing-operation-creation-update.css',
  providers: [ErrorMessageHandler],
})
export class SharingOperationCreationUpdate implements OnInit {
  private sharingOpService = inject(SharingOperationService);
  private municipalityService = inject(MunicipalityService);
  private config = inject(DynamicDialogConfig, { optional: true });
  private ref = inject(DynamicDialogRef);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);
  formAddSharingOp!: FormGroup;
  readonly categories = signal<SharingOperationCategory[]>([]);
  readonly municipalitySuggestions = signal<MunicipalityPartialDTO[]>([]);
  readonly municipalitySearching = signal<boolean>(false);

  readonly existingOperation = signal<SharingOperationDTO | undefined>(
    (this.config?.data as SharingOperationCreationUpdateData | undefined)?.operation,
  );
  readonly isUpdateMode = computed(() => this.existingOperation() !== undefined);
  readonly submitLabelKey = computed(() =>
    this.isUpdateMode()
      ? 'SHARING_OPERATION.EDIT.UPDATE_BUTTON_LABEL'
      : 'SHARING_OPERATION.ADD.ADD_BUTTON_LABEL',
  );

  ngOnInit(): void {
    const op = this.existingOperation();
    this.formAddSharingOp = new FormGroup({
      name: new FormControl<string | null>(op?.name ?? null, Validators.required),
      type: new FormControl<SharingOperationType | null>(op?.type ?? null, Validators.required),
      municipalities: new FormControl<MunicipalityPartialDTO[]>(op?.municipalities ?? []),
    });
    this.setupTranslationCategory();
  }

  setupTranslationCategory(): void {
    this.setupECCategory();
  }

  setupECCategory(): void {
    this.translate
      .get([
        'SHARING_OPERATION.TYPE.INSIDE_BUILDING',
        'SHARING_OPERATION.TYPE.CER',
        'SHARING_OPERATION.TYPE.CEC',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.categories.set([
          {
            key: SharingOperationType.LOCAL,
            value: translation['SHARING_OPERATION.TYPE.INSIDE_BUILDING'],
          },
          { key: SharingOperationType.CER, value: translation['SHARING_OPERATION.TYPE.CER'] },
          { key: SharingOperationType.CEC, value: translation['SHARING_OPERATION.TYPE.CEC'] },
        ]);
      });
  }

  searchMunicipalities(event: AutoCompleteCompleteEvent): void {
    const term = (event.query ?? '').trim();
    this.municipalitySearching.set(true);
    this.municipalityService
      .searchMunicipalities({ page: 1, limit: 20, name: term || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const items = (response?.data as MunicipalityPartialDTO[]) ?? [];
          // Hide already-selected entries from the suggestion list
          const selected: MunicipalityPartialDTO[] =
            (this.formAddSharingOp.get('municipalities')?.value as MunicipalityPartialDTO[]) ?? [];
          const selectedCodes = new Set(selected.map((m) => m.nis_code));
          this.municipalitySuggestions.set(items.filter((m) => !selectedCodes.has(m.nis_code)));
          this.municipalitySearching.set(false);
        },
        error: () => {
          this.municipalitySuggestions.set([]);
          this.municipalitySearching.set(false);
        },
      });
  }

  municipalityLabel(m: MunicipalityPartialDTO): string {
    const codes =
      m.postal_codes && m.postal_codes.length > 0 ? ` (${m.postal_codes.join(', ')})` : '';
    return `${m.fr_name}${codes}`;
  }

  onSubmitForm(): void {
    if (this.formAddSharingOp.invalid) {
      this.formAddSharingOp.markAllAsTouched();
      return;
    }
    const formValue = this.formAddSharingOp.getRawValue() as SharingOperationFormValue;
    const municipality_nis_codes = formValue.municipalities.map((m) => m.nis_code);

    const op = this.existingOperation();
    const request$ = op
      ? this.sharingOpService.updateSharingOperation(op.id, {
          name: formValue.name,
          type: formValue.type,
          municipality_nis_codes,
        } as UpdateSharingOperationDTO)
      : this.sharingOpService.createSharingOperation({
          name: formValue.name,
          type: formValue.type,
          municipality_nis_codes,
        } as CreateSharingOperationDTO);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response) {
          this.ref.close(true);
        } else {
          this.errorHandler.handleError(response);
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error);
      },
    });
  }
}
