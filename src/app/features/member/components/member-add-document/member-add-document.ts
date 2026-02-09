import {Component, OnInit} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {ErrorMessageHandler} from '../../../../shared/services-ui/error.message.handler';
import {ErrorHandlerComponent} from '../../../../shared/components/error.handler/error.handler.component';
import {TranslatePipe} from '@ngx-translate/core';
import {Button} from 'primeng/button';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {MemberService} from '../../../../shared/services/member.service';
import {DocumentService} from '../../../../shared/services/document.service';

@Component({
  selector: 'app-member-add-document',
  standalone: true,
  imports: [ErrorHandlerComponent, ReactiveFormsModule, TranslatePipe, Button],
  templateUrl: './member-add-document.html',
  styleUrl: './member-add-document.css',
  providers: [ErrorMessageHandler],
})
export class MemberAddDocument implements OnInit {
  formGroup!: FormGroup;
  public dragging: boolean = false;
  public fileToUpload: File | null = null;
  private idMember!: string;

  constructor(
    private memberService: MemberService,
    private documentService: DocumentService,
    private config: DynamicDialogConfig,
    private ref: DynamicDialogRef,
    private errorHandler: ErrorMessageHandler,
  ) {}

  ngOnInit() {
    if (this.config.data && this.config.data.idMember) {
      this.idMember = this.config.data.idMember;
    } else {
      console.error('No member id provided');
      this.ref.close(false);
    }
    this.formGroup = new FormGroup({
      fileToUpload: new FormControl(null, Validators.required),
    });
  }

  onFileSelected(event: any): void {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      this.fileToUpload = selectedFile;
      this.formGroup.patchValue({ fileToUpload: this.fileToUpload });
      this.formGroup.get('fileToUpload')?.updateValueAndValidity();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.fileToUpload = files[0];
      this.formGroup.patchValue({ fileToUpload: this.fileToUpload });
      this.formGroup.get('fileToUpload')?.updateValueAndValidity();
    }
  }

  uploadDocument() {
    if (this.formGroup.invalid) {
      return;
    }
    const formData = new FormData();
    formData.append('file', this.fileToUpload as File);
    formData.append('idMember', this.idMember);
    this.documentService.uploadDocument(formData).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.ref.close(true);
          } else {
            this.errorHandler.handleError();
          }
        },
        error:(error) => {
          this.errorHandler.handleError(error.data? error.data : null);
        },
      }
    );
  }
}
