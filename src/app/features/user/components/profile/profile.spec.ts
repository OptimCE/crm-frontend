import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogService } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Profile } from './profile';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { UserDTO } from '../../../../shared/dtos/user.dtos';
import { UserService } from '../../../../shared/services/user.service';
import { ProfileTabs } from './profile-tabs/profile-tabs';
import { UserUpdateDialog } from './user-update-dialog/user-update-dialog';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-profile-tabs', standalone: true, template: '' })
class ProfileTabsStub {}

// ── Helpers ────────────────────────────────────────────────────────

function buildUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@test.com',
    nrn: '00.01.01-123.45',
    phone_number: '+32 470 00 00 00',
    iban: 'BE68 5390 0754 7034',
    home_address: {
      id: 1,
      street: 'Rue de la Loi',
      number: 16,
      postcode: '1000',
      city: 'Bruxelles',
    },
    billing_address: {
      id: 2,
      street: 'Avenue Louise',
      number: 42,
      postcode: '1050',
      city: 'Ixelles',
    },
    ...overrides,
  };
}

function buildUserResponse(user: UserDTO = buildUser()): ApiResponse<UserDTO | string> {
  return new ApiResponse<UserDTO | string>(user);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let el: HTMLElement;

  let userServiceSpy: {
    getUserInfo: ReturnType<typeof vi.fn>;
  };

  let dialogServiceSpy: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    userServiceSpy = {
      getUserInfo: vi.fn().mockReturnValue(of(buildUserResponse())),
    };

    dialogServiceSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Profile, TranslateModule.forRoot()],
      providers: [{ provide: UserService, useValue: userServiceSpy }],
    })
      .overrideComponent(Profile, {
        remove: {
          imports: [ProfileTabs],
          providers: [DialogService],
        },
        add: {
          imports: [ProfileTabsStub],
          providers: [{ provide: DialogService, useValue: dialogServiceSpy }],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    vi.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation(
      (key: string | string[]) =>
        Array.isArray(key)
          ? key.reduce<Record<string, string>>((acc, k) => ({ ...acc, [k]: k }), {})
          : key,
    );

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  // ── Creation ───────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Initial load ──────────────────────────────────────────────

  describe('initial load', () => {
    it('should call getUserInfo on construction', () => {
      expect(userServiceSpy.getUserInfo).toHaveBeenCalled();
    });

    it('should set user signal with response data', () => {
      expect(component['user']()).toEqual(buildUser());
    });

    it('should set isLoading to false after load', () => {
      expect(component['isLoading']()).toBe(false);
    });

    it('should set hasError to false after successful load', () => {
      expect(component['hasError']()).toBe(false);
    });
  });

  // ── Computed: userInitials ────────────────────────────────────

  describe('userInitials', () => {
    it('should return uppercase initials from first and last name', () => {
      expect(component['userInitials']()).toBe('JD');
    });

    it('should return single initial when only first name exists', () => {
      component['user'].set(buildUser({ last_name: null }));
      expect(component['userInitials']()).toBe('J');
    });

    it('should return single initial when only last name exists', () => {
      component['user'].set(buildUser({ first_name: null }));
      expect(component['userInitials']()).toBe('D');
    });

    it('should return "?" when both names are empty strings', () => {
      component['user'].set(buildUser({ first_name: '', last_name: '' }));
      expect(component['userInitials']()).toBe('?');
    });

    it('should return "?" when both names are null', () => {
      component['user'].set(buildUser({ first_name: null, last_name: null }));
      expect(component['userInitials']()).toBe('?');
    });

    it('should return empty string when user is null', () => {
      component['user'].set(null);
      expect(component['userInitials']()).toBe('');
    });
  });

  // ── Error handling ────────────────────────────────────────────

  describe('error handling', () => {
    it('should set hasError to true on service error', async () => {
      userServiceSpy.getUserInfo.mockReturnValue(throwError(() => new Error('Network error')));

      component['loadUser']();
      await fixture.whenStable();

      expect(component['hasError']()).toBe(true);
    });

    it('should set isLoading to false on error', async () => {
      userServiceSpy.getUserInfo.mockReturnValue(throwError(() => new Error('Network error')));

      component['loadUser']();
      await fixture.whenStable();

      expect(component['isLoading']()).toBe(false);
    });
  });

  // ── loadUser retry ────────────────────────────────────────────

  describe('loadUser retry', () => {
    it('should reset hasError to false when called again', () => {
      component['hasError'].set(true);

      component['loadUser']();

      expect(component['hasError']()).toBe(false);
    });

    it('should set isLoading to true when called again', () => {
      userServiceSpy.getUserInfo.mockReturnValue(new Subject());

      component['loadUser']();

      expect(component['isLoading']()).toBe(true);
    });
  });

  // ── updateMember ──────────────────────────────────────────────

  describe('updateMember', () => {
    it('should open UserUpdateDialog via DialogService', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      component.updateMember();

      expect(dialogServiceSpy.open).toHaveBeenCalledWith(
        UserUpdateDialog,
        expect.objectContaining({
          header: 'PROFILE.UPDATE_PROFILE.TITLE',
          modal: true,
          closable: true,
          closeOnEscape: true,
          width: '40rem',
          data: { user: buildUser() },
        }),
      );
    });

    it('should reload user when dialog closes with true', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      component.updateMember();
      userServiceSpy.getUserInfo.mockClear();

      onClose$.next(true);

      expect(userServiceSpy.getUserInfo).toHaveBeenCalled();
    });

    it('should not reload user when dialog closes with false', () => {
      const onClose$ = new Subject<boolean>();
      dialogServiceSpy.open.mockReturnValue({
        onClose: onClose$.asObservable(),
        destroy: vi.fn(),
      });

      component.updateMember();
      userServiceSpy.getUserInfo.mockClear();

      onClose$.next(false);

      expect(userServiceSpy.getUserInfo).not.toHaveBeenCalled();
    });
  });

  // ── Template rendering ────────────────────────────────────────

  describe('template rendering', () => {
    it('should show skeleton when loading', () => {
      userServiceSpy.getUserInfo.mockReturnValue(new Subject());
      component['isLoading'].set(true);
      component['user'].set(null);
      fixture.detectChanges();

      const skeletons = el.querySelectorAll('p-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show error state with retry button when hasError', () => {
      component['hasError'].set(true);
      component['isLoading'].set(false);
      component['user'].set(null);
      fixture.detectChanges();

      const errorIcon = el.querySelector('.pi-exclamation-circle');
      expect(errorIcon).toBeTruthy();

      const retryButton = el.querySelector('p-button');
      expect(retryButton).toBeTruthy();
    });

    it('should display user name when loaded', () => {
      fixture.detectChanges();
      const heading = el.querySelector('h1');
      expect(heading?.textContent).toContain('John');
      expect(heading?.textContent).toContain('Doe');
    });

    it('should display user email when loaded', () => {
      fixture.detectChanges();
      const emailEl = el.querySelector('.text-surface-500.truncate');
      expect(emailEl?.textContent).toContain('john.doe@test.com');
    });
  });
});
