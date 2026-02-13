import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterDeactivation } from './meter-deactivation';

describe('MeterDeactivation', () => {
  let component: MeterDeactivation;
  let fixture: ComponentFixture<MeterDeactivation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterDeactivation],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterDeactivation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
