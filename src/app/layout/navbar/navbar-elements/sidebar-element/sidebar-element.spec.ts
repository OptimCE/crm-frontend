import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidebarElement } from './sidebar-element';

describe('SidebarElement', () => {
  let component: SidebarElement;
  let fixture: ComponentFixture<SidebarElement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarElement],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarElement);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('sidebarOpen', false);
    fixture.componentRef.setInput('isRouteActive', false);
    fixture.componentRef.setInput('name', 'Test');
    fixture.componentRef.setInput('icon', 'pi pi-home');
    fixture.componentRef.setInput('routerLinkUrl', '/test');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
