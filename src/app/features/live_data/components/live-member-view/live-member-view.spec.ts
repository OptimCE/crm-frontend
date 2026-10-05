import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { environments } from '../../../../../environments/environments';
import { LiveMemberSeries } from '../../../../shared/dtos/live-data.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { LiveMemberView } from './live-member-view';

const base = `${environments.apiUrl}/live`;

function memberSeries(overrides: Partial<LiveMemberSeries> = {}): LiveMemberSeries {
  return {
    indicative: true,
    id_sharing_operation: 7,
    resolution: 'hour',
    start: '2026-10-03T00:00:00Z',
    end: '2026-10-04T00:00:00Z',
    points: [],
    suppressed_buckets: 0,
    truncated: false,
    cap: 1464,
    absent: [],
    ...overrides,
  };
}

describe('LiveMemberView (D-14)', () => {
  let httpMock: HttpTestingController;
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  /** ASYNC: the template holds a `@defer`, whose metadata resolves asynchronously. */
  async function render(): Promise<ComponentFixture<LiveMemberView>> {
    errorHandlerSpy = { handleError: vi.fn() };
    TestBed.configureTestingModule({
      imports: [LiveMemberView, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
    });
    await TestBed.compileComponents();
    vi.spyOn(TestBed.inject(TranslateService), 'getCurrentLang').mockReturnValue('en');
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LiveMemberView);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('says so plainly when the member holds no operation', async () => {
    const fixture = await render();
    httpMock.expectOne(`${base}/mine/operations`).flush({ data: [], error_code: 0 });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-member-view__none"]')).not.toBeNull();
    // Nothing else is asked for: there is no operation to read.
    httpMock.expectNone((r) => r.url.includes('/series'));
  });

  it("reads only the member's own operation, never a community read", async () => {
    const fixture = await render();
    httpMock
      .expectOne(`${base}/mine/operations`)
      .flush({ data: [{ id: 7, name: 'Solar' }], error_code: 0 });
    httpMock
      .expectOne((r) => r.url === `${base}/mine/operations/7/series`)
      .flush({
        data: memberSeries({
          points: [{ bucket: '2026-10-03T10:00:00Z', n_devices: 3, export_wh: 240 }],
        }),
        error_code: 0,
      });
    fixture.detectChanges();

    httpMock.expectNone(`${base}/summary`);
    httpMock.expectNone((r) => r.url === `${base}/series`);
    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="live-member-view__operation-name"]')?.textContent,
    ).toContain('Solar');
    // A prosumer operation: the export line, as on the manager's chart.
    expect(fixture.componentInstance.lines().map((line) => line.labelKey)).toEqual([
      'LIVE_DATA.CHART.EXPORT',
    ]);
  });

  it('lets a member with two operations pick one', async () => {
    const fixture = await render();
    httpMock.expectOne(`${base}/mine/operations`).flush({
      data: [
        { id: 7, name: 'Solar' },
        { id: 9, name: 'Wind' },
      ],
      error_code: 0,
    });
    httpMock
      .expectOne((r) => r.url === `${base}/mine/operations/7/series`)
      .flush({ data: memberSeries(), error_code: 0 });

    fixture.componentInstance.selectOperation(9);

    httpMock
      .expectOne((r) => r.url === `${base}/mine/operations/9/series`)
      .flush({ data: memberSeries({ id_sharing_operation: 9 }), error_code: 0 });
    expect(fixture.componentInstance.series()?.id_sharing_operation).toBe(9);
  });

  it('shows a closed setting as a message, not as a fault', async () => {
    // 2440: the manager has not opened the figures to members.
    const fixture = await render();
    httpMock
      .expectOne(`${base}/mine/operations`)
      .flush({ data: 'forbidden', error_code: 2440 }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="live-member-view__forbidden"]')).not.toBeNull();
    expect(errorHandlerSpy.handleError).not.toHaveBeenCalled();
  });
});
