import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import {
  DocumentOut,
  DossierDetailOut,
  DossierStatus,
  SharingOperationOut,
  StatusEventOut,
  SubjectType,
} from '../../../../shared/dtos/administrative-document.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import {
  TagSeverity,
  dossierStatusLabelKey,
  dossierStatusSeverity,
  dossierTypeLabelKey,
  extractApiErrorMessage,
  regionLabelKey,
} from '../../administrative-document-format';
import {
  allowedTargets,
  isCorrective,
  isTerminal,
  transitionFields,
} from '../../administrative-document-transitions';
import { DossierDeadlinesPanel } from '../dossier-deadlines-panel/dossier-deadlines-panel';
import { DossierDocumentsPanel } from '../dossier-documents-panel/dossier-documents-panel';
import { DossierEditDialog } from '../dossier-edit-dialog/dossier-edit-dialog';
import { DossierTimeline } from '../dossier-timeline/dossier-timeline';
import { TransitionDialog, TransitionDialogData } from '../transition-dialog/transition-dialog';

@Component({
  selector: 'app-dossier-detail',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    Button,
    Tag,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    ConfirmDialog,
    BackArrow,
    DatePipe,
    DossierDocumentsPanel,
    DossierDeadlinesPanel,
    DossierTimeline,
  ],
  templateUrl: './dossier-detail.html',
  providers: [DialogService, ConfirmationService, ErrorMessageHandler],
})
export class DossierDetail implements OnInit {
  private readonly service = inject(AdministrativeDocumentService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly confirmation = inject(ConfirmationService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  private dialogRef?: DynamicDialogRef | null;

  /** Router param, bound by withComponentInputBinding() — always a string. */
  readonly id = input.required<string>();

  readonly dossier = signal<DossierDetailOut | null>(null);
  readonly timeline = signal<StatusEventOut[]>([]);
  readonly loading = signal<boolean>(true);
  readonly timelineLoading = signal<boolean>(true);
  readonly busy = signal<boolean>(false);

  private readonly operations = signal<SharingOperationOut[]>([]);

  private readonly dossierId = computed(() => Number(this.id()));

  /** The sharing operation this dossier belongs to. `id_sharing_operation` is NOT NULL. */
  readonly operationId = computed(() => this.dossier()?.id_sharing_operation ?? null);

  /**
   * Derived rather than assigned, and that is a bug fix.
   *
   * The previous version set this inside the `listSharingOperations()` subscribe,
   * reading `dossier()` there. That call is a `cachedGet` and the hub primes the
   * key before navigating here, so it emits SYNCHRONOUSLY — while `dossier()` is
   * still null. The name resolved to an empty string on the normal path in.
   * A computed simply recomputes when either input lands.
   */
  readonly operationName = computed(() => {
    const id = this.operationId();
    if (id === null) return '';
    return this.operations().find((op) => op.id === id)?.name ?? `#${id}`;
  });

  readonly documentsById = computed<ReadonlyMap<number, DocumentOut>>(
    () => new Map((this.dossier()?.documents ?? []).map((doc) => [doc.id, doc])),
  );

  /** Only the statuses this dossier can legally move to. */
  readonly targets = computed<readonly number[]>(() => {
    const dossier = this.dossier();
    return dossier ? allowedTargets(SubjectType.DOSSIER, dossier.status) : [];
  });

  readonly isTerminalDossier = computed(() => {
    const dossier = this.dossier();
    return dossier !== null && isTerminal(SubjectType.DOSSIER, dossier.status);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  ngOnInit(): void {
    this.load();
    this.loadOperations();
  }

  private load(): void {
    this.loading.set(true);
    this.timelineLoading.set(true);

    this.service
      .getDossier(this.dossierId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.dossier.set(res.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });

    this.service
      .getDossierTimeline(this.dossierId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.timeline.set(Array.isArray(res.data) ? res.data : []);
          this.timelineLoading.set(false);
        },
        error: () => this.timelineLoading.set(false),
      });
  }

  private loadOperations(): void {
    this.service
      .listSharingOperations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.operations.set(Array.isArray(res.data) ? res.data : []),
        // The name falls back to `#{id}`, so a failure here still leaves a
        // usable link rather than a blank field.
        error: () => this.operations.set([]),
      });
  }

