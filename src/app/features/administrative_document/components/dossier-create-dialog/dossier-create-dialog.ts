import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  DossierIn,
  DossierType,
  SharingOperationOut,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  ERROR_CODE,
  dossierTypeLabelKey,
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../administrative-document-format';

interface DossierCreateDialogData {
  operations: SharingOperationOut[];
}

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-dossier-create-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, InputText, Select],
  templateUrl: './dossier-create-dialog.html',
  providers: [ErrorMessageHandler],
})
export class DossierCreateDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<DossierCreateDialogData>);
  private readonly service = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as DossierCreateDialogData | undefined;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly operations = signal<SharingOperationOut[]>(this.dialogData?.operations ?? []);

  readonly operationOptions = computed<SelectOption<number>[]>(() =>
    this.operations().map((op) => ({ label: op.name, value: op.id })),
  );

  /** A dossier cannot be filed without an operation, so say so up front. */
  readonly hasNoOperations = computed(() => this.operations().length === 0);

  readonly typeOptions: SelectOption<DossierType>[] = [
    DossierType.CREATION_NOTIFICATION,
    DossierType.MODIFICATION,
    DossierType.ANNUAL_REPORT,
    DossierType.SHARING_AUTHORIZATION,
    DossierType.SHARING_MODIFICATION,
    DossierType.CESSATION,
  ].map((value) => ({
    label: this.translate.instant(dossierTypeLabelKey(value)) as string,
    value,
  }));

  readonly form = new FormGroup({
    dossier_type: new FormControl<DossierType | null>(null),
    id_sharing_operation: new FormControl<number | null>(null),
    title: new FormControl<string>('', { nonNullable: true }),
    external_ref: new FormControl<string>('', { nonNullable: true }),
  });

  submit(): void {
    this.formError.set(null);
    const raw = this.form.getRawValue();

    if (raw.dossier_type == null) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOSSIER.ERRORS.TYPE_REQUIRED',
        ) as string,
      );
      return;
    }
    // Required by the backend: every dossier is filed for one sharing operation.
    if (raw.id_sharing_operation == null) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOSSIER.ERRORS.OPERATION_REQUIRED',
        ) as string,
      );
      return;
    }

    const body: DossierIn = {
      dossier_type: raw.dossier_type,
      id_sharing_operation: raw.id_sharing_operation,
      title: raw.title.trim() || null,
      external_ref: raw.external_ref.trim() || null,
    };

    this.submitting.set(true);
    this.service
      .createDossier(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOSSIER.SUCCESS',
            ) as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const code = extractApiErrorCode(error);
          // A duplicate reference or a rejected operation are field problems —
          // keep them inline instead of firing a toast the user must chase.
          if (
            code === ERROR_CODE.DUPLICATE_EXTERNAL_REF ||
            code === ERROR_CODE.SHARING_OPERATION_NOT_FOUND
          ) {
            this.formError.set(extractApiErrorMessage(error));
            return;
          }
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
