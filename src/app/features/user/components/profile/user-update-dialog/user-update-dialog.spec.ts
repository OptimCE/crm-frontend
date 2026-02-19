import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserUpdateDialog } from './user-update-dialog';

describe('UserUpdateDialog', () => {
  let component: UserUpdateDialog;
  let fixture: ComponentFixture<UserUpdateDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserUpdateDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(UserUpdateDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
