import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMemberBankingInfoSelfEncoding } from './new-member-banking-info-self-encoding.component';

describe('NewMemberBankingInfo', () => {
  let component: NewMemberBankingInfoSelfEncoding;
  let fixture: ComponentFixture<NewMemberBankingInfoSelfEncoding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberBankingInfoSelfEncoding],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemberBankingInfoSelfEncoding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
