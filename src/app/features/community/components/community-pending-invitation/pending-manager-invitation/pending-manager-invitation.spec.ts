import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PendingManagerInvitation } from './pending-manager-invitation';

describe('PendingManagerInvitation', () => {
  let component: PendingManagerInvitation;
  let fixture: ComponentFixture<PendingManagerInvitation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingManagerInvitation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PendingManagerInvitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
