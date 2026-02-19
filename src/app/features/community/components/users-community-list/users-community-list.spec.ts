import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersCommunityList } from './users-community-list';

describe('UsersCommunityList', () => {
  let component: UsersCommunityList;
  let fixture: ComponentFixture<UsersCommunityList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersCommunityList],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersCommunityList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
