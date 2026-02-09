import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberViewDocumentsTab } from './member-view-documents-tab';

describe('MemberViewDocumentsTab', () => {
  let component: MemberViewDocumentsTab;
  let fixture: ComponentFixture<MemberViewDocumentsTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewDocumentsTab]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberViewDocumentsTab);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
