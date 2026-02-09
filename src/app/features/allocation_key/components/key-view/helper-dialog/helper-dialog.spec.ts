import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelperDialog } from './helper-dialog';

describe('HelperDialog', () => {
  let component: HelperDialog;
  let fixture: ComponentFixture<HelperDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelperDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HelperDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
