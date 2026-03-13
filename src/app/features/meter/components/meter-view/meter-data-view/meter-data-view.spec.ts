import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { MeterDataView } from './meter-data-view';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';

describe('MeterDataView', () => {
  let component: MeterDataView;
  let fixture: ComponentFixture<MeterDataView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterDataView, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterDataView);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('meterData', {
      status: MeterDataStatus.ACTIVE,
      description: '',
      sampling_power: 0,
      totalGenerating_capacity: 0,
      amperage: 0,
      production_chain: 0,
      injection_status: 0,
      rate: 0,
      client_type: 0,
      grd: '',
    });
    fixture.componentRef.setInput('productionChainMap', []);
    fixture.componentRef.setInput('injectionStatusMap', []);
    fixture.componentRef.setInput('rateMap', []);
    fixture.componentRef.setInput('clientTypeMap', []);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
