import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityPendingInvitation } from './community-pending-invitation';

describe('CommunityPendingInvitation', () => {
  let component: CommunityPendingInvitation;
  let fixture: ComponentFixture<CommunityPendingInvitation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityPendingInvitation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommunityPendingInvitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
