import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMemberAddress } from './new-member-address';

describe('NewMemberAddress', () => {
  let component: NewMemberAddress;
  let fixture: ComponentFixture<NewMemberAddress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberAddress]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewMemberAddress);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
