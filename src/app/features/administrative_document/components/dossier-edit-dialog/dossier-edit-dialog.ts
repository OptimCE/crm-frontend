import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { DossierOut, DossierPatch } from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  ERROR_CODE,
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../administrative-document-format';

interface DossierEditDialogData {
  dossier: DossierOut;
  operationName: string;
}

@Component({
  selector: 'app-dossier-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, InputText],
  templateUrl: './dossier-edit-dialog.html',
  providers: [ErrorMessageHandler],
})
export class DossierEditDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<DossierEditDialogData>);
  private readonly service = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as DossierEditDialogData | undefined;
  private readonly dossier = this.dialogData?.dossier;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly operationName = this.dialogData?.operationName ?? '';

  readonly form = new FormGroup({
    title: new FormControl<string>(this.dossier?.title ?? '', { nonNullable: true }),
    external_ref: new FormControl<string>(this.dossier?.external_ref ?? '', { nonNullable: true }),
  });

  submit(): void {
    this.formError.set(null);
    if (!this.dossier) return;

    const raw = this.form.getRawValue();
    const title = raw.title.trim();
    const externalRef = raw.external_ref.trim();

    // The backend applies a field only when it is not null, so an unchanged key
    // must be OMITTED rather than sent as null — sending null is a silent no-op.
    const body: DossierPatch = {};
    if (title !== (this.dossier.title ?? '')) body.title = title;
    if (externalRef !== (this.dossier.external_ref ?? '')) body.external_ref = externalRef;

    if (Object.keys(body).length === 0) {
      this.ref.close(false);
      return;
    }

    this.submitting.set(true);
    this.service
      .updateDossier(this.dossier.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.DIALOGS.EDIT_DOSSIER.SUCCESS',
            ) as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (extractApiErrorCode(error) === ERROR_CODE.DUPLICATE_EXTERNAL_REF) {
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
