import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ImportSharingOperationMeters } from './import-sharing-operation-meters';
import { AddressPipe } from '../../pipes/address/address-pipe';
import { SharingOperationService } from '../../services/sharing_operation.service';
import { PartialMeterDTO } from '../../dtos/meter.dtos';
import {
  SharingOperationMetersQuery,
  SharingOperationMetersQueryType,
  SharingOperationPartialDTO,
} from '../../dtos/sharing_operation.dtos';
import { ApiResponsePaginated, Pagination } from '../../../core/dtos/api.response';
import { InjectionStatus, MeterDataStatus } from '../../types/meter.types';

// ── Helpers ──────────────────────────────────────────────────────────

function buildMeter(
  ean: string,
  injection_status: InjectionStatus | null = null,
  status = MeterDataStatus.ACTIVE,
): PartialMeterDTO {
  return {
    EAN: ean,
    meter_number: `MTR-${ean}`,
    address: { id: 1, street: 'Rue Test', number: '1', postcode: '1000', city: 'Brussels' },
    status,
    injection_status,
  } as PartialMeterDTO;
}

/** Two consumers and one injection point — the pre-tick rule has to tell them apart. */
const CONSUMER_A = buildMeter('EAN-CONSUMER-A');
const CONSUMER_B = buildMeter('EAN-CONSUMER-B');
const INJECTION = buildMeter('EAN-INJECTION', InjectionStatus.INJECTION_OWNER);
const defaultMeters = [CONSUMER_A, CONSUMER_B, INJECTION];

const operations: SharingOperationPartialDTO[] = [
  { id: 7, name: 'Op Seven' } as SharingOperationPartialDTO,
  { id: 8, name: 'Op Eight' } as SharingOperationPartialDTO,
];

function paginated(meters: PartialMeterDTO[]): ApiResponsePaginated<PartialMeterDTO[] | string> {
  return new ApiResponsePaginated(meters, new Pagination(1, 10, meters.length, 1));
}

/** The query object handed to the service on the most recent meters call. */
function lastMetersQuery(
  spy: ReturnType<typeof vi.fn>,
): Partial<Omit<SharingOperationMetersQuery, 'type'>> {
  const call = spy.mock.calls.at(-1) as [
    number,
    SharingOperationMetersQueryType,
    Partial<Omit<SharingOperationMetersQuery, 'type'>>,
  ];
  return call[2];
}

