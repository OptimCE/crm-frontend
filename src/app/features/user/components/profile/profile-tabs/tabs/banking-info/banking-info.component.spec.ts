import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BankingInfoComponent } from './banking-info.component';

describe('BankingInfo', () => {
  let component: BankingInfoComponent;
  let fixture: ComponentFixture<BankingInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BankingInfoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BankingInfoComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
