import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MeterDataUpdate } from './meter-data-update';
import { MemberService } from '../../../../shared/services/member.service';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { MetersDataDTO } from '../../../../shared/dtos/meter.dtos';
import { MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import {
  MeterDataStatus,
  ClientType,
  InjectionStatus,
  MeterRate,
  ProductionChain,
} from '../../../../shared/types/meter.types';
import { MemberStatus, MemberType } from '../../../../shared/types/member.types';

// ── Helpers ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

function buildMember(overrides: Partial<MembersPartialDTO> = {}): MembersPartialDTO {
  return {
    id: 1,
    name: 'John Doe',
    member_type: MemberType.INDIVIDUAL,
    status: MemberStatus.ACTIVE,
    ...overrides,
  };
}

function buildMeterData(overrides: Partial<MetersDataDTO> = {}): MetersDataDTO {
  return {
    id: 100,
    description: 'Test meter',
    sampling_power: 10,
    status: MeterDataStatus.ACTIVE,
    amperage: 25,
    rate: MeterRate.SIMPLE,
    client_type: ClientType.RESIDENTIAL,
    start_date: '2024-01-01',
    injection_status: InjectionStatus.NONE,
    production_chain: ProductionChain.PHOTOVOLTAIC,
    totalGenerating_capacity: 5,
    member: buildMember(),
    grd: 'RESA',
    ...overrides,
  };
}

function buildMembersResponse(members: MembersPartialDTO[] = [buildMember()]) {
  return { data: members, meta: { total: members.length, page: 1, limit: 10 } };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('MeterDataUpdate', () => {
  let component: MeterDataUpdate;
  let fixture: ComponentFixture<MeterDataUpdate>;
  let memberServiceSpy: { getMembersList: ReturnType<typeof vi.fn> };
  let meterServiceSpy: { patchMeterData: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let membersSubject$: Subject<unknown>;

  /** Call ngOnInit then emit the members response so the form exists first. */
  function initAndEmitMembers(members: MembersPartialDTO[] = [buildMember()]) {
    component.ngOnInit();
    membersSubject$.next(buildMembersResponse(members));
    membersSubject$.complete();
  }

  // ── With meterData (default scenario) ────────────────────────────

  describe('with meterData provided', () => {
    beforeEach(async () => {
      membersSubject$ = new Subject();
      memberServiceSpy = {
        getMembersList: vi.fn().mockReturnValue(membersSubject$.asObservable()),
      };
      meterServiceSpy = { patchMeterData: vi.fn().mockReturnValue(of({ data: 'ok' })) };
      dialogRefSpy = { close: vi.fn() };
      errorHandlerSpy = { handleError: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [MeterDataUpdate, TranslateModule.forRoot()],
        providers: [
          { provide: MemberService, useValue: memberServiceSpy },
          { provide: MeterService, useValue: meterServiceSpy },
          {
            provide: DynamicDialogConfig,
            useValue: { data: { meterData: buildMeterData(), id: 'EAN123' } },
          },
          { provide: DynamicDialogRef, useValue: dialogRefSpy },
          { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      fixture = TestBed.createComponent(MeterDataUpdate);
      component = fixture.componentInstance;
    });

    it('should create the component', () => {
      initAndEmitMembers();
      expect(component).toBeTruthy();
    });

    it('should initialize the form with all required controls', () => {
      initAndEmitMembers();

      const controlNames = [
        'description',
        'samplingPower',
        'totalGeneratingCapacity',
        'amperage',
        'rate',
        'productionChain',
        'clientType',
        'member',
        'dateStart',
        'status',
        'injectionStatus',
        'grd',
      ];
      for (const name of controlNames) {
        expect(component.metersForm.get(name)).toBeTruthy();
      }
    });

    it('should patch form values from meterData when provided', () => {
      initAndEmitMembers();
      const meterData = buildMeterData();

      expect(component.metersForm.get('description')?.value).toBe(meterData.description);
      expect(component.metersForm.get('samplingPower')?.value).toBe(meterData.sampling_power);
      expect(component.metersForm.get('totalGeneratingCapacity')?.value).toBe(
        meterData.totalGenerating_capacity,
      );
      expect(component.metersForm.get('amperage')?.value).toBe(meterData.amperage);
      expect(component.metersForm.get('status')?.value).toBe(meterData.status);
    });

    it('should fetch members list on init and set membersList signal', () => {
      const members = [buildMember(), buildMember({ id: 2, name: 'Jane Doe' })];
      initAndEmitMembers(members);

      expect(component.membersList().length).toBe(2);
    });

    it('should patch member control when meterData has a member', () => {
      initAndEmitMembers();

      const memberValue = component.metersForm.get('member')?.value as MembersPartialDTO;
      expect(memberValue).toBeTruthy();
      expect(memberValue.id).toBe(1);
    });

    it('should log error when getMembersList returns no data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(noop);
      component.ngOnInit();
      membersSubject$.next({ data: null });
      membersSubject$.complete();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error when getMembersList fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(noop);
      component.ngOnInit();
      membersSubject$.error(new Error('Network error'));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should mark form as valid when all required fields are filled', () => {
      initAndEmitMembers();

      component.metersForm.patchValue({
        dateStart: new Date('2024-01-01'),
      });

      expect(component.metersForm.valid).toBe(true);
    });

    it('should invalidate member control with invalidMember error for non-listed member', () => {
      initAndEmitMembers();

      const unlisted = buildMember({ id: 999, name: 'Unknown' });
      component.metersForm.get('member')?.setValue(unlisted);

      expect(component.metersForm.get('member')?.hasError('invalidMember')).toBe(true);
    });

    it('should accept a member that exists in membersList', () => {
      initAndEmitMembers();

      const listed = component.membersList()[0];
      component.metersForm.get('member')?.setValue(listed);

      expect(component.metersForm.get('member')?.hasError('invalidMember')).toBe(false);
    });

    it('should populate productionChainCategory with 8 entries', () => {
      initAndEmitMembers();

      const categories = component.productionChainCategory();
      expect(categories.length).toBe(8);
      for (const cat of categories) {
        expect(cat.id).toBeDefined();
      }
    });

    it('should populate rateCategory with 3 entries', () => {
      initAndEmitMembers();
      expect(component.rateCategory().length).toBe(3);
    });

    it('should populate clientCategory with 3 entries', () => {
      initAndEmitMembers();
      expect(component.clientCategory().length).toBe(3);
    });

    it('should populate injectionStatusCategory with 5 entries', () => {
      initAndEmitMembers();
      expect(component.injectionStatusCategory().length).toBe(5);
    });

    it('should have 4 status options', () => {
      expect(component.statusOptions.length).toBe(4);
    });

    it('should include ACTIVE, INACTIVE, WAITING_GRD, and WAITING_MANAGER statuses', () => {
      const values = component.statusOptions.map((o) => o.value);
      expect(values).toContain(MeterDataStatus.ACTIVE);
      expect(values).toContain(MeterDataStatus.INACTIVE);
      expect(values).toContain(MeterDataStatus.WAITING_GRD);
      expect(values).toContain(MeterDataStatus.WAITING_MANAGER);
    });

    it('should call patchMeterData and close dialog on success', () => {
      initAndEmitMembers();
      component.metersForm.patchValue({ dateStart: new Date(2024, 0, 1) });

      component.onSubmit();

      expect(meterServiceSpy.patchMeterData).toHaveBeenCalled();
      // Calendar date is sent as YYYY-MM-DD built from local Date components,
      // so it survives any timezone — guards the off-by-one bug.
      expect(meterServiceSpy.patchMeterData).toHaveBeenCalledWith(
        expect.objectContaining({ start_date: '2024-01-01' }),
      );
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should call errorHandler.handleError when patchMeterData returns falsy', () => {
      meterServiceSpy.patchMeterData.mockReturnValue(of(null));
      initAndEmitMembers();
      component.metersForm.patchValue({ dateStart: new Date('2024-01-01') });

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });

    it('should call errorHandler.handleError on patchMeterData error', () => {
      meterServiceSpy.patchMeterData.mockReturnValue(throwError(() => ({ data: 'some error' })));
      initAndEmitMembers();
      component.metersForm.patchValue({ dateStart: new Date('2024-01-01') });

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('some error');
    });
  });

  // ── Without meterData ────────────────────────────────────────────

  describe('without meterData', () => {
    beforeEach(async () => {
      membersSubject$ = new Subject();
      memberServiceSpy = {
        getMembersList: vi.fn().mockReturnValue(membersSubject$.asObservable()),
      };
      meterServiceSpy = { patchMeterData: vi.fn().mockReturnValue(of({ data: 'ok' })) };
      dialogRefSpy = { close: vi.fn() };
      errorHandlerSpy = { handleError: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [MeterDataUpdate, TranslateModule.forRoot()],
        providers: [
          { provide: MemberService, useValue: memberServiceSpy },
          { provide: MeterService, useValue: meterServiceSpy },
          {
            provide: DynamicDialogConfig,
            useValue: { data: { meterData: undefined, id: 'EAN123' } },
          },
          { provide: DynamicDialogRef, useValue: dialogRefSpy },
          { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      fixture = TestBed.createComponent(MeterDataUpdate);
      component = fixture.componentInstance;
    });

    it('should leave form with default values when no meterData is provided', () => {
      initAndEmitMembers();

      expect(component.metersForm.get('description')?.value).toBe('');
      expect(component.metersForm.get('samplingPower')?.value).toBe('');
      expect(component.metersForm.get('amperage')?.value).toBe('');
    });

    it('should mark form as invalid when required fields are empty', () => {
      initAndEmitMembers();
      expect(component.metersForm.valid).toBe(false);
    });

    it('should not call meterService when form is invalid', () => {
      initAndEmitMembers();

      component.onSubmit();

      expect(meterServiceSpy.patchMeterData).not.toHaveBeenCalled();
    });
  });
});
