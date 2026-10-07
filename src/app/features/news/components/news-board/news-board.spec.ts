import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { NewsBoard } from './news-board';

describe('NewsBoard', () => {
  let newsService: { listPosts: ReturnType<typeof vi.fn>; invalidate: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    newsService = { listPosts: vi.fn(), invalidate: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewsBoard, TranslateModule.forRoot()],
      providers: [
        { provide: NewsService, useValue: newsService },
        { provide: UserContextService, useValue: { compareWithActiveRole: vi.fn() } },
      ],
    })
      .overrideComponent(NewsBoard, {
        set: {
          template: '',
          providers: [
            { provide: DialogService, useValue: { open: vi.fn() } },
            { provide: ConfirmationService, useValue: { confirm: vi.fn() } },
            { provide: ErrorMessageHandler, useValue: errorHandler },
          ],
        },
      })
      .compileComponents();
  });

  it("shows the server's message when the board cannot be loaded", () => {
    const message = 'The news board is temporarily unavailable';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    newsService.listPosts.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 503, error: { data: message, error_code: 5030 } }),
      ),
    );

    const fixture = TestBed.createComponent(NewsBoard);
    fixture.detectChanges();

    expect(newsService.listPosts).toHaveBeenCalledWith({ page: 1, page_size: 10 });
    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