  /** A transition rewrites status, deadlines and the journal at once. */
  refresh(): void {
    this.service.invalidate();
    this.load();
    this.loadOperations();
  }

  // ---- transitions -------------------------------------------------------

  targetLabelKey(target: number): string {
    return dossierStatusLabelKey(target as DossierStatus);
  }

  isCorrectiveTarget(target: number): boolean {
    const dossier = this.dossier();
    return dossier !== null && isCorrective(SubjectType.DOSSIER, dossier.status, target);
  }

  targetIcon(target: number): string {
    return this.isCorrectiveTarget(target) ? 'pi pi-undo' : 'pi pi-arrow-right';
  }

  targetSeverity(target: number): 'warn' | 'primary' {
    return this.isCorrectiveTarget(target) ? 'warn' : 'primary';
  }

  transition(target: number): void {
    const dossier = this.dossier();
    if (!dossier) return;

    const fields = transitionFields(SubjectType.DOSSIER, dossier.status, target);
    if (fields.length === 0) {
      this.confirmSimpleTransition(dossier, target);
      return;
    }

    const data: TransitionDialogData = {
      subject: SubjectType.DOSSIER,
      subjectId: dossier.id,
      fromStatus: dossier.status,
      toStatus: target,
      subjectLabel:
        dossier.title ??
        (this.translate.instant(dossierTypeLabelKey(dossier.dossier_type)) as string),
    };
    this.dialogRef = this.dialogService.open(TransitionDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '34rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.TRANSITION.HEADER') as string,
      data,
    });
    this.afterDialog();
  }

  private confirmSimpleTransition(dossier: DossierDetailOut, target: number): void {
    this.confirmation.confirm({
      header: this.translate.instant('ADMINISTRATIVE_DOCUMENT.DOCUMENTS.CONFIRM_HEADER') as string,
      message: this.translate.instant('ADMINISTRATIVE_DOCUMENT.DOCUMENTS.CONFIRM_MESSAGE', {
        status: this.translate.instant(this.targetLabelKey(target)) as string,
      }) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      accept: () => {
        this.busy.set(true);
        this.service
          .transitionDossier(dossier.id, { to_status: target, context: {} })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.busy.set(false);
              this.snackbar.openSnackBar(
                this.translate.instant(
                  'ADMINISTRATIVE_DOCUMENT.DOCUMENTS.STATUS_CHANGED',
                ) as string,
                VALIDATION_TYPE,
              );
              this.refresh();
            },
            error: (error: unknown) => {
              this.busy.set(false);
              this.errorHandler.handleError(extractApiErrorMessage(error));
            },
          });
      },
    });
  }

  openEdit(): void {
    const dossier = this.dossier();
    if (!dossier) return;
    this.dialogRef = this.dialogService.open(DossierEditDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '32rem',
      styleClass: 'responsive-dialog',
      header: this.translate.instant(
        'ADMINISTRATIVE_DOCUMENT.DIALOGS.EDIT_DOSSIER.TITLE',
      ) as string,
      data: { dossier, operationName: this.operationName() },
    });
    this.afterDialog();
  }

  private afterDialog(): void {
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changed: boolean) => {
        if (changed) this.refresh();
      });
  }

  // ---- presentation helpers ----------------------------------------------

  typeLabelKey(dossier: DossierDetailOut): string {
    return dossierTypeLabelKey(dossier.dossier_type);
  }

  statusLabelKey(dossier: DossierDetailOut): string {
    return dossierStatusLabelKey(dossier.status);
  }

  statusSeverity(dossier: DossierDetailOut): TagSeverity {
    return dossierStatusSeverity(dossier.status);
  }

  regionKey(dossier: DossierDetailOut): string {
    return regionLabelKey(dossier.region);
  }

  dossierLabel(): string {
    const dossier = this.dossier();
    if (!dossier) return '';
    return dossier.title ?? (this.translate.instant(this.typeLabelKey(dossier)) as string);
  }
}
