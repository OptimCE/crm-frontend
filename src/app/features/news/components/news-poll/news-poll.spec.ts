import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import {
  AdminVisibility,
  MemberDisplay,
  MemberVisibility,
  PollResults,
  PostDetail,
  PostListItem,
  PostType,
} from '../../../../shared/dtos/news.dtos';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { NewsPoll } from './news-poll';

describe('NewsPoll', () => {
  const common = {
    id: 7,
    type: PostType.POLL_SINGLE_CHOICE,
    author_id: 'manager-1',
    author_email: 'manager@example.org',
    body_html: '<p>Which evening suits the general assembly?</p>',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
    expires_at: '2026-10-20T18:00:00Z',
    is_poll: true,
    poll_ended: false,
    has_voted: false,
  };
  const post: PostListItem = { ...common, option_count: 2 };
  const detail: PostDetail = {
    ...common,
    post: 'Which evening suits the general assembly?',
    options: [
      { id: 71, option_value: 'Tuesday', display_order: 0 },
      { id: 72, option_value: 'Thursday', display_order: 1 },
    ],
    my_option_ids: [],
    admin_visibility: AdminVisibility.AGGREGATE,
    member_visibility: MemberVisibility.AGGREGATE,
    member_display: MemberDisplay.AFTER_VOTE,
  };
  const results: PollResults = {
    post_id: 7,
    poll_ended: false,
    visible: false,
    mode: null,
    total_voters: null,
    options: null,
  };

  let newsService: {
    getPost: ReturnType<typeof vi.fn>;
    getResults: ReturnType<typeof vi.fn>;
    castVote: ReturnType<typeof vi.fn>;
    retractVote: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
  };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    newsService = {
      getPost: vi.fn().mockReturnValue(of(new ApiResponse(detail))),
      getResults: vi.fn().mockReturnValue(of(new ApiResponse(results))),
      castVote: vi.fn(),
      retractVote: vi.fn(),
      invalidate: vi.fn(),
    };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewsPoll, TranslateModule.forRoot()],
      providers: [
        { provide: NewsService, useValue: newsService },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(NewsPoll, { set: { template: '' } })
      .compileComponents();
  });

  it("shows the server's message when the vote is refused", () => {
    const message = 'This poll is closed and no longer accepts votes';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    newsService.castVote.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { data: message, error_code: 4090 } }),
      ),
    );
    const fixture = TestBed.createComponent(NewsPoll);
    fixture.componentRef.setInput('post', post);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.select(72);
    component.submitVote();

    expect(newsService.castVote).toHaveBeenCalledWith(7, [72]);
    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.submitting()).toBe(false);
  });
});
