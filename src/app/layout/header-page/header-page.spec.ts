import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderPage } from './header-page';

describe('HeaderPage', () => {
  let component: HeaderPage;
  let fixture: ComponentFixture<HeaderPage>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderPage],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderPage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('icon', 'pi pi-home');
    fixture.componentRef.setInput('text', 'Dashboard');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the icon with correct class', () => {
    const iconEl = el.querySelector('[data-testid="header-page__icon"]');
    expect(iconEl).toBeTruthy();
    expect(iconEl?.classList).toContain('pi');
    expect(iconEl?.classList).toContain('pi-home');
  });

  it('should display the text in heading', () => {
    const titleEl = el.querySelector('h1');
    expect(titleEl).toBeTruthy();
    expect(titleEl?.textContent?.trim()).toBe('Dashboard');
  });

  it('should update icon when input changes', () => {
    fixture.componentRef.setInput('icon', 'pi pi-users');
    fixture.detectChanges();

    const iconEl = el.querySelector('[data-testid="header-page__icon"]');
    expect(iconEl?.classList).toContain('pi');
    expect(iconEl?.classList).toContain('pi-users');
  });

  it('should update text when input changes', () => {
    fixture.componentRef.setInput('text', 'Settings');
    fixture.detectChanges();

    const titleEl = el.querySelector('h1');
    expect(titleEl?.textContent?.trim()).toBe('Settings');
  });

  it('should not render subtitle when input is omitted', () => {
    const subtitleEl = el.querySelector('[data-testid="header-page__subtitle"]');
    expect(subtitleEl).toBeNull();
  });

  it('should render subtitle when input is provided', () => {
    fixture.componentRef.setInput('subtitle', 'Subtitle text');
    fixture.detectChanges();

    const subtitleEl = el.querySelector('[data-testid="header-page__subtitle"]');
    expect(subtitleEl).toBeTruthy();
    expect(subtitleEl?.textContent?.trim()).toBe('Subtitle text');
  });
});
