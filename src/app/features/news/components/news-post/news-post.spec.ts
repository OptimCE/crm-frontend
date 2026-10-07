import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { PostListItem, PostType } from '../../../../shared/dtos/news.dtos';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { NewsPost } from './news-post';

describe('NewsPost', () => {
  const post: PostListItem = {
    id: 12,
    type: PostType.POST,
    author_id: 'manager-1',
    author_email: 'manager@example.org',
    body_html: '<p>Meter readings are due on Friday.</p>',
    created_at: '2026-10-05T09:30:00Z',
    updated_at: '2026-10-05T09:30:00Z',
    expires_at: null,
    is_poll: false,
    poll_ended: false,
    option_count: 0,
    has_voted: false,
  };

  let newsService: { deletePost: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    newsService = { deletePost: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewsPost, TranslateModule.forRoot()],
      providers: [
        { provide: NewsService, useValue: newsService },
        {
          provide: ConfirmationService,
          useValue: { confirm: vi.fn((c: Confirmation) => (c.accept as () => void)()) },
        },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(NewsPost, { set: { template: '' } })
      .compileComponents();
  });

  it("shows the server's message when the post cannot be deleted", () => {
    const message = 'This post has already been deleted';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    newsService.deletePost.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { data: message, error_code: 4041 } }),
      ),
    );
    const fixture = TestBed.createComponent(NewsPost);
    fixture.componentRef.setInput('post', post);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component
      .menuItems()
      .find((item) => item.styleClass === 'news-post__menu-item--delete')
      ?.command?.({});

    expect(newsService.deletePost).toHaveBeenCalledWith(12);
    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.deleting()).toBe(false);
  });
});
