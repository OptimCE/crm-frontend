import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvitationDetailComponent } from './invitation-detail.component';

describe('InvitationDetail', () => {
  let component: InvitationDetailComponent;
  let fixture: ComponentFixture<InvitationDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvitationDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InvitationDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
