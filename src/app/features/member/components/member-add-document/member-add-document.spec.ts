import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberAddDocument } from './member-add-document';

describe('MemberAddDocument', () => {
  let component: MemberAddDocument;
  let fixture: ComponentFixture<MemberAddDocument>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberAddDocument],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberAddDocument);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
