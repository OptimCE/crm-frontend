import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { DocumentService } from '../../../../shared/services/document.service';
import { ApiResponse } from '../../../../core/dtos/api.response';

@Component({
  selector: 'app-member-add-document',
  standalone: true,
  imports: [ErrorHandlerComponent, ReactiveFormsModule, TranslatePipe, Button],
  templateUrl: './member-add-document.html',
  styleUrl: './member-add-document.css',
  providers: [ErrorMessageHandler],
})
export class MemberAddDocument implements OnInit {
  private documentService = inject(DocumentService);
  private config = inject<DynamicDialogConfig<{ idMember: string }>>(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  formGroup!: FormGroup;
  readonly dragging = signal<boolean>(false);
  readonly fileToUpload = signal<File | null>(null);
  private idMember!: string;

  ngOnInit(): void {
    const data = this.config.data;
    if (data && data.idMember) {
      this.idMember = data.idMember;
    } else {
      console.error('No member id provided');
      this.ref.close(false);
    }
    this.formGroup = new FormGroup({
      fileToUpload: new FormControl(null, Validators.required),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const selectedFile = input?.files?.[0] ?? null;
    if (selectedFile) {
      this.fileToUpload.set(selectedFile);
      this.formGroup.patchValue({ fileToUpload: this.fileToUpload() });
      this.formGroup.get('fileToUpload')?.updateValueAndValidity();
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
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.fileToUpload.set(files[0]);
      this.formGroup.patchValue({ fileToUpload: this.fileToUpload() });
      this.formGroup.get('fileToUpload')?.updateValueAndValidity();
    }
  }

  uploadDocument(): void {
    if (this.formGroup.invalid) {
      return;
    }
    const formData = new FormData();
    formData.append('file', this.fileToUpload() as File);
    formData.append('id_member', this.idMember);
    this.documentService.uploadDocument(formData).subscribe({
      next: (response) => {
        if (response) {
          this.ref.close(true);
        } else {
          this.errorHandler.handleError();
        }
      },
      error: (error: unknown) => {
        const errorData = error instanceof ApiResponse ? (error.data as string) : null;
        this.errorHandler.handleError(errorData);
      },
    });
  }
}
