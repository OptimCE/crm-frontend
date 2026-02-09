import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberViewTabs } from './member-view-tabs';

describe('MemberViewTabs', () => {
  let component: MemberViewTabs;
  let fixture: ComponentFixture<MemberViewTabs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewTabs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberViewTabs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
