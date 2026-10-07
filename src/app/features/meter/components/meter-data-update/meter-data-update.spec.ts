import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
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
  let confirmationSpy: { confirm: ReturnType<typeof vi.fn> };
  let membersSubject$: Subject<unknown>;

  const janeDoe = buildMember({ id: 2, name: 'Jane Doe' });

  async function configureTestBed(meterData: MetersDataDTO | undefined) {
    membersSubject$ = new Subject();
    memberServiceSpy = {
      getMembersList: vi.fn().mockReturnValue(membersSubject$.asObservable()),
    };
    meterServiceSpy = { patchMeterData: vi.fn().mockReturnValue(of({ data: 'ok' })) };
    dialogRefSpy = { close: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    confirmationSpy = { confirm: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MeterDataUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: MemberService, useValue: memberServiceSpy },
        { provide: MeterService, useValue: meterServiceSpy },
        {
          provide: DynamicDialogConfig,
          useValue: { data: { meterData, id: 'EAN123' } },
        },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // The real ConfirmDialog would subscribe to the spy's (absent) requireConfirmation$.
      .overrideComponent(MeterDataUpdate, {
        remove: { imports: [ConfirmDialog], providers: [ConfirmationService] },
        add: {
          providers: [{ provide: ConfirmationService, useValue: confirmationSpy }],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MeterDataUpdate);
    component = fixture.componentInstance;
  }

  /** Call ngOnInit then emit the members response so the form exists first. */
  function initAndEmitMembers(members: MembersPartialDTO[] = [buildMember()]) {
    component.ngOnInit();
    membersSubject$.next(buildMembersResponse(members));
    membersSubject$.complete();
  }

  function lastConfirmation(): Confirmation {
    return confirmationSpy.confirm.mock.calls.at(-1)?.[0] as Confirmation;
  }

  // ── With meterData (default scenario) ────────────────────────────

  describe('with meterData provided', () => {
    beforeEach(async () => {
      await configureTestBed(buildMeterData());
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
      expect(component.statusOptions().length).toBe(4);
    });

    it('should include ACTIVE, INACTIVE, WAITING_GRD, and WAITING_MANAGER statuses', () => {
      const values = component.statusOptions().map((o) => o.value);
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
      // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
      const message = 'The start date overlaps an existing period of this meter';
      meterServiceSpy.patchMeterData.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 422, error: { data: message, error_code: 2017 } }),
        ),
      );
      initAndEmitMembers();
      component.metersForm.patchValue({ dateStart: new Date('2024-01-01') });

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    });

    it('should load enough members for the whole community to be selectable', () => {
      initAndEmitMembers();

      expect(memberServiceSpy.getMembersList).toHaveBeenCalledWith({ page: 1, limit: 500 });
    });

    // ── Holder change confirmation ─────────────────────────────────

    it('should save without confirmation when the holder is unchanged', () => {
      initAndEmitMembers([buildMember(), janeDoe]);
      component.metersForm.patchValue({ dateStart: new Date(2024, 0, 1) });

      component.onSubmit();

      expect(confirmationSpy.confirm).not.toHaveBeenCalled();
      expect(meterServiceSpy.patchMeterData).toHaveBeenCalledWith(
        expect.objectContaining({ member_id: 1 }),
      );
    });

    it('should ask for confirmation before transferring the meter to another member', () => {
      const instantSpy = vi.spyOn(TestBed.inject(TranslateService), 'instant');
      initAndEmitMembers([buildMember(), janeDoe]);
      component.metersForm.patchValue({ member: janeDoe, dateStart: new Date(2024, 0, 1) });

      component.onSubmit();

      expect(meterServiceSpy.patchMeterData).not.toHaveBeenCalled();
      expect(confirmationSpy.confirm).toHaveBeenCalledTimes(1);
      const confirmation = lastConfirmation();
      expect(confirmation.header).toBe('METER.UPDATE_DATA.HOLDER_CHANGE.HEADER');
      expect(confirmation.message).toBe('METER.UPDATE_DATA.HOLDER_CHANGE.TRANSFER_MESSAGE');
      expect(instantSpy).toHaveBeenCalledWith('METER.UPDATE_DATA.HOLDER_CHANGE.TRANSFER_MESSAGE', {
        ean: 'EAN123',
        from: 'John Doe',
        to: 'Jane Doe',
        date: '01/01/2024',
      });
    });

    it('should save the new holder once the transfer is confirmed', () => {
      initAndEmitMembers([buildMember(), janeDoe]);
      component.metersForm.patchValue({ member: janeDoe, dateStart: new Date(2024, 0, 1) });
      component.onSubmit();

      (lastConfirmation().accept as () => void)();

      expect(meterServiceSpy.patchMeterData).toHaveBeenCalledWith(
        expect.objectContaining({ member_id: 2, start_date: '2024-01-01' }),
      );
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should neither save nor close when the transfer is not confirmed', () => {
      initAndEmitMembers([buildMember(), janeDoe]);
      component.metersForm.patchValue({ member: janeDoe, dateStart: new Date(2024, 0, 1) });

      component.onSubmit();

      expect(confirmationSpy.confirm).toHaveBeenCalledTimes(1);
      expect(meterServiceSpy.patchMeterData).not.toHaveBeenCalled();
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });

    it('should ask for confirmation before removing the holder', () => {
      initAndEmitMembers();
      component.metersForm.patchValue({ member: null, dateStart: new Date(2024, 0, 1) });

      component.onSubmit();

      expect(meterServiceSpy.patchMeterData).not.toHaveBeenCalled();
      expect(lastConfirmation().message).toBe('METER.UPDATE_DATA.HOLDER_CHANGE.REMOVE_MESSAGE');

      (lastConfirmation().accept as () => void)();

      const payload = meterServiceSpy.patchMeterData.mock.calls[0][0] as { member_id?: number };
      expect(payload.member_id).toBeUndefined();
    });
  });

  // ── Holder outside the loaded page of members ────────────────────

  describe('with a holder outside the loaded page of members', () => {
    const farHolder = buildMember({ id: 42, name: 'Far Holder' });

    beforeEach(async () => {
      await configureTestBed(buildMeterData({ member: farHolder }));
    });

    it('should keep the current holder selectable and pre-filled', () => {
      initAndEmitMembers([buildMember(), janeDoe]);

      expect(component.membersList().map((m) => m.id)).toEqual([42, 1, 2]);
      const memberControl = component.metersForm.get('member');
      expect((memberControl?.value as MembersPartialDTO).id).toBe(42);
      expect(memberControl?.valid).toBe(true);
    });

    it('should save without confirmation when the holder is left untouched', () => {
      initAndEmitMembers([buildMember(), janeDoe]);
      component.metersForm.patchValue({ dateStart: new Date(2024, 0, 1) });

      component.onSubmit();

      expect(confirmationSpy.confirm).not.toHaveBeenCalled();
      expect(meterServiceSpy.patchMeterData).toHaveBeenCalledWith(
        expect.objectContaining({ member_id: 42 }),
      );
    });
  });

  // ── Members list served from cache ───────────────────────────────

  // Within the cache TTL, getMembersList emits synchronously, i.e. during ngOnInit itself
  // (every opening of the dialog after the first one).
  describe('when the members list is served from cache (synchronous emission)', () => {
    function initWithCachedMembers(members: MembersPartialDTO[]) {
      memberServiceSpy.getMembersList.mockReturnValue(of(buildMembersResponse(members)));
      component.ngOnInit();
    }

    it('should pre-fill the current holder', async () => {
      await configureTestBed(buildMeterData());
      initWithCachedMembers([buildMember(), janeDoe]);

      const memberControl = component.metersForm.get('member');
      expect((memberControl?.value as MembersPartialDTO).id).toBe(1);
      expect(memberControl?.valid).toBe(true);
    });

    it('should save the untouched holder without asking to remove it', async () => {
      await configureTestBed(buildMeterData());
      initWithCachedMembers([buildMember(), janeDoe]);
      component.metersForm.patchValue({ dateStart: new Date(2024, 0, 1) });

      component.onSubmit();

      expect(confirmationSpy.confirm).not.toHaveBeenCalled();
      expect(meterServiceSpy.patchMeterData).toHaveBeenCalledWith(
        expect.objectContaining({ member_id: 1 }),
      );
    });

    it('should pre-fill a holder outside the loaded page of members', async () => {
      await configureTestBed(buildMeterData({ member: buildMember({ id: 42, name: 'Far' }) }));
      initWithCachedMembers([buildMember(), janeDoe]);

      expect((component.metersForm.get('member')?.value as MembersPartialDTO).id).toBe(42);
    });
  });

  // ── Without meterData ────────────────────────────────────────────

  describe('without meterData', () => {
    beforeEach(async () => {
      await configureTestBed(undefined);
    });

    /** Fill every required control so the form is valid; the holder is left to the test. */
    function fillRequiredFields() {
      component.metersForm.patchValue({
        samplingPower: 10,
        totalGeneratingCapacity: 5,
        amperage: 25,
        rate: component.rateCategory()[0],
        productionChain: component.productionChainCategory()[0],
        clientType: component.clientCategory()[0],
        status: MeterDataStatus.ACTIVE,
        injectionStatus: component.injectionStatusCategory()[0],
        grd: component.grdAvailable[0],
        dateStart: new Date(2024, 0, 1),
      });
    }

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

    it('should save without confirmation when no holder is set', () => {
      initAndEmitMembers();
      fillRequiredFields();

      component.onSubmit();

      expect(confirmationSpy.confirm).not.toHaveBeenCalled();
      expect(meterServiceSpy.patchMeterData).toHaveBeenCalled();
    });

    it('should ask for confirmation before assigning a first holder', () => {
      const instantSpy = vi.spyOn(TestBed.inject(TranslateService), 'instant');
      initAndEmitMembers([buildMember(), janeDoe]);
      fillRequiredFields();
      component.metersForm.patchValue({ member: janeDoe });

      component.onSubmit();

      expect(meterServiceSpy.patchMeterData).not.toHaveBeenCalled();
      expect(lastConfirmation().message).toBe('METER.UPDATE_DATA.HOLDER_CHANGE.ASSIGN_MESSAGE');
      expect(instantSpy).toHaveBeenCalledWith('METER.UPDATE_DATA.HOLDER_CHANGE.ASSIGN_MESSAGE', {
        ean: 'EAN123',
        from: '',
        to: 'Jane Doe',
        date: '01/01/2024',
      });

      (lastConfirmation().accept as () => void)();

      expect(meterServiceSpy.patchMeterData).toHaveBeenCalledWith(
        expect.objectContaining({ member_id: 2 }),
      );
    });
  });

  // ── Translated select labels ─────────────────────────────────────

  // PrimeNG copies an option's label into the select's aria-label, so a key
  // there is what a screen reader announces.
  describe('status select labels', () => {
    let translate: TranslateService;

    function statusAriaLabel(): string | null {
      return (
        (fixture.nativeElement as HTMLElement)
          .querySelector('[data-testid="meter-data-update__select--status"] [role="combobox"]')
          ?.getAttribute('aria-label') ?? null
      );
    }

    beforeEach(async () => {
      await configureTestBed(buildMeterData({ status: MeterDataStatus.WAITING_GRD }));
      translate = TestBed.inject(TranslateService);
      translate.setTranslation('fr', {
        METER: {
          STATUS: {
            ACTIVE_LABEL: 'Actif',
            INACTIVE_LABEL: 'Inactif',
            WAITING_GRD_LABEL: 'En attente du GRD',
            WAITING_MANAGER_LABEL: 'En attente du gestionnaire',
          },
        },
      });
      translate.setTranslation('en', {
        METER: {
          STATUS: {
            ACTIVE_LABEL: 'Active',
            INACTIVE_LABEL: 'Inactive',
            WAITING_GRD_LABEL: 'Waiting for the DSO',
            WAITING_MANAGER_LABEL: 'Waiting for the manager',
          },
        },
      });
      translate.use('fr');
      initAndEmitMembers();
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should label the options with their translation, keeping the values', () => {
      expect(component.statusOptions()).toEqual([
        { value: MeterDataStatus.ACTIVE, label: 'Actif' },
        { value: MeterDataStatus.INACTIVE, label: 'Inactif' },
        { value: MeterDataStatus.WAITING_GRD, label: 'En attente du GRD' },
        { value: MeterDataStatus.WAITING_MANAGER, label: 'En attente du gestionnaire' },
      ]);
    });

    it('should give the current status a translated aria-label that follows the language', async () => {
      expect(statusAriaLabel()).toBe('En attente du GRD');

      translate.use('en');
      await fixture.whenStable();
      expect(statusAriaLabel()).toBe('Waiting for the DSO');
    });
  });
});
