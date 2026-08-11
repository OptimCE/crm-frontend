import { Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Role } from '../../../../core/dtos/role';
import {
  ROLE_HIERARCHY,
  UserContextService,
} from '../../../../core/services/authorization/authorization.service';
import { DashboardPage } from './dashboard-page';

// Stand-ins so the branch can be tested without dragging either dashboard's
// tiles — and their HTTP calls — into the fixture.
@Component({ selector: 'app-manager-dashboard', standalone: true, template: '' })
class StubManagerDashboard {}

@Component({ selector: 'app-member-dashboard', standalone: true, template: '' })
class StubMemberDashboard {}

describe('DashboardPage', () => {
  let activeRole: WritableSignal<Role | null>;

  function render(): ComponentFixture<DashboardPage> {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        {
          provide: UserContextService,
          useValue: {
            activeCommunityRole: activeRole,
            compareWithActiveRole: (role: Role) => {
              const current = activeRole();
              return current !== null && ROLE_HIERARCHY[current] >= ROLE_HIERARCHY[role];
            },
          },
        },
      ],
    });
    TestBed.overrideComponent(DashboardPage, {
      set: { imports: [StubManagerDashboard, StubMemberDashboard] },
    });
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    activeRole = signal<Role | null>(null);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the manager dashboard for a manager', () => {
    activeRole.set(Role.GESTIONNAIRE);
    const el = render().nativeElement as HTMLElement;

    expect(el.querySelector('app-manager-dashboard')).not.toBeNull();
    expect(el.querySelector('app-member-dashboard')).toBeNull();
  });

  it('renders the manager dashboard for an admin', () => {
    activeRole.set(Role.ADMIN);
    const el = render().nativeElement as HTMLElement;

    expect(el.querySelector('app-manager-dashboard')).not.toBeNull();
  });

  it('renders the member dashboard for a plain member', () => {
    activeRole.set(Role.MEMBER);
    const el = render().nativeElement as HTMLElement;

    expect(el.querySelector('app-member-dashboard')).not.toBeNull();
    expect(el.querySelector('app-manager-dashboard')).toBeNull();
  });

  it('swaps the branch when the active community role changes', () => {
    // The guarantee this test exists for: role is a property of the ACTIVE
    // COMMUNITY, not of the session. The same person is MANAGER in one community
    // and MEMBER in another, so a value cached at login would show one
    // community's dashboard under another community's name.
    activeRole.set(Role.GESTIONNAIRE);
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-manager-dashboard')).not.toBeNull();

    activeRole.set(Role.MEMBER);
    fixture.detectChanges();

    expect(el.querySelector('app-member-dashboard')).not.toBeNull();
    expect(el.querySelector('app-manager-dashboard')).toBeNull();
  });
});
