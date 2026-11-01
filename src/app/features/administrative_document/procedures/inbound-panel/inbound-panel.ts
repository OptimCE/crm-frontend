import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { debounceTime } from 'rxjs';

import { Role } from '../../../../core/dtos/role';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import {
  REALTIME_RECONNECTED,
  REALTIME_TOPICS,
} from '../../../../core/services/realtime/realtime.types';
import {
  InboundAddressOut,
  InboundMailOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { InboundChoice, InboundMailList } from '../inbound-mail-list/inbound-mail-list';

/**
 * The hub's reception address (phase 4): the community's address to forward
 * the GRD's and the CWaPE's answers to (an admin may change it), and what it
 * received that waits for a manager. Nothing shows on an instance without one.
 */
@Component({
  selector: 'app-inbound-panel',
  standalone: true,
  imports: [TranslatePipe, Button, InboundMailList],
  templateUrl: './inbound-panel.html',
})
export class InboundPanel implements OnInit {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly userContext = inject(UserContextService);
  private readonly realtime = inject(RealtimeService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly translate = inject(TranslateService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  /** The open procedures an unmatched mail may be attached to. */
  readonly procedures = input<InboundChoice[]>([]);

  readonly address = signal<InboundAddressOut | null>(null);
  readonly mails = signal<InboundMailOut[]>([]);
  readonly rotating = signal(false);

  canRotate(): boolean {
    return this.userContext.compareWithActiveRole(Role.ADMIN);
  }

  ngOnInit(): void {
    this.service
      .getInboundAddress()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.address.set(res.data ?? null);
          if (res.data?.enabled) this.loadMails();
        },
        error: () => this.address.set(null),
      });
    this.realtime
      .on(REALTIME_TOPICS.ADMIN_DOSSIER_UPDATED, REALTIME_RECONNECTED)
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.address()?.enabled) this.loadMails();
      });
  }

  loadMails(): void {
    this.service
      .getInboundMail('open')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.mails.set(Array.isArray(res.data) ? res.data : []),
        error: () => this.mails.set([]),
      });
  }

  copy(): void {
    const address = this.address()?.address;
    if (!address) return;
    void navigator.clipboard
      ?.writeText(address)
      .then(() =>
        this.snackbar.openSnackBar(
          this.translate.instant('ADMINISTRATIVE_DOCUMENT.INBOUND.COPIED') as string,
          VALIDATION_TYPE,
        ),
      );
  }

  rotate(): void {
    this.rotating.set(true);
    this.service
      .rotateInboundAddress()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rotating.set(false);
          this.address.set(res.data ?? null);
        },
        error: (error: unknown) => {
          this.rotating.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }
}
