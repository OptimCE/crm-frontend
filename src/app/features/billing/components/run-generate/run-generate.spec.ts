import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { BillingService } from '../../../../shared/services/billing.service';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { RunGenerate } from './run-generate';

describe('RunGenerate', () => {
  let component: RunGenerate;
  let billing: {
    listBillingRuns: ReturnType<typeof vi.fn>;
    createBillingRun: ReturnType<typeof vi.fn>;
  };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    billing = {
      listBillingRuns: vi.fn().mockReturnValue(of(new ApiResponse([]))),
      createBillingRun: vi.fn(),
    };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RunGenerate, TranslateModule.forRoot()],
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
        {
          provide: RealtimeService,
          useValue: { live: signal(false), on: vi.fn().mockReturnValue(NEVER) },
        },
      ],
    })
      .overrideComponent(RunGenerate, {
        set: {
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandler }],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(RunGenerate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("shows the server's message when the billing run is refused", () => {
    const message = 'A billing run already covers this period for this sharing operation';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    billing.createBillingRun.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 6201 } }),
      ),
    );

    component.onOperationChange(2);
    component.periodStart = new Date(2026, 8, 1);
    component.periodEnd = new Date(2026, 8, 30);
    component.generate();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.generating()).toBe(false);
  });
});
