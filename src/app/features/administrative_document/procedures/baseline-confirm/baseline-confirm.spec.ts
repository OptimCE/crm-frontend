import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { BaselineOut } from '../../../../shared/dtos/administrative-procedure.dtos';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { baseline } from '../procedure-fixtures';
import { BaselineConfirm } from './baseline-confirm';

const METER = 'meter:3:541448000000000001';
const KEY = 'key:3:8';

describe('BaselineConfirm (criterion 1.8)', () => {
  let fixture: ComponentFixture<BaselineConfirm>;
  let component: BaselineConfirm;
  let confirmBaseline: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);

  async function setup(data: BaselineOut = baseline()): Promise<void> {
    confirmBaseline = vi.fn();
    await TestBed.configureTestingModule({
      imports: [BaselineConfirm, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: AdministrativeProcedureService,
          useValue: {
            getBaseline: vi.fn().mockReturnValue(of(new ApiResponse(data))),
            confirmBaseline,
          },
        },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(BaselineConfirm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lists every meter and key by operation, each on its default choice', async () => {
    await setup();
    expect(byTestId('baseline-confirm__operation--3')?.textContent).toContain('Op Centre');
    expect(byTestId(`baseline-confirm__row--${METER}`)?.textContent).toContain(
      '541448000000000001',
    );
    expect(byTestId(`baseline-confirm__row--${KEY}`)?.textContent).toContain('Clé égalitaire');
    expect(component.rows().map((r) => r.choice)).toEqual(['active', 'active']);
  });

  it('dates an active meter from when it joined unless told otherwise', async () => {
    await setup();
    expect(component.rows()[0].effectiveDate).toEqual(new Date(2025, 2, 1));
  });

  it('sends every line explicitly, with the dates each choice takes', async () => {
    await setup();
    const [meter, key] = component.rows();
    component.setChoice(key, 'in_progress');
    component.rows()[1].sentDate = new Date(2026, 9, 15);
    expect(meter.choice).toBe('active');
    confirmBaseline.mockReturnValue(of(new ApiResponse(baseline({ status: 'confirmed' }))));

    component.confirm();

    expect(confirmBaseline).toHaveBeenCalledWith({
      choices: [
        { key: METER, choice: 'active', effective_date: '2025-03-01', sent_date: null },
        { key: KEY, choice: 'in_progress', effective_date: null, sent_date: '2026-10-15' },
      ],
    });
  });

  it('asks for the day it was sent before confirming one in progress', async () => {
    await setup();
    component.setChoice(component.rows()[0], 'in_progress');
    component.confirm();
    expect(confirmBaseline).not.toHaveBeenCalled();
    expect(component.formError()).toContain('541448000000000001');
  });

  describe('a meter the CRM has waiting (one status per meter)', () => {
    function waiting(): BaselineOut {
      const data = baseline();
      data.items[0] = {
        ...data.items[0],
        crm_status: 3,
        default_choice: 'not_notified',
      };
      return data;
    }

    it('is not dated for the GRD from when it joined the operation', async () => {
      await setup(waiting());
      const [meter] = component.rows();
      expect(meter.choice).toBe('not_notified');
      component.setChoice(meter, 'active');
      expect(component.rows()[0].effectiveDate).toBeNull();
    });

    it('says the CRM has it waiting', async () => {
      await setup(waiting());
      expect(component.context(component.rows()[0])).toContain('en attente du GRD dans le CRM');
    });

    it('called active, needs the date it became active before confirming', async () => {
      await setup(waiting());
      component.setChoice(component.rows()[0], 'active');
      component.confirm();
      expect(confirmBaseline).not.toHaveBeenCalled();
      expect(component.formError()).toContain('541448000000000001');

      component.rows()[0].effectiveDate = new Date(2026, 4, 1);
      confirmBaseline.mockReturnValue(of(new ApiResponse(baseline({ status: 'confirmed' }))));
      component.confirm();
      expect(confirmBaseline).toHaveBeenCalledWith({
        choices: [
          { key: METER, choice: 'active', effective_date: '2026-05-01', sent_date: null },
          { key: KEY, choice: 'active', effective_date: '2025-03-01', sent_date: null },
        ],
      });
    });
  });

  it('applies one choice to every line that accepts it', async () => {
    await setup();
    component.bulkChoice = 'not_notified';
    component.applyBulk();
    expect(component.rows().map((r) => r.choice)).toEqual(['not_notified', 'not_notified']);
  });

  it('marks the EANs the core refused, and confirms nothing', async () => {
    await setup();
    confirmBaseline.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { data: 'conflict', error_code: 2373, conflicts: ['541448000000000001'] },
          }),
      ),
    );
    component.confirm();
    fixture.detectChanges();

    expect(byTestId(`baseline-confirm__row--${METER}`)?.className).toContain('border-red-300');
    expect(byTestId(`baseline-confirm__row--${KEY}`)?.className).not.toContain('border-red-300');
    expect(byTestId('baseline-confirm__error')?.textContent).toContain('541448000000000001');
  });

  it('reads back what was chosen once confirmed', async () => {
    const done = baseline({ status: 'confirmed', confirmed_at: '2026-10-29T10:00:00Z' });
    done.items[0] = { ...done.items[0], chosen: 'not_notified' };
    await setup(done);
    expect(byTestId('baseline-confirm__message--confirmed')).not.toBeNull();
    expect(byTestId('baseline-confirm__btn--confirm')).toBeNull();
    expect(byTestId(`baseline-confirm__row--${METER}`)?.textContent).toContain(
      'Pas encore notifié',
    );
  });

  describe('the procedures it asks about (phase 4)', () => {
    const CREATION = 'ask:CE_NOTIFICATION:0';
    const AUTHORISATION = 'ask:PARTAGE_AUTORISATION:3';

    function asking(): BaselineOut {
      const data = baseline();
      const asked = (key: string, code: string, fr: string, operation: number | null) => ({
        ...data.items[0],
        key,
        subject_type: 'procedure' as const,
        subject_ref: String(operation ?? 1),
        id_sharing_operation: operation,
        operation_name: operation ? 'Op Centre' : null,
        default_choice: 'not_notified' as const,
        procedure_code: code,
        procedure_labels: { fr, en: fr, nl: fr, de: fr },
        grd: null,
        start_date: null,
        crm_status: null,
      });
      data.items = [
        asked(CREATION, 'CE_NOTIFICATION', 'Notification de création de la CE', null),
        asked(AUTHORISATION, 'PARTAGE_AUTORISATION', 'Autorisation de partage', 3),
        ...data.items,
      ];
      return data;
    }

    it('lists the community first, then each operation above its meters', async () => {
      await setup(asking());
      const groups = component.groups();
      expect(groups.map((g) => g.name)).toEqual(['La communauté', 'Op Centre']);
      expect(groups[1].rows.map((r) => r.item.key)).toEqual([AUTHORISATION, METER, KEY]);
      const creation = byTestId(`baseline-confirm__row--${CREATION}`);
      expect(creation?.textContent).toContain('Notification de création de la CE');
      expect(creation?.textContent).toContain('Déjà faite auprès du régulateur ?');
    });

    it('says its choices as a procedure: done, to do, sent', async () => {
      await setup(asking());
      expect(component.rows()[0].options.map((o) => o.label)).toEqual([
        'Déjà faite',
        'À faire',
        'Envoyée, réponse attendue',
      ]);
    });

    it('sends its choice with the others', async () => {
      await setup(asking());
      component.setChoice(component.rows()[0], 'active');
      confirmBaseline.mockReturnValue(of(new ApiResponse(baseline({ status: 'confirmed' }))));

      component.confirm();

      const sent = confirmBaseline.mock.calls[0][0] as {
        choices: { key: string; choice: string }[];
      };
      expect(sent.choices.slice(0, 2)).toEqual([
        { key: CREATION, choice: 'active', effective_date: null, sent_date: null },
        { key: AUTHORISATION, choice: 'not_notified', effective_date: null, sent_date: null },
      ]);
    });
  });

  it('says the regulator is not supported: there is no starting state', async () => {
    await setup(baseline({ status: 'not_supported', regulator: 'BE-VLA-VREG', items: [] }));
    expect(byTestId('baseline-confirm__message--unsupported')?.textContent).toContain('VREG');
  });
});
