import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { environments } from '../../../environments/environments';
import { UserContextService } from '../../core/services/authorization/authorization.service';
import { CacheService } from '../../core/services/cache/cache.service';
import { AdministrativeProcedureService } from './administrative-procedure.service';

const API = `${environments.apiUrl}/administrative-document/admin`;

describe('AdministrativeProcedureService', () => {
  let service: AdministrativeProcedureService;
  let http: HttpTestingController;
  let cache: CacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UserContextService, useValue: { activeCommunityId: signal('org-a') } },
      ],
    });
    service = TestBed.inject(AdministrativeProcedureService);
    http = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(CacheService);
  });

  afterEach(() => {
    http.match(() => true);
    http.verify();
    TestBed.resetTestingModule();
  });

  it('reads the dashboard with its filters, and caches it per community', () => {
    service.getInbox({ grd: 'ores', operation_id: 3 }).subscribe();
    const request = http.expectOne((r) => r.url === `${API}/inbox`);
    expect(request.request.params.get('grd')).toBe('ores');
    expect(request.request.params.get('operation_id')).toBe('3');
    request.flush({ data: {} });

    // Same query, other key order: one cache entry, no second request.
    service.getInbox({ operation_id: 3, grd: 'ores' }).subscribe();
    http.expectNone(`${API}/inbox`);
  });

  it('lists every procedure, paged', () => {
    service.listProcedures({ page: 2, limit: 20, code: 'PARTAGE_FIN' }).subscribe();
    const request = http.expectOne((r) => r.url === `${API}/dossiers`);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('code')).toBe('PARTAGE_FIN');
  });

  it('marks as sent in multipart, without a Content-Type of its own', () => {
    const file = new File(['From: x'], 'sent.eml');
    service
      .send(12, { sent_on: '2026-10-29', channel: 'email', subject: 'S', body_text: null, file })
      .subscribe();
    const request = http.expectOne(`${API}/dossiers/12/send`);
    const form = request.request.body as FormData;
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(form.get('sent_on')).toBe('2026-10-29');
    expect(form.get('channel')).toBe('email');
    expect(form.get('subject')).toBe('S');
    expect(form.has('body_text')).toBe(false);
    expect(form.get('file')).toBe(file);
  });

  it('previews a response with dry_run, writes nothing, invalidates nothing', () => {
    const invalidate = vi.spyOn(cache, 'invalidate');
    service.previewResponse(12, { type: 'receipt', occurred_on: '2026-10-29' }).subscribe();
    const request = http.expectOne((r) => r.url === `${API}/dossiers/12/correspondence`);
    expect(request.request.params.get('dry_run')).toBe('true');
    expect((request.request.body as FormData).get('type')).toBe('receipt');
    request.flush({ data: {} });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates the whole prefix after an action, the July routes’ entries included', () => {
    const invalidate = vi.spyOn(cache, 'invalidate');
    service.recordResponse(12, { type: 'receipt', occurred_on: '2026-10-29' }).subscribe();
    const request = http.expectOne((r) => r.url === `${API}/dossiers/12/correspondence`);
    expect(request.request.params.has('dry_run')).toBe(false);
    request.flush({ data: {} });
    expect(invalidate).toHaveBeenCalledWith('administrative-document');
  });

  it('confirms the starting state with every choice', () => {
    service.confirmBaseline({ choices: [{ key: 'k', choice: 'active' }] }).subscribe();
    const request = http.expectOne(`${API}/baseline/confirm`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ choices: [{ key: 'k', choice: 'active' }] });
  });

  it('downloads a message’s file under its recorded name', () => {
    let name = '';
    service.downloadCorrespondence(12, 3).subscribe(({ filename }) => (name = filename));
    http.expectOne(`${API}/dossiers/12/correspondence/3/file`).flush(new Blob(['x']), {
      headers: { 'Content-Disposition': 'attachment; filename="AR ORES.eml"' },
    });
    expect(name).toBe('AR ORES.eml');
  });
});
