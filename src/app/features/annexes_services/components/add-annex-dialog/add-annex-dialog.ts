import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityAnnex } from '../../../../shared/dtos/annexes_services.dtos';
import { AnnexesServicesService } from '../../../../shared/services/annexes_services.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';

interface AddAnnexDialogData {
  available: CommunityAnnex[];
}

@Component({
  selector: 'app-add-annex-dialog',
  imports: [Button, TranslatePipe],
  templateUrl: './add-annex-dialog.html',
  styleUrl: './add-annex-dialog.css',
})
export class AddAnnexDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<AddAnnexDialogData>);
  private readonly annexesService = inject(AnnexesServicesService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  available = signal<CommunityAnnex[]>(
    (this.config.data as AddAnnexDialogData | undefined)?.available ?? [],
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
