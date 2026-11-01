import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';

import {
  InboundAttachmentOut,
  InboundMailOut,
  InboundMailStatus,
  ProcedureDetailOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { downloadBlob } from '../../../../shared/utils/download.utils';

/** A choice in a select: a procedure to attach to, a piece to supply. */
export interface InboundChoice {
  id: number;
  label: string;
}

const SNIPPET_CHARS = 280;

/**
 * Mails the reception address received (phase 4): on a procedure's page, the
 * ones attached to it, to qualify (« Ajouter une réponse » from one, an
 * attachment as a piece); on the hub, the ones waiting for a manager (attach
 * an unmatched one to a procedure, discard). Every file downloads as it came.
 */
@Component({
  selector: 'app-inbound-mail-list',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, Button, Select, Tag, LocaleDatePipe],
  templateUrl: './inbound-mail-list.html',
})
export class InboundMailList {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly mails = input.required<InboundMailOut[]>();
  /** On a procedure's page: its id, to supply its pieces. */
  readonly dossierId = input<number | null>(null);
  /** The procedures an unmatched mail may be attached to (the hub). */
  readonly procedures = input<InboundChoice[]>([]);
  /** The pieces an attachment may supply (a procedure's page). */
  readonly pieces = input<InboundChoice[]>([]);

  readonly respond = output<InboundMailOut>();
  /** A mail attached or discarded: the host reloads its list. */
  readonly changed = output<void>();
  /** An attachment became a piece's version: the procedure as it now is. */
  readonly pieceSupplied = output<ProcedureDetailOut>();

  readonly busy = signal<number | null>(null);
  /** Per mail, the procedure picked to attach it to. */
  readonly attachTo: Record<number, number | null> = {};
  /** Per attachment, the piece picked to supply. */
  readonly pieceFor: Record<number, number | null> = {};

  protected readonly Status = InboundMailStatus;

  snippet(mail: InboundMailOut): string {
    const text = (mail.body_text ?? '').trim();
    return text.length > SNIPPET_CHARS ? `${text.slice(0, SNIPPET_CHARS)}…` : text;
  }

  download(mail: InboundMailOut, attachment: InboundAttachmentOut | null = null): void {
    this.service
      .downloadInbound(mail.id, attachment?.id ?? null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => downloadBlob(blob, filename),
        error: (error: unknown) => this.errorHandler.handleError(extractApiErrorMessage(error)),
      });
  }

  attach(mail: InboundMailOut): void {
    const target = this.attachTo[mail.id];
    if (!target) return;
    this.busy.set(mail.id);
    this.service
      .attachInboundMail(mail.id, target)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.changed.emit();
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  discard(mail: InboundMailOut): void {
    this.busy.set(mail.id);
    this.service
      .discardInboundMail(mail.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.changed.emit();
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  supply(mail: InboundMailOut, attachment: InboundAttachmentOut): void {
    const dossier = this.dossierId();
    const piece = this.pieceFor[attachment.id];
    if (!dossier || !piece) return;
    this.busy.set(mail.id);
    this.service
      .pieceFromInbound(dossier, piece, mail.id, attachment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.busy.set(null);
          this.pieceFor[attachment.id] = null;
          if (response.data) this.pieceSupplied.emit(response.data);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(error: unknown): void {
    this.busy.set(null);
    this.errorHandler.handleError(extractApiErrorMessage(error));
  }
}
