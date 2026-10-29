import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Select } from 'primeng/select';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { SharingOperationOut } from '../../../../shared/dtos/administrative-document.dtos';
import { ProcedureDefinitionOut } from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
  toApiDate,
} from '../../administrative-document-format';
import { pickLabel } from '../../procedures/procedure-format';

interface DossierCreateDialogData {
  operations: SharingOperationOut[];
}

interface SelectOption<T> {
  label: string;
  value: T;
}

/** Refusals about this choice: shown in the dialog. */
const INLINE_ERRORS: ReadonlySet<number> = new Set([
  2307, // SHARING_OPERATION_NOT_FOUND
  2376, // UNKNOWN_PROCEDURE_TYPE
  2377, // DRAFT_EXISTS: one open draft per family and operation
]);

/**
 * A procedure opened by hand from the regulator's catalogue: an end of
 * sharing, or one the CRM does not trigger yet. The types are the catalogue's
 * own (`GET /admin/procedure-definitions`), filings in force only, labelled in
 * the reader's language: a new type needs no frontend change.
 *
 * Closes with the new procedure's id, so the caller can open it.
 */
@Component({
  selector: 'app-dossier-create-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Button, DatePicker, Select],
  templateUrl: './dossier-create-dialog.html',
  providers: [ErrorMessageHandler],
})
export class DossierCreateDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<DossierCreateDialogData>);
  private readonly service = inject(AdministrativeProcedureService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LocaleService).locale();

  private readonly dialogData = this.config.data as DossierCreateDialogData | undefined;

  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly operations = signal<SharingOperationOut[]>(this.dialogData?.operations ?? []);
  readonly definitions = signal<ProcedureDefinitionOut[]>([]);
  readonly code = signal<string | null>(null);

  operation: number | null = null;
  requestedEffect: Date | null = null;

  readonly operationOptions = computed<SelectOption<number>[]>(() =>
    this.operations().map((op) => ({ label: op.name, value: op.id })),
  );
  /** One entry per type: the version in force. The starting state is not filed by hand. */
  readonly typeOptions = computed<SelectOption<string>[]>(() =>
    this.definitions()
      .filter((d) => d.in_force && d.purpose === 'filing')
      .map((d) => ({ value: d.code, label: pickLabel(d.labels, this.lang, d.code) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );
  readonly selected = computed(() =>
    this.definitions().find((d) => d.in_force && d.code === this.code()),
  );
  readonly needsOperation = computed(() => this.selected()?.scope === 'operation');
  readonly hasNoOperations = computed(
    () => this.needsOperation() && this.operations().length === 0,
  );

  ngOnInit(): void {
    this.service
      .listDefinitions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.definitions.set(Array.isArray(res.data) ? res.data : []),
        error: (error: unknown) => this.errorHandler.handleError(extractApiErrorMessage(error)),
      });
  }

  submit(): void {
    this.formError.set(null);
    const code = this.code();
    if (!code) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOSSIER.ERRORS.TYPE_REQUIRED',
        ) as string,
      );
      return;
    }
    if (this.needsOperation() && this.operation == null) {
      this.formError.set(
        this.translate.instant(
          'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOSSIER.ERRORS.OPERATION_REQUIRED',
        ) as string,
      );
      return;
    }

    this.submitting.set(true);
    this.service
      .createProcedure({
        code,
        id_sharing_operation: this.needsOperation() ? this.operation : null,
        requested_effective_date: toApiDate(this.requestedEffect),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.snackbar.openSnackBar(
            this.translate.instant(
              'ADMINISTRATIVE_DOCUMENT.DIALOGS.CREATE_DOSSIER.SUCCESS',
            ) as string,
            VALIDATION_TYPE,
          );
          this.ref.close(res.data.id);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const errorCode = extractApiErrorCode(error);
          if (errorCode !== null && INLINE_ERRORS.has(errorCode)) {
            this.formError.set(extractApiErrorMessage(error));
            return;
          }
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  close(): void {
    this.ref.close(null);
  }
}
