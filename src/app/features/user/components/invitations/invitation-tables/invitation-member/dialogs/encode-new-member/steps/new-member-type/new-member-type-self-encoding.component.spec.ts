import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMemberTypeSelfEncoding } from './new-member-type-self-encoding.component';

describe('NewMemberType', () => {
  let component: NewMemberTypeSelfEncoding;
  let fixture: ComponentFixture<NewMemberTypeSelfEncoding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberTypeSelfEncoding],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemberTypeSelfEncoding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
