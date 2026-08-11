import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { Role } from '../../../../core/dtos/role';
import { ActiveCommunityStore } from '../../../../core/services/active-community.store';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { CommunityDetailDTO } from '../../../../shared/dtos/community.dtos';
import { MemberDashboard } from './member-dashboard';

/**
 * Prefixes a member must never touch. All of these carry
 * `roleChecker(Role.GESTIONNAIRE)` in crm-backend and would answer 401/403.
 */
const MANAGER_ONLY_PREFIXES = [
  '/members',
  '/meters',
  '/keys',
  '/sharing_operations',
  '/invitations',
  '/audit-logs',
  '/communities/dashboard',
  '/administrative-document/',
];

const COMMUNITY: CommunityDetailDTO = {
  id: 7,
  name: 'Test Community',
  auth_community_id: 'org-a',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  member_count: 12,
  regulator: 'BE-WAL-CWAPE',
} as CommunityDetailDTO;

describe('MemberDashboard', () => {
  let httpMock: HttpTestingController;
  let subscribed: WritableSignal<Record<string, boolean>>;

  function render(): void {
    TestBed.configureTestingModule({
      imports: [MemberDashboard, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: {
            activeCommunityId: signal<string | null>('org-a'),
            activeCommunity: signal<{ name: string } | null>({ name: 'Test Community' }),
            compareWithActiveRole: (role: Role) => role === Role.MEMBER,
          },
        },
        {
          provide: CommunityServicesStore,
          useValue: {
            ensureLoaded: () => of([]),
            canReach: (feature: string) => subscribed()[feature] ?? false,
          },
        },
        {
          provide: ActiveCommunityStore,
          useValue: { ensureLoaded: () => of(COMMUNITY), invalidate: () => undefined },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MemberDashboard);
    fixture.detectChanges();
  }

  beforeEach(() => {
    subscribed = signal<Record<string, boolean>>({ billing: true, news: true });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('fires no manager-gated request', () => {
    render();

    const forbidden = httpMock.match((request) => {
      // Match on the PATH, not on a substring of the whole URL: `/me/members`
      // contains `/members` and is perfectly legitimate here.
      const path = new URL(request.url, 'http://localhost').pathname;
      return (
        MANAGER_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
        // `/billing/invoices` is the community ledger and is manager territory;
        // `/billing/invoices/mine` is the member's own and is not.
        path === '/billing/invoices'
      );
    });

    expect(forbidden.map((r) => r.request.urlWithParams)).toEqual([]);
  });

  it('renders no module discovery strip', () => {
    // A member cannot subscribe to anything, so advertising modules is noise.
    render();
    const el = TestBed.createComponent(MemberDashboard).nativeElement as HTMLElement;
    expect(el.querySelector('app-module-discovery-strip')).toBeNull();
  });

  it('fires no annexe request when nothing is subscribed', () => {
    subscribed.set({ billing: false, news: false });
    render();

    httpMock.expectNone((request) => request.url.includes('/billing'));
    httpMock.expectNone((request) => request.url.includes('/news'));
  });
});
