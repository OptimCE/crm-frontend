import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { MemberViewTabs } from './member-view-tabs';

describe('MemberViewTabs', () => {
  let component: MemberViewTabs;
  let fixture: ComponentFixture<MemberViewTabs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberViewTabs, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberViewTabs);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 1);
    fixture.componentRef.setInput('member', { status: 1, iban: '', manager: null });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
