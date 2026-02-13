import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagersCommunityList } from './managers-community-list';

describe('ManagersCommunityList', () => {
  let component: ManagersCommunityList;
  let fixture: ComponentFixture<ManagersCommunityList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagersCommunityList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagersCommunityList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
