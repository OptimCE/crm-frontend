import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { DocumentOut } from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  ERROR_CODE,
  extractApiErrorCode,
  extractApiErrorMessage,
  formatBytes,
} from '../../administrative-document-format';
import { canUploadVersion } from '../../administrative-document-transitions';

interface UploadVersionDialogData {
  document: DocumentOut;
}

@Component({
  selector: 'app-upload-version-dialog',
  standalone: true,
  imports: [TranslatePipe, Button],
  templateUrl: './upload-version-dialog.html',
  providers: [ErrorMessageHandler],
})
export class UploadVersionDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<UploadVersionDialogData>);
  private readonly service = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as UploadVersionDialogData | undefined;
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly dragging = signal<boolean>(false);
  readonly selectedFile = signal<File | null>(null);

  readonly documentTitle = this.dialogData?.document.title ?? '';

  pickFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.formError.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.selectedFile.set(file);
      this.formError.set(null);
    }
  }

  fileSize(): string {
    const file = this.selectedFile();
    return file ? formatBytes(file.size) : '';
  }

  submit(): void {
    this.formError.set(null);
    const document = this.dialogData?.document;
    if (!document) return;

    // The caller already hides the button, but a document can change status
    // while this dialog is open — re-check rather than let the request 409.
    if (!canUploadVersion(document.status)) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.UPLOAD_VERSION.ERRORS.NOT_ALLOWED',
        ) as string,
      );
      return;
    }

    const file = this.selectedFile();
    if (!file) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.UPLOAD_VERSION.ERRORS.FILE_REQUIRED',
        ) as string,
      );
      return;
    }

    this.submitting.set(true);
    this.service
      .uploadVersion(document.id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.DIALOGS.UPLOAD_VERSION.SUCCESS',
            ) as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const code = extractApiErrorCode(error);
          // Every one of these is about the file or the document's state, so
          // it belongs next to the field rather than in a transient toast.
          if (
            code === ERROR_CODE.VERSION_NOT_ALLOWED ||
            code === ERROR_CODE.FILE_TOO_LARGE ||
            code === ERROR_CODE.INVALID_FILE
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
