import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MetersDataDTO } from '../dtos/meter.dtos';
import { LocaleDatePipe } from '../pipes/locale-format/locale-format-pipes';
import { meterPeriodLabel, meterPeriodOptions } from './meter-period-options.utils';

function period(id: number, start_date: string, end_date?: string): MetersDataDTO {
  return { id, start_date, end_date } as MetersDataDTO;
}

describe('meterPeriodOptions', () => {
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
    injector = TestBed.inject(Injector);
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', {});
    translate.use('fr');
  });

  it('should label a closed period with its start and end dates', () => {
    const options = runInInjectionContext(injector, () =>
      meterPeriodOptions(() => [period(1, '2024-01-01', '2024-12-31')]),
    );
    expect(options()[0].label).toBe('01/01/2024 - 31/12/2024');
  });

  it('should label an open-ended period with its start date alone', () => {
    const options = runInInjectionContext(injector, () =>
      meterPeriodOptions(() => [period(2, '2025-03-07')]),
    );
    expect(options()[0].label).toBe('07/03/2025');
  });

  it('should keep the period itself as the value, in order', () => {
    const periods = [period(1, '2024-01-01', '2024-12-31'), period(2, '2025-01-01')];
    const options = runInInjectionContext(injector, () => meterPeriodOptions(() => periods));
    expect(options().map((option) => option.value)).toEqual(periods);
    expect(options()[1].value).toBe(periods[1]);
  });

  it('should follow the periods it reads', () => {
    const periods = signal<MetersDataDTO[] | undefined>(undefined);
    const options = runInInjectionContext(injector, () => meterPeriodOptions(periods));
    expect(options()).toEqual([]);

    periods.set([period(3, '2026-10-04')]);
    expect(options().map((option) => option.label)).toEqual(['04/10/2026']);
  });

  // The label is what a screen reader hears; the select shows the same dates
  // through `localeDate: 'dd/MM/yyyy'`. The two must not drift apart.
  it('should write each date exactly as the localeDate pipe does, in every language', () => {
    const pipe = runInInjectionContext(injector, () => new LocaleDatePipe());
    const translate = TestBed.inject(TranslateService);
    const closed = period(1, '2024-02-29', '2024-11-30');

    for (const lang of ['fr', 'en', 'nl', 'de']) {
      translate.setTranslation(lang, {});
      translate.use(lang);
      const shown = `${pipe.transform(closed.start_date, 'dd/MM/yyyy')} - ${pipe.transform(
        closed.end_date,
        'dd/MM/yyyy',
      )}`;
      expect(meterPeriodLabel(closed, lang)).toBe(shown);
    }
  });
});
