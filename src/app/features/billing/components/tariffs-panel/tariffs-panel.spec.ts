import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { TariffKind, TariffOut, TariffScope } from '../../../../shared/dtos/billing.dtos';
import { BillingService } from '../../../../shared/services/billing.service';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { TariffsPanel } from './tariffs-panel';

describe('TariffsPanel', () => {
  const tariff: TariffOut = {
    id: 9,
    id_sharing_operation: 2,
    kind: TariffKind.CONSUMER_SELLING,
    scope: TariffScope.GLOBAL,
    scope_segment: null,
    scope_ean: null,
    price_per_kwh: '0.1200',
    currency: 'EUR',
    valid_from: '2026-01-01',
    valid_to: null,
    label: 'Standard 2026',
  };

  let component: TariffsPanel;
  let billing: { listTariffs: ReturnType<typeof vi.fn>; deleteTariff: ReturnType<typeof vi.fn> };
  let confirmation: { confirm: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    billing = {
      listTariffs: vi.fn().mockReturnValue(of(new ApiResponse([tariff]))),
      deleteTariff: vi.fn(),
    };
    confirmation = { confirm: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TariffsPanel, TranslateModule.forRoot()],
      providers: [
        { provide: BillingService, useValue: billing },
        {
          provide: SharingOperationService,
          useValue: {
            getSharingOperationList: vi
              .fn()
              .mockReturnValue(of(new ApiResponsePaginated([], new Pagination(1, 100, 0, 0)))),
          },
        },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: LocaleService, useValue: { locale: signal('en') } },
      ],
    })
      .overrideComponent(TariffsPanel, {
        set: {
          template: '',
          providers: [
            { provide: DialogService, useValue: { open: vi.fn() } },
            { provide: ConfirmationService, useValue: confirmation },
            { provide: ErrorMessageHandler, useValue: errorHandler },
          ],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(TariffsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("shows the server's message when the tariff cannot be deleted, and keeps it listed", () => {
    const message = 'This tariff was used by a billing run and can no longer be deleted';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    billing.deleteTariff.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 6302 } }),
      ),
    );
    component.onOperationChange(2);

    component.confirmDelete(tariff);
    const { accept } = confirmation.confirm.mock.calls[0][0] as Confirmation;
    (accept as () => void)();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.tariffs()).toEqual([tariff]);
  });
});
