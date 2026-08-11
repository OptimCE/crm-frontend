import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { TemplateOut } from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { docTypeLabelKey, extractApiErrorMessage } from '../../administrative-document-format';

interface DocumentCreateDialogData {
  dossierId: number;
}

interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-document-create-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Button, InputText, Select],
  templateUrl: './document-create-dialog.html',
  providers: [ErrorMessageHandler],
})
export class DocumentCreateDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<DocumentCreateDialogData>);
  private readonly service = inject(AdministrativeDocumentService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialogData = this.config.data as DocumentCreateDialogData | undefined;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly loadingTypes = signal<boolean>(true);
  readonly typeOptions = signal<SelectOption[]>([]);

  readonly form = new FormGroup({
    doc_type: new FormControl<string | null>(null),
    title: new FormControl<string>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadDocumentTypes();
  }

  /**
   * The choices come from the template registry, so adding a template row adds
   * a document type with no frontend change. Only templates still in force
   * (valid_to === null) are offered.
   */
  private loadDocumentTypes(): void {
    this.service
      .listTemplates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const templates = Array.isArray(res.data) ? res.data : [];
          const seen = new Set<string>();
          const options: SelectOption[] = [];
          for (const template of templates.filter((t: TemplateOut) => t.valid_to === null)) {
            if (seen.has(template.doc_type)) continue;
            seen.add(template.doc_type);
            const key = docTypeLabelKey(template.doc_type);
            const translated = this.translate.instant(key) as string;
            options.push({
              // An unseeded type has no i18n key: fall back to the registry's
              // own label before falling back to the raw value.
              label: translated !== key ? translated : (template.label ?? template.doc_type),
              value: template.doc_type,
            });
          }
          this.typeOptions.set(options);
          this.loadingTypes.set(false);
        },
        error: () => {
          this.typeOptions.set([]);
          this.loadingTypes.set(false);
        },
      });
  }

  submit(): void {
    this.formError.set(null);
    const raw = this.form.getRawValue();
    const docType = raw.doc_type?.trim();

    if (!docType) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOCUMENT.ERRORS.TYPE_REQUIRED',
        ) as string,
      );
      return;
    }
    if (!this.dialogData) return;

    this.submitting.set(true);
    this.service
      .createDocument(this.dialogData.dossierId, {
        doc_type: docType,
        title: raw.title.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOCUMENT.SUCCESS',
            ) as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
