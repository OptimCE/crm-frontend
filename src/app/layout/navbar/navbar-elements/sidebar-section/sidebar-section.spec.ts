import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { SidebarSection } from './sidebar-section';

function queryEl(fixture: ComponentFixture<SidebarSection>, selector: string): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector(selector);
}

describe('SidebarSection', () => {
  let component: SidebarSection;
  let fixture: ComponentFixture<SidebarSection>;

  function setInputs(overrides: Partial<Record<string, unknown>> = {}): void {
    const defaults: Record<string, unknown> = {
      label: 'NAVBAR.PROFILE',
      key: 'profile',
      sidebarOpen: true,
    };
    const merged = { ...defaults, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarSection, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarSection);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setInputs();
    expect(component).toBeTruthy();
  });

  it('should render the label (and no divider) when the drawer is open', () => {
    setInputs({ sidebarOpen: true });
    expect(queryEl(fixture, '.sidebar__section-label')).toBeTruthy();
    expect(queryEl(fixture, '.sidebar__section-divider')).toBeNull();
  });

  it('should render a divider (and no label) when collapsed to the rail', () => {
    setInputs({ sidebarOpen: false });
    expect(queryEl(fixture, '.sidebar__section-divider')).toBeTruthy();
    expect(queryEl(fixture, '.sidebar__section-label')).toBeNull();
  });

  it('should expose key-based test ids', () => {
    setInputs({ sidebarOpen: true, key: 'management' });
    expect(queryEl(fixture, '[data-testid="navbar__section-label--management"]')).toBeTruthy();
  });
});
