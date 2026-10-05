import { Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Message } from 'primeng/message';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LiveEnrollmentToken } from '../../../../shared/dtos/live-data.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';

interface TokenDialogData {
  token: LiveEnrollmentToken;
}

/**
 * The enrolment code, shown once.
 *
 * ---------------------------------------------------------------------------
 * THE QR IS RENDERED SERVER-SIDE AND THERE IS NO QR LIBRARY IN THIS PROJECT.
 *
 * `qr_svg` arrives as an inline SVG data URI from the backend. That is not a
 * convenience: a URL that carries a credential lands in nginx's and KrakenD's
 * access logs, so the alternative — a second endpoint returning the image —
 * would write every enrolment code to disk in two places.
 *
 * `bypassSecurityTrustUrl` is required because Angular strips a `data:` URL
 * bound to `[src]`. It is safe HERE and would not be in general: the value comes
 * from this platform's own API over the authenticated leg, has just been
 * produced by `segno` from a token this same response minted, and is never
 * user-supplied.
 * ---------------------------------------------------------------------------
 *
 * There is no "regenerate" button on this dialog. Issuing a new code invalidates
 * this one, and putting that next to a code someone is mid-way through typing
 * into a device is how an installer invalidates the code they are using.
 */
@Component({
  selector: 'app-device-token-dialog',
  standalone: true,
  imports: [TranslatePipe, Button, Message, LocaleDatePipe],
  templateUrl: './device-token-dialog.html',
})
export class DeviceTokenDialog {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<TokenDialogData>);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);

  readonly token: LiveEnrollmentToken | undefined = (
    this.config.data as TokenDialogData | undefined
  )?.token;

  readonly copied = signal<boolean>(false);

  readonly qr: SafeUrl | null = this.token
    ? this.sanitizer.bypassSecurityTrustUrl(this.token.qr_svg)
    : null;

  copy(): void {
    if (!this.token) return;
    // `navigator.clipboard` is absent over plain HTTP and in some embedded
    // browsers. The code is on screen and readable either way, so a failure here
    // is not worth an error toast — it just does not confirm.
    void navigator.clipboard
      ?.writeText(this.token.token)
      .then(() => {
        this.copied.set(true);
        this.snackbar.openSnackBar(
          this.translate.instant('LIVE_DATA.TOKEN.COPIED') as string,
          VALIDATION_TYPE,
        );
      })
      .catch(() => {
        /* clipboard unavailable — the code is still displayed */
      });
  }

  close(): void {
    this.ref.close(false);
  }
}
