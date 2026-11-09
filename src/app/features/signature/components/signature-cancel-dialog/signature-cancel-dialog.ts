import { Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';

/**
 * « Annuler la demande »: a confirmation with an optional reason, shared by the
 * follow-up list and the request page. Responsive (full width on a phone).
 */
@Component({
  selector: 'app-signature-cancel-dialog',
  standalone: true,
  imports: [TranslatePipe, Button, Dialog, Textarea],
  template: `
    <p-dialog
      [header]="'SIGNATURE.CANCEL_DIALOG.TITLE' | translate"
      [modal]="true"
      [visible]="visible()"
      (visibleChange)="!$event && dismissed.emit()"
      [style]="{ width: '32rem' }"
      [breakpoints]="{ '640px': '100vw' }"
      styleClass="responsive-dialog"
      [draggable]="false"
      data-testid="signature-cancel-dialog"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm m-0">{{ 'SIGNATURE.CANCEL_DIALOG.MESSAGE' | translate }}</p>
        <label for="signature-cancel-reason" class="text-sm font-medium">{{
          'SIGNATURE.CANCEL_DIALOG.REASON' | translate
        }}</label>
        <textarea
          pTextarea
          id="signature-cancel-reason"
          rows="3"
          maxlength="1000"
          class="w-full"
          [value]="reason()"
          (input)="reason.set($any($event.target).value)"
          data-testid="signature-cancel-dialog__reason"
        ></textarea>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <p-button
            severity="secondary"
            [text]="true"
            [label]="'SIGNATURE.CANCEL_DIALOG.BACK' | translate"
            (onClick)="dismissed.emit()"
            data-testid="signature-cancel-dialog__button--back"
          />
          <p-button
            severity="danger"
            icon="pi pi-ban"
            [label]="'SIGNATURE.CANCEL_DIALOG.CONFIRM' | translate"
            [loading]="busy()"
            (onClick)="confirmed.emit(reason().trim() || null)"
            data-testid="signature-cancel-dialog__button--confirm"
          />
        </div>
      </div>
    </p-dialog>
  `,
})
export class SignatureCancelDialog {
  readonly visible = input(false);
  readonly busy = input(false);
  /** The reason, or null when none was given. */
  readonly confirmed = output<string | null>();
  readonly dismissed = output<void>();

  readonly reason = signal('');

  constructor() {
    // A fresh reason each time it opens.
    effect(() => {
      if (this.visible()) this.reason.set('');
    });
  }
}
