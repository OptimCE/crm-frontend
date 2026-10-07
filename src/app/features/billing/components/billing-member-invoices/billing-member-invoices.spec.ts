import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { ERROR_TYPE } from '../../../../core/dtos/notification';
import { BillingService } from '../../../../shared/services/billing.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { invoiceStatusLabelKey } from '../../billing-format';
import { BillingMemberInvoices } from './billing-member-invoices';

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

describe('BillingMemberInvoices', () => {
  let fixture: ComponentFixture<BillingMemberInvoices>;
  let component: BillingMemberInvoices;
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
    await TestBed.configureTestingModule({
      imports: [BillingMemberInvoices, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: BillingService,
          useValue: {
            listMyInvoices: vi
              .fn()
              .mockReturnValue(of(new ApiResponsePaginated([], new Pagination(1, 20, 0, 0)))),
            downloadInvoicePdf: vi.fn(),
          },
        },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();

    translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.setTranslation('en', en as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(BillingMemberInvoices);
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
      expect(ariaLabelOf('my-invoices__select--sort')).toBe(lookup(fr, key));

      translate.use('en');
      await fixture.whenStable();

      expect(lookup(en, key)).not.toBe(lookup(fr, key));
      expect(ariaLabelOf('my-invoices__select--sort')).toBe(lookup(en, key));
    });
  });

  describe('listing errors', () => {
    it("should show the server's message when the invoices cannot be listed", () => {
      const message = 'No member is linked to your account in this community';
      const billing = TestBed.inject(BillingService) as unknown as {
        listMyInvoices: ReturnType<typeof vi.fn>;
      };
      const snackbar = TestBed.inject(SnackbarNotification) as unknown as {
        openSnackBar: ReturnType<typeof vi.fn>;
      };
      // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
      billing.listMyInvoices.mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 404, error: { data: message, error_code: 6004 } }),
        ),
      );

      component.applyFilters();

      expect(snackbar.openSnackBar).toHaveBeenCalledWith(message, ERROR_TYPE);
      expect(component.loading()).toBe(false);
    });
  });
});
