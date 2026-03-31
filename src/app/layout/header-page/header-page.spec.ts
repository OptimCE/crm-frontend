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
    const iconEl = el.querySelector('i');
    expect(iconEl).toBeTruthy();
    expect(iconEl?.classList).toContain('pi');
    expect(iconEl?.classList).toContain('pi-home');
  });

  it('should display the text in heading', () => {
    const h2El = el.querySelector('h2');
    expect(h2El).toBeTruthy();
    expect(h2El?.textContent?.trim()).toBe('Dashboard');
  });

  it('should update icon when input changes', () => {
    fixture.componentRef.setInput('icon', 'pi pi-users');
    fixture.detectChanges();

    const iconEl = el.querySelector('i');
    expect(iconEl?.classList).toContain('pi');
    expect(iconEl?.classList).toContain('pi-users');
  });

  it('should update text when input changes', () => {
    fixture.componentRef.setInput('text', 'Settings');
    fixture.detectChanges();

    const h2El = el.querySelector('h2');
    expect(h2El?.textContent?.trim()).toBe('Settings');
  });
});
