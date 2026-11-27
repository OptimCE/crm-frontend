import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import Keycloak from 'keycloak-js';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ERROR_TYPE, INFO_TYPE, VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { savePendingExport } from '../../data-export-format';
import { DataExportDTO, DataExportScope } from '../../data-export.dto';
import { DataExportService } from '../../data-export.service';
import { DATA_EXPORT_POLL_MS, DataExportPanel } from './data-export-panel';

const COMMUNITY = { auth_community_id: 'org-1', name: 'Test Community' };

function row(overrides: Partial<DataExportDTO> = {}): DataExportDTO {
  return {
    id: '7d5f9d7e-0000-4000-8000-000000000001',
    scope: 'user',
    community: null,
    status: 'ready',
    locale: 'fr',
    requester: { first_name: 'Alice', last_name: 'Martin', email: 'alice@example.test' },
    is_mine: true,
    can_download: true,
    created_at: '2026-11-16T10:00:00.000Z',
    started_at: '2026-11-16T10:00:01.000Z',
    completed_at: '2026-11-16T10:01:00.000Z',
    expires_at: '2026-11-23T10:01:00.000Z',
    size_bytes: 2048,
    error_code: null,
    ...overrides,
  };
}

function apiError(status: number, error_code: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { data: `message ${error_code}`, error_code } });
}

const page = (rows: DataExportDTO[]) =>
  of({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, total_pages: 1 } });

