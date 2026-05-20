import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { AnnexesServicesService } from '../../../../shared/services/annexes_services.service';
import { CommunityAnnex } from '../../../../shared/dtos/annexes_services.dtos';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { AddAnnexDialog } from '../add-annex-dialog/add-annex-dialog';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';

@Component({
  selector: 'app-annexes-services-list',
  imports: [Button, Tag, Toast, Tooltip, ConfirmDialog, TranslatePipe, HeaderPage],
  templateUrl: './annexes-services-list.html',
  styleUrl: './annexes-services-list.css',
  providers: [DialogService, MessageService, ConfirmationService, ErrorMessageHandler],
})
export class AnnexesServicesList implements OnInit {
  protected readonly Role = Role;
  protected readonly userContextService = inject(UserContextService);

  private readonly annexesService = inject(AnnexesServicesService);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private dialogRef?: DynamicDialogRef | null;

  readonly services = signal<CommunityAnnex[]>([]);
  readonly loading = signal<boolean>(true);
  readonly pendingUnsubscribe = signal<string | null>(null);
  readonly subscribedServices = computed(() => this.services().filter((s) => s.subscribed));
  readonly availableToAdd = computed(() => this.services().filter((s) => !s.subscribed));
  readonly canManage = computed(() =>
    this.userContextService.compareWithActiveRole(Role.GESTIONNAIRE),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.destroy());
  }

  ngOnInit(): void {
    this.loadServices();
  }

  loadServices(): void {
    this.loading.set(true);
    this.annexesService
      .getCommunityServices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.services.set(response.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            detail: this.translate.instant('ANNEXES_SERVICES.ERROR_LOADING') as string,
          });
        },
      });
  }

  openModule(service: CommunityAnnex): void {
    void this.router.navigateByUrl(service.frontendRoute);
  }

  openAddDialog(): void {
    this.dialogRef = this.dialogService.open(AddAnnexDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('ANNEXES_SERVICES.DIALOG.TITLE') as string,
      data: { available: this.availableToAdd() },
    });
    this.dialogRef?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((added: boolean) => {
        if (added) {
          this.loadServices();
        }
      });
  }

  unsubscribe(service: CommunityAnnex, event: MouseEvent): void {
    event.stopPropagation();
    if (this.pendingUnsubscribe() !== null) {
      return;
    }
    const name = this.translate.instant(service.displayKey) as string;
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      header: this.translate.instant('ANNEXES_SERVICES.UNSUBSCRIBE_CONFIRM_HEADER') as string,
      message: this.translate.instant('ANNEXES_SERVICES.UNSUBSCRIBE_CONFIRM', { name }) as string,
      acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
      rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.pendingUnsubscribe.set(service.feature);
        this.annexesService
          .unsubscribe(service.unsubscribePath)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.openSnackBar(
                this.translate.instant('ANNEXES_SERVICES.UNSUBSCRIBE_SUCCESS') as string,
                VALIDATION_TYPE,
              );
              this.pendingUnsubscribe.set(null);
              this.loadServices();
            },
            error: (error: unknown) => {
              this.errorHandler.handleError(error);
              this.pendingUnsubscribe.set(null);
            },
          });
      },
    });
  }
}
