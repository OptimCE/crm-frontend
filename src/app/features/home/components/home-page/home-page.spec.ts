import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { HomePage } from './home-page';

/**
 * Path prefixes that need `X-Community-ID` and answer 401 without it.
 *
 * `/home` renders BEFORE a community is picked — that is its whole reason to
 * exist — so a single request to any of these is a bug the user experiences as
 * a page of broken tiles rather than as an error.
 *
 * Matched on the parsed pathname, not by substring: `/me/members` is legitimate
 * and `/members` is not, and one contains the other.
 */
const COMMUNITY_SCOPED_PREFIXES = [
  '/members',
  '/meters',
  '/keys',
  '/sharing_operations',
  '/audit-logs',
  '/invitations',
  '/communities/dashboard',
];

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: {
            activeCommunityId: signal<string | null>(null),
            activeCommunity: signal(null),
            activeCommunityRole: signal<Role | null>(null),
            communitiesById: signal({}),
            compareWithActiveRole: () => false,
            isActiveRole: () => false,
            switchCommunity: vi.fn(),
            refreshUserContext: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Drain whatever is still in flight before verifying, so an assertion
    // failure surfaces as itself rather than as a verify() error on top.
    httpMock.match(() => true).forEach((request) => request.flush({ data: [], error_code: 0 }));
    httpMock.verify();
  });

  /** Every request the page has issued so far, removed from the queue. */
  function drain(): TestRequest[] {
    return httpMock.match(() => true);
  }

  function pathOf(request: TestRequest): string {
    return new URL(request.request.url, 'http://localhost').pathname;
  }

  it('issues no community-scoped request when no community is active', () => {
    const requests = drain();
    requests.forEach((request) => request.flush({ data: [], error_code: 0 }));

    const offending = requests
      .map(pathOf)
      .filter((path) => COMMUNITY_SCOPED_PREFIXES.some((prefix) => path.startsWith(prefix)));

    expect(offending).toEqual([]);
  });

  it('reads only user-scoped endpoints on first paint', () => {
    const paths = drain().map((request) => {
      request.flush({ data: [], error_code: 0 });
      return pathOf(request);
    });

    // Positive form of the assertion above: every one of these carries
    // `idChecker()` alone on the backend.
    for (const path of paths) {
      expect(
        path.startsWith('/me/') ||
          path.startsWith('/notifications') ||
          path.startsWith('/users') ||
          path.startsWith('/communities/my-communities'),
      ).toBe(true);
    }
  });

  it('reports a failed community list rather than showing zero communities', () => {
    for (const request of drain()) {
      if (pathOf(request).includes('my-communities')) {
        // The 200-with-a-string envelope. Treating it as data would hide the
        // only way into a community behind a convincing empty state.
        request.flush({ data: 'boom', error_code: 7 });
      } else {
        request.flush({ data: [], error_code: 0 });
      }
    }
    fixture.detectChanges();

    expect(fixture.componentInstance.communitiesFailed()).toBe(true);
    expect(fixture.componentInstance.hasCommunities()).toBe(false);
  });

  it('falls back to a neutral greeting when the profile cannot be read', () => {
    for (const request of drain()) {
      if (pathOf(request).startsWith('/users')) request.flush({ data: 'nope', error_code: 3 });
      else request.flush({ data: [], error_code: 0 });
    }
    fixture.detectChanges();

    // "Bonjour null" on the first line of the first screen would be worse than
    // no name at all.
    expect(fixture.componentInstance.firstName()).toBeNull();
    expect(fixture.componentInstance.greetingKey()).toBe('HOME.GREETING_ANON');
  });

  it('greets the user by first name when the profile resolves', () => {
    for (const request of drain()) {
      if (pathOf(request).startsWith('/users')) {
        request.flush({ data: { id: 1, first_name: 'Marie', email: 'm@x.be' }, error_code: 0 });
      } else {
        request.flush({ data: [], error_code: 0 });
      }
    }
    fixture.detectChanges();

    expect(fixture.componentInstance.firstName()).toBe('Marie');
    expect(fixture.componentInstance.greetingKey()).toBe('HOME.GREETING');
  });
});
