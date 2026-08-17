import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityAnnex } from '../../../../shared/dtos/annexes_services.dtos';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { AnnexesServicesService } from '../../../../shared/services/annexes_services.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';

@Component({
  selector: 'app-add-annex-dialog',
  imports: [Button, TranslatePipe],
  templateUrl: './add-annex-dialog.html',
  styleUrl: './add-annex-dialog.css',
})
export class AddAnnexDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly store = inject(CommunityServicesStore);
  private readonly annexesService = inject(AnnexesServicesService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Derived live from the store, NOT passed in as dialog data.
   *
   * This used to be `signal(config.data?.available ?? [])` — a snapshot taken
   * once at open time and never written again. Opening the dialog before
   * `GET /annexes-services/` resolved therefore rendered the terminal
   * "everything is already activated" empty state on a community with nothing
   * activated, directly contradicting the page behind it, and it never recovered:
   * you had to close and reopen. A snapshot cannot distinguish "not yet known"
   * from "known to be empty", so the fix is to not hold one.
   *
   * Reading the store makes the list self-healing, but it does NOT by itself make
   * the empty state honest: an unresolved store and a fully-subscribed community
   * both render as `[]`. What makes the empty state trustworthy is the trigger
   * guard — `catalogueReady()` in `annexes-services-list.ts` — which refuses to
   * open this dialog until the catalogue has actually arrived, including when the
   * fetch failed.
   */
  readonly available = computed<CommunityAnnex[]>(() =>
    this.store.services().filter((service) => !service.subscribed),
  );
  readonly pendingFeature = signal<string | null>(null);

  add(service: CommunityAnnex): void {
    if (this.pendingFeature() !== null) {
      return;
    }
    this.pendingFeature.set(service.feature);
    this.annexesService
      .subscribe(service.subscribePath)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.openSnackBar(
            this.translate.instant('ANNEXES_SERVICES.DIALOG.SUBSCRIBE_SUCCESS') as string,
            VALIDATION_TYPE,
          );
          this.ref.close(true);
        },
        error: (error: unknown) => {
          this.errorHandler.handleError(error);
          this.pendingFeature.set(null);
        },
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
