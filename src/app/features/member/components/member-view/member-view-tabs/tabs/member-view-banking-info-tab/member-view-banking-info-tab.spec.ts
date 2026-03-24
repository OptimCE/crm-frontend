import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { MemberViewBankingInfoTab } from './member-view-banking-info-tab';
import { IndividualDTO } from '../../../../../../../shared/dtos/member.dtos';
import { MemberStatus, MemberType } from '../../../../../../../shared/types/member.types';

// ── Helpers ────────────────────────────────────────────────────────

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
    ...overrides,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MemberViewBankingInfoTab', () => {
  let component: MemberViewBankingInfoTab;
  let fixture: ComponentFixture<MemberViewBankingInfoTab>;

  async function createComponent(member?: IndividualDTO): Promise<void> {
    fixture = TestBed.createComponent(MemberViewBankingInfoTab);
    component = fixture.componentInstance;
    if (member) {
      fixture.componentRef.setInput('member', member);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewBankingInfoTab, TranslateModule.forRoot()],
    })
      .overrideComponent(MemberViewBankingInfoTab, {
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
      const member = buildMember({ iban: 'BE00000000000000' });
      await createComponent(member);
      expect(component.member()).toEqual(member);
    });
  });

  // ── 2. copyIban ─────────────────────────────────────────────────

  describe('copyIban', () => {
    let writeTextSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextSpy },
      });
    });

    it('should copy IBAN to clipboard when IBAN exists', async () => {
      await createComponent(buildMember({ iban: 'BE68539007547034' }));
      component.copyIban();
      expect(writeTextSpy).toHaveBeenCalledWith('BE68539007547034');
    });

    it('should not call clipboard when IBAN is empty', async () => {
      await createComponent(buildMember({ iban: '' }));
      component.copyIban();
      expect(writeTextSpy).not.toHaveBeenCalled();
    });

    it('should not call clipboard when member is undefined', async () => {
      await createComponent();
      component.copyIban();
      expect(writeTextSpy).not.toHaveBeenCalled();
    });
  });
});
