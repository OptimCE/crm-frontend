import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { LocaleDatePipe, LocaleNumberPipe, LocalePercentPipe } from './locale-format-pipes';

/** French thousands separator (narrow no-break space) and percent-sign space. */
const NNBSP = String.fromCharCode(0x202f);
const NBSP = String.fromCharCode(0xa0);

/**
 * OnPush on purpose: the language switch below must rewrite figures ALREADY on
 * screen, in a view nothing else marks dirty - which is exactly where a pure
 * pipe, or a LOCALE_ID read once at bootstrap, leaves the old language.
 */
@Component({
  template: `
    <span data-testid="energy">{{ energy | localeNumber: '1.2-2' }} kWh</span>
    <span data-testid="day">{{ seen | localeDate: 'dd/MM/yyyy' }}</span>
    <span data-testid="short">{{ seen | localeDate: 'short' }}</span>
    <span data-testid="share">{{ share | localePercent: '1.0-2' }}</span>
  `,
  imports: [LocaleNumberPipe, LocaleDatePipe, LocalePercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FiguresHost {
  readonly energy = 1.5;
  // Local parts, so the assertions hold in any timezone.
  readonly seen = new Date(2026, 8, 29, 14, 30);
  readonly share = 0.125;
}

describe('locale format pipes', () => {
  function render(lang: string): ComponentFixture<FiguresHost> {
    TestBed.configureTestingModule({
      imports: [FiguresHost],
      providers: [provideTranslateService({ lang })],
    });
    const fixture = TestBed.createComponent(FiguresHost);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<FiguresHost>, testId: string): string | undefined {
    const root = fixture.nativeElement as HTMLElement;
    return root.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('shows a French reader "1,50 kWh" and "29/09/2026"', () => {
    // BUG: Angular's pipes read LOCALE_ID, which nothing set: every reader got
    // en-US, and "1.50 kWh" reads in French as one and a half THOUSAND.
    const fixture = render('fr');

    expect(text(fixture, 'energy')).toBe('1,50 kWh');
    expect(text(fixture, 'day')).toBe('29/09/2026');
    expect(text(fixture, 'short')).toBe('29/09/2026 14:30');
    expect(text(fixture, 'share')).toBe(`12,5${NBSP}%`);
  });

  it('writes each language its own way', () => {
    const cases: Record<string, [string, string, string]> = {
      en: ['1.50 kWh', `9/29/26, 2:30${NNBSP}PM`, '12.5%'],
      nl: ['1,50 kWh', '29-09-2026, 14:30', '12,5%'],
      de: ['1,50 kWh', '29.09.26, 14:30', `12,5${NBSP}%`],
    };

    for (const [lang, [energy, short, share]] of Object.entries(cases)) {
      const fixture = render(lang);
      expect(text(fixture, 'energy'), lang).toBe(energy);
      expect(text(fixture, 'short'), lang).toBe(short);
      expect(text(fixture, 'share'), lang).toBe(share);
      TestBed.resetTestingModule();
    }
  });

  it('rewrites the figures already on screen when the reader switches language', () => {
    const fixture = render('fr');
    expect(text(fixture, 'energy')).toBe('1,50 kWh');

    TestBed.inject(TranslateService).use('en');
    fixture.detectChanges();

    expect(text(fixture, 'energy')).toBe('1.50 kWh');
    expect(text(fixture, 'short')).toBe(`9/29/26, 2:30${NNBSP}PM`);
    expect(text(fixture, 'share')).toBe('12.5%');
  });

  describe('as a drop-in for the Angular pipe', () => {
    function numberPipe(lang: string): LocaleNumberPipe {
      TestBed.configureTestingModule({ providers: [provideTranslateService({ lang })] });
      return TestBed.runInInjectionContext(() => new LocaleNumberPipe());
    }

    it('renders nothing for an absent value, as `| number` does', () => {
      const pipe = numberPipe('fr');

      expect(pipe.transform(null)).toBeNull();
      expect(pipe.transform(undefined)).toBeNull();
      expect(pipe.transform('')).toBeNull();
    });

    it('reads a numeric string, and rejects anything else loudly', () => {
      const pipe = numberPipe('fr');

      expect(pipe.transform('1234.5', '1.1-1')).toBe(`1${NNBSP}234,5`);
      expect(() => pipe.transform('abc')).toThrow(/InvalidPipeArgument/);
    });

    it('formats again only when the value, the arguments or the language change', () => {
      // Impure, so change detection calls it on every pass; an unchanged
      // binding must cost a comparison, not a re-format.
      const format = vi.spyOn(DecimalPipe.prototype, 'transform');
      const pipe = numberPipe('fr');

      pipe.transform(1.5, '1.2-2');
      pipe.transform(1.5, '1.2-2');
      expect(format).toHaveBeenCalledTimes(1);

      pipe.transform(2.5, '1.2-2'); // the value changed
      pipe.transform(2.5, '1.1-1'); // the arguments changed
      expect(format).toHaveBeenCalledTimes(3);

      TestBed.inject(TranslateService).use('en'); // only the language changed
      expect(pipe.transform(2.5, '1.1-1')).toBe('2.5');
      expect(format).toHaveBeenCalledTimes(4);
    });
  });
});
