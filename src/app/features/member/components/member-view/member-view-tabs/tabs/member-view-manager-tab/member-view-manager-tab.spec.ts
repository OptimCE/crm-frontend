import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { MemberViewManagerTab } from './member-view-manager-tab';
import { IndividualDTO, ManagerDTO } from '../../../../../../../shared/dtos/member.dtos';
import { MemberStatus, MemberType } from '../../../../../../../shared/types/member.types';

// ── Helpers ────────────────────────────────────────────────────────

function buildManager(overrides: Partial<ManagerDTO> = {}): ManagerDTO {
  return {
    id: 1,
    NRN: '00000000001',
    name: 'Dupont',
    surname: 'Jean',
    email: 'jean.dupont@test.com',
    phone_number: '0600000001',
    ...overrides,
  };
}

function buildMember(overrides: Partial<IndividualDTO> = {}): IndividualDTO {
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

describe('MemberViewManagerTab', () => {
  let component: MemberViewManagerTab;
  let fixture: ComponentFixture<MemberViewManagerTab>;

  async function createComponent(member?: IndividualDTO): Promise<void> {
    fixture = TestBed.createComponent(MemberViewManagerTab);
    component = fixture.componentInstance;
    if (member) {
      fixture.componentRef.setInput('member', member);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewManagerTab, TranslateModule.forRoot()],
    })
      .overrideComponent(MemberViewManagerTab, {
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', async () => {
      await createComponent(buildMember());
      expect(component).toBeTruthy();
    });

    it('should create without member input', async () => {
      await createComponent();
      expect(component).toBeTruthy();
    });

    it('should expose the member input', async () => {
      const member = buildMember({ manager: buildManager({ name: 'Martin' }) });
      await createComponent(member);
      expect(component.member()).toEqual(member);
    });
  });

  // ── 2. Member with manager data ─────────────────────────────────

  describe('member with manager', () => {
    it('should have manager data accessible from member input', async () => {
      const manager = buildManager({
        NRN: '99999999999',
        surname: 'Alice',
        name: 'Martin',
        email: 'alice@test.com',
        phone_number: '0612345678',
      });
      await createComponent(buildMember({ manager }));
      expect(component.member()?.manager).toEqual(manager);
    });

    it('should handle member without manager', async () => {
      await createComponent(buildMember({ manager: undefined }));
      expect(component.member()?.manager).toBeUndefined();
    });
  });
});
