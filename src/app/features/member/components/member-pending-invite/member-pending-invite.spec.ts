import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberPendingInvite } from './member-pending-invite';

describe('MemberPendingInvite', () => {
  let component: MemberPendingInvite;
  let fixture: ComponentFixture<MemberPendingInvite>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberPendingInvite],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberPendingInvite);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
