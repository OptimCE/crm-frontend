import { signal, WritableSignal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { Role } from '../../../../core/dtos/role';
import {
  ROLE_HIERARCHY,
  UserContextService,
} from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { CommunityAnnex } from '../../../../shared/dtos/annexes_services.dtos';
import { ManagerDashboard } from './manager-dashboard';

function annex(feature: string, subscribed: boolean, minRole: Role): CommunityAnnex {
  return {
    feature,
    subscribed,
    minRole,
    displayKey: `ANNEXES_SERVICES.${feature}.NAME`,
    descriptionKey: `ANNEXES_SERVICES.${feature}.DESCRIPTION`,
    icon: 'pi pi-box',
    frontendRoute: `/${feature}`,
    subscribePath: `/annexes-services/${feature}/subscribe`,
    unsubscribePath: `/annexes-services/${feature}/unsubscribe`,
  };
}

const ANNEXE_PATH_PREFIXES = ['/billing', '/news', '/administrative-document'];

describe('ManagerDashboard', () => {
  let httpMock: HttpTestingController;
  let services: WritableSignal<CommunityAnnex[]>;
  let activeRole: WritableSignal<Role>;

  function render(): ComponentFixture<ManagerDashboard> {
    TestBed.configureTestingModule({
      imports: [ManagerDashboard, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: {
            activeCommunityId: signal<string | null>('org-a'),
            activeCommunity: signal<{ name: string } | null>({ name: 'Test Community' }),
            compareWithActiveRole: (role: Role) =>
              ROLE_HIERARCHY[activeRole()] >= ROLE_HIERARCHY[role],
          },
        },
        {
          provide: CommunityServicesStore,
          useValue: {
            services,
            ensureLoaded: () => of(services()),
            reload: () => of(services()),
            canReach: (feature: string) => {
              const entry = services().find((s) => s.feature === feature);
              return (
                !!entry?.subscribed && ROLE_HIERARCHY[activeRole()] >= ROLE_HIERARCHY[entry.minRole]
              );
            },
          },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ManagerDashboard);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    activeRole = signal<Role>(Role.GESTIONNAIRE);
    services = signal<CommunityAnnex[]>([
      annex('billing', false, Role.MEMBER),
      annex('news', false, Role.MEMBER),
      annex('administrative-document', false, Role.GESTIONNAIRE),
    ]);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('fires zero requests for an unsubscribed annexe', () => {
    render();

    // Not "swallows the 403" — the tiles are never INSTANTIATED, so no request
    // is made at all. This is the cross-cutting rule for a community that has
    // bought nothing, which is every new community and every prospect.
    for (const prefix of ANNEXE_PATH_PREFIXES) {
      httpMock.expectNone((request) => {
        const path = new URL(request.url, 'http://localhost').pathname;
        return path.startsWith(prefix);
      });
    }
  });

  it('renders the discovery strip listing exactly the unsubscribed modules', () => {
    const el = render().nativeElement as HTMLElement;

    const strip = el.querySelector('[data-testid="module-discovery-strip"]');
    expect(strip).not.toBeNull();
    expect(strip?.querySelectorAll('li')).toHaveLength(3);
  });

  it('offers an admin an enable control and a manager an explanation', () => {
    activeRole.set(Role.ADMIN);
    const adminEl = render().nativeElement as HTMLElement;
    expect(
      adminEl.querySelector('[data-testid="module-discovery-strip__btn--enable-billing"]'),
    ).not.toBeNull();
    expect(adminEl.querySelector('[data-testid="module-discovery-strip__ask-admin"]')).toBeNull();

    TestBed.resetTestingModule();
    activeRole = signal<Role>(Role.GESTIONNAIRE);
    const managerEl = render().nativeElement as HTMLElement;
    // Only ADMIN can POST /annexes-services/:feature/subscribe, so a manager gets
    // a sentence — not a button that 403s, and not a disabled dead end.
    expect(
      managerEl.querySelector('[data-testid="module-discovery-strip__btn--enable-billing"]'),
    ).toBeNull();
    expect(
      managerEl.querySelector('[data-testid="module-discovery-strip__ask-admin"]'),
    ).not.toBeNull();
  });

  it('hides an annexe the role cannot reach even when it is subscribed', () => {
    // administrative-document declares minRole MANAGER in the catalogue. This
    // asserts the gate reads that rather than hardcoding a role.
    services.set([annex('administrative-document', true, Role.ADMIN)]);
    render();

    httpMock.expectNone((request) =>
      new URL(request.url, 'http://localhost').pathname.startsWith('/administrative-document'),
    );
  });
});
