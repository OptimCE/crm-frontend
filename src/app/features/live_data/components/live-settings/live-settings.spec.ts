import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { environments } from '../../../../../environments/environments';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { LiveSettings as LiveSettingsDto } from '../../../../shared/dtos/live-data.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { LiveSettings } from './live-settings';

const base = `${environments.apiUrl}/live`;

/** A community that closed both switches and raised k: nothing like the form's initial values. */
const CLOSED: LiveSettingsDto = {
  members_see_production: false,
  members_see_aggregate: false,
  k: 7,
  is_default: false,
};

describe('LiveSettings', () => {
  let httpMock: HttpTestingController;
  let snackbar: { openSnackBar: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  /** The real French strings: what is asserted is the sentence a manager reads. */
  function render(): ComponentFixture<LiveSettings> {
    snackbar = { openSnackBar: vi.fn() };
    errorHandler = { handleError: vi.fn() };
    TestBed.configureTestingModule({
      imports: [LiveSettings, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SnackbarNotification, useValue: snackbar },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');
    httpMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(LiveSettings);
    fixture.detectChanges();
    return fixture;
  }

  function loaded(settings: LiveSettingsDto): ComponentFixture<LiveSettings> {
    const fixture = render();
    httpMock.expectOne(`${base}/settings`).flush({ data: settings, error_code: 0 });
    fixture.detectChanges();
    return fixture;
  }

  function query(fixture: ComponentFixture<LiveSettings>, testid: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);
  }

  function clickSave(fixture: ComponentFixture<LiveSettings>): void {
    query(fixture, 'live-settings__btn--save')?.querySelector('button')?.click();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('fills the form with what the server holds', () => {
    const fixture = loaded(CLOSED);

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      members_see_production: false,
      members_see_aggregate: false,
      k: 7,
    });
    expect(query(fixture, 'live-settings__is-default')).toBeNull();
    expect(query(fixture, 'live-settings__btn--save')).not.toBeNull();
  });

  it('says so when nobody has saved settings yet', () => {
    const fixture = loaded({ ...CLOSED, is_default: true });

    expect(query(fixture, 'live-settings__is-default')?.textContent?.trim()).toBe(
      fr.LIVE_DATA.SETTINGS.IS_DEFAULT,
    );
  });

  it('saves all three fields as loaded, so an untouched switch keeps its value', () => {
    // A PUT replaces the whole row. Changing k must not reset either switch.
    const fixture = loaded(CLOSED);
    fixture.componentInstance.form.controls.k.setValue(9);
    fixture.detectChanges();

    clickSave(fixture);

    const put = httpMock.expectOne(`${base}/settings`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      members_see_production: false,
      members_see_aggregate: false,
      k: 9,
    });
    put.flush({ data: { ...CLOSED, k: 9 }, error_code: 0 });

    expect(snackbar.openSnackBar).toHaveBeenCalledWith(
      fr.LIVE_DATA.SETTINGS.SAVED,
      VALIDATION_TYPE,
    );
  });

  it('drops the "not saved yet" notice once the first save creates the row', () => {
    const fixture = loaded({ ...CLOSED, is_default: true });

    clickSave(fixture);
    httpMock.expectOne(`${base}/settings`).flush({ data: CLOSED, error_code: 0 });
    fixture.detectChanges();

    expect(query(fixture, 'live-settings__is-default')).toBeNull();
  });

  it.each([2, 1001])('refuses k = %i and sends nothing', (k) => {
    const fixture = loaded(CLOSED);
    fixture.componentInstance.form.controls.k.setValue(k);
    fixture.detectChanges();

    const button = query(fixture, 'live-settings__btn--save')?.querySelector('button');
    expect(button?.disabled).toBe(true);

    fixture.componentInstance.save();
    httpMock.expectNone(`${base}/settings`);
  });

  it('shows the API message when the save fails, and keeps the form', () => {
    const fixture = loaded(CLOSED);

    clickSave(fixture);
    httpMock
      .expectOne(`${base}/settings`)
      .flush(
        { data: 'Nope', error_code: 2420 },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(errorHandler.handleError).toHaveBeenCalledWith('Nope');
    expect(snackbar.openSnackBar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(query(fixture, 'live-settings__btn--save')).not.toBeNull();
  });

  describe('when the settings cannot be loaded', () => {
    /**
     * The role gate's refusal (403, error_code 2). A 4xx on purpose: `cachedGet`
     * retries a 5xx twice, with a back-off, before the component sees it.
     */
    function failedLoad(): ComponentFixture<LiveSettings> {
      const fixture = render();
      httpMock
        .expectOne(`${base}/settings`)
        .flush({ data: 'Boom', error_code: 2 }, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();
      return fixture;
    }

    it('does not offer the form, which still holds its initial values', () => {
      // BUG: the form rendered with its initial values - both switches ON - and
      // a manager who then changed k saved them over the community's real ones,
      // re-opening to members what the community had closed.
      const fixture = failedLoad();

      expect(errorHandler.handleError).toHaveBeenCalledWith('Boom');
      expect(query(fixture, 'live-settings__load-failed')?.textContent).toContain(
        fr.COMMON.ERROR_LOADING,
      );
      expect(query(fixture, 'live-settings__btn--save')).toBeNull();

      fixture.componentInstance.save();
      httpMock.expectNone(`${base}/settings`);
    });

    it('loads again from the retry button', () => {
      const fixture = failedLoad();

      query(fixture, 'live-settings__btn--retry')?.querySelector('button')?.click();
      httpMock.expectOne(`${base}/settings`).flush({ data: CLOSED, error_code: 0 });
      fixture.detectChanges();

      expect(query(fixture, 'live-settings__load-failed')).toBeNull();
      expect(fixture.componentInstance.form.getRawValue().members_see_production).toBe(false);
      expect(query(fixture, 'live-settings__btn--save')).not.toBeNull();
    });
  });
});
