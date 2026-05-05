import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { Button } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextModule } from 'primeng/inputtext';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { CreateSharingOperationDTO } from '../../../../shared/dtos/sharing_operation.dtos';
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

function nonEmptyArrayValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown[] | null | undefined;
  return Array.isArray(value) && value.length > 0 ? null : { required: true };
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
  private ref = inject(DynamicDialogRef);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);
  formAddSharingOp!: FormGroup;
  readonly categories = signal<SharingOperationCategory[]>([]);
  readonly municipalitySuggestions = signal<MunicipalityPartialDTO[]>([]);
  readonly municipalitySearching = signal<boolean>(false);

  ngOnInit(): void {
    this.formAddSharingOp = new FormGroup({
      name: new FormControl<string | null>(null, Validators.required),
      type: new FormControl<SharingOperationType | null>(null, Validators.required),
      municipalities: new FormControl<MunicipalityPartialDTO[]>([], nonEmptyArrayValidator),
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
    const newSharing: CreateSharingOperationDTO = {
      name: formValue.name,
      type: formValue.type,
      municipality_nis_codes: formValue.municipalities.map((m) => m.nis_code),
    };
    this.sharingOpService
      .createSharingOperation(newSharing)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
