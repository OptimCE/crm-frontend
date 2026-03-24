import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageSelector } from './language-selector';
import { LanguageService } from '../../../core/services/language/language.service';
import { EventBusService } from '../../../core/services/event_bus/eventbus.service';

describe('LanguageSelector', () => {
  let component: LanguageSelector;
  let fixture: ComponentFixture<LanguageSelector>;
  let languageServiceSpy: {
    changeLanguage: ReturnType<typeof vi.fn>;
    getCurrentLanguage: ReturnType<typeof vi.fn>;
  };
  let eventBusSpy: { emit: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    languageServiceSpy = {
      changeLanguage: vi.fn(),
      getCurrentLanguage: vi.fn().mockReturnValue('fr'),
    };
    eventBusSpy = {
      emit: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LanguageSelector, TranslateModule.forRoot()],
      providers: [
        { provide: LanguageService, useValue: languageServiceSpy },
        { provide: EventBusService, useValue: eventBusSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 4 language options', () => {
    expect(component.langs).toHaveLength(4);
    expect(component.langs.map((l) => l.code)).toEqual(['fr', 'en', 'nl', 'de']);
  });

  it('should detect initial language from LanguageService', () => {
    expect(languageServiceSpy.getCurrentLanguage).toHaveBeenCalled();
    expect(component.currentLang).toBe('fr');
  });

  it('should return correct label for currentLangLabel', () => {
    expect(component.currentLangLabel).toBe('Français');
  });

  it('should return undefined for unknown language code', () => {
    component.currentLang = 'xx';
    expect(component.currentLangLabel).toBeUndefined();
  });

  it('should call languageService.changeLanguage and eventBus.emit on setLang', () => {
    component.setLang('en');

    expect(languageServiceSpy.changeLanguage).toHaveBeenCalledWith('en');
    expect(eventBusSpy.emit).toHaveBeenCalledWith('changeLanguage', 'en');
  });

  it('should handle null from getCurrentLanguage', async () => {
    languageServiceSpy.getCurrentLanguage.mockReturnValue(null);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LanguageSelector, TranslateModule.forRoot()],
      providers: [
        { provide: LanguageService, useValue: languageServiceSpy },
        { provide: EventBusService, useValue: eventBusSpy },
      ],
    }).compileComponents();

    const nullFixture = TestBed.createComponent(LanguageSelector);
    const nullComponent = nullFixture.componentInstance;
    nullFixture.detectChanges();

    expect(nullComponent.currentLang).toBeNull();
    expect(nullComponent.currentLangLabel).toBeUndefined();
  });
});
