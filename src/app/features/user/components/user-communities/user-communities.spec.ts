import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCommunities } from './user-communities';

describe('UserCommunities', () => {
  let component: UserCommunities;
  let fixture: ComponentFixture<UserCommunities>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCommunities],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCommunities);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
