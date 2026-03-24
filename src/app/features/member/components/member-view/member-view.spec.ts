import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MemberView } from './member-view';
import { MemberService } from '../../../../shared/services/member.service';
import { InvitationService } from '../../../../shared/services/invitation.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  CompanyDTO,
  IndividualDTO,
  ManagerDTO,
  MemberLinkDTO,
} from '../../../../shared/dtos/member.dtos';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import { MemberStatus, MemberType } from '../../../../shared/types/member.types';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { PartialMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { MemberViewTabs } from './member-view-tabs/member-view-tabs';

// ── Helpers ────────────────────────────────────────────────────────

function buildAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Main St',
    number: 42,
    postcode: '1000',
    city: 'Brussels',
    ...overrides,
  };
}

function buildManager(overrides: Partial<ManagerDTO> = {}): ManagerDTO {
  return {
    id: 10,
    NRN: '99.01.01-001.01',
    name: 'Jane',
    surname: 'Manager',
    email: 'manager@test.com',
    phone_number: '0400000000',
    ...overrides,
  };
}

function buildIndividual(overrides: Partial<IndividualDTO> = {}): IndividualDTO {
  return {
    id: 1,
    name: 'Doe',
    first_name: 'John',
    member_type: MemberType.INDIVIDUAL,
    status: MemberStatus.ACTIVE,
    NRN: '90.01.01-001.01',
    email: 'john@test.com',
    phone_number: '0412345678',
    social_rate: false,
    iban: 'BE00000000000000',
    home_address: buildAddress(),
    billing_address: buildAddress({ id: 2 }),
    manager: buildManager(),
    ...overrides,
  };
}

function buildCompany(overrides: Partial<CompanyDTO> = {}): CompanyDTO {
  return {
    id: 2,
    name: 'Acme Corp',
    member_type: MemberType.COMPANY,
    status: MemberStatus.ACTIVE,
    vat_number: 'BE0123456789',
    iban: 'BE00000000000001',
    home_address: buildAddress(),
    billing_address: buildAddress({ id: 3 }),
    manager: buildManager(),
    ...overrides,
  };
}

function buildMemberLink(status: MemberStatus = MemberStatus.ACTIVE): MemberLinkDTO {
  return { id: 100, user_email: 'link@test.com', user_id: 5, status };
}

