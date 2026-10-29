import { registerLocaleData } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import localeDe from '@angular/common/locales/de';
import localeFr from '@angular/common/locales/fr';
import localeNl from '@angular/common/locales/nl';

import { ApiResponse } from '../../core/dtos/api.response';
import { RenderState } from '../../shared/dtos/administrative-document.dtos';
import {
  extensionForMimeType,
  extractApiErrorCode,
  extractApiErrorMessage,
  formatApiDate,
  formatApiDay,
  formatBytes,
  parseApiDate,
  renderStateLabelKey,
  renderStateSeverity,
  toApiDate,
} from './administrative-document-format';

describe('render state', () => {
  it('derives the key from the enum member name', () => {
    expect(renderStateLabelKey(RenderState.PENDING)).toBe(
      'ADMINISTRATIVE_DOCUMENT.RENDER_STATE.PENDING',
    );
    expect(renderStateLabelKey(RenderState.FAILED)).toBe(
      'ADMINISTRATIVE_DOCUMENT.RENDER_STATE.FAILED',
    );
  });

  it('flags only a failed render', () => {
    expect(renderStateSeverity(RenderState.FAILED)).toBe('danger');
    expect(renderStateSeverity(RenderState.PENDING)).toBe('info');
  });
});

describe('dates', () => {
  it('serialises a Date as a LOCAL calendar date', () => {
    // 23:30 local on the 5th must stay the 5th; toISOString() would roll it
    // forward to the 6th in a positive-offset zone.
    expect(toApiDate(new Date(2026, 2, 5, 23, 30))).toBe('2026-03-05');
  });

  it('returns null for no date', () => {
    expect(toApiDate(null)).toBeNull();
    expect(toApiDate(undefined)).toBeNull();
  });

  it('formats a bare API date without a Date round-trip', () => {
    expect(formatApiDate('2026-09-21')).toBe('21/09/2026');
  });

  it('passes through anything that is not a bare date', () => {
    expect(formatApiDate('')).toBe('');
    expect(formatApiDate(null)).toBe('');
    expect(formatApiDate('not-a-date')).toBe('not-a-date');
  });

  it('round-trips through parseApiDate at local midnight', () => {
    const parsed = parseApiDate('2026-09-21');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(21);
    expect(toApiDate(parsed)).toBe('2026-09-21');
  });
});

describe('formatApiDay', () => {
  // The app registers these in LocaleService, which a pure spec never builds;
  // without them Angular throws NG0701 for every language but English.
  beforeAll(() => {
    registerLocaleData(localeFr, 'fr');
    registerLocaleData(localeNl, 'nl');
    registerLocaleData(localeDe, 'de');
  });

  /**
   * A timestamp in the API's own shape (microseconds, then `Z`) for a LOCAL
   * wall-clock time, so it falls on the same day whatever zone the suite runs in.
   */
  function apiTimestamp(month: number, day: number, hours: number, minutes: number): string {
    return new Date(2026, month - 1, day, hours, minutes, 17, 519)
      .toISOString()
      .replace(/Z$/, '196Z');
  }

  it('writes a timestamp as its day, in each language', () => {
    // BUG: the member read "Transmis le 2026-10-02T16:29:17.519196Z" — the
    // timestamp went through formatApiDate, which hands it back untouched.
    const filedAt = apiTimestamp(10, 2, 18, 29);

    expect(formatApiDay(filedAt, 'fr')).toBe('2 oct. 2026');
    expect(formatApiDay(filedAt, 'en')).toBe('Oct 2, 2026');
    expect(formatApiDay(filedAt, 'nl')).toBe('2 okt 2026');
    expect(formatApiDay(filedAt, 'de')).toBe('02.10.2026');
  });

  it('counts the day where the reader is, not in UTC', () => {
    // Either side of local midnight. East of UTC (Brussels) the first is still
    // the 1st in UTC, west of it the second is already the 3rd: reading the day
    // off the string would be wrong by one somewhere.
    expect(formatApiDay(apiTimestamp(10, 2, 0, 30), 'fr')).toBe('2 oct. 2026');
    expect(formatApiDay(apiTimestamp(10, 2, 23, 30), 'fr')).toBe('2 oct. 2026');
  });

  it('leaves a bare date exactly as formatApiDate writes it, in every language', () => {
    // A calendar day has no instant to convert, so it is never parsed at all.
    for (const lang of ['fr', 'en', 'nl', 'de']) {
      expect(formatApiDay('2026-09-21', lang), lang).toBe('21/09/2026');
    }
  });

  it('renders nothing for no value, and an unparseable value as it came', () => {
    expect(formatApiDay(null, 'fr')).toBe('');
    expect(formatApiDay(undefined, 'fr')).toBe('');
    expect(formatApiDay('', 'fr')).toBe('');
    expect(formatApiDay('not-a-date', 'fr')).toBe('not-a-date');
  });
});

describe('extensionForMimeType', () => {
  // Only a fallback — the backend names every download — but a saved file with
  // no extension is one the OS cannot open, which reads as a broken download.
  it('resolves the formats generation produces', () => {
    expect(extensionForMimeType('application/pdf')).toBe('.pdf');
    expect(
      extensionForMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('.xlsx');
    expect(
      extensionForMimeType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('.docx');
  });

  it('ignores media-type parameters', () => {
    expect(extensionForMimeType('text/html; charset=utf-8')).toBe('.html');
  });

  it('adds nothing for an unknown or absent type', () => {
    expect(extensionForMimeType('application/octet-stream')).toBe('');
    expect(extensionForMimeType(null)).toBe('');
    expect(extensionForMimeType(undefined)).toBe('');
    expect(extensionForMimeType('')).toBe('');
  });
});

describe('formatBytes', () => {
  it('scales through the units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('renders nothing when the size is unknown', () => {
    expect(formatBytes(null)).toBe('');
  });
});

describe('API error extraction', () => {
  it('reads the message from a real HttpErrorResponse', () => {
    // This is the shape that actually reaches a component at runtime.
    const error = new HttpErrorResponse({
      error: { data: 'This step change is not allowed', error_code: 2379 },
      status: 409,
    });
    expect(extractApiErrorMessage(error)).toBe('This step change is not allowed');
    expect(extractApiErrorCode(error)).toBe(2379);
  });

  it('still reads an ApiResponse, which is what specs throw', () => {
    const error = new ApiResponse('boom', 2364);
    expect(extractApiErrorMessage(error)).toBe('boom');
    expect(extractApiErrorCode(error)).toBe(2364);
  });

  it('degrades to null rather than throwing on an unexpected shape', () => {
    expect(extractApiErrorMessage(new Error('network'))).toBeNull();
    expect(extractApiErrorCode(undefined)).toBeNull();
    expect(extractApiErrorMessage(new HttpErrorResponse({ error: null }))).toBeNull();
  });
});
