import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvitationGestionnaire } from './invitation-gestionnaire';

describe('InvitationGestionnaire', () => {
  let component: InvitationGestionnaire;
  let fixture: ComponentFixture<InvitationGestionnaire>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvitationGestionnaire],
    }).compileComponents();

    fixture = TestBed.createComponent(InvitationGestionnaire);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
