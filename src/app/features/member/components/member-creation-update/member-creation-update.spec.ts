import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberCreationUpdate } from './member-creation-update';

describe('MemberCreationUpdate', () => {
  let component: MemberCreationUpdate;
  let fixture: ComponentFixture<MemberCreationUpdate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberCreationUpdate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberCreationUpdate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
