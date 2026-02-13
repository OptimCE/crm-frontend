import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberViewMeterTab } from './member-view-meter-tab';

describe('MemberViewMeterTab', () => {
  let component: MemberViewMeterTab;
  let fixture: ComponentFixture<MemberViewMeterTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewMeterTab],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberViewMeterTab);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