describe('DataExportPanel', () => {
  let fixture: ComponentFixture<DataExportPanel>;
  let list: ReturnType<typeof vi.fn>;
  let request: ReturnType<typeof vi.fn>;
  let downloadUrl: ReturnType<typeof vi.fn>;
  let login: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let openSnackBar: ReturnType<typeof vi.fn>;
  let goTo: ReturnType<typeof vi.spyOn>;
  let queryParams: Record<string, string>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);
  const requestButton = (): HTMLButtonElement | null =>
    byTestId('data-export__btn--request')?.querySelector('button') ?? null;

  function create(scope: DataExportScope): DataExportPanel {
    fixture = TestBed.createComponent(DataExportPanel);
    fixture.componentRef.setInput('scope', scope);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    sessionStorage.clear();
    queryParams = {};
    list = vi.fn().mockReturnValue(page([]));
    request = vi.fn().mockReturnValue(of({ data: { export_id: 'new', status: 'pending' } }));
    downloadUrl = vi
      .fn()
      .mockReturnValue(
        of({ data: { url: 'https://storage.example/archive?sig=1', expires_in: 300 } }),
      );
    login = vi.fn().mockResolvedValue(undefined);
    navigate = vi.fn().mockResolvedValue(true);
    openSnackBar = vi.fn();
    // The browser navigation to the presigned URL: never let jsdom attempt it.
    goTo = vi
      .spyOn(
        DataExportPanel.prototype as unknown as { navigate: (url: string) => void },
        'navigate',
      )
      .mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [DataExportPanel, TranslateModule.forRoot()],
      providers: [
        { provide: DataExportService, useValue: { list, request, downloadUrl } },
        { provide: Keycloak, useValue: { login } },
        { provide: Location, useValue: { prepareExternalUrl: (path: string) => path } },
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParamMap: convertToParamMap(queryParams) };
            },
          },
        },
        { provide: Router, useValue: { navigate } },
        {
          provide: UserContextService,
          useValue: {
            activeCommunityId: signal<string | null>('org-1'),
            activeCommunity: signal({ orgId: 'org-1', name: 'Test Community' }),
          },
        },
        { provide: SnackbarNotification, useValue: { openSnackBar } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('the list', () => {
    it("reads the caller's own exports on the profile", () => {
      create('user');
      expect(list).toHaveBeenCalledWith({ view: 'mine', page: 1, limit: 10 });
    });

    it('reads the community view on the admin screen', () => {
      create('community');
      expect(list).toHaveBeenCalledWith({ view: 'community', page: 1, limit: 10 });
    });

    it('offers Télécharger only on a row the caller may download', () => {
      list.mockReturnValue(
        page([
          row(),
          row({
            id: 'other',
            is_mine: false,
            can_download: false,
            scope: 'community',
            community: COMMUNITY,
          }),
        ]),
      );
      create('community');
      expect(byTestId('data-export__btn--download-desktop--0')).not.toBeNull();
      expect(byTestId('data-export__row--desktop--1')).not.toBeNull();
      expect(byTestId('data-export__btn--download-desktop--1')).toBeNull();
      expect(root().textContent).toContain('DATA_EXPORT.COLUMNS.REQUESTER');
    });

    it('shows the scope, not the requester, in « Mes exports »', () => {
      list.mockReturnValue(page([row({ scope: 'community', community: COMMUNITY })]));
      create('user');
      expect(root().textContent).toContain('DATA_EXPORT.COLUMNS.SCOPE');
      expect(root().textContent).not.toContain('DATA_EXPORT.COLUMNS.REQUESTER');
      expect(root().textContent).toContain('DATA_EXPORT.SCOPE.COMMUNITY');
    });

    it('says so when there is nothing yet, and offers a retry when the read failed', () => {
      create('user');
      expect(byTestId('data-export__empty')).not.toBeNull();

      list.mockReturnValue(throwError(() => apiError(500, 0)));
      fixture.componentInstance.load();
      fixture.detectChanges();
      expect(byTestId('data-export__error')).not.toBeNull();
    });
  });

  describe('asking for an export', () => {
    it('asks for a user export at once, confirms it, and reads the list again', () => {
      const panel = create('user');
      list.mockClear();
      panel.onRequest();
      expect(request).toHaveBeenCalledWith({ scope: 'user' });
      expect(openSnackBar).toHaveBeenCalledWith('DATA_EXPORT.REQUESTED', VALIDATION_TYPE);
      expect(list).toHaveBeenCalledTimes(1);
    });

    it('shows the warning before a community export, and sends nothing until confirmed', () => {
      const panel = create('community');
      panel.onRequest();
      fixture.detectChanges();
      expect(panel.warningVisible()).toBe(true);
      expect(request).not.toHaveBeenCalled();

      panel.confirmCommunityExport();
      expect(panel.warningVisible()).toBe(false);
      expect(request).toHaveBeenCalledWith({ scope: 'community', community_id: 'org-1' });
    });

    it('holds the button while one of my exports of that scope is in preparation', () => {
      list.mockReturnValue(page([row({ status: 'collecting', can_download: false })]));
      const panel = create('user');
      expect(requestButton()?.disabled).toBe(true);
      expect(byTestId('data-export__hint--in-progress')).not.toBeNull();
      panel.onRequest();
      expect(request).not.toHaveBeenCalled();
    });

    it('shows the 409 and reads the list again, to show the export already running', () => {
      request.mockReturnValue(throwError(() => apiError(409, 35002)));
      const panel = create('user');
      list.mockClear();
      panel.onRequest();
      expect(openSnackBar).toHaveBeenCalledWith('message 35002', ERROR_TYPE);
      expect(list).toHaveBeenCalledTimes(1);
    });
  });

  describe('step-up', () => {
    it('keeps the request and logs in again with max_age=300, back to this tab', () => {
      request.mockReturnValue(throwError(() => apiError(401, 35000)));
      const panel = create('user');
      panel.onRequest();

      expect(login).toHaveBeenCalledWith({
        redirectUri: `${window.location.origin}/users?tab=exports&resume=export`,
        maxAge: 300,
      });
      expect(openSnackBar).toHaveBeenCalledWith('DATA_EXPORT.STEP_UP', INFO_TYPE);
      const kept = JSON.parse(sessionStorage.getItem('optimce.data-export.pending') ?? '{}') as {
        scope?: string;
      };
      expect(kept.scope).toBe('user');
    });

    it('comes back to the community screen for a community export', () => {
      request.mockReturnValue(throwError(() => apiError(401, 35000)));
      const panel = create('community');
      panel.confirmCommunityExport();
      expect(login).toHaveBeenCalledWith({
        redirectUri: `${window.location.origin}/communities/exports?resume=export`,
        maxAge: 300,
      });
    });

    it('replays the kept request once on return, and takes the marker out of the URL', () => {
      savePendingExport({ scope: 'user', community_id: null, at: Date.now() });
      queryParams = { tab: 'exports', resume: 'export' };
      create('user');

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith({ scope: 'user' });
      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { resume: null }, replaceUrl: true }),
      );
      expect(sessionStorage.getItem('optimce.data-export.pending')).toBeNull();
    });

    it('never logs in a second time: a replay that still needs a login ends in a message', () => {
      request.mockReturnValue(throwError(() => apiError(401, 35000)));
      savePendingExport({ scope: 'user', community_id: null, at: Date.now() });
      queryParams = { resume: 'export' };
      create('user');

      expect(request).toHaveBeenCalledTimes(1);
      expect(login).not.toHaveBeenCalled();
      expect(openSnackBar).toHaveBeenCalledWith('DATA_EXPORT.STEP_UP_FAILED', ERROR_TYPE);
    });

    it('replays nothing without the resume marker', () => {
      savePendingExport({ scope: 'user', community_id: null, at: Date.now() });
      create('user');
      expect(request).not.toHaveBeenCalled();
    });

    it('drops a community request kept for another community', () => {
      savePendingExport({ scope: 'community', community_id: 'org-2', at: Date.now() });
      queryParams = { resume: 'export' };
      create('community');
      expect(request).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalled();
    });

    it('drops a user request on the community screen', () => {
      savePendingExport({ scope: 'user', community_id: null, at: Date.now() });
      queryParams = { resume: 'export' };
      create('community');
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('opens the presigned URL: the browser saves the file, the app never fetches it', () => {
      list.mockReturnValue(page([row()]));
      const panel = create('user');
      panel.download(row());
      expect(downloadUrl).toHaveBeenCalledWith(row().id);
      expect(goTo).toHaveBeenCalledWith('https://storage.example/archive?sig=1');
    });

    it('refuses a row it may not download, without asking the API', () => {
      const panel = create('community');
      panel.download(row({ can_download: false, is_mine: false }));
      expect(downloadUrl).not.toHaveBeenCalled();
    });

    it('shows an expired export as such and reads the list again', () => {
      downloadUrl.mockReturnValue(throwError(() => apiError(410, 35007)));
      const panel = create('user');
      list.mockClear();
      panel.download(row());
      expect(goTo).not.toHaveBeenCalled();
      expect(openSnackBar).toHaveBeenCalledWith('message 35007', ERROR_TYPE);
      expect(list).toHaveBeenCalledTimes(1);
    });
  });

  describe('polling', () => {
    beforeEach(() => vi.useFakeTimers());

    it('reads again while an export is in preparation, and stops once it is ready', () => {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
      list.mockReturnValue(page([row({ status: 'collecting', can_download: false })]));
      create('user');
      list.mockClear();

      vi.advanceTimersByTime(DATA_EXPORT_POLL_MS);
      expect(list).toHaveBeenCalledTimes(1);

      list.mockReturnValue(page([row()]));
      vi.advanceTimersByTime(DATA_EXPORT_POLL_MS);
      fixture.detectChanges();
      list.mockClear();
      vi.advanceTimersByTime(DATA_EXPORT_POLL_MS * 3);
      expect(list).not.toHaveBeenCalled();
    });

    it('does not read while the page is hidden', () => {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      list.mockReturnValue(page([row({ status: 'pending', can_download: false })]));
      create('user');
      list.mockClear();
      vi.advanceTimersByTime(DATA_EXPORT_POLL_MS * 3);
      expect(list).not.toHaveBeenCalled();
    });

    it('never polls a list with nothing in preparation', () => {
      list.mockReturnValue(page([row(), row({ id: 'b', status: 'failed', can_download: false })]));
      create('user');
      list.mockClear();
      vi.advanceTimersByTime(DATA_EXPORT_POLL_MS * 3);
      expect(list).not.toHaveBeenCalled();
    });
  });
});
