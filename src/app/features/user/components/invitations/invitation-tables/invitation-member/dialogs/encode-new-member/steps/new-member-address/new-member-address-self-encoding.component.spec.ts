import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMemberAddressSelfEncoding } from './new-member-address-self-encoding.component';

describe('NewMemberAddress', () => {
  let component: NewMemberAddressSelfEncoding;
  let fixture: ComponentFixture<NewMemberAddressSelfEncoding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberAddressSelfEncoding],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemberAddressSelfEncoding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
