import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidebarMultiElements } from './sidebar-multi-elements';

describe('SidebarMultiElements', () => {
  let component: SidebarMultiElements;
  let fixture: ComponentFixture<SidebarMultiElements>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarMultiElements],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarMultiElements);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Test');
    fixture.componentRef.setInput('icon', 'pi pi-home');
    fixture.componentRef.setInput('sidebarOpen', false);
    fixture.componentRef.setInput('isRouteActive', false);
    fixture.componentRef.setInput('links', []);
    fixture.componentRef.setInput('activeSublist', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
