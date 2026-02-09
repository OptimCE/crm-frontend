import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberViewBankingInfoTab } from './member-view-banking-info-tab';

describe('MemberViewBankingInfoTab', () => {
  let component: MemberViewBankingInfoTab;
  let fixture: ComponentFixture<MemberViewBankingInfoTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewBankingInfoTab]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberViewBankingInfoTab);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
