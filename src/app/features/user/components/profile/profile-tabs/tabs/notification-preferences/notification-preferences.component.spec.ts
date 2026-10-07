import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../../../../core/dtos/api.response';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { NotificationPreferencesDTO } from '../../../../../../notifications/dtos/notification.dto';
import { NotificationService } from '../../../../../../notifications/services/notification.service';
import { NotificationPreferencesComponent } from './notification-preferences.component';

describe('NotificationPreferencesComponent', () => {
  const stored: NotificationPreferencesDTO = {
    type_prefixes: ['invoice', 'news_post'],
    preferences: [],
  };

  let notificationService: {
    preferences: ReturnType<typeof vi.fn>;
    savePreferences: ReturnType<typeof vi.fn>;
  };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    notificationService = {
      preferences: vi.fn().mockReturnValue(of(new ApiResponse(stored))),
      savePreferences: vi.fn(),
    };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NotificationPreferencesComponent, TranslateModule.forRoot()],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: ErrorMessageHandler, useValue: errorHandler },
      ],
    })
      .overrideComponent(NotificationPreferencesComponent, {
        set: {
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandler }],
        },
      })
      .compileComponents();
  });

  it("shows the server's message when the preferences cannot be loaded", () => {
    const message = 'Your notification preferences could not be retrieved';
    // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
    notificationService.preferences.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 503, error: { data: message, error_code: 7101 } }),
      ),
    );

    const component = TestBed.createComponent(NotificationPreferencesComponent).componentInstance;

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.loading()).toBe(false);
  });

  it("shows the server's message when the preferences cannot be saved", () => {
    const message = 'This notification type cannot be turned off';
    notificationService.savePreferences.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { data: message, error_code: 7102 } }),
      ),
    );
    const component = TestBed.createComponent(NotificationPreferencesComponent).componentInstance;

    component.save();

    expect(errorHandler.handleError).toHaveBeenCalledWith(message);
    expect(component.saving()).toBe(false);
    expect(component.saved()).toBe(false);
  });
});
