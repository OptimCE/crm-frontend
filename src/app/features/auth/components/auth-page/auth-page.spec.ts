import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';
import Keycloak from 'keycloak-js';

import { AuthPage } from './auth-page';
import { LanguageService } from '../../../../core/services/language/language.service';
import { EventBusService } from '../../../../core/services/event_bus/eventbus.service';

const TRANSLATIONS: Record<string, string> = {
  'LOGIN.SLIDES.MEMBERS_TITLE': 'Members',
  'LOGIN.SLIDES.MEMBERS_DESC': 'Manage members',
  'LOGIN.SLIDES.METERS_TITLE': 'Meters',
  'LOGIN.SLIDES.METERS_DESC': 'Manage meters',
  'LOGIN.SLIDES.SHARING_TITLE': 'Sharing',
  'LOGIN.SLIDES.SHARING_DESC': 'Sharing operations',
  'LOGIN.SLIDES.KEYS_TITLE': 'Keys',
  'LOGIN.SLIDES.KEYS_DESC': 'Allocation keys',
  'LOGIN.LOGIN': 'Login',
  TITLE: 'OptimCE',
};

describe('AuthPage', () => {
  let component: AuthPage;
  let fixture: ComponentFixture<AuthPage>;
  let keycloakMock: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    keycloakMock = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AuthPage, TranslateModule.forRoot()],
      providers: [
        { provide: Keycloak, useValue: keycloakMock },
        {
          provide: LanguageService,
          useValue: { getCurrentLanguage: vi.fn().mockReturnValue('en'), changeLanguage: vi.fn() },
        },
        { provide: EventBusService, useValue: { emit: vi.fn() } },
      ],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'instant').mockImplementation((key: string | string[]) => {
      if (Array.isArray(key))
        return key.reduce((acc, k) => ({ ...acc, [k]: TRANSLATIONS[k] ?? k }), {});
      return TRANSLATIONS[key] ?? key;
    });

    fixture = TestBed.createComponent(AuthPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 4 slides', () => {
    expect(component.slides).toHaveLength(4);
  });

  it('should define correct slide icons', () => {
    const icons = component.slides.map((s) => s.icon);
    expect(icons).toEqual(['pi-users', 'pi-bolt', 'pi-share-alt', 'pi-key']);
  });

  it('should define correct slide translation keys', () => {
    const titleKeys = component.slides.map((s) => s.titleKey);
    const descKeys = component.slides.map((s) => s.descKey);

    expect(titleKeys).toEqual([
      'LOGIN.SLIDES.MEMBERS_TITLE',
      'LOGIN.SLIDES.METERS_TITLE',
      'LOGIN.SLIDES.SHARING_TITLE',
      'LOGIN.SLIDES.KEYS_TITLE',
    ]);
    expect(descKeys).toEqual([
      'LOGIN.SLIDES.MEMBERS_DESC',
      'LOGIN.SLIDES.METERS_DESC',
      'LOGIN.SLIDES.SHARING_DESC',
      'LOGIN.SLIDES.KEYS_DESC',
    ]);
  });

  it('should call keycloak.login with correct redirectUri on login()', () => {
    component.login();
    expect(keycloakMock.login).toHaveBeenCalledWith({
      redirectUri: window.location.origin + '/',
    });
  });

  it('should render the carousel', () => {
    const carousel = (fixture.nativeElement as HTMLElement).querySelector('p-carousel');
    expect(carousel).toBeTruthy();
  });

  it('should render the login button', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('p-button');
    expect(button).toBeTruthy();
  });

  it('should render the language selector', () => {
    const langSelector = (fixture.nativeElement as HTMLElement).querySelector(
      'app-language-selector',
    );
    expect(langSelector).toBeTruthy();
  });

  it('should render the logo image', () => {
    const logo = (fixture.nativeElement as HTMLElement).querySelector('.login-logo');
    expect(logo).toBeTruthy();
    expect((logo as HTMLImageElement).alt).toBe('OptimCE');
  });
});
