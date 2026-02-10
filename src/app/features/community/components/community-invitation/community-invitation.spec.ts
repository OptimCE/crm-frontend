import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityInvitation } from './community-invitation';

describe('CommunityInvitation', () => {
  let component: CommunityInvitation;
  let fixture: ComponentFixture<CommunityInvitation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityInvitation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommunityInvitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
