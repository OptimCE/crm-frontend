import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { BillingHub } from './billing-hub';

// Lightweight stand-ins so the hub's branching can be tested without pulling the
// real console/member-view (and their HTTP calls) into the fixture.
@Component({
  selector: 'app-billing-admin-console',
  standalone: true,
  template: '',
})
class StubAdminConsole {
  // The hub now forwards the deep-link params down to the console.
  readonly tab = input<string | null>(null);
  readonly participant = input<number | null>(null);
  readonly operation = input<number | null>(null);
}

@Component({ selector: 'app-billing-member-invoices', standalone: true, template: '' })
class StubMemberInvoices {}

describe('BillingHub', () => {
  let compareWithActiveRole: (role: Role) => boolean;

  function render(): ComponentFixture<BillingHub> {
    TestBed.configureTestingModule({
      imports: [BillingHub],
      providers: [
        // The hub now translates ?tab=/?participant=/?operation= into console inputs.
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        {
          provide: UserContextService,
          useValue: { compareWithActiveRole: (role: Role) => compareWithActiveRole(role) },
        },
      ],
    });
    TestBed.overrideComponent(BillingHub, {
      set: { imports: [StubAdminConsole, StubMemberInvoices] },
    });
    const fixture = TestBed.createComponent(BillingHub);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the admin console for a manager/admin', () => {
    compareWithActiveRole = (role) => role === Role.GESTIONNAIRE;
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('app-billing-admin-console')).not.toBeNull();
    expect(el.querySelector('app-billing-member-invoices')).toBeNull();
  });

  it('renders the member invoices view for a pure member', () => {
    compareWithActiveRole = () => false;
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('app-billing-member-invoices')).not.toBeNull();
    expect(el.querySelector('app-billing-admin-console')).toBeNull();
  });
});
