import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { PollResults } from '../../../../shared/dtos/news.dtos';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { NewsComposeDialog } from './news-compose-dialog';

interface ComposeData {
  mode: 'create' | 'edit';
  postId?: number;
}

describe('NewsComposeDialog', () => {
  let dialogConfig: { data: ComposeData };
  let ref: { close: ReturnType<typeof vi.fn> };
  let newsService: {
    getPost: ReturnType<typeof vi.fn>;
    getResults: ReturnType<typeof vi.fn>;
    createPost: ReturnType<typeof vi.fn>;
    updatePost: ReturnType<typeof vi.fn>;
  };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  function open(data: ComposeData): NewsComposeDialog {
    dialogConfig.data = data;
    const fixture = TestBed.createComponent(NewsComposeDialog);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    dialogConfig = { data: { mode: 'create' } };
    ref = { close: vi.fn() };
    newsService = {
      getPost: vi.fn(),
      getResults: vi.fn(),
      createPost: vi.fn(),
      updatePost: vi.fn(),
    };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewsComposeDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogConfig, useValue: dialogConfig },
        { provide: DynamicDialogRef, useValue: ref },
        { provide: NewsService, useValue: newsService },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(NewsComposeDialog, { set: { template: '' } })
      .compileComponents();
  });

  it("shows the server's message when the post cannot be published, and stays open", () => {
    const message = 'Only community managers can publish on the news board';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    newsService.createPost.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403, error: { data: message, error_code: 4030 } }),
      ),
    );
    const component = open({ mode: 'create' });

    component.form.controls.post.setValue('The general assembly takes place on 14 November.');
    component.submit();

    expect(newsService.createPost).toHaveBeenCalled();
    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.submitting()).toBe(false);
    expect(ref.close).not.toHaveBeenCalled();
  });

  it("shows the server's message and closes when the post to edit cannot be loaded", () => {
    const message = 'This post no longer exists';
    const results: PollResults = {
      post_id: 42,
      poll_ended: false,
      visible: false,
      mode: null,
      total_voters: null,
      options: null,
    };
    newsService.getPost.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { data: message, error_code: 4040 } }),
      ),
    );
    newsService.getResults.mockReturnValue(of(new ApiResponse(results)));

    const component = open({ mode: 'edit', postId: 42 });

    expect(newsService.getPost).toHaveBeenCalledWith(42);
    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.loading()).toBe(false);
    expect(ref.close).toHaveBeenCalledWith(false);
  });
});
