import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { MemberViewTabs } from './member-view-tabs';
import { MemberViewMeterTab } from './tabs/member-view-meter-tab/member-view-meter-tab';
import { MemberViewBankingInfoTab } from './tabs/member-view-banking-info-tab/member-view-banking-info-tab';
import { MemberViewDocumentsTab } from './tabs/member-view-documents-tab/member-view-documents-tab';
import { MemberViewManagerTab } from './tabs/member-view-manager-tab/member-view-manager-tab';
import { IndividualDTO, ManagerDTO } from '../../../../../shared/dtos/member.dtos';
import { MemberStatus, MemberType } from '../../../../../shared/types/member.types';

// ── Helpers ────────────────────────────────────────────────────────

function buildManager(): ManagerDTO {
  return {
    id: 1,
    NRN: '00000000001',
    name: 'Dupont',
    surname: 'Jean',
    email: 'jean@test.com',
    phone_number: '0600000001',
  };
}

function buildIndividual(overrides: Partial<IndividualDTO> = {}): IndividualDTO {
  return {
    id: 1,
    name: 'Dupont',
    member_type: MemberType.INDIVIDUAL,
    status: MemberStatus.ACTIVE,
    iban: 'BE68539007547034',
    home_address: { id: 1, street: 'Rue Test', number: 1, postcode: '1000', city: 'Bruxelles' },
    billing_address: {
      id: 2,
      street: 'Rue Facture',
      number: 2,
      postcode: '1000',
      city: 'Bruxelles',
    },
    NRN: '00000000001',
    first_name: 'Jean',
    email: 'jean@test.com',
    phone_number: '0600000001',
    social_rate: false,
    manager: buildManager(),
    ...overrides,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MemberViewTabs', () => {
  let component: MemberViewTabs;
  let fixture: ComponentFixture<MemberViewTabs>;

  async function createComponent(
    id: number = 1,
    member: IndividualDTO = buildIndividual(),
  ): Promise<void> {
    fixture = TestBed.createComponent(MemberViewTabs);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', id);
    fixture.componentRef.setInput('member', member);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewTabs, TranslateModule.forRoot()],
    })
      .overrideComponent(MemberViewTabs, {
        remove: {
          imports: [
            Tabs,
            TabList,
            TabPanels,
            TabPanel,
            Tab,
            MemberViewMeterTab,
            MemberViewBankingInfoTab,
            MemberViewDocumentsTab,
            MemberViewManagerTab,
          ],
        },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should expose the id input', async () => {
      await createComponent(42);
      expect(component.id()).toBe(42);
    });

    it('should expose the member input', async () => {
      const member = buildIndividual({ first_name: 'Alice' });
      await createComponent(1, member);
      expect(component.member()).toEqual(member);
    });
  });

  // ── 2. Conditional tab rendering ────────────────────────────────

  describe('conditional tab rendering', () => {
    it('should render meter tab when member status is ACTIVE (1)', async () => {
      await createComponent(1, buildIndividual({ status: MemberStatus.ACTIVE }));
      const html = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      // With NO_ERRORS_SCHEMA, p-tab elements are rendered as custom elements
      const tabs = html.querySelectorAll('p-tab');
      // Active member with manager → 4 tabs (Meter, Banking, Documents, Manager)
      expect(tabs.length).toBe(4);
    });

    it('should hide meter tab when member status is not ACTIVE', async () => {
      await createComponent(1, buildIndividual({ status: MemberStatus.INACTIVE }));
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      const tabs = html.querySelectorAll('p-tab');
      // Inactive member with manager → 3 tabs (Banking, Documents, Manager)
      expect(tabs.length).toBe(3);
    });

    it('should render manager tab when member has a manager', async () => {
      await createComponent(1, buildIndividual({ manager: buildManager() }));
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      const tabs = html.querySelectorAll('p-tab');
      expect(tabs.length).toBe(4);
    });

    it('should hide manager tab when member has no manager', async () => {
      await createComponent(1, buildIndividual({ manager: undefined }));
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      const tabs = html.querySelectorAll('p-tab');
      // Active member without manager → 3 tabs (Meter, Banking, Documents)
      expect(tabs.length).toBe(3);
    });

    it('should show only 2 tabs when inactive and no manager', async () => {
      await createComponent(
        1,
        buildIndividual({ status: MemberStatus.INACTIVE, manager: undefined }),
      );
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      const tabs = html.querySelectorAll('p-tab');
      // Inactive without manager → 2 tabs (Banking, Documents)
      expect(tabs.length).toBe(2);
    });
  });

  // ── 3. Tab panels ───────────────────────────────────────────────

  describe('tab panels', () => {
    it('should always render all 4 tab panels regardless of conditions', async () => {
      await createComponent(
        1,
        buildIndividual({ status: MemberStatus.INACTIVE, manager: undefined }),
      );
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      const panels = html.querySelectorAll('p-tabpanel');
      expect(panels.length).toBe(4);
    });
  });
});
