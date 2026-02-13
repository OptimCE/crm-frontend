import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvitationMember } from './invitation-member';

describe('InvitationMember', () => {
  let component: InvitationMember;
  let fixture: ComponentFixture<InvitationMember>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvitationMember],
    }).compileComponents();

    fixture = TestBed.createComponent(InvitationMember);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
