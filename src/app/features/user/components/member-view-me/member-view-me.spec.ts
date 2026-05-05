import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MemberViewMe } from './member-view-me';
import { MeService } from '../../../../shared/services/me.service';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { MeCompanyDTO, MeIndividualDTO } from '../../../../shared/dtos/me.dtos';
import { MemberStatus, MemberType } from '../../../../shared/types/member.types';
import { CommunityDTO } from '../../../../shared/dtos/community.dtos';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { MemberViewBankingInfoTab } from '../../../member/components/member-view/member-view-tabs/tabs/member-view-banking-info-tab/member-view-banking-info-tab';
import { MemberViewManagerTab } from '../../../member/components/member-view/member-view-tabs/tabs/member-view-manager-tab/member-view-manager-tab';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

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

function buildCommunity(overrides: Partial<CommunityDTO> = {}): CommunityDTO {
  return {
    id: 1,
    name: 'Test community',
    logo_url: null,
    ...overrides,
  };
}

function buildIndividual(overrides: Partial<MeIndividualDTO> = {}): MeIndividualDTO {
  return {
    id: 42,
    name: 'Doe',
    member_type: MemberType.INDIVIDUAL,
    status: MemberStatus.ACTIVE,
    iban: 'BE00 0000 0000 0000',
    home_address: buildAddress(),
    billing_address: buildAddress(),
    NRN: '12345678901',
    first_name: 'John',
    email: 'john@example.com',
    phone_number: '0400000000',
    social_rate: false,
    community: buildCommunity(),
    ...overrides,
  } as MeIndividualDTO;
}

function buildCompany(overrides: Partial<MeCompanyDTO> = {}): MeCompanyDTO {
  return {
    id: 7,
    name: 'Acme SA',
    member_type: MemberType.COMPANY,
    status: MemberStatus.ACTIVE,
    iban: 'BE00 0000 0000 0001',
    home_address: buildAddress(),
    billing_address: buildAddress(),
    vat_number: 'BE0123456789',
    manager: {
      id: 99,
      NRN: '11111111111',
      name: 'Manager',
      surname: 'Smith',
      email: 'manager@example.com',
      phone_number: '0411111111',
    },
    community: buildCommunity(),
    ...overrides,
  } as MeCompanyDTO;
}

describe('MemberViewMe', () => {
  let component: MemberViewMe;
  let fixture: ComponentFixture<MemberViewMe>;

  let meServiceSpy: { getMemberById: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let activatedRouteMock: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

  async function createComponent(preInit?: () => void): Promise<void> {
    fixture = TestBed.createComponent(MemberViewMe);
    component = fixture.componentInstance;
    if (preInit) preInit();
    component.ngOnInit();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    activatedRouteMock = { snapshot: { paramMap: convertToParamMap({ id: '42' }) } };
    meServiceSpy = {
      getMemberById: vi
        .fn()
        .mockReturnValue(of(new ApiResponse<MeIndividualDTO | MeCompanyDTO>(buildIndividual()))),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [MemberViewMe, TranslateModule.forRoot()],
      providers: [
        { provide: MeService, useValue: meServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    })
      .overrideComponent(MemberViewMe, {
        remove: {
          imports: [
            BackArrow,
            MemberViewBankingInfoTab,
            MemberViewManagerTab,
            Tabs,
            TabList,
            Tab,
            TabPanels,
            TabPanel,
          ],
        },
        add: {
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  describe('Creation & Init', () => {
    it('should create', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should call getMemberById on init with route id', async () => {
      await createComponent();
      expect(meServiceSpy.getMemberById).toHaveBeenCalledWith(42);
    });

    it('should navigate to /users when no id in route', async () => {
      activatedRouteMock.snapshot.paramMap = convertToParamMap({});
      await createComponent();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/users']);
    });

    it('should clear isLoading after response', async () => {
      await createComponent();
      expect(component.isLoading()).toBe(false);
      expect(component.member()).toBeTruthy();
    });

    it('should set hasError on service error', async () => {
      meServiceSpy.getMemberById.mockReturnValue(throwError(() => new Error('boom')));
      await createComponent();
      expect(component.hasError()).toBe(true);
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('Member type branching', () => {
    it('sets individual signal for INDIVIDUAL member', async () => {
      await createComponent();
      expect(component.individual()).toBeTruthy();
      expect(component.legalEntity()).toBeUndefined();
    });

    it('sets legalEntity signal for COMPANY member', async () => {
      meServiceSpy.getMemberById.mockReturnValue(
        of(new ApiResponse<MeIndividualDTO | MeCompanyDTO>(buildCompany())),
      );
      await createComponent();
      expect(component.legalEntity()).toBeTruthy();
      expect(component.individual()).toBeUndefined();
    });

    it('manager computed returns the manager when present', async () => {
      meServiceSpy.getMemberById.mockReturnValue(
        of(new ApiResponse<MeIndividualDTO | MeCompanyDTO>(buildCompany())),
      );
      await createComponent();
      expect(component.manager()).toBeTruthy();
    });

    it('manager computed returns undefined when no manager', async () => {
      await createComponent();
      expect(component.manager()).toBeUndefined();
    });
  });

  describe('Read-only — no edit affordances rendered', () => {
    beforeEach(async () => {
      await createComponent();
      fixture.detectChanges();
    });

    it('does not render activate/deactivate/modify buttons', () => {
      const html = (fixture.nativeElement as HTMLElement).innerHTML;
      expect(html).not.toContain('member-view-me__btn--activate');
      expect(html).not.toContain('member-view-me__btn--deactivate');
      expect(html).not.toContain('member-view-me__btn--modify');
      expect(html).not.toContain('member-view-me__btn--invite');
    });
  });
});
