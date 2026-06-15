import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environments } from '../../../../environments/environments';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;
  const base = `${environments.apiUrl}/notifications`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('polls the unread count with a plain GET', () => {
    service.unreadCount().subscribe();
    const req = httpMock.expectOne(`${base}/unread-count`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { count: 3 }, error_code: 0 });
  });

  it('lists notifications globally (no community_id) with pagination params', () => {
    service.list({ page: 2, limit: 20 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.has('community_id')).toBe(false);
    req.flush({
      data: [],
      pagination: { page: 2, limit: 20, total: 0, total_pages: 0 },
      error_code: 0,
    });
  });

  it('marks a single notification read via PATCH /:id/read', () => {
    service.markRead('42').subscribe();
    const req = httpMock.expectOne(`${base}/42/read`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ data: 'success', error_code: 0 });
  });

  it('marks all read via PATCH /read-all', () => {
    service.markAllRead().subscribe();
    const req = httpMock.expectOne(`${base}/read-all`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ data: 'success', error_code: 0 });
  });
});
