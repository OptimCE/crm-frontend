import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EncodeNewMemberComponent } from './encode-new-member.component';

describe('EncodeNewMember', () => {
  let component: EncodeNewMemberComponent;
  let fixture: ComponentFixture<EncodeNewMemberComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EncodeNewMemberComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EncodeNewMemberComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
