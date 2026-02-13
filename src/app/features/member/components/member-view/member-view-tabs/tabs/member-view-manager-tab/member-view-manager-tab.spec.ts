import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberViewManagerTab } from './member-view-manager-tab';

describe('MemberViewManagerTab', () => {
  let component: MemberViewManagerTab;
  let fixture: ComponentFixture<MemberViewManagerTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewManagerTab],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberViewManagerTab);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
