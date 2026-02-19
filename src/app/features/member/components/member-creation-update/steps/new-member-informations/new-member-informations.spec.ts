import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMemberInformations } from './new-member-informations';

describe('NewMemberInformations', () => {
  let component: NewMemberInformations;
  let fixture: ComponentFixture<NewMemberInformations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberInformations],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemberInformations);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
