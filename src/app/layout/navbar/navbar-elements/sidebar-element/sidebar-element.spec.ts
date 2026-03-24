import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SidebarElement } from './sidebar-element';

function queryEl(fixture: ComponentFixture<SidebarElement>, selector: string): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector(selector);
}

describe('SidebarElement', () => {
  let component: SidebarElement;
  let fixture: ComponentFixture<SidebarElement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarElement],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarElement);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sidebarOpen', false);
    fixture.componentRef.setInput('isRouteActive', false);
    fixture.componentRef.setInput('name', 'Dashboard');
    fixture.componentRef.setInput('icon', 'pi pi-home');
    fixture.componentRef.setInput('routerLinkUrl', '/dashboard');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the icon with the correct class', () => {
    const iconEl = queryEl(fixture, 'i');
    expect(iconEl).toBeTruthy();
    expect(iconEl?.className).toContain('pi pi-home');
  });

  it('should update icon class when input changes', () => {
    fixture.componentRef.setInput('icon', 'pi pi-cog');
    fixture.detectChanges();
    const iconEl = queryEl(fixture, 'i');
    expect(iconEl?.className).toContain('pi pi-cog');
  });

  describe('when sidebar is open', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('sidebarOpen', true);
      fixture.detectChanges();
    });

    it('should display the label', () => {
      const label = queryEl(fixture, '.sidebar-item__label');
      expect(label).toBeTruthy();
      expect(label?.textContent?.trim()).toBe('Dashboard');
    });

    it('should not apply collapsed class', () => {
      const anchor = queryEl(fixture, 'a');
      expect(anchor?.classList.contains('sidebar-item--collapsed')).toBe(false);
    });

    it('should provide empty tooltip when sidebar is open', () => {
      expect(component.sidebarOpen()).toBe(true);
      expect(component.name()).toBe('Dashboard');
    });
  });

  describe('when sidebar is closed', () => {
    it('should not display the label', () => {
      const label = queryEl(fixture, '.sidebar-item__label');
      expect(label).toBeFalsy();
    });

    it('should apply collapsed class', () => {
      const anchor = queryEl(fixture, 'a');
      expect(anchor?.classList.contains('sidebar-item--collapsed')).toBe(true);
    });

    it('should provide name as tooltip when sidebar is closed', () => {
      expect(component.sidebarOpen()).toBe(false);
      expect(component.name()).toBe('Dashboard');
    });
  });

  describe('when route is active', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('isRouteActive', true);
      fixture.detectChanges();
    });

    it('should apply active class on the anchor', () => {
      const anchor = queryEl(fixture, 'a');
      expect(anchor?.classList.contains('sidebar-item--active')).toBe(true);
    });

    it('should apply active class on the icon wrapper', () => {
      const iconWrapper = queryEl(fixture, '.sidebar-item__icon-wrapper');
      expect(iconWrapper?.classList.contains('sidebar-item__icon-wrapper--active')).toBe(true);
    });

    it('should display the active indicator', () => {
      const indicator = queryEl(fixture, '.sidebar-item__active-indicator');
      expect(indicator).toBeTruthy();
    });
  });

  describe('when route is not active', () => {
    it('should not apply active class on the anchor', () => {
      const anchor = queryEl(fixture, 'a');
      expect(anchor?.classList.contains('sidebar-item--active')).toBe(false);
    });

    it('should not apply active class on the icon wrapper', () => {
      const iconWrapper = queryEl(fixture, '.sidebar-item__icon-wrapper');
      expect(iconWrapper?.classList.contains('sidebar-item__icon-wrapper--active')).toBe(false);
    });

    it('should not display the active indicator', () => {
      const indicator = queryEl(fixture, '.sidebar-item__active-indicator');
      expect(indicator).toBeFalsy();
    });
  });

  describe('routerLink', () => {
    it('should set routerLink on the anchor', () => {
      expect(component.routerLinkUrl()).toBe('/dashboard');
      const anchor = queryEl(fixture, 'a');
      expect(anchor?.getAttribute('href')).toBe('/dashboard');
    });
  });

  describe('closeSideBar', () => {
    it('should emit sidebarClose when closeSideBar is called', () => {
      const spy = vi.fn();
      component.sidebarClose.subscribe(spy);

      component.closeSideBar();

      expect(spy).toHaveBeenCalledOnce();
    });

    it('should emit sidebarClose when the anchor is clicked', () => {
      const spy = vi.fn();
      component.sidebarClose.subscribe(spy);

      const anchor = queryEl(fixture, 'a') as HTMLElement;
      anchor.click();

      expect(spy).toHaveBeenCalledOnce();
    });
  });
});
