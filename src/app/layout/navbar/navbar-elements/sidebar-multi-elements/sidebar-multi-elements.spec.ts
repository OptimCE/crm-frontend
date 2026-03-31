import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SidebarMultiElements } from './sidebar-multi-elements';
import { Links } from '../dtos';

// ── Helpers ──────────────────────────────────────────────────
function queryEl(
  fixture: ComponentFixture<SidebarMultiElements>,
  selector: string,
): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector(selector);
}

function queryAllEls(
  fixture: ComponentFixture<SidebarMultiElements>,
  selector: string,
): NodeListOf<Element> {
  return (fixture.nativeElement as HTMLElement).querySelectorAll(selector);
}

const mockLinks: Links[] = [
  { name: 'LINK_A', icon: 'pi pi-star', url: '/link-a' },
  { name: 'LINK_B', icon: 'pi pi-bolt', url: '/link-b' },
];

describe('SidebarMultiElements', () => {
  let component: SidebarMultiElements;
  let fixture: ComponentFixture<SidebarMultiElements>;

  function setInputs(overrides: Partial<Record<string, unknown>> = {}): void {
    const defaults: Record<string, unknown> = {
      name: 'Test',
      icon: 'pi pi-home',
      sidebarOpen: false,
      isRouteActive: false,
      links: [],
      activeSublist: false,
    };
    const merged = { ...defaults, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarMultiElements, TranslateModule.forRoot()],
      providers: [provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarMultiElements);
    component = fixture.componentInstance;
  });

  // ── Creation ───────────────────────────────────────────────
  it('should create', () => {
    setInputs();
    expect(component).toBeTruthy();
  });

  // ── Icon rendering ─────────────────────────────────────────
  it('should render the icon with the correct class', () => {
    setInputs({ icon: 'pi pi-cog' });
    const icon = queryEl(fixture, '.sidebar-item__icon-wrapper i');
    expect(icon?.classList.contains('pi')).toBe(true);
    expect(icon?.classList.contains('pi-cog')).toBe(true);
  });

  // ── Sidebar open / collapsed state ─────────────────────────
  describe('when sidebar is closed', () => {
    beforeEach(() => setInputs({ sidebarOpen: false }));

    it('should apply collapsed class', () => {
      const item = queryEl(fixture, '.sidebar-item');
      expect(item?.classList.contains('sidebar-item--collapsed')).toBe(true);
    });

    it('should not render label or chevron', () => {
      expect(queryEl(fixture, '.sidebar-item__label')).toBeNull();
      expect(queryEl(fixture, '.sidebar-item__chevron')).toBeNull();
    });
  });

  describe('when sidebar is open', () => {
    beforeEach(() => setInputs({ sidebarOpen: true, name: 'Dashboard' }));

    it('should not apply collapsed class', () => {
      const item = queryEl(fixture, '.sidebar-item');
      expect(item?.classList.contains('sidebar-item--collapsed')).toBe(false);
    });

    it('should render the label with the name', () => {
      const label = queryEl(fixture, '.sidebar-item__label');
      expect(label?.textContent?.trim()).toBe('Dashboard');
    });

    it('should render the chevron', () => {
      expect(queryEl(fixture, '.sidebar-item__chevron')).toBeTruthy();
    });
  });

  // ── Active route state ─────────────────────────────────────
  describe('when route is active', () => {
    beforeEach(() => setInputs({ isRouteActive: true }));

    it('should apply active class on sidebar-item', () => {
      const item = queryEl(fixture, '.sidebar-item');
      expect(item?.classList.contains('sidebar-item--active')).toBe(true);
    });

    it('should apply active class on icon-wrapper', () => {
      const wrapper = queryEl(fixture, '.sidebar-item__icon-wrapper');
      expect(wrapper?.classList.contains('sidebar-item__icon-wrapper--active')).toBe(true);
    });
  });

  describe('when route is not active', () => {
    beforeEach(() => setInputs({ isRouteActive: false }));

    it('should not apply active class on sidebar-item', () => {
      const item = queryEl(fixture, '.sidebar-item');
      expect(item?.classList.contains('sidebar-item--active')).toBe(false);
    });

    it('should not apply active class on icon-wrapper', () => {
      const wrapper = queryEl(fixture, '.sidebar-item__icon-wrapper');
      expect(wrapper?.classList.contains('sidebar-item__icon-wrapper--active')).toBe(false);
    });
  });

  // ── Chevron rotation ───────────────────────────────────────
  describe('chevron open state', () => {
    it('should apply open class when activeSublist is true', () => {
      setInputs({ sidebarOpen: true, activeSublist: true });
      const chevron = queryEl(fixture, '.sidebar-item__chevron');
      expect(chevron?.classList.contains('sidebar-item__chevron--open')).toBe(true);
    });

    it('should not apply open class when activeSublist is false', () => {
      setInputs({ sidebarOpen: true, activeSublist: false });
      const chevron = queryEl(fixture, '.sidebar-item__chevron');
      expect(chevron?.classList.contains('sidebar-item__chevron--open')).toBe(false);
    });
  });

  // ── Submenu rendering ──────────────────────────────────────
  describe('submenu', () => {
    it('should render submenu when sidebar is open and sublist is active', () => {
      setInputs({ sidebarOpen: true, activeSublist: true, links: mockLinks });
      expect(queryEl(fixture, '.sidebar-submenu')).toBeTruthy();
    });

    it('should not render submenu when sidebar is closed', () => {
      setInputs({ sidebarOpen: false, activeSublist: true, links: mockLinks });
      expect(queryEl(fixture, '.sidebar-submenu')).toBeNull();
    });

    it('should not render submenu when sublist is inactive', () => {
      setInputs({ sidebarOpen: true, activeSublist: false, links: mockLinks });
      expect(queryEl(fixture, '.sidebar-submenu')).toBeNull();
    });

    it('should render the correct number of links', () => {
      setInputs({ sidebarOpen: true, activeSublist: true, links: mockLinks });
      const items = queryAllEls(fixture, '.sidebar-submenu__item');
      expect(items.length).toBe(2);
    });

    it('should render link icons with correct classes', () => {
      setInputs({ sidebarOpen: true, activeSublist: true, links: mockLinks });
      const icons = queryAllEls(fixture, '.sidebar-submenu__icon');
      expect(icons[0]?.classList.contains('pi-star')).toBe(true);
      expect(icons[1]?.classList.contains('pi-bolt')).toBe(true);
    });

    it('should set href on each link via routerLink', () => {
      setInputs({ sidebarOpen: true, activeSublist: true, links: mockLinks });
      const anchors = queryAllEls(fixture, '.sidebar-submenu__item');
      expect(anchors[0]?.getAttribute('href')).toBe('/link-a');
      expect(anchors[1]?.getAttribute('href')).toBe('/link-b');
    });
  });

  // ── Output: sidebarClose ───────────────────────────────────
  describe('closeSideBar()', () => {
    it('should emit sidebarClose when closeSideBar is called', () => {
      setInputs({ sidebarOpen: true, activeSublist: true, links: mockLinks });
      const spy = vi.fn();
      component.sidebarClose.subscribe(spy);

      component.closeSideBar();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit sidebarClose when a submenu link is clicked', () => {
      setInputs({ sidebarOpen: true, activeSublist: true, links: mockLinks });
      const spy = vi.fn();
      component.sidebarClose.subscribe(spy);

      const firstLink = queryEl(fixture, '.sidebar-submenu__item') as HTMLElement;
      firstLink.click();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
