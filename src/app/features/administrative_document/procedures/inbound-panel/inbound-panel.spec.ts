import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { InboundAddressOut } from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { InboundPanel } from './inbound-panel';

describe('InboundPanel (the hub)', () => {
  let getInboundMail: ReturnType<typeof vi.fn>;
  let rotate: ReturnType<typeof vi.fn>;

  async function render(address: InboundAddressOut, admin = false): Promise<HTMLElement> {
    getInboundMail = vi.fn().mockReturnValue(of(new ApiResponse([])));
    rotate = vi
      .fn()
      .mockReturnValue(of(new ApiResponse({ enabled: true, address: 'demarches+new@optimce.be' })));
    await TestBed.configureTestingModule({
      imports: [InboundPanel, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: AdministrativeProcedureService,
          useValue: {
            getInboundAddress: () => of(new ApiResponse(address)),
            getInboundMail,
            rotateInboundAddress: rotate,
          },
        },
        { provide: UserContextService, useValue: { compareWithActiveRole: () => admin } },
        { provide: RealtimeService, useValue: { on: () => new Subject() } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: { handleError: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(InboundPanel);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the address and what waits, and only an admin may change it', async () => {
    const el = await render({ enabled: true, address: 'demarches+k7x2abcd9z01@optimce.be' });

    expect(el.querySelector('[data-testid="inbound-panel__address"]')?.textContent?.trim()).toBe(
      'demarches+k7x2abcd9z01@optimce.be',
    );
    expect(getInboundMail).toHaveBeenCalledWith('open');
    expect(el.querySelector('[data-testid="inbound-panel__rotate"]')).toBeNull();
  });

  it('lets an admin change the address', async () => {
    const el = await render({ enabled: true, address: 'demarches+old@optimce.be' }, true);

    (el.querySelector('[data-testid="inbound-panel__rotate"] button') as HTMLButtonElement).click();

    expect(rotate).toHaveBeenCalled();
  });

  it('shows nothing on an instance without a reception address', async () => {
    const el = await render({ enabled: false, address: null });

    expect(el.querySelector('[data-testid="inbound-panel"]')).toBeNull();
    expect(getInboundMail).not.toHaveBeenCalled();
  });
});
