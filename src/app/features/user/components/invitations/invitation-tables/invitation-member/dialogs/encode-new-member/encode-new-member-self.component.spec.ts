import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EncodeNewMemberSelfComponent } from './encode-new-member-self.component';

describe('EncodeNewMember', () => {
  let component: EncodeNewMemberSelfComponent;
  let fixture: ComponentFixture<EncodeNewMemberSelfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EncodeNewMemberSelfComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EncodeNewMemberSelfComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