interface ServiceSpy {
  getSharingOperationMetersList: ReturnType<typeof vi.fn>;
  getSharingOperationList: ReturnType<typeof vi.fn>;
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('ImportSharingOperationMeters', () => {
  let component: ImportSharingOperationMeters;
  let fixture: ComponentFixture<ImportSharingOperationMeters>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let serviceSpy: ServiceSpy;

  async function setup(data: unknown = { idSharing: 1 }): Promise<void> {
    // A test may call setup() again to swap the dialog payload; TestBed refuses to be
    // reconfigured once a component exists, so start from a clean module every time.
    TestBed.resetTestingModule();
    dialogRefSpy = { close: vi.fn() };
    serviceSpy = {
      getSharingOperationMetersList: vi.fn().mockReturnValue(of(paginated(defaultMeters))),
      getSharingOperationList: vi
        .fn()
        .mockReturnValue(of(new ApiResponsePaginated(operations, new Pagination(1, 10, 2, 1)))),
    };

    await TestBed.configureTestingModule({
      imports: [ImportSharingOperationMeters, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: { data } },
        { provide: SharingOperationService, useValue: serviceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ImportSharingOperationMeters, {
        set: { imports: [TranslatePipe, AddressPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportSharingOperationMeters);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  // ── 1. Creation ──────────────────────────────────────────────────

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  // ── 2. Operation fixed by the caller ─────────────────────────────

  describe('with a fixed sharing operation', () => {
    beforeEach(async () => {
      await setup({ idSharing: 1 });
    });

    it('does not ask which operation to import from', () => {
      expect(component.needsOperationChoice).toBe(false);
      expect(serviceSpy.getSharingOperationList).not.toHaveBeenCalled();
    });

    it('loads the meters straight away using an AT_DATE snapshot', () => {
      expect(serviceSpy.getSharingOperationMetersList).toHaveBeenCalledTimes(1);
      const [id, type] = serviceSpy.getSharingOperationMetersList.mock.calls[0] as [
        number,
        SharingOperationMetersQueryType,
      ];
      expect(id).toBe(1);
      expect(type).toBe(SharingOperationMetersQueryType.AT_DATE);
    });

    it("sends today's date as `at`, formatted as a local YYYY-MM-DD calendar date", () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}`;
      expect(lastMetersQuery(serviceSpy.getSharingOperationMetersList).at).toBe(expected);
    });
  });

  // ── 3. Operation chosen in the dialog ────────────────────────────

  describe('without a fixed sharing operation', () => {
    beforeEach(async () => {
      await setup({});
    });

    it('asks which operation to import from and loads the list', () => {
      expect(component.needsOperationChoice).toBe(true);
      expect(serviceSpy.getSharingOperationList).toHaveBeenCalledTimes(1);
      expect(component.operations()).toEqual(operations);
    });

    it('does not query meters until an operation is picked', () => {
      expect(serviceSpy.getSharingOperationMetersList).not.toHaveBeenCalled();
    });

    it('loads that operation’s meters once one is picked', () => {
      component.onOperationChange(8);

      expect(component.selectedOperationId()).toBe(8);
      const [id] = serviceSpy.getSharingOperationMetersList.mock.calls[0] as [number];
      expect(id).toBe(8);
    });

    it('treats a missing dialog payload as "no operation chosen"', async () => {
      await setup(null);
      expect(component.needsOperationChoice).toBe(true);
    });
  });

  // ── 4. Pre-ticking consumers ─────────────────────────────────────

  describe('pre-ticking', () => {
    beforeEach(async () => {
      await setup({ idSharing: 1 });
    });

    it('pre-ticks consumers and leaves injection points unticked', () => {
      expect(component.isSelected(CONSUMER_A.EAN)).toBe(true);
      expect(component.isSelected(CONSUMER_B.EAN)).toBe(true);
      expect(component.isSelected(INJECTION.EAN)).toBe(false);
    });

    it('treats the frontend-only NONE injection status as a consumer', () => {
      const none = buildMeter('EAN-NONE', InjectionStatus.NONE);
      serviceSpy.getSharingOperationMetersList.mockReturnValue(of(paginated([none])));
      component.loadMeters();

      expect(component.isSelected('EAN-NONE')).toBe(true);
    });

    it('does not re-tick a meter the user deliberately unticked when it is seen again', () => {
      component.toggleMeter(CONSUMER_A.EAN);
      expect(component.isSelected(CONSUMER_A.EAN)).toBe(false);

      // Same rows come back, e.g. after paginating away and back.
      component.loadMeters();

      expect(component.isSelected(CONSUMER_A.EAN)).toBe(false);
      expect(component.isSelected(CONSUMER_B.EAN)).toBe(true);
    });

    it('pre-ticks consumers appearing on a later page without touching earlier choices', () => {
      component.toggleMeter(CONSUMER_B.EAN); // untick one from page 1
      const pageTwo = [
        buildMeter('EAN-PAGE2-CONSUMER'),
        buildMeter('EAN-PAGE2-INJ', InjectionStatus.AUTOPROD_OWNER),
      ];
      serviceSpy.getSharingOperationMetersList.mockReturnValue(of(paginated(pageTwo)));

      component.lazyLoad({ first: 10, rows: 10 });

      expect(component.isSelected('EAN-PAGE2-CONSUMER')).toBe(true);
      expect(component.isSelected('EAN-PAGE2-INJ')).toBe(false);
      expect(component.isSelected(CONSUMER_B.EAN)).toBe(false);
    });
  });

  // ── 5. Changing the snapshot ─────────────────────────────────────

  describe('changing the snapshot', () => {
    beforeEach(async () => {
      await setup({ idSharing: 1 });
    });

    it('refetches with the new `at` when the date changes', () => {
      component.onDateChange(new Date(2025, 5, 30)); // 2025-06-30, local

      expect(lastMetersQuery(serviceSpy.getSharingOperationMetersList).at).toBe('2025-06-30');
    });

    it('ignores a cleared date', () => {
      serviceSpy.getSharingOperationMetersList.mockClear();
      component.onDateChange(null);

      expect(serviceSpy.getSharingOperationMetersList).not.toHaveBeenCalled();
    });

    it('drops a stale selection when the date changes, then pre-ticks the new rows', () => {
      component.toggleMeter(CONSUMER_A.EAN); // untick
      serviceSpy.getSharingOperationMetersList.mockReturnValue(of(paginated([CONSUMER_A])));

      component.onDateChange(new Date(2025, 0, 1));

      // The untick belonged to the previous snapshot, so A is pre-ticked afresh.
      expect(component.isSelected(CONSUMER_A.EAN)).toBe(true);
      expect(component.selectedEans().size).toBe(1);
    });

    it('resets to the first page when the snapshot changes', () => {
      component.lazyLoad({ first: 10, rows: 10 });
      expect(component.filter().page).toBe(2);

      component.onDateChange(new Date(2025, 0, 1));

      expect(component.filter().page).toBe(1);
    });
  });

  // ── 6. lazyLoad ──────────────────────────────────────────────────

  describe('lazyLoad', () => {
    beforeEach(async () => {
      await setup({ idSharing: 1 });
      serviceSpy.getSharingOperationMetersList.mockClear();
    });

    it('derives the page from first/rows and reloads', () => {
      component.lazyLoad({ first: 20, rows: 10 });

      expect(component.filter().page).toBe(3);
      expect(serviceSpy.getSharingOperationMetersList).toHaveBeenCalledTimes(1);
    });

    it('applies the EAN column filter', () => {
      component.lazyLoad({
        first: 0,
        rows: 10,
        filters: { EAN: { value: 'EAN-123', matchMode: 'contains' } },
      });

      expect(component.filter().EAN).toBe('EAN-123');
    });

    it('clears the EAN filter when it is emptied', () => {
      component.lazyLoad({
        first: 0,
        rows: 10,
        filters: { EAN: { value: 'EAN-123', matchMode: 'contains' } },
      });
      component.lazyLoad({
        first: 0,
        rows: 10,
        filters: { EAN: { value: '', matchMode: 'contains' } },
      });

      expect(component.filter().EAN).toBeUndefined();
    });
  });

  // ── 7. Bulk selection ────────────────────────────────────────────

  describe('bulk selection', () => {
    beforeEach(async () => {
      await setup({ idSharing: 1 });
    });

    it('reports the page as fully selected only when every row is ticked', () => {
      expect(component.isPageFullySelected()).toBe(false); // the injection row is unticked

      component.toggleMeter(INJECTION.EAN);

      expect(component.isPageFullySelected()).toBe(true);
    });

    it('ticks and unticks the whole page', () => {
      component.togglePage(true);
      expect(component.selectedEans().size).toBe(defaultMeters.length);

      component.togglePage(false);
      expect(component.selectedEans().size).toBe(0);
    });

    it('selects every matching meter, not just the visible page', () => {
      const all = [
        buildMeter('EAN-ALL-1'),
        buildMeter('EAN-ALL-2', InjectionStatus.INJECTION_OWNER),
      ];
      serviceSpy.getSharingOperationMetersList.mockReturnValue(of(paginated(all)));

      component.selectAll();

      expect(lastMetersQuery(serviceSpy.getSharingOperationMetersList).limit).toBe(9999);
      // Even the injection point is taken — this is an explicit "select all".
      all.forEach((m) => expect(component.isSelected(m.EAN)).toBe(true));
    });

    it('clears the whole selection', () => {
      component.clearAll();
      expect(component.selectedEans().size).toBe(0);
    });
  });

  // ── 8. Status severity ───────────────────────────────────────────

  describe('getStatusSeverity', () => {
    beforeEach(async () => {
      await setup();
    });

    it.each([
      [MeterDataStatus.ACTIVE, 'success'],
      [MeterDataStatus.INACTIVE, 'danger'],
      [MeterDataStatus.WAITING_GRD, 'warn'],
      [MeterDataStatus.WAITING_MANAGER, 'warn'],
    ])('maps status %s to %s', (status, expected) => {
      expect(component.getStatusSeverity(status)).toBe(expected);
    });

    it('falls back to "info" for an unknown status', () => {
      expect(component.getStatusSeverity(99 as MeterDataStatus)).toBe('info');
    });

    it('labels statuses with translation keys rather than the raw enum number', () => {
      expect(component.getStatusLabel(MeterDataStatus.ACTIVE)).toBe(
        'SHARING_OPERATION.VIEW.METER.STATUS.ACTIVATED_LABEL',
      );
      expect(component.getStatusLabel(MeterDataStatus.INACTIVE)).toBe(
        'SHARING_OPERATION.VIEW.METER.STATUS.DEACTIVATED_LABEL',
      );
      expect(component.getStatusLabel(99 as MeterDataStatus)).toBe('');
    });
  });

  // ── 9. Dialog actions ────────────────────────────────────────────

  describe('dialog actions', () => {
    beforeEach(async () => {
      await setup({ idSharing: 1 });
    });

    it('confirm closes with the selected EANs', () => {
      component.clearAll();
      component.toggleMeter(CONSUMER_A.EAN);
      component.toggleMeter(INJECTION.EAN);

      component.confirm();

      expect(dialogRefSpy.close).toHaveBeenCalledWith([CONSUMER_A.EAN, INJECTION.EAN]);
    });

    it('cancel closes with null', () => {
      component.cancel();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
    });
  });
});
