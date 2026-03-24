import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TranslatePipe } from '@ngx-translate/core';
import { AddressPipe } from '../../../../../../shared/pipes/address/address-pipe';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SelectMeterNewKeyDialog } from './select-meter-new-key-dialog';
import { SharingOperationService } from '../../../../../../shared/services/sharing_operation.service';
import { PartialMeterDTO } from '../../../../../../shared/dtos/meter.dtos';
import { SharingOperationMetersQueryType } from '../../../../../../shared/dtos/sharing_operation.dtos';
import { ApiResponsePaginated, Pagination } from '../../../../../../core/dtos/api.response';
import { MeterDataStatus } from '../../../../../../shared/types/meter.types';

// ── Helpers ──────────────────────────────────────────────────────────

function buildMeter(ean: string, status = MeterDataStatus.ACTIVE): PartialMeterDTO {
  return {
    EAN: ean,
    meter_number: `MTR-${ean}`,
    address: { id: 1, street: 'Rue Test', number: 1, postcode: '1000', city: 'Brussels' },
    status,
  } as PartialMeterDTO;
}

const metersNow = [buildMeter('EAN-NOW-1'), buildMeter('EAN-NOW-2', MeterDataStatus.INACTIVE)];
const metersFuture = [buildMeter('EAN-FUT-1', MeterDataStatus.WAITING_GRD)];

