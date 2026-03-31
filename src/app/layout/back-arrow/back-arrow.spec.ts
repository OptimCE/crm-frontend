import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BackArrow } from './back-arrow';

describe('BackArrow', () => {
  let component: BackArrow;
  let fixture: ComponentFixture<BackArrow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackArrow],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BackArrow);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('url', '/test');
    fixture.componentRef.setInput('text', 'Go back');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the provided text', () => {
    const anchor = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(anchor?.textContent?.trim()).toBe('Go back');
  });

  it('should set routerLink to the provided url', () => {
    const anchor = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/test');
  });

  it('should render the back arrow icon', () => {
    const icon = (fixture.nativeElement as HTMLElement).querySelector('i.pi-arrow-left');
    expect(icon).toBeTruthy();
  });

  it('should update text when input changes', () => {
    fixture.componentRef.setInput('text', 'Return');
    fixture.detectChanges();

    const anchor = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(anchor?.textContent?.trim()).toBe('Return');
  });

  it('should update url when input changes', () => {
    fixture.componentRef.setInput('url', '/home');
    fixture.detectChanges();

    const anchor = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/home');
  });
});
