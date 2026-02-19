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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
