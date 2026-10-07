import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../core/services/community-services.store';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { NotificationService } from '../../services/notification.service';
import { NotificationStore } from '../../services/notification.store';
import { NotificationsPage } from './notifications-page';

describe('NotificationsPage', () => {
  let notificationService: { list: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    notificationService = { list: vi.fn() };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NotificationsPage, TranslateModule.forRoot()],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        {
          provide: NotificationStore,
          useValue: {
            unreadCount: signal(0),
            refreshUnread: vi.fn(),
            markRead: vi.fn(),
            markAllRead: vi.fn(),
          },
        },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: UserContextService, useValue: { activeCommunityId: signal(null) } },
        { provide: CommunityServicesStore, useValue: { canReach: vi.fn(() => false) } },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(NotificationsPage, {
        set: {
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandler }],
        },
      })
      .compileComponents();
  });

  it("shows the server's message when the notifications cannot be loaded", () => {
    const message = 'Notifications are temporarily unavailable, please try again later';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    notificationService.list.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 503, error: { data: message, error_code: 7001 } }),
      ),
    );
    const fixture = TestBed.createComponent(NotificationsPage);

    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component['failed']()).toBe(true);
    expect(component['loading']()).toBe(false);
  });
});
