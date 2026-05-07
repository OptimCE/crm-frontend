import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';

interface SharingOperationMunicipalitiesUpdateData {
  id: number;
  municipalities: MunicipalityPartialDTO[];
}

@Component({
  selector: 'app-sharing-operation-municipalities-update',
  standalone: true,
  imports: [ReactiveFormsModule, AutoComplete, Button, ErrorHandlerComponent, TranslatePipe],
  templateUrl: './sharing-operation-municipalities-update.html',
  styleUrl: './sharing-operation-municipalities-update.css',
  providers: [ErrorMessageHandler],
})
export class SharingOperationMunicipalitiesUpdate implements OnInit {
  private sharingOpService = inject(SharingOperationService);
  private municipalityService = inject(MunicipalityService);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  readonly municipalitySuggestions = signal<MunicipalityPartialDTO[]>([]);
  readonly municipalitySearching = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);

  private readonly data = this.config.data as SharingOperationMunicipalitiesUpdateData;
  private readonly initialNisSet = new Set(
    (this.data?.municipalities ?? []).map((m) => m.nis_code),
  );

  private readonly municipalitiesValue = signal<MunicipalityPartialDTO[]>(
    this.data?.municipalities ?? [],
  );

  readonly selectedCount = computed(() => this.municipalitiesValue().length);
  readonly isDirty = computed(() => {
    const current = this.municipalitiesValue();
    if (current.length !== this.initialNisSet.size) return true;
    return current.some((m) => !this.initialNisSet.has(m.nis_code));
  });

  ngOnInit(): void {
    this.form = new FormGroup({
      municipalities: new FormControl<MunicipalityPartialDTO[]>(this.data?.municipalities ?? []),
    });
    this.form
      .get('municipalities')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value: MunicipalityPartialDTO[] | null) => {
        this.municipalitiesValue.set(value ?? []);
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
          const selected: MunicipalityPartialDTO[] =
            (this.form.get('municipalities')?.value as MunicipalityPartialDTO[]) ?? [];
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

  onCancel(): void {
    this.ref.close(false);
  }

  onSubmitForm(): void {
    if (this.submitting()) return;
    const selected = (this.form.get('municipalities')?.value as MunicipalityPartialDTO[]) ?? [];
    this.submitting.set(true);
    this.sharingOpService
      .updateMunicipalities({
        id_sharing: this.data.id,
        municipality_nis_codes: selected.map((m) => m.nis_code),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          if (response) {
            this.ref.close(true);
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error: (error) => {
          this.submitting.set(false);
          this.errorHandler.handleError(error);
        },
      });
  }
}
