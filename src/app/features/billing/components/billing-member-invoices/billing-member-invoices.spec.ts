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
import { InvoiceOut, InvoiceStatus, InvoiceType } from '../../../../shared/dtos/billing.dtos';
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

function invoice(overrides: Partial<InvoiceOut>): InvoiceOut {
  return {
    id: 1,
    id_billing_run: 1,
    id_member: 1,
    type: InvoiceType.INVOICE,
    status: InvoiceStatus.SENT,
    number: 'F-2026-00001',
    currency: 'EUR',
    subtotal: '53.08',
    vat_rate: '0.21',
    vat_amount: '11.15',
    total: '64.23',
    structured_comm: '+++000/0000/00101+++',
    issued_at: '2026-10-01T08:00:00Z',
    due_date: '2026-10-31',
    pdf_ready: false,
    ...overrides,
  };
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

  // A producer statement (the community pays the producer) and a credit note
  // are issued like a bill, structured communication included. The list used to
  // show that communication under "Communication structurée" on all three, as if
  // the member had to pay each of them.
  describe('documents the member does not pay', () => {
    const BILL = invoice({ id: 1, number: 'F-2026-00001' });
    const STATEMENT = invoice({
      id: 2,
      type: InvoiceType.PRODUCER_STATEMENT,
      number: 'DP-2026-00019',
      structured_comm: '+++000/0000/00202+++',
    });
    const CREDIT_NOTE = invoice({
      id: 3,
      type: InvoiceType.CREDIT_NOTE,
      number: 'NC-2026-00001',
      total: '-64.23',
      structured_comm: '+++000/0000/00303+++',
    });

    function cards(): Record<string, HTMLElement> {
      const list = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '[data-testid="my-invoices__card"]',
      );
      return Object.fromEntries(
        Array.from(list).map((card): [string, HTMLElement] => [
          card.querySelector('.font-semibold')?.textContent?.trim() ?? '',
          card,
        ]),
      );
    }

    function text(card: HTMLElement, testId: string): string | null {
      return card.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? null;
    }

    beforeEach(async () => {
      const billing = TestBed.inject(BillingService) as unknown as {
        listMyInvoices: ReturnType<typeof vi.fn>;
      };
      billing.listMyInvoices.mockReturnValue(
        of(new ApiResponsePaginated([BILL, STATEMENT, CREDIT_NOTE], new Pagination(1, 20, 3, 1))),
      );
      component.applyFilters();
      await fixture.whenStable();
    });

    it('should show payment instructions on the bill only', () => {
      const shown = cards();

      expect(Object.keys(shown)).toEqual(['F-2026-00001', 'DP-2026-00019', 'NC-2026-00001']);
      expect(text(shown['F-2026-00001'], 'my-invoices__ogm')).toContain('+++000/0000/00101+++');
      expect(text(shown['DP-2026-00019'], 'my-invoices__ogm')).toBeNull();
      expect(text(shown['NC-2026-00001'], 'my-invoices__ogm')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('00202');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('00303');
    });

    it('should say a producer statement is to be received', () => {
      const card = cards()['DP-2026-00019'];

      expect(text(card, 'my-invoices__tag--type')).toBe('Décompte producteur');
      expect(text(card, 'my-invoices__settlement')).toBe('À recevoir');
    });

    it('should say a credit note is in the member’s favour', () => {
      const card = cards()['NC-2026-00001'];

      expect(text(card, 'my-invoices__tag--type')).toBe('Note de crédit');
      expect(text(card, 'my-invoices__settlement')).toBe('En votre faveur');
    });

    it('should give a bill neither a type tag nor a settlement label', () => {
      const card = cards()['F-2026-00001'];

      expect(text(card, 'my-invoices__tag--type')).toBeNull();
      expect(text(card, 'my-invoices__settlement')).toBeNull();
    });

    it('should switch the settlement label with the language', async () => {
      translate.use('en');
      await fixture.whenStable();

      expect(text(cards()['DP-2026-00019'], 'my-invoices__settlement')).toBe('To receive');
      expect(text(cards()['NC-2026-00001'], 'my-invoices__settlement')).toBe('In your favour');
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
