import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';

import { InvitationDetailComponent } from './invitation-detail.component';
import {
  IndividualDTO,
  CompanyDTO,
  ManagerDTO,
} from '../../../../../../../../shared/dtos/member.dtos';
import { AddressDTO } from '../../../../../../../../shared/dtos/address.dtos';
import { MemberType, MemberStatus } from '../../../../../../../../shared/types/member.types';

function buildAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    id: 1,
    street: 'Rue de la Loi',
    number: 16,
    postcode: '1000',
    city: 'Bruxelles',
    ...overrides,
  };
}

function buildManager(overrides: Partial<ManagerDTO> = {}): ManagerDTO {
  return {
    id: 10,
    NRN: '99.01.01-001.01',
    name: 'ManagerFirst',
    surname: 'ManagerLast',
    email: 'manager@example.com',
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
    iban: 'BE68539007547034',
    NRN: '90.01.01-123.45',
    email: 'john.doe@example.com',
    phone_number: '0471234567',
    social_rate: true,
    home_address: buildAddress(),
    billing_address: buildAddress({ id: 2, street: 'Avenue Louise', number: 100 }),
    ...overrides,
  };
}

function buildCompany(overrides: Partial<CompanyDTO> = {}): CompanyDTO {
  return {
    id: 2,
    name: 'Acme Corp',
    member_type: MemberType.COMPANY,
    status: MemberStatus.ACTIVE,
    iban: 'BE68539007547034',
    vat_number: 'BE0123456789',
    manager: buildManager(),
    home_address: buildAddress(),
    billing_address: buildAddress({ id: 3, street: 'Boulevard Anspach', number: 50 }),
    ...overrides,
  };
}

