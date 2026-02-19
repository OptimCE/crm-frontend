import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Invitations } from './invitations';

describe('Invitations', () => {
  let component: Invitations;
  let fixture: ComponentFixture<Invitations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Invitations],
    }).compileComponents();

    fixture = TestBed.createComponent(Invitations);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
