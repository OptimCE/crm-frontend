import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MembersList } from './members-list';

describe('MembersList', () => {
  let component: MembersList;
  let fixture: ComponentFixture<MembersList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersList],
    }).compileComponents();

    fixture = TestBed.createComponent(MembersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
