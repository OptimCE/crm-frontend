import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberInvite } from './member-invite';

describe('MemberInvite', () => {
  let component: MemberInvite;
  let fixture: ComponentFixture<MemberInvite>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberInvite],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberInvite);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
