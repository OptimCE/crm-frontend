import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterDataView } from './meter-data-view';

describe('MeterDataView', () => {
  let component: MeterDataView;
  let fixture: ComponentFixture<MeterDataView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterDataView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeterDataView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
