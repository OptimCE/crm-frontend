import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import fr from '../../../../../assets/i18n/fr.json';
import { LiveEnrollmentToken } from '../../../../shared/dtos/live-data.dtos';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { DeviceTokenDialog } from './device-token-dialog';

const NNBSP = String.fromCharCode(0x202f);

describe('DeviceTokenDialog', () => {
  /** The real French strings: what is asserted is the sentence a manager reads. */
  function render(token: LiveEnrollmentToken): ComponentFixture<DeviceTokenDialog> {
    TestBed.configureTestingModule({
      imports: [DeviceTokenDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogConfig, useValue: { data: { token } } },
        { provide: DynamicDialogRef, useValue: { close: vi.fn() } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.setTranslation('en', en as unknown as TranslationObject);
    translate.use('fr');

    const fixture = TestBed.createComponent(DeviceTokenDialog);
    fixture.detectChanges();
    return fixture;
  }

  function expiry(fixture: ComponentFixture<DeviceTokenDialog>): string {
    const line = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="device-token-dialog__expires"]',
    );
    expect(line).not.toBeNull();
    return line?.textContent?.trim() ?? '';
  }

  // Built from local parts so the assertions hold in any timezone, then given
  // the six-digit fraction the service actually sends.
  const expiresAt = new Date(2026, 9, 3, 12, 25).toISOString().replace(/\.\d{3}Z$/, '.158030Z');

  const token: LiveEnrollmentToken = {
    token: 'ABCD-EFGH-JKLM',
    expires_at: expiresAt,
    qr_svg: 'data:image/svg+xml;base64,PHN2Zy8+',
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("writes the expiry the way the reader's language writes a date", () => {
    // BUG: `expires_at` went straight into the sentence, so the dialog read
    // "Valable jusqu'au 2026-10-03T10:25:04.158030Z".
    const fixture = render(token);

    expect(expiry(fixture)).toBe("Valable jusqu'au 03/10/2026 12:25");
    expect(expiry(fixture)).not.toMatch(/T\d{2}:\d{2}|Z$/);
  });

  it('rewrites the expiry when the reader switches language', () => {
    const fixture = render(token);

    TestBed.inject(TranslateService).use('en');
    fixture.detectChanges();

    expect(expiry(fixture)).toContain(`10/3/26, 12:25${NNBSP}PM`);
  });
});
