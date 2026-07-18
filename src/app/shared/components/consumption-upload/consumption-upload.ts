import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';

import { ApiResponse } from '../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../core/dtos/notification';
import { SharingOperationService } from '../../services/sharing_operation.service';
import { ErrorMessageHandler } from '../../services-ui/error.message.handler';
import { SnackbarNotification } from '../../services-ui/snackbar.notifcation.service';
import { ErrorHandlerComponent } from '../error.handler/error.handler.component';

/**
 * Reusable Excel consumption-data uploader. Owns the drag/drop drop-zone, the
 * one-control reactive form and the POST to
 * `SharingOperationService.addConsumptionDataToSharing`, so both the
 * sharing-operation view and the billing Generate tab share the exact same flow.
 *
 * On success it resets the control WITHOUT emitting (`emitEvent: false`) and
 * clears its error state — otherwise `Validators.required` re-fires on the null
 * reset value and `app-error-handler` would flash a false "required" error right
 * after a successful upload.
 */
@Component({
  selector: 'app-consumption-upload',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, ErrorHandlerComponent],
  templateUrl: './consumption-upload.html',
  styleUrl: './consumption-upload.css',
  providers: [ErrorMessageHandler],
})
export class ConsumptionUpload {
  private readonly sharingOperationService = inject(SharingOperationService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Sharing operation the uploaded consumption data is attached to. */
  readonly operationId = input.required<number>();
  /** Accepted file extensions for the native picker. */
  readonly accept = input<string>('.xlsx,.xls');

  /** Emitted after a successful upload so hosts can refresh dependent views. */
  readonly uploaded = output<void>();

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly dragging = signal<boolean>(false);
  readonly fileConsumption = signal<File | null>(null);
  readonly uploading = signal<boolean>(false);

  readonly formGroup = new FormGroup(
    {
      fileConsumption: new FormControl<File | string | null>('', [Validators.required]),
    },
    { updateOn: 'submit' },
  );

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0];
    if (selectedFile) {
      this.setFile(selectedFile);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.setFile(file);
    }
  }

  private setFile(file: File): void {
    this.fileConsumption.set(file);
    const control = this.formGroup.get('fileConsumption');
    control?.patchValue(file);
    control?.updateValueAndValidity();
  }

  submit(): void {
    const file = this.fileConsumption();
    if (this.formGroup.invalid || this.uploading() || !file) {
      return;
    }
    const operationId = this.operationId();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('id_sharing_operation', operationId.toString());

    this.uploading.set(true);
    this.sharingOperationService
      .addConsumptionDataToSharing(formData, operationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          if (response) {
            this.snackbar.openSnackBar(
              this.translate.instant(
                'SHARING_OPERATION.VIEW.CONSUMPTION_MONITORING.UPLOAD_SUCCESS_LABEL',
              ) as string,
              VALIDATION_TYPE,
            );
            this.resetForm();
            this.uploaded.emit();
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.errorHandler.handleError(
            error instanceof ApiResponse ? (error.data as string) : null,
          );
        },
      });
  }

  /** Clears the picked file without re-triggering the required validator. */
  private resetForm(): void {
    this.fileConsumption.set(null);
    const control = this.formGroup.get('fileConsumption');
    control?.reset('', { emitEvent: false });
    control?.markAsPristine();
    control?.markAsUntouched();
    control?.setErrors(null);
    const inputEl = this.fileInput()?.nativeElement;
    if (inputEl) {
      inputEl.value = '';
    }
  }
}
