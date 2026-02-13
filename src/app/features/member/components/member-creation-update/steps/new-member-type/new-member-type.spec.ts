import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMemberType } from './new-member-type';

describe('NewMemberType', () => {
  let component: NewMemberType;
  let fixture: ComponentFixture<NewMemberType>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberType],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemberType);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
