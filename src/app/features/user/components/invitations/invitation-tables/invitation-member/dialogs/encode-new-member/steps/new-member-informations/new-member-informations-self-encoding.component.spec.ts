import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMemberInformationsSelfEncoding } from './new-member-informations-self-encoding.component';

describe('NewMemberInformations', () => {
  let component: NewMemberInformationsSelfEncoding;
  let fixture: ComponentFixture<NewMemberInformationsSelfEncoding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberInformationsSelfEncoding],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemberInformationsSelfEncoding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
