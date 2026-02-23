import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectMeterNewKeyDialog } from './select-meter-new-key-dialog';

describe('SelectMeterNewKeyDialog', () => {
  let component: SelectMeterNewKeyDialog;
  let fixture: ComponentFixture<SelectMeterNewKeyDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectMeterNewKeyDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectMeterNewKeyDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
