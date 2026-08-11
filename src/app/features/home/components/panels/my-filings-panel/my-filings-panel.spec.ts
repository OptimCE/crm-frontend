import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { Role } from '../../../../../core/dtos/role';
import { UserContextService } from '../../../../../core/services/authorization/authorization.service';
import { CacheService } from '../../../../../core/services/cache/cache.service';
import { communityContextInterceptor } from '../../../../../core/interceptors/community.context.inteceptor';
import { MyCommunityDTO } from '../../../../../shared/dtos/community.dtos';
import { MyFilingsPanel } from './my-filings-panel';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

function community(id: number, orgId: string, name: string): MyCommunityDTO {
  return { id, auth_community_id: orgId, name, role: Role.MEMBER } as MyCommunityDTO;
}

describe('MyFilingsPanel', () => {
  let fixture: ComponentFixture<MyFilingsPanel>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyFilingsPanel, TranslateModule.forRoot()],
      providers: [
        // The real interceptor, deliberately: the whole point of the fan-out is
        // that each request carries its own pinned X-Community-ID, and that
        // header is set by the interceptor rather than by the service. Without
        // it the tests below would pass against a build that sends none.
        provideHttpClient(withInterceptors([communityContextInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: {
            activeCommunityId: signal<string | null>(null),
            switchCommunity: vi.fn(),
            compareWithActiveRole: () => false,
          },
        },
      ],
    }).compileComponents();

    // The catalogue and the annexe reads are both cached; a shared cache across
    // tests would let one case satisfy another's expectations.
    TestBed.inject(CacheService).invalidate('');

    fixture = TestBed.createComponent(MyFilingsPanel);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Drain before verifying, so a failed assertion surfaces as itself rather
    // than as a verify() error stacked on top of it.
    httpMock.match(() => true).forEach((request) => request.flush({ data: [], error_code: 0 }));
    httpMock.verify();
  });

  function start(communities: MyCommunityDTO[]): void {
    fixture.componentRef.setInput('communities', communities);
    fixture.detectChanges();
  }

  /** Answer one community's catalogue request, asserting its pinned header. */
  function flushCatalog(orgId: string, subscribed: boolean): void {
    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url.includes('/annexes-services') &&
        candidate.headers.get('X-Community-ID') === orgId,
    );
    request.flush({
      data: [
        {
          feature: 'administrative-document',
          displayKey: '',
          descriptionKey: '',
          icon: '',
          minRole: Role.MEMBER,
          frontendRoute: '/administrative-document',
          subscribePath: '',
          unsubscribePath: '',
          subscribed,
        },
      ],
      error_code: 0,
    });
    fixture.detectChanges();
  }

  it('asks each community with its own pinned X-Community-ID', () => {
    // The interceptor stamps the ACTIVE community and there is none here, so
    // without the context token every request would go out unscoped and the
    // backend would answer for nobody.
    start([community(1, ORG_A, 'A'), community(2, ORG_B, 'B')]);

    flushCatalog(ORG_A, false);
    flushCatalog(ORG_B, false);

    expect(fixture.componentInstance.rows()).toEqual([]);
  });

  it('fires zero annexe requests for an unsubscribed community', () => {
    start([community(1, ORG_A, 'A')]);
    flushCatalog(ORG_A, false);

    // §2.2 rule 3: an unsubscribed annexe must produce no request at all, not a
    // swallowed 403.
    httpMock.expectNone((request) => request.url.includes('/filings/mine'));
  });

  it('reads filings only from the subscribed community', () => {
    start([community(1, ORG_A, 'A'), community(2, ORG_B, 'B')]);
    flushCatalog(ORG_A, true);
    flushCatalog(ORG_B, false);

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url.includes('/filings/mine') &&
        candidate.headers.get('X-Community-ID') === ORG_A,
    );
    request.flush({
      data: [
        {
          dossier: {
            id: 1,
            dossier_type: 1,
            status: 1,
            title: null,
            external_ref: null,
            submitted_at: null,
          },
          document: { id: 2, doc_type: 'annex6_sharing_form', status: 1, title: null },
          template_label: null,
          version: { id: 3, version_no: 1, created_at: '2026-07-01T10:00:00Z' },
          my_rows: { members: [], participants: [{ ean: 'X' }], installations: [], storage: [] },
        },
      ],
      error_code: 0,
    });
    fixture.detectChanges();

    httpMock.expectNone(
      (candidate) =>
        candidate.url.includes('/filings/mine') &&
        candidate.headers.get('X-Community-ID') === ORG_B,
    );
    expect(fixture.componentInstance.rows()).toHaveLength(1);
    expect(fixture.componentInstance.rows()[0].community.auth_community_id).toBe(ORG_A);
  });

  it('degrades one community without losing the other', () => {
    start([community(1, ORG_A, 'A'), community(2, ORG_B, 'B')]);
    flushCatalog(ORG_A, true);
    flushCatalog(ORG_B, true);

    httpMock
      .expectOne(
        (candidate) =>
          candidate.url.includes('/filings/mine') &&
          candidate.headers.get('X-Community-ID') === ORG_A,
      )
      // 403, not 500: `ServiceBase.cachedGet` retries 5xx twice behind a timer,
      // so a 500 would still be in flight when the assertions run. 403 is also
      // the realistic failure — a subscription that lapsed between the catalogue
      // read and this one.
      .flush('NOT_SUBSCRIBED', { status: 403, statusText: 'Forbidden' });
    httpMock
      .expectOne(
        (candidate) =>
          candidate.url.includes('/filings/mine') &&
          candidate.headers.get('X-Community-ID') === ORG_B,
      )
      .flush({
        data: [
          {
            dossier: {
              id: 1,
              dossier_type: 1,
              status: 1,
              title: null,
              external_ref: null,
              submitted_at: null,
            },
            document: { id: 2, doc_type: 'annex6_sharing_form', status: 1, title: null },
            template_label: null,
            version: { id: 3, version_no: 1, created_at: '2026-07-01T10:00:00Z' },
            my_rows: { members: [], participants: [{ ean: 'X' }], installations: [], storage: [] },
          },
        ],
        error_code: 0,
      });
    fixture.detectChanges();

    // One dead annexe degrades its own row, not the panel — N communities means
    // N chances to fail, and any of them blanking the rest is unacceptable on
    // the landing page.
    expect(fixture.componentInstance.rows()).toHaveLength(1);
    expect(fixture.componentInstance.rows()[0].community.auth_community_id).toBe(ORG_B);
    expect(fixture.componentInstance.state()).toBe('ready');
  });

  it('issues nothing at all when the user has no community', () => {
    start([]);

    httpMock.expectNone(() => true);
    expect(fixture.componentInstance.state()).toBe('empty');
  });
});
