import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PendingMemberInvitation } from './pending-member-invitation';

describe('PendingMemberInvitation', () => {
  let component: PendingMemberInvitation;
  let fixture: ComponentFixture<PendingMemberInvitation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingMemberInvitation],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingMemberInvitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
