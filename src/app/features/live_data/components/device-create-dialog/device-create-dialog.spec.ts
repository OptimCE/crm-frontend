import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { Select } from 'primeng/select';
import { EMPTY, Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import {
  LiveDevice,
  LiveDeviceStatus,
  LiveDeviceType,
  LiveEnrollmentToken,
} from '../../../../shared/dtos/live-data.dtos';
import { PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { LiveDataService } from '../../../../shared/services/live-data.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { MemberStatus, MemberType } from '../../../../shared/types/member.types';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { DeviceCreateDialog } from './device-create-dialog';

/**
 * Service mocks rather than `HttpTestingController`: `cachedGet` retries with
 * timers, and what is under test here is the dialog's reaction to each outcome,
 * not the transport. The French strings are the real ones - what is asserted is
 * the sentence a manager reads.
 */
describe('DeviceCreateDialog', () => {
  // The seeded wind meters of crm-backend/tests/sql/init.sql.
  const W1 = '541448200000000001';
  const W2 = '541448200000000002';
  const W3 = '541448200000000003';

  let ref: { close: ReturnType<typeof vi.fn> };
  let meterService: { getMetersList: ReturnType<typeof vi.fn> };
  let liveData: {
    listDevices: ReturnType<typeof vi.fn>;
    createDevice: ReturnType<typeof vi.fn>;
    issueToken: ReturnType<typeof vi.fn>;
  };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  function meter(EAN: string, holder?: string): PartialMeterDTO {
    return {
      EAN,
      meter_number: `M-${EAN.slice(-2)}`,
      status: MeterDataStatus.ACTIVE,
      address: { id: 5, street: 'Wind Alley', number: '10', postcode: '1000', city: 'Brussels' },
      ...(holder
        ? {
            holder: {
              id: 4,
              name: holder,
              member_type: MemberType.INDIVIDUAL,
              status: MemberStatus.ACTIVE,
            },
          }
        : {}),
    };
  }

  function page(
    data: PartialMeterDTO[] | string,
    total = Array.isArray(data) ? data.length : 0,
  ): ApiResponsePaginated<PartialMeterDTO[] | string> {
    return new ApiResponsePaginated(data, new Pagination(1, 500, total, 1));
  }

  function device(ean: string, status: LiveDeviceStatus): LiveDevice {
    return {
      indicative: true,
      device_id: `dev-${ean.slice(-2)}`,
      name: 'Onduleur',
      type: LiveDeviceType.PRODUCTION,
      status,
      ean,
      pure_injection: false,
      created_at: '2026-10-01T08:00:00Z',
    };
  }

  function devicesOf(...rows: LiveDevice[]): Observable<ApiResponse<LiveDevice[]>> {
    return of(new ApiResponse(rows));
  }

  function render(
    meters$: Observable<unknown>,
    devices$: Observable<unknown> = devicesOf(),
  ): ComponentFixture<DeviceCreateDialog> {
    ref = { close: vi.fn() };
    meterService = { getMetersList: vi.fn().mockReturnValue(meters$) };
    liveData = {
      listDevices: vi.fn().mockReturnValue(devices$),
      createDevice: vi.fn(),
      issueToken: vi.fn(),
    };
    errorHandler = { handleError: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DeviceCreateDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: ref },
        { provide: MeterService, useValue: meterService },
        { provide: LiveDataService, useValue: liveData },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');

    const fixture = TestBed.createComponent(DeviceCreateDialog);
    fixture.detectChanges();
    return fixture;
  }

  function byTestId(fixture: ComponentFixture<DeviceCreateDialog>, id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  function textOf(fixture: ComponentFixture<DeviceCreateDialog>, id: string): string | null {
    return byTestId(fixture, id)?.textContent?.trim() ?? null;
  }

  /** Set by the one test that opens the overlay; undone AFTER the overlay is destroyed. */
  let restoreMatchMedia: (() => void) | null = null;

  /**
   * jsdom has no `matchMedia`, and PrimeNG's overlay calls it to decide between
   * its modal and dropdown modes - when it opens AND when it is destroyed.
   */
  function stubMatchMedia(): void {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
    restoreMatchMedia = () => {
      window.matchMedia = original;
    };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    // The overlay is appended to <body>, outside the fixture.
    document.body.querySelectorAll('.p-select-overlay').forEach((node) => node.remove());
    restoreMatchMedia?.();
    restoreMatchMedia = null;
  });

  it('asks for every active meter in one page, and for a fresh device list', () => {
    render(of(page([meter(W1)])));

    // The backend default limit is 10: without an explicit one, an eleventh
    // meter would silently never be offered.
    expect(meterService.getMetersList).toHaveBeenCalledTimes(1);
    expect(meterService.getMetersList).toHaveBeenCalledWith({
      page: 1,
      limit: 500,
      status: MeterDataStatus.ACTIVE,
    });
    // `fresh`: a device another manager revoked would otherwise keep its meter
    // greyed out for the cache's five minutes.
    expect(liveData.listDevices).toHaveBeenCalledTimes(1);
    expect(liveData.listDevices).toHaveBeenCalledWith({ fresh: true });
  });

  it('keeps the select disabled until the meters arrive', () => {
    const meters$ = new Subject<ApiResponsePaginated<PartialMeterDTO[] | string>>();
    const fixture = render(meters$);
    const component = fixture.componentInstance;

    expect(component.metersLoading()).toBe(true);
    expect(component.form.controls.ean.disabled).toBe(true);
    // The e2e scenarios wait on exactly this class: a click on a disabled host
    // is silently ignored.
    expect(byTestId(fixture, 'device-create-dialog__select--ean')?.classList).toContain(
      'p-disabled',
    );
    expect(byTestId(fixture, 'device-create-dialog__ean-hint')).toBeNull();

    meters$.next(page([meter(W1, 'Wind Producer Alpha')]));
    meters$.complete();
    fixture.detectChanges();

    expect(component.metersLoading()).toBe(false);
    expect(component.form.controls.ean.enabled).toBe(true);
    expect(byTestId(fixture, 'device-create-dialog__select--ean')?.classList).not.toContain(
      'p-disabled',
    );
    expect(textOf(fixture, 'device-create-dialog__ean-hint')).toBe(
      "Seuls les compteurs actifs de la communauté sont proposés. Un compteur ne peut avoir qu'un seul appareil à la fois.",
    );
  });

  it('labels each option EAN · address · holder', () => {
    const fixture = render(of(page([meter(W1, 'Wind Producer Alpha')])));

    expect(fixture.componentInstance.meterOptions()[0].label).toBe(
      `${W1} · Wind Alley 10, 1000 Brussels · Wind Producer Alpha`,
    );
  });

  it('disables a meter a pending or active device holds, and lists the free ones first', () => {
    const fixture = render(
      of(page([meter(W1), meter(W2), meter(W3)])),
      devicesOf(
        device(W1, LiveDeviceStatus.PENDING),
        device(W2, LiveDeviceStatus.ACTIVE),
        device(W3, LiveDeviceStatus.REVOKED),
      ),
    );

    expect(
      fixture.componentInstance.meterOptions().map((option) => [option.ean, option.disabled]),
    ).toEqual([
      [W3, false],
      [W1, true],
      [W2, true],
    ]);
    expect(byTestId(fixture, 'device-create-dialog__ean-devices-unknown')).toBeNull();
  });

  it('marks a held meter in the open list, with the tag and the attributes the e2e reads', () => {
    stubMatchMedia();
    const fixture = render(
      of(page([meter(W1, 'Wind Producer Alpha'), meter(W2)])),
      devicesOf(device(W1, LiveDeviceStatus.ACTIVE)),
    );
    const select = fixture.debugElement.query(By.directive(Select)).componentInstance as Select;
    select.show();
    fixture.detectChanges();

    // `appendTo="body"`: the overlay is NOT inside the dialog.
    const held = document.body.querySelector<HTMLElement>(
      `.p-select-overlay .p-select-option[aria-label^="${W1}"]`,
    );
    const free = document.body.querySelector<HTMLElement>(
      `.p-select-overlay .p-select-option[aria-label^="${W2}"]`,
    );
    expect(held).not.toBeNull();
    expect(free).not.toBeNull();
    // PrimeNG 21 marks a disabled option with a class and a data attribute,
    // NOT with `aria-disabled`.
    expect(held?.classList).toContain('p-disabled');
    expect(held?.getAttribute('data-p-disabled')).toBe('true');
    expect(
      held?.querySelector('[data-testid="device-create-dialog__tag--has-device"]')?.textContent,
    ).toContain('A déjà un appareil');
    expect(free?.getAttribute('data-p-disabled')).toBe('false');
    expect(free?.querySelector('[data-testid="device-create-dialog__tag--has-device"]')).toBeNull();
  });

  it('lets every meter be picked when the devices cannot be read, and says so', () => {
    const fixture = render(
      of(page([meter(W1), meter(W2)])),
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const component = fixture.componentInstance;

    expect(component.meterOptions().every((option) => !option.disabled)).toBe(true);
    expect(component.form.controls.ean.enabled).toBe(true);
    expect(textOf(fixture, 'device-create-dialog__ean-devices-unknown')).toBe(
      'Impossible de vérifier quels compteurs ont déjà un appareil. Un compteur qui en a déjà un sera refusé à la création.',
    );
    // Not a toast: the dialog stays usable, and the line under the select is
    // the whole message.
    expect(errorHandler.handleError).not.toHaveBeenCalled();
  });

  it('does not spin for ever when the device list completes empty', () => {
    // REGRESSION GUARD. `gateSubscription` turns a 403 NOT_SUBSCRIBED into
    // EMPTY, and `forkJoin` completes WITHOUT emitting when any source does:
    // without `defaultIfEmpty` the picker never left its loading state.
    const fixture = render(of(page([meter(W1)])), EMPTY);
    const component = fixture.componentInstance;

    expect(component.metersLoading()).toBe(false);
    expect(component.meterOptions().map((option) => option.ean)).toEqual([W1]);
    expect(component.form.controls.ean.enabled).toBe(true);
  });

  it('reports a failed meter read, and refuses to submit without a meter', () => {
    const fixture = render(throwError(() => new HttpErrorResponse({ status: 500 })));
    const component = fixture.componentInstance;

    expect(component.metersLoading()).toBe(false);
    expect(textOf(fixture, 'device-create-dialog__ean-error')).toBe(
      "Les compteurs de la communauté n'ont pas pu être chargés. Fermez cette fenêtre et réessayez.",
    );
    expect(component.form.controls.ean.disabled).toBe(true);
    expect(component.meterOptions()).toEqual([]);

    // A disabled control is left out of `form.invalid`: the name alone would
    // otherwise make the form "valid" and post an empty EAN.
    component.form.controls.name.setValue('Onduleur toiture');
    component.submit();

    expect(component.formError()).toBe('Veuillez indiquer un nom et choisir un compteur.');
    expect(liveData.createDevice).not.toHaveBeenCalled();
  });

  it('treats a string payload as a failure, not as an empty community', () => {
    const fixture = render(of(page('Erreur interne')));

    expect(byTestId(fixture, 'device-create-dialog__ean-error')).not.toBeNull();
    expect(byTestId(fixture, 'device-create-dialog__ean-none')).toBeNull();
    expect(fixture.componentInstance.form.controls.ean.disabled).toBe(true);
  });

  it('says so when the community has no active meter', () => {
    const fixture = render(of(page([])));

    expect(textOf(fixture, 'device-create-dialog__ean-none')).toBe(
      "Cette communauté n'a aucun compteur actif auquel rattacher un appareil.",
    );
    expect(byTestId(fixture, 'device-create-dialog__ean-hint')).toBeNull();
    expect(fixture.componentInstance.form.controls.ean.disabled).toBe(true);
  });

  it('reports a list cut short, never silently', () => {
    const cut = render(of(page([meter(W1), meter(W2)], 750)));
    expect(textOf(cut, 'device-create-dialog__ean-truncated')).toBe(
      'Seuls les 2 premiers des 750 compteurs actifs sont proposés.',
    );
    TestBed.resetTestingModule();

    const whole = render(of(page([meter(W1), meter(W2)], 2)));
    expect(byTestId(whole, 'device-create-dialog__ean-truncated')).toBeNull();
  });

  it('creates the device with the picked EAN, issues its code and closes with it', () => {
    const fixture = render(of(page([meter(W1)])));
    const component = fixture.componentInstance;
    const token: LiveEnrollmentToken = {
      token: 'ABCD-EFGH-JKLM',
      expires_at: '2026-10-03T12:25:00Z',
      qr_svg: 'data:image/svg+xml;base64,PHN2Zy8+',
    };
    liveData.createDevice.mockReturnValue(
      of(new ApiResponse({ ...device(W1, LiveDeviceStatus.PENDING), device_id: 'dev-1' })),
    );
    liveData.issueToken.mockReturnValue(of(new ApiResponse(token)));

    component.form.controls.name.setValue('Onduleur toiture');
    component.form.controls.ean.setValue(W1);
    component.submit();

    expect(liveData.createDevice).toHaveBeenCalledWith({
      name: 'Onduleur toiture',
      ean: W1,
      type: LiveDeviceType.PRODUCTION,
      pure_injection: false,
    });
    expect(liveData.issueToken).toHaveBeenCalledWith('dev-1');
    expect(ref.close).toHaveBeenCalledWith(token);
  });

  it('asks for a meter when none was picked', () => {
    const fixture = render(of(page([meter(W1)])));
    const component = fixture.componentInstance;

    component.form.controls.name.setValue('Onduleur toiture');
    component.submit();

    expect(component.formError()).toBe('Veuillez indiquer un nom et choisir un compteur.');
    expect(liveData.createDevice).not.toHaveBeenCalled();
  });

  it("shows the server's 409 and stays open", () => {
    // The list is advice: another manager can take the meter between the read
    // and the click, and the server's answer is the one that counts.
    const fixture = render(of(page([meter(W1)])));
    const component = fixture.componentInstance;
    const message = 'Un appareil existe déjà pour cet EAN.';
    liveData.createDevice.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 2405 } }),
      ),
    );

    component.form.controls.name.setValue('Onduleur toiture');
    component.form.controls.ean.setValue(W1);
    component.submit();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(ref.close).not.toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });

  it('closes with true when the device exists but its first code failed', () => {
    // `false` is a cancel to the parent: no reload, and the new device stayed
    // invisible while the picker already greyed its meter out.
    const fixture = render(of(page([meter(W1)])));
    const component = fixture.componentInstance;
    const message = "Le code n'a pas pu être émis.";
    liveData.createDevice.mockReturnValue(
      of(new ApiResponse({ ...device(W1, LiveDeviceStatus.PENDING), device_id: 'dev-1' })),
    );
    liveData.issueToken.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { data: message } })),
    );

    component.form.controls.name.setValue('Onduleur toiture');
    component.form.controls.ean.setValue(W1);
    component.submit();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(ref.close).toHaveBeenCalledWith(true);
    expect(component.submitting()).toBe(false);
  });
});
