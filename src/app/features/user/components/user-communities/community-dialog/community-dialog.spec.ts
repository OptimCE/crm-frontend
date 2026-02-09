import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityDialog } from './community-dialog';

describe('CommunityDialog', () => {
  let component: CommunityDialog;
  let fixture: ComponentFixture<CommunityDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommunityDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
