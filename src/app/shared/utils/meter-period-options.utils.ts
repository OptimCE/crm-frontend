import { formatDate } from '@angular/common';
import { computed, inject, Signal } from '@angular/core';

import { LocaleService } from '../../core/services/language/locale.service';
import { MetersDataDTO } from '../dtos/meter.dtos';

/** A meter-data period offered by a select: its dates as `label`, the period as `value`. */
export interface MeterPeriodOption {
  label: string;
  value: MetersDataDTO;
}

/** The pattern the period selects and the date pickers write dates in. */
const PERIOD_DATE_FORMAT = 'dd/MM/yyyy';

/**
 * Meter-data periods as select options, labelled with their dates as the select
 * shows them: "01/01/2024 - 31/12/2024", or the start date alone while the period
 * is open-ended.
 *
 * Bound to the periods themselves, PrimeNG had no text to name the select and its
 * options by, and its aria-label fell back to the object: "[object Object]". The
 * period stays each option's `value`, so `optionValue="value"` keeps `[ngModel]`
 * holding the period.
 *
 * Call it in an injection context (a field initializer).
 */
export function meterPeriodOptions(
  periods: () => MetersDataDTO[] | undefined,
): Signal<MeterPeriodOption[]> {
  const locale = inject(LocaleService).locale;
  return computed(() => {
    const lang = locale();
    return (periods() ?? []).map((period) => ({
      label: meterPeriodLabel(period, lang),
      value: period,
    }));
  });
}

/** What `localeDate: 'dd/MM/yyyy'` writes for the period's start and end. */
export function meterPeriodLabel(period: MetersDataDTO, locale: string): string {
  const start = formatDate(period.start_date, PERIOD_DATE_FORMAT, locale);
  return period.end_date
    ? `${start} - ${formatDate(period.end_date, PERIOD_DATE_FORMAT, locale)}`
    : start;
}
