import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  InboundMailOut,
  InboundMailStatus,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { InboundMailList } from './inbound-mail-list';

function mail(overrides: Partial<InboundMailOut> = {}): InboundMailOut {
  return {
    id: 7,
    status: InboundMailStatus.ATTACHED,
    from_address: 'ores@ores.be',
    subject: 'RE: [OPT-12] Modification du partage',
    sent_at: '2026-11-02T08:15:00Z',
    received_at: '2026-11-02T08:20:00Z',
    body_text: 'Votre dossier est complet.',
    id_dossier: 12,
    match_reason: 'reference',
    suggested_response: 'completeness_ack',
    id_correspondence: null,
    byte_size: 1200,
    attachments: [
      {
        id: 3,
        filename: 'avenant.pdf',
        content_type: 'application/pdf',
        byte_size: 20,
        content_sha256: 'a',
      },
    ],
    ...overrides,
  };
}

describe('InboundMailList (the reception address)', () => {
  let service: {
    attachInboundMail: ReturnType<typeof vi.fn>;
    discardInboundMail: ReturnType<typeof vi.fn>;
    pieceFromInbound: ReturnType<typeof vi.fn>;
    downloadInbound: ReturnType<typeof vi.fn>;
  };

  async function render(mails: InboundMailOut[], inputs: Record<string, unknown> = {}) {
    service = {
      attachInboundMail: vi.fn().mockReturnValue(of(new ApiResponse(mail()))),
      discardInboundMail: vi.fn().mockReturnValue(of(new ApiResponse(mail()))),
      pieceFromInbound: vi.fn().mockReturnValue(of(new ApiResponse({ id: 12 }))),
      downloadInbound: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [InboundMailList, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: AdministrativeProcedureService, useValue: service },
        { provide: ErrorMessageHandler, useValue: { handleError: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(InboundMailList);
    fixture.componentRef.setInput('mails', mails);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('on a procedure, a mail to qualify offers « Ajouter une réponse » and its pieces', async () => {
    const fixture = await render([mail()], {
      dossierId: 12,
      pieces: [{ id: 40, label: 'Avenant' }],
    });
    const el = fixture.nativeElement as HTMLElement;
    let asked: InboundMailOut | null = null;
    fixture.componentInstance.respond.subscribe((m) => (asked = m));

    (
      el.querySelector('[data-testid="inbound-mail-list__qualify--7"] button') as HTMLButtonElement
    ).click();

    expect(asked).toEqual(mail());
    expect(el.querySelector('[data-testid="inbound-mail-list__piece--3"]')).not.toBeNull();
  });

  it('supplies a piece from an attachment', async () => {
    const fixture = await render([mail()], { dossierId: 12, pieces: [{ id: 40, label: 'A' }] });
    let supplied = false;
    fixture.componentInstance.pieceSupplied.subscribe(() => (supplied = true));
    fixture.componentInstance.pieceFor[3] = 40;

    fixture.componentInstance.supply(mail(), mail().attachments[0]);

    expect(service.pieceFromInbound).toHaveBeenCalledWith(12, 40, 7, 3);
    expect(supplied).toBe(true);
  });

  it('on the hub, attaches an unmatched mail to the procedure picked, or discards it', async () => {
    const unmatched = mail({ status: InboundMailStatus.UNMATCHED, id_dossier: null });
    const fixture = await render([unmatched], { procedures: [{ id: 12, label: '#12' }] });
    let changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="inbound-mail-list__qualify--7"]')).toBeNull();

    fixture.componentInstance.attachTo[7] = 12;
    fixture.componentInstance.attach(unmatched);
    fixture.componentInstance.discard(unmatched);

    expect(service.attachInboundMail).toHaveBeenCalledWith(7, 12);
    expect(service.discardInboundMail).toHaveBeenCalledWith(7);
    expect(changed).toBe(2);
  });

  it('shortens a long text', async () => {
    const fixture = await render([mail({ body_text: 'x'.repeat(400) })]);
    expect(fixture.componentInstance.snippet(mail({ body_text: 'x'.repeat(400) })).length).toBe(
      281,
    );
  });
});
