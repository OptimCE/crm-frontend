import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { BillingService } from '../../../../shared/services/billing.service';
import { MemberService } from '../../../../shared/services/member.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { invoiceStatusLabelKey } from '../../billing-format';
import { TrackingBoard } from './tracking-board';

/** The string a dotted i18n key points at in a locale bundle. */
function lookup(bundle: unknown, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle);
  if (typeof value !== 'string') throw new Error(`no string at ${key}`);
  return value;
}

const SORT_KEYS: Record<string, string> = {
  issued_at: 'BILLING.SORT.ISSUED_DATE',
  due_date: 'BILLING.SORT.DUE_DATE',
  total: 'BILLING.SORT.AMOUNT',
  number: 'BILLING.SORT.NUMBER',
  status: 'BILLING.SORT.STATUS',
};

describe('TrackingBoard', () => {
  let fixture: ComponentFixture<TrackingBoard>;
  let component: TrackingBoard;
  let translate: TranslateService;

  function ariaLabelOf(testId: string): string | null {
    return (
      (fixture.nativeElement as HTMLElement)
        .querySelector(`[data-testid="${testId}"] [role="combobox"]`)
        ?.getAttribute('aria-label') ?? null
    );
  }

  function labelsIn(bundle: unknown): Record<string, string[]> {
    return {
      status: component.statusOptions().map((o) => lookup(bundle, invoiceStatusLabelKey(o.value))),
      sort: component.sortOptions().map((o) => lookup(bundle, SORT_KEYS[o.value])),
    };
  }

  function shownLabels(): Record<string, string[]> {
    return {
      status: component.statusOptions().map((o) => o.label),
      sort: component.sortOptions().map((o) => o.label),
    };
  }

  beforeEach(async () => {
    const empty = of(new ApiResponsePaginated([], new Pagination(1, 20, 0, 0)));
    await TestBed.configureTestingModule({
      imports: [TrackingBoard, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: BillingService,
          useValue: { listInvoices: vi.fn().mockReturnValue(empty), invalidate: vi.fn() },
        },
        { provide: MemberService, useValue: { getMembersList: vi.fn().mockReturnValue(empty) } },
        { provide: UserContextService, useValue: { compareWithActiveRole: vi.fn(() => true) } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();

    translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.setTranslation('en', en as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(TrackingBoard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  // The labels used to be translated once, in ngOnInit: a language switch left
  // the filters - and their aria-labels - in the old language until a reload.
  describe('status and sort select labels', () => {
    it('should label every option in the current language', () => {
      expect(shownLabels()).toEqual(labelsIn(fr));
    });

    it('should translate the options again when the language changes', () => {
      translate.use('en');

      expect(shownLabels()).toEqual(labelsIn(en));
    });

    it('should name the default sort in the language now in use', async () => {
      const key = SORT_KEYS['issued_at'];
      expect(ariaLabelOf('tracking-board__select--sort')).toBe(lookup(fr, key));

      translate.use('en');
      await fixture.whenStable();

      expect(lookup(en, key)).not.toBe(lookup(fr, key));
      expect(ariaLabelOf('tracking-board__select--sort')).toBe(lookup(en, key));
    });
  });
});
