import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterUpdate } from './meter-update';

describe('MeterUpdate', () => {
  let component: MeterUpdate;
  let fixture: ComponentFixture<MeterUpdate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterUpdate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeterUpdate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