function buildMeter(status: MeterDataStatus = MeterDataStatus.INACTIVE): PartialMeterDTO {
  return {
    EAN: '541449000000000001',
    meter_number: 'M001',
    address: buildAddress(),
    status,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MemberView', () => {
  let component: MemberView;
  let fixture: ComponentFixture<MemberView>;

  let memberServiceSpy: {
    getMember: ReturnType<typeof vi.fn>;
    getMemberLink: ReturnType<typeof vi.fn>;
    patchMemberStatus: ReturnType<typeof vi.fn>;
    patchMemberLink: ReturnType<typeof vi.fn>;
    deleteMemberLink: ReturnType<typeof vi.fn>;
  };
  let invitationServiceSpy: {
    cancelMemberInvitation: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let snackbarSpy: { openSnackBar: ReturnType<typeof vi.fn> };
  let dialogServiceSpy: { open: ReturnType<typeof vi.fn> };
  let activatedRouteMock: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

  async function createComponent(preInitFn?: () => void): Promise<void> {
    fixture = TestBed.createComponent(MemberView);
    component = fixture.componentInstance;
    if (preInitFn) {
      preInitFn();
    }
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    activatedRouteMock = { snapshot: { paramMap: convertToParamMap({ id: '1' }) } };

    memberServiceSpy = {
      getMember: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<IndividualDTO | CompanyDTO>(buildIndividual()))),
      getMemberLink: vi.fn().mockReturnValue(of(new ApiResponse<MemberLinkDTO>(buildMemberLink()))),
      patchMemberStatus: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      patchMemberLink: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
      deleteMemberLink: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };

    invitationServiceSpy = {
      cancelMemberInvitation: vi.fn().mockReturnValue(of(new ApiResponse('OK'))),
    };

    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    snackbarSpy = { openSnackBar: vi.fn() };
    dialogServiceSpy = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [MemberView, TranslateModule.forRoot()],
      providers: [
        { provide: MemberService, useValue: memberServiceSpy },
        { provide: InvitationService, useValue: invitationServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    })
      .overrideComponent(MemberView, {
        remove: { imports: [BackArrow, MemberViewTabs], providers: [DialogService] },
        add: {
          providers: [{ provide: DialogService, useValue: dialogServiceSpy }],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    vi.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation(
      (key: string | string[]) =>
        Array.isArray(key)
          ? key.reduce<Record<string, string>>((acc, k) => ({ ...acc, [k]: k }), {})
          : key,
    );
  });

  // ── 1. Creation & Init ────────────────────────────────────────────

  describe('creation & init', () => {
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should call getMember on init with route id', async () => {
      await createComponent();
      expect(memberServiceSpy.getMember).toHaveBeenCalledWith(1);
    });

    it('should set isLoading to false after successful load', async () => {
      await createComponent();
      expect(component.isLoading()).toBe(false);
    });

    it('should set individual signal for INDIVIDUAL type member', async () => {
      await createComponent();
      expect(component.individual()).toBeTruthy();
      expect(component.individual()?.first_name).toBe('John');
    });

    it('should navigate away when route id is empty', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['//members/member/']);
    });

    it('should not call getMember when route id is empty', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(memberServiceSpy.getMember).not.toHaveBeenCalled();
    });
  });

  // ── 2. loadMember() ───────────────────────────────────────────────

  describe('loadMember', () => {
    it('should set individual signal and clear legalEntity for INDIVIDUAL member', async () => {
      await createComponent();
      expect(component.individual()).toBeTruthy();
      expect(component.legalEntity()).toBeUndefined();
    });

    it('should set legalEntity signal and clear individual for COMPANY member', async () => {
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(buildCompany())),
      );
      await createComponent();
      expect(component.legalEntity()).toBeTruthy();
      expect(component.individual()).toBeUndefined();
    });

    it('should call getMemberLink for individual invitation status', async () => {
      await createComponent();
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, { email: 'john@test.com' });
    });

    it('should call getMemberLink for manager invitation status when individual has manager', async () => {
      await createComponent();
      // Called twice: once for individual, once for manager
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, {
        email: 'manager@test.com',
      });
    });

    it('should call getMemberLink for manager invitation status for company member', async () => {
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(buildCompany())),
      );
      await createComponent();
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(2, {
        email: 'manager@test.com',
      });
    });

    it('should not call manager invitation when individual has no manager', async () => {
      const ind = buildIndividual({ manager: undefined });
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(ind)),
      );
      memberServiceSpy.getMemberLink.mockClear();
      await createComponent();
      // Individual invitation call made, but no manager call
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, { email: 'john@test.com' });
      expect(memberServiceSpy.getMemberLink).not.toHaveBeenCalledWith(1, {
        email: 'manager@test.com',
      });
    });

    it('should set hasError to true on service error', async () => {
      memberServiceSpy.getMember.mockReturnValue(throwError(() => new Error('fail')));
      await createComponent();
      expect(component.hasError()).toBe(true);
    });

    it('should set isLoading to false on service error', async () => {
      memberServiceSpy.getMember.mockReturnValue(throwError(() => new Error('fail')));
      await createComponent();
      expect(component.isLoading()).toBe(false);
    });
  });

  // ── 3. Computed signals ───────────────────────────────────────────

  describe('computed signals', () => {
    it('should return correct initials for individual ("JD")', async () => {
      await createComponent();
      expect(component['memberInitials']()).toBe('JD');
    });

    it('should return correct initial for company ("A")', async () => {
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(buildCompany())),
      );
      await createComponent();
      expect(component['memberInitials']()).toBe('A');
    });

    it('should return "?" when no member is set', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(component['memberInitials']()).toBe('?');
    });

    it('should return member from individual signal', async () => {
      await createComponent();
      expect(component.member()).toBeTruthy();
      expect(component.member()?.name).toBe('Doe');
    });

    it('should return member from legalEntity when no individual', async () => {
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(buildCompany())),
      );
      await createComponent();
      expect(component.member()?.name).toBe('Acme Corp');
    });

    it('should return manager from individual', async () => {
      await createComponent();
      expect(component['manager']()?.email).toBe('manager@test.com');
    });

    it('should return manager from legalEntity', async () => {
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(buildCompany())),
      );
      await createComponent();
      expect(component['manager']()?.email).toBe('manager@test.com');
    });

    it('should reflect member status', async () => {
      await createComponent();
      expect(component.status()).toBe(MemberStatus.ACTIVE);
    });

    it('should reflect member type', async () => {
      await createComponent();
      expect(component.membersType()).toBe(MemberType.INDIVIDUAL);
    });
  });

  // ── 4. loadInvitationStatusIndividual() ───────────────────────────

  describe('loadInvitationStatusIndividual', () => {
    beforeEach(async () => {
      // Prevent auto-loading invitation statuses during init
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      await createComponent();
      memberServiceSpy.getMemberLink.mockClear();
    });

    it('should set ACCEPTED when link status is ACTIVE', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink(MemberStatus.ACTIVE))),
      );
      component.loadInvitationStatusIndividual(1, 'john@test.com');
      // InvitationStatus.ACCEPTED = 1
      expect(component.individualInvitationStatus()).toBe(1);
    });

    it('should set PENDING when link status is PENDING', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink(MemberStatus.PENDING))),
      );
      component.loadInvitationStatusIndividual(1, 'john@test.com');
      // InvitationStatus.PENDING = 2
      expect(component.individualInvitationStatus()).toBe(2);
    });

    it('should set NO_INVITE when link status is INACTIVE', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink(MemberStatus.INACTIVE))),
      );
      component.loadInvitationStatusIndividual(1, 'john@test.com');
      // InvitationStatus.NO_INVITE = 3
      expect(component.individualInvitationStatus()).toBe(3);
    });

    it('should set NO_INVITE on error', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(throwError(() => new Error('fail')));
      component.loadInvitationStatusIndividual(1, 'john@test.com');
      expect(component.individualInvitationStatus()).toBe(3);
    });

    it('should store the invitation link', () => {
      const link = buildMemberLink(MemberStatus.ACTIVE);
      memberServiceSpy.getMemberLink.mockReturnValue(of(new ApiResponse<MemberLinkDTO>(link)));
      component.loadInvitationStatusIndividual(1, 'john@test.com');
      expect(component.individualInvitationLink()).toEqual(link);
    });
  });

  // ── 5. loadInvitationStatusManager() ──────────────────────────────

  describe('loadInvitationStatusManager', () => {
    beforeEach(async () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      await createComponent();
      memberServiceSpy.getMemberLink.mockClear();
    });

    it('should set ACCEPTED when link status is ACTIVE', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink(MemberStatus.ACTIVE))),
      );
      component.loadInvitationStatusManager(1, 'manager@test.com');
      expect(component.managerInvitationStatus()).toBe(1);
    });

    it('should set PENDING when link status is PENDING', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink(MemberStatus.PENDING))),
      );
      component.loadInvitationStatusManager(1, 'manager@test.com');
      expect(component.managerInvitationStatus()).toBe(2);
    });

    it('should set NO_INVITE when link status is INACTIVE', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink(MemberStatus.INACTIVE))),
      );
      component.loadInvitationStatusManager(1, 'manager@test.com');
      expect(component.managerInvitationStatus()).toBe(3);
    });

    it('should set NO_INVITE on error', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(throwError(() => new Error('fail')));
      component.loadInvitationStatusManager(1, 'manager@test.com');
      expect(component.managerInvitationStatus()).toBe(3);
    });

    it('should store the manager invitation link', () => {
      const link = buildMemberLink(MemberStatus.PENDING);
      memberServiceSpy.getMemberLink.mockReturnValue(of(new ApiResponse<MemberLinkDTO>(link)));
      component.loadInvitationStatusManager(1, 'manager@test.com');
      expect(component.managerInvitationLink()).toEqual(link);
    });
  });

  // ── 6. toModify() ─────────────────────────────────────────────────

  describe('toModify', () => {
    let dialogCloseSubject: Subject<unknown>;

    beforeEach(async () => {
      await createComponent();
      dialogCloseSubject = new Subject();
      dialogServiceSpy.open.mockReturnValue({
        onClose: dialogCloseSubject.asObservable(),
        destroy: vi.fn(),
      } as unknown as DynamicDialogRef);
    });

    it('should open dialog with member data', () => {
      component.toModify();
      expect(dialogServiceSpy.open).toHaveBeenCalled();
      const callArgs = dialogServiceSpy.open.mock.calls[0] as [
        unknown,
        { data: { member: unknown } },
      ];
      expect(callArgs[1].data.member).toEqual(component.individual());
    });

    it('should reload member and show snackbar on dialog close with response', () => {
      memberServiceSpy.getMember.mockClear();
      component.toModify();
      dialogCloseSubject.next(true);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
      expect(memberServiceSpy.getMember).toHaveBeenCalledWith(1);
    });

    it('should not reload member or show snackbar on dialog close without response', () => {
      memberServiceSpy.getMember.mockClear();
      component.toModify();
      dialogCloseSubject.next(undefined);
      expect(snackbarSpy.openSnackBar).not.toHaveBeenCalled();
      expect(memberServiceSpy.getMember).not.toHaveBeenCalled();
    });
  });

  // ── 7. setStatus() ────────────────────────────────────────────────

  describe('setStatus', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMember.mockClear();
    });

    it('should call patchMemberStatus with correct params', () => {
      component.setStatus(2);
      expect(memberServiceSpy.patchMemberStatus).toHaveBeenCalledWith({
        status: 2,
        id_member: 1,
      });
    });

    it('should show snackbar and reload member on success', () => {
      component.setStatus(3);
      expect(snackbarSpy.openSnackBar).toHaveBeenCalled();
      expect(memberServiceSpy.getMember).toHaveBeenCalledWith(1);
    });

    it('should show alert popup when deactivating member with active meters', () => {
      component.metersPartialList.set([buildMeter(MeterDataStatus.ACTIVE)]);
      component.setStatus(2);
      expect(component.alertPopupVisible()).toBe(true);
      expect(memberServiceSpy.patchMemberStatus).not.toHaveBeenCalled();
    });

    it('should not show alert when all meters are inactive', () => {
      component.metersPartialList.set([buildMeter(MeterDataStatus.INACTIVE)]);
      component.setStatus(2);
      expect(component.alertPopupVisible()).toBe(false);
      expect(memberServiceSpy.patchMemberStatus).toHaveBeenCalled();
    });

    it('should not show alert when meters list is empty', () => {
      component.metersPartialList.set([]);
      component.setStatus(2);
      expect(component.alertPopupVisible()).toBe(false);
      expect(memberServiceSpy.patchMemberStatus).toHaveBeenCalled();
    });

    it('should not check meters when member is not ACTIVE', async () => {
      const ind = buildIndividual({ status: MemberStatus.INACTIVE });
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(ind)),
      );
      await createComponent();
      component.metersPartialList.set([buildMeter(MeterDataStatus.ACTIVE)]);
      memberServiceSpy.patchMemberStatus.mockClear();
      component.setStatus(1);
      expect(component.alertPopupVisible()).toBe(false);
      expect(memberServiceSpy.patchMemberStatus).toHaveBeenCalled();
    });
  });

  // ── 8. invite() ───────────────────────────────────────────────────

  describe('invite', () => {
    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMemberLink.mockClear();
    });

    it('should call patchMemberLink with individual email when manager=false', () => {
      component.invite(false);
      expect(memberServiceSpy.patchMemberLink).toHaveBeenCalledWith({
        id_member: 1,
        user_email: 'john@test.com',
      });
    });

    it('should call patchMemberLink with manager email when manager=true', () => {
      component.invite(true);
      expect(memberServiceSpy.patchMemberLink).toHaveBeenCalledWith({
        id_member: 1,
        user_email: 'manager@test.com',
      });
    });

    it('should reload individual invitation status on success (manager=false)', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      component.invite(false);
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, { email: 'john@test.com' });
    });

    it('should reload manager invitation status on success (manager=true)', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      component.invite(true);
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, {
        email: 'manager@test.com',
      });
    });

    it('should call patchMemberLink with company manager email for company member', async () => {
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(buildCompany())),
      );
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      await createComponent();
      memberServiceSpy.patchMemberLink.mockClear();
      component.invite(true);
      expect(memberServiceSpy.patchMemberLink).toHaveBeenCalledWith({
        id_member: 2,
        user_email: 'manager@test.com',
      });
    });
  });

  // ── 9. cancel() ───────────────────────────────────────────────────

  describe('cancel', () => {
    const link = buildMemberLink(MemberStatus.PENDING);

    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMemberLink.mockClear();
    });

    it('should call cancelMemberInvitation with link id', () => {
      component.cancel(link);
      expect(invitationServiceSpy.cancelMemberInvitation).toHaveBeenCalledWith(100);
    });

    it('should reload individual invitation status on success (manager=false)', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      component.cancel(link, false);
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, { email: 'john@test.com' });
    });

    it('should reload manager invitation status on success (manager=true)', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      component.cancel(link, true);
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, {
        email: 'manager@test.com',
      });
    });

    it('should not call service when link has no id', () => {
      component.cancel({ status: MemberStatus.PENDING });
      expect(invitationServiceSpy.cancelMemberInvitation).not.toHaveBeenCalled();
    });
  });

  // ── 10. delete() ──────────────────────────────────────────────────

  describe('delete', () => {
    const link = buildMemberLink(MemberStatus.ACTIVE);

    beforeEach(async () => {
      await createComponent();
      memberServiceSpy.getMemberLink.mockClear();
    });

    it('should call deleteMemberLink with member id', () => {
      component.delete(link);
      expect(memberServiceSpy.deleteMemberLink).toHaveBeenCalledWith(1);
    });

    it('should reload individual invitation status on success (manager=false)', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      component.delete(link, false);
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, { email: 'john@test.com' });
    });

    it('should reload manager invitation status on success (manager=true)', () => {
      memberServiceSpy.getMemberLink.mockReturnValue(
        of(new ApiResponse<MemberLinkDTO>(buildMemberLink())),
      );
      component.delete(link, true);
      expect(memberServiceSpy.getMemberLink).toHaveBeenCalledWith(1, {
        email: 'manager@test.com',
      });
    });

    it('should not call service when link has no id', () => {
      component.delete({ status: MemberStatus.ACTIVE });
      expect(memberServiceSpy.deleteMemberLink).not.toHaveBeenCalled();
    });

    it('should not call service when member has no id or email', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      memberServiceSpy.getMember.mockReturnValue(
        of(new ApiResponse<IndividualDTO | CompanyDTO>(buildIndividual())),
      );
      await createComponent();
      // Component navigated away, no individual/legalEntity set
      component.delete(link);
      expect(memberServiceSpy.deleteMemberLink).not.toHaveBeenCalled();
    });
  });
});