function buildPaginatedResponse(
  meters: PartialMeterDTO[],
): ApiResponsePaginated<PartialMeterDTO[] | string> {
  return new ApiResponsePaginated(meters, new Pagination(1, 10, meters.length, 1));
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('SelectMeterNewKeyDialog', () => {
  let component: SelectMeterNewKeyDialog;
  let fixture: ComponentFixture<SelectMeterNewKeyDialog>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let serviceSpy: { getSharingOperationMetersList: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };
    serviceSpy = {
      getSharingOperationMetersList: vi
        .fn()
        .mockImplementation((_id: number, query: { type: SharingOperationMetersQueryType }) => {
          if (query.type === SharingOperationMetersQueryType.NOW) {
            return of(buildPaginatedResponse(metersNow));
          }
          return of(buildPaginatedResponse(metersFuture));
        }),
    };

    await TestBed.configureTestingModule({
      imports: [SelectMeterNewKeyDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: { data: { idSharing: 1 } } },
        { provide: SharingOperationService, useValue: serviceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SelectMeterNewKeyDialog, {
        set: {
          imports: [TranslatePipe, AddressPipe],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SelectMeterNewKeyDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── 1. Creation ──────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── 2. Initialization ────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should call getSharingOperationMetersList twice (NOW + FUTURE)', () => {
      expect(serviceSpy.getSharingOperationMetersList).toHaveBeenCalledTimes(2);
    });

    it('should populate listNow with response data', () => {
      expect(component.listNow()).toEqual(metersNow);
    });

    it('should populate listFuture with response data', () => {
      expect(component.listFuture()).toEqual(metersFuture);
    });

    it('should set loadingNow to false after load', () => {
      expect(component.loadingNow()).toBe(false);
    });

    it('should set loadingFuture to false after load', () => {
      expect(component.loadingFuture()).toBe(false);
    });

    it('should set paginationNow from response', () => {
      const p = component.paginationNow();
      expect(p.total).toBe(metersNow.length);
      expect(p.page).toBe(1);
    });

    it('should set paginationFuture from response', () => {
      const p = component.paginationFuture();
      expect(p.total).toBe(metersFuture.length);
    });
  });

  // ── 3. Getter methods ────────────────────────────────────────────

  describe('getter methods', () => {
    it('getList should return listNow for NOW type', () => {
      expect(component.getList(SharingOperationMetersQueryType.NOW)).toBe(component.listNow);
    });

    it('getList should return listFuture for FUTURE type', () => {
      expect(component.getList(SharingOperationMetersQueryType.FUTURE)).toBe(component.listFuture);
    });

    it('getLoading should return loadingNow for NOW type', () => {
      expect(component.getLoading(SharingOperationMetersQueryType.NOW)).toBe(component.loadingNow);
    });

    it('getLoading should return loadingFuture for FUTURE type', () => {
      expect(component.getLoading(SharingOperationMetersQueryType.FUTURE)).toBe(
        component.loadingFuture,
      );
    });

    it('getPagination should return paginationNow for NOW type', () => {
      expect(component.getPagination(SharingOperationMetersQueryType.NOW)).toBe(
        component.paginationNow,
      );
    });

    it('getPagination should return paginationFuture for FUTURE type', () => {
      expect(component.getPagination(SharingOperationMetersQueryType.FUTURE)).toBe(
        component.paginationFuture,
      );
    });

    it('getFilter should return filterNow for NOW type', () => {
      expect(component.getFilter(SharingOperationMetersQueryType.NOW)).toBe(component.filterNow);
    });

    it('getFilter should return filterFuture for FUTURE type', () => {
      expect(component.getFilter(SharingOperationMetersQueryType.FUTURE)).toBe(
        component.filterFuture,
      );
    });
  });

  // ── 4. lazyLoad ──────────────────────────────────────────────────

  describe('lazyLoad', () => {
    beforeEach(() => {
      serviceSpy.getSharingOperationMetersList.mockClear();
    });

    it('should update page from event.first/event.rows and reload meters', () => {
      component.lazyLoad({ first: 10, rows: 10 }, SharingOperationMetersQueryType.NOW);

      expect(component.filterNow().page).toBe(2);
      expect(serviceSpy.getSharingOperationMetersList).toHaveBeenCalledTimes(1);
    });

    it('should set EAN filter from event filters', () => {
      component.lazyLoad(
        { first: 0, rows: 10, filters: { EAN: { value: 'EAN-123', matchMode: 'contains' } } },
        SharingOperationMetersQueryType.NOW,
      );

      expect(component.filterNow().EAN).toBe('EAN-123');
    });

    it('should remove EAN filter when filter value is an array', () => {
      // First set a filter
      component.lazyLoad(
        { first: 0, rows: 10, filters: { EAN: { value: 'EAN-123', matchMode: 'contains' } } },
        SharingOperationMetersQueryType.NOW,
      );
      expect(component.filterNow().EAN).toBe('EAN-123');

      // Then clear it with array filter
      component.lazyLoad(
        { first: 0, rows: 10, filters: { EAN: [{ value: null, matchMode: 'contains' }] } },
        SharingOperationMetersQueryType.NOW,
      );
      expect(component.filterNow().EAN).toBeUndefined();
    });

    it('should remove EAN filter when filter value is falsy', () => {
      component.lazyLoad(
        { first: 0, rows: 10, filters: { EAN: { value: '', matchMode: 'contains' } } },
        SharingOperationMetersQueryType.NOW,
      );
      expect(component.filterNow().EAN).toBeUndefined();
    });
  });

  // ── 5. Selection logic ───────────────────────────────────────────

  describe('selection logic', () => {
    describe('isSelected', () => {
      it('should return false for unselected meter', () => {
        expect(component.isSelected('EAN-NOW-1')).toBe(false);
      });

      it('should return true for selected meter', () => {
        component.selectedMeters.set('EAN-NOW-1', SharingOperationMetersQueryType.NOW);
        expect(component.isSelected('EAN-NOW-1')).toBe(true);
      });
    });

    describe('toggleMeter', () => {
      it('should add meter to selection when not selected', () => {
        component.toggleMeter(metersNow[0], SharingOperationMetersQueryType.NOW);
        expect(component.selectedMeters.has('EAN-NOW-1')).toBe(true);
        expect(component.selectedMeters.get('EAN-NOW-1')).toBe(SharingOperationMetersQueryType.NOW);
      });

      it('should remove meter from selection when already selected', () => {
        component.selectedMeters.set('EAN-NOW-1', SharingOperationMetersQueryType.NOW);
        component.toggleMeter(metersNow[0], SharingOperationMetersQueryType.NOW);
        expect(component.selectedMeters.has('EAN-NOW-1')).toBe(false);
      });
    });

    describe('isPageFullySelected', () => {
      it('should return false when no meters are selected', () => {
        expect(component.isPageFullySelected(SharingOperationMetersQueryType.NOW)).toBe(false);
      });

      it('should return false when only some page meters are selected', () => {
        component.selectedMeters.set('EAN-NOW-1', SharingOperationMetersQueryType.NOW);
        expect(component.isPageFullySelected(SharingOperationMetersQueryType.NOW)).toBe(false);
      });

      it('should return true when all page meters are selected', () => {
        metersNow.forEach((m) =>
          component.selectedMeters.set(m.EAN, SharingOperationMetersQueryType.NOW),
        );
        expect(component.isPageFullySelected(SharingOperationMetersQueryType.NOW)).toBe(true);
      });
    });

    describe('togglePage', () => {
      it('should select all meters on current page when selectAll is true', () => {
        component.togglePage(SharingOperationMetersQueryType.NOW, true);
        expect(component.selectedMeters.size).toBe(metersNow.length);
        metersNow.forEach((m) => expect(component.selectedMeters.has(m.EAN)).toBe(true));
      });

      it('should deselect all meters on current page when selectAll is false', () => {
        metersNow.forEach((m) =>
          component.selectedMeters.set(m.EAN, SharingOperationMetersQueryType.NOW),
        );
        component.togglePage(SharingOperationMetersQueryType.NOW, false);
        expect(component.selectedMeters.size).toBe(0);
      });
    });

    describe('selectAllInTab', () => {
      it('should call service with limit 9999 and add all returned meters', () => {
        const allMeters = [
          buildMeter('EAN-ALL-1'),
          buildMeter('EAN-ALL-2'),
          buildMeter('EAN-ALL-3'),
        ];
        serviceSpy.getSharingOperationMetersList.mockReturnValueOnce(
          of(buildPaginatedResponse(allMeters)),
        );

        component.selectAllInTab(SharingOperationMetersQueryType.NOW);

        const lastCall = serviceSpy.getSharingOperationMetersList.mock.calls.at(-1) as [
          number,
          { limit: number },
        ];
        expect(lastCall[1].limit).toBe(9999);
        allMeters.forEach((m) => expect(component.selectedMeters.has(m.EAN)).toBe(true));
      });
    });

    describe('countSelected', () => {
      it('should count only meters of the given type', () => {
        component.selectedMeters.set('EAN-NOW-1', SharingOperationMetersQueryType.NOW);
        component.selectedMeters.set('EAN-NOW-2', SharingOperationMetersQueryType.NOW);
        component.selectedMeters.set('EAN-FUT-1', SharingOperationMetersQueryType.FUTURE);

        expect(component.countSelected(SharingOperationMetersQueryType.NOW)).toBe(2);
        expect(component.countSelected(SharingOperationMetersQueryType.FUTURE)).toBe(1);
      });

      it('should return 0 when no meters of the given type are selected', () => {
        expect(component.countSelected(SharingOperationMetersQueryType.NOW)).toBe(0);
      });
    });

    describe('selectedMetersArray', () => {
      it('should return selected meters from both lists with their types', () => {
        component.selectedMeters.set('EAN-NOW-1', SharingOperationMetersQueryType.NOW);
        component.selectedMeters.set('EAN-FUT-1', SharingOperationMetersQueryType.FUTURE);

        const result = component.selectedMetersArray();

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          meter: metersNow[0],
          type: SharingOperationMetersQueryType.NOW,
        });
        expect(result[1]).toEqual({
          meter: metersFuture[0],
          type: SharingOperationMetersQueryType.FUTURE,
        });
      });

      it('should return empty array when no meters are selected', () => {
        expect(component.selectedMetersArray()).toEqual([]);
      });
    });
  });

  // ── 6. getStatusSeverity ─────────────────────────────────────────

  describe('getStatusSeverity', () => {
    it('should return "success" for ACTIVE status', () => {
      expect(component.getStatusSeverity(MeterDataStatus.ACTIVE)).toBe('success');
    });

    it('should return "danger" for INACTIVE status', () => {
      expect(component.getStatusSeverity(MeterDataStatus.INACTIVE)).toBe('danger');
    });

    it('should return "warn" for WAITING_GRD status', () => {
      expect(component.getStatusSeverity(MeterDataStatus.WAITING_GRD)).toBe('warn');
    });

    it('should return "warn" for WAITING_MANAGER status', () => {
      expect(component.getStatusSeverity(MeterDataStatus.WAITING_MANAGER)).toBe('warn');
    });

    it('should return "info" for unknown status', () => {
      expect(component.getStatusSeverity(99 as MeterDataStatus)).toBe('info');
    });
  });

  // ── 7. Dialog actions ────────────────────────────────────────────

  describe('dialog actions', () => {
    it('confirm should close dialog with selected meter EANs', () => {
      component.selectedMeters.set('EAN-NOW-1', SharingOperationMetersQueryType.NOW);
      component.selectedMeters.set('EAN-FUT-1', SharingOperationMetersQueryType.FUTURE);

      component.confirm();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(['EAN-NOW-1', 'EAN-FUT-1']);
    });

    it('confirm should close with empty array when nothing selected', () => {
      component.confirm();
      expect(dialogRefSpy.close).toHaveBeenCalledWith([]);
    });

    it('cancel should close dialog with null', () => {
      component.cancel();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
    });
  });
});
