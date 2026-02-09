import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterDataUpdate } from './meter-data-update';

describe('MeterDataUpdate', () => {
  let component: MeterDataUpdate;
  let fixture: ComponentFixture<MeterDataUpdate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterDataUpdate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeterDataUpdate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
