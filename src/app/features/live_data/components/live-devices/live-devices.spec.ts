import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { environments } from '../../../../../environments/environments';
import { LiveEnrollmentToken } from '../../../../shared/dtos/live-data.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { DeviceCreateDialog } from '../device-create-dialog/device-create-dialog';
import { DeviceTokenDialog } from '../device-token-dialog/device-token-dialog';
import { LiveDevices } from './live-devices';

const base = `${environments.apiUrl}/live`;

function device(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    indicative: true,
    device_id: id,
    name: `Device ${id}`,
    type: 1,
    status: 2,
    ean: '541448800000000001',
    health: 'ok',
    hint: 'LIVE.HINT.OK',
    online: true,
    last_seen_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

describe('LiveDevices', () => {
  let httpMock: HttpTestingController;

  /** The real French strings: what is asserted is the sentence a manager reads. */
  function render(devices: Record<string, unknown>[]): ComponentFixture<LiveDevices> {
    TestBed.configureTestingModule({
      imports: [LiveDevices, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    });
    // The component PROVIDES these three itself, so a TestBed-level mock would
    // never reach it; the error handler is the one with dependencies to fake.
    TestBed.overrideComponent(LiveDevices, {
      set: {
        providers: [
          DialogService,
          ConfirmationService,
          { provide: ErrorMessageHandler, useValue: { handleError: vi.fn() } },
        ],
      },
    });
    const translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');
    httpMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(LiveDevices);
    fixture.detectChanges();
    httpMock.expectOne(`${base}/ops/health`).flush({
      data: {
        indicative: true,
        n_devices: devices.length,
        by_health: {},
        rollup_freshness: 'fresh',
        dead_letters_24h: 0,
        n_devices_readings_rejected_24h: 0,
        devices,
      },
      error_code: 0,
    });
    fixture.detectChanges();
    return fixture;
  }

  function row(fixture: ComponentFixture<LiveDevices>, id: string): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector(
      `[data-testid="live-devices__row--${id}"]`,
    );
    expect(found, `row ${id}`).not.toBeNull();
    return found as HTMLElement;
  }

  function inRow(fixture: ComponentFixture<LiveDevices>, id: string, testId: string) {
    return row(fixture, id).querySelector(`[data-testid="${testId}"]`);
  }

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  describe('rejected readings', () => {
    it('shows the last rejection, translated, with when it happened', () => {
      // BUG: `last_reject_reason` and `last_reject_at` were in the payload and
      // rendered nowhere. A rejected READING leaves no dead letter, so this is
      // the only place a clipped sunny peak can be seen at all.
      const fixture = render([
        device('clipped', {
          last_reject_reason: 'implausible_production',
          last_reject_at: hoursAgo(1),
        }),
      ]);

      const line = inRow(fixture, 'clipped', 'live-devices__reject');
      expect(line).not.toBeNull();
      expect(line?.textContent).toContain('Production invraisemblable');
      expect(line?.textContent).toContain('il y a 1 heure');
      expect(line?.textContent).not.toContain('implausible_production');
    });

    it('explains the most likely cause of implausible production', () => {
      // Production above the declared kVA, or during the night window. A kVA
      // that does not match the inverter clips exactly the sunny peaks, and the
      // curve then just looks overcast.
      const fixture = render([
        device('clipped', {
          last_reject_reason: 'implausible_production',
          last_reject_at: hoursAgo(1),
        }),
      ]);

      const hint = inRow(fixture, 'clipped', 'live-devices__reject-hint');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('kVA');
    });

    it('shows no time for a consumption device, whose timestamps are withheld', () => {
      const fixture = render([
        device('home', {
          type: 2,
          last_seen_at: undefined,
          last_reject_reason: 'ts_not_aligned',
        }),
      ]);

      const line = inRow(fixture, 'home', 'live-devices__reject');
      expect(line).not.toBeNull();
      expect(line?.textContent).not.toContain('il y a');
    });

    it('still names a reason this build does not know, rather than hiding it', () => {
      // The worker is deployed separately; a reason added there tomorrow must not
      // vanish here, nor print as if it were a sentence.
      const fixture = render([
        device('future', {
          last_reject_reason: 'a_reason_from_the_future',
          last_reject_at: hoursAgo(2),
        }),
      ]);

      const line = inRow(fixture, 'future', 'live-devices__reject');
      expect(line?.textContent).toContain('a_reason_from_the_future');
    });

    it('shows nothing for a device that has never had anything rejected', () => {
      const fixture = render([device('clean')]);

      expect(inRow(fixture, 'clean', 'live-devices__reject')).toBeNull();
    });
  });

  describe('last seen', () => {
    it("is written the way the reader's language writes a date", () => {
      // BUG: `| date: 'short'` formatted with Angular's LOCALE_ID, which nothing
      // set, so a French manager read "9/29/26, 2:30 PM" - month first, a
      // two-digit year and an AM/PM clock, on an otherwise French page.
      // Built from local parts so the assertion holds in any timezone.
      const seen = new Date(2026, 8, 29, 14, 30);
      const fixture = render([device('seen', { last_seen_at: seen.toISOString() })]);

      const text = row(fixture, 'seen').textContent ?? '';
      expect(text).toContain('29/09/2026 14:30');
      expect(text).not.toContain('PM');
    });
  });

  describe('a revoked device', () => {
    it('is listed without an attention hint or a second "revoked" tag', () => {
      // BUG: classified from its last report alone, a revoked device read silent a
      // day later and carried the "check power and network" hint for ever.
      const fixture = render([
        device('gone', { status: 3, health: 'revoked', hint: 'LIVE.HINT.REVOKED' }),
      ]);

      expect(inRow(fixture, 'gone', 'live-devices__hint--revoked')).toBeNull();
      expect(inRow(fixture, 'gone', 'live-devices__tag--health')).toBeNull();
      expect(inRow(fixture, 'gone', 'live-devices__tag--status')).not.toBeNull();
    });
  });

  describe('closing the creation dialog', () => {
    /** Opens it through the component's own DialogService, spied, and hands back its close channel. */
    function openCreate(fixture: ComponentFixture<LiveDevices>) {
      const dialogs = fixture.debugElement.injector.get(DialogService);
      const onClose = new Subject<unknown>();
      const open = vi
        .spyOn(dialogs, 'open')
        .mockReturnValue({ onClose, destroy: vi.fn() } as unknown as DynamicDialogRef);
      fixture.componentInstance.openCreate();
      return { open, onClose };
    }

    /** The TestBed-level `useValue`, typed as the plain mock it is (not a bound method). */
    function snackbarMock(): { openSnackBar: ReturnType<typeof vi.fn> } {
      return TestBed.inject(SnackbarNotification) as unknown as {
        openSnackBar: ReturnType<typeof vi.fn>;
      };
    }

    function flushReload(): void {
      httpMock.expectOne(`${base}/ops/health`).flush({
        data: { indicative: true, n_devices: 0, by_health: {}, devices: [] },
        error_code: 0,
      });
    }

    it('reloads the list, without the toast or a token dialog, when the device exists but its code failed', () => {
      // BUG: the dialog closed with `false` here, which reads as a cancel - no
      // reload, so the new device stayed invisible while the meter picker
      // already greyed its meter out. The dialog has shown the error itself.
      const fixture = render([]);
      const snackbar = snackbarMock();
      const { open, onClose } = openCreate(fixture);

      onClose.next(true);

      flushReload();
      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(DeviceCreateDialog, expect.anything());
      expect(snackbar.openSnackBar).not.toHaveBeenCalled();
    });

    it('reloads, says so, and shows the one-time code straight away', () => {
      const fixture = render([]);
      const snackbar = snackbarMock();
      const { open, onClose } = openCreate(fixture);
      const token = { token: 'ABCD-EFGH' } as unknown as LiveEnrollmentToken;

      onClose.next(token);

      flushReload();
      expect(snackbar.openSnackBar).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledTimes(2);
      expect(open).toHaveBeenLastCalledWith(
        DeviceTokenDialog,
        expect.objectContaining({ data: { token } }),
      );
    });

    it('does nothing on a cancel', () => {
      const fixture = render([]);
      const snackbar = snackbarMock();
      const { open, onClose } = openCreate(fixture);

      onClose.next(false);

      httpMock.expectNone(`${base}/ops/health`);
      expect(open).toHaveBeenCalledTimes(1);
      expect(snackbar.openSnackBar).not.toHaveBeenCalled();
    });
  });
});
