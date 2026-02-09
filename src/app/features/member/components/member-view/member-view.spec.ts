import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberView } from './member-view';

describe('MemberView', () => {
  let component: MemberView;
  let fixture: ComponentFixture<MemberView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