function getEl(fixture: ComponentFixture<InvitationDetailComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function createComponent(dialogData: Record<string, unknown> | undefined): Promise<{
  fixture: ComponentFixture<InvitationDetailComponent>;
  component: InvitationDetailComponent;
}> {
  return TestBed.configureTestingModule({
    imports: [InvitationDetailComponent, TranslateModule.forRoot()],
    providers: [{ provide: DynamicDialogConfig, useValue: { data: dialogData } }],
    schemas: [NO_ERRORS_SCHEMA],
  })
    .compileComponents()
    .then(() => {
      const fixture = TestBed.createComponent(InvitationDetailComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      return { fixture, component };
    });
}

describe('InvitationDetailComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('component creation and loading state', () => {
    it('should create the component', async () => {
      const { component } = await createComponent({
        member: buildIndividual(),
        member_type: MemberType.INDIVIDUAL,
      });
      expect(component).toBeTruthy();
    });

    it('should show loading spinner when no data is provided', async () => {
      const { fixture, component } = await createComponent(undefined);
      expect(component.isLoading()).toBe(true);
      const spinner = getEl(fixture).querySelector('p-progressSpinner');
      expect(spinner).toBeTruthy();
    });

    it('should remain loading when member_type is missing', async () => {
      const { component } = await createComponent({ member: buildIndividual() });
      expect(component.isLoading()).toBe(true);
    });

    it('should remain loading when member is missing', async () => {
      const { component } = await createComponent({ member_type: MemberType.INDIVIDUAL });
      expect(component.isLoading()).toBe(true);
    });
  });

  describe('individual member display', () => {
    let fixture: ComponentFixture<InvitationDetailComponent>;
    let component: InvitationDetailComponent;
    const individual = buildIndividual();

    beforeEach(async () => {
      ({ fixture, component } = await createComponent({
        member: individual,
        member_type: MemberType.INDIVIDUAL,
      }));
    });

    it('should set individual signal and clear loading', () => {
      expect(component.isLoading()).toBe(false);
      expect(component.individual()).toEqual(individual);
      expect(component.legalEntity()).toBeUndefined();
    });

    it('should display the individual icon (pi-user)', () => {
      const icon = getEl(fixture).querySelector('i.pi-user');
      expect(icon).toBeTruthy();
    });

    it('should not display the company icon', () => {
      const icon = getEl(fixture).querySelector('i.pi-building');
      expect(icon).toBeFalsy();
    });

    it('should display the NRN', () => {
      expect(getEl(fixture).textContent).toContain(individual.NRN);
    });

    it('should display the name', () => {
      expect(getEl(fixture).textContent).toContain(individual.name);
    });

    it('should display the first name', () => {
      expect(getEl(fixture).textContent).toContain(individual.first_name);
    });

    it('should display the email', () => {
      expect(getEl(fixture).textContent).toContain(individual.email);
    });

    it('should display the phone number', () => {
      expect(getEl(fixture).textContent).toContain(individual.phone_number);
    });

    it('should display the social rate checkbox', () => {
      const checkbox = getEl(fixture).querySelector('p-checkbox');
      expect(checkbox).toBeTruthy();
    });

    it('should not display VAT number section', () => {
      expect(getEl(fixture).textContent).not.toContain('BE0123456789');
    });
  });

  describe('company (legal entity) display', () => {
    let fixture: ComponentFixture<InvitationDetailComponent>;
    let component: InvitationDetailComponent;
    const company = buildCompany();

    beforeEach(async () => {
      ({ fixture, component } = await createComponent({
        member: company,
        member_type: MemberType.COMPANY,
      }));
    });

    it('should set legalEntity signal and clear loading', () => {
      expect(component.isLoading()).toBe(false);
      expect(component.legalEntity()).toEqual(company);
      expect(component.individual()).toBeUndefined();
    });

    it('should display the company icon (pi-building)', () => {
      const icon = getEl(fixture).querySelector('i.pi-building');
      expect(icon).toBeTruthy();
    });

    it('should not display the individual icon', () => {
      const icon = getEl(fixture).querySelector('i.pi-user');
      expect(icon).toBeFalsy();
    });

    it('should display the VAT number', () => {
      expect(getEl(fixture).textContent).toContain(company.vat_number);
    });

    it('should display the company name', () => {
      expect(getEl(fixture).textContent).toContain(company.name);
    });

    it('should not display social rate checkbox', () => {
      const checkbox = getEl(fixture).querySelector('p-checkbox');
      expect(checkbox).toBeFalsy();
    });

    it('should not display individual-specific fields (first name, email, phone)', () => {
      const text = getEl(fixture).textContent;
      expect(text).not.toContain('john.doe@example.com');
      expect(text).not.toContain('0471234567');
    });
  });

  describe('manager / guardianship section', () => {
    it('should display guardianship section for individual with manager', async () => {
      const manager = buildManager();
      const individual = buildIndividual({ manager });
      const { fixture } = await createComponent({
        member: individual,
        member_type: MemberType.INDIVIDUAL,
      });
      const text = getEl(fixture).textContent;
      expect(text).toContain(manager.NRN);
      expect(text).toContain(manager.surname);
      expect(text).toContain(manager.name);
      expect(text).toContain(manager.email);
      expect(text).toContain(manager.phone_number ?? '');
    });

    it('should display guardianship section for company with manager', async () => {
      const manager = buildManager();
      const company = buildCompany({ manager });
      const { fixture } = await createComponent({
        member: company,
        member_type: MemberType.COMPANY,
      });
      const text = getEl(fixture).textContent;
      expect(text).toContain(manager.NRN);
      expect(text).toContain(manager.surname);
      expect(text).toContain(manager.name);
      expect(text).toContain(manager.email);
    });

    it('should not display guardianship section for individual without manager', async () => {
      const individual = buildIndividual({ manager: undefined });
      const { fixture } = await createComponent({
        member: individual,
        member_type: MemberType.INDIVIDUAL,
      });
      const text = getEl(fixture).textContent;
      expect(text).not.toContain('99.01.01-001.01');
    });
  });

  describe('address display', () => {
    it('should render home and billing address elements for individual', async () => {
      const { fixture } = await createComponent({
        member: buildIndividual(),
        member_type: MemberType.INDIVIDUAL,
      });
      const paragraphs = getEl(fixture).querySelectorAll('p.text-sm');
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    });

    it('should render home and billing address elements for company', async () => {
      const { fixture } = await createComponent({
        member: buildCompany(),
        member_type: MemberType.COMPANY,
      });
      const paragraphs = getEl(fixture).querySelectorAll('p.text-sm');
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
