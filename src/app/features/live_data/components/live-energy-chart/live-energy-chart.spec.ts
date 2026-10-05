import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LiveSeries } from '../../../../shared/dtos/live-data.dtos';
import { EnergyLine, LIVE_CHART_COLORS } from '../../live-data-format';
import { LiveEnergyChart } from './live-energy-chart';

const SERIES: LiveSeries = {
  indicative: true,
  resolution: 'hour',
  start: '2026-10-04T08:00:00Z',
  end: '2026-10-04T10:00:00Z',
  points: [{ bucket: '2026-10-04T09:00:00Z', n_devices: 3, export_wh: 1459 }],
  suppressed_buckets: 0,
  truncated: false,
  cap: 1464,
  absent: [],
};

const EXPORT_LINE: EnergyLine = {
  labelKey: 'LIVE_DATA.CHART.EXPORT',
  values: [1.459],
  color: LIVE_CHART_COLORS.export,
  fill: false,
  absentKey: 'LIVE_DATA.CHART.WITHHELD',
};

const FR = { LIVE_DATA: { CHART: { EXPORT: 'Injecté sur le réseau', Y_AXIS: 'kWh' } } };
const EN = { LIVE_DATA: { CHART: { EXPORT: 'Fed into the grid', Y_AXIS: 'kWh' } } };

describe('LiveEnergyChart', () => {
  /**
   * The template is emptied: it is a `p-chart`, and chart.js cannot draw on
   * jsdom's canvas. What is under test is the data the chart is HANDED - the
   * datasets and options are plain computeds, readable without rendering.
   */
  function create() {
    TestBed.configureTestingModule({
      imports: [LiveEnergyChart, TranslateModule.forRoot()],
    });
    TestBed.overrideComponent(LiveEnergyChart, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(LiveEnergyChart);
    fixture.componentRef.setInput('series', SERIES);
    fixture.componentRef.setInput('lines', [EXPORT_LINE]);
    return { chart: fixture.componentInstance, translate: TestBed.inject(TranslateService) };
  }

  afterEach(() => TestBed.resetTestingModule());

  function legend(chart: LiveEnergyChart): string[] {
    return chart.data().datasets.map((dataset) => dataset.label);
  }

  it('relabels the legend once the language file arrives, instead of keeping the key', () => {
    // Reported 2026-10-04: the legend read "LIVE_DATA.CHART.EXPORT". A chart
    // drawn before the language file loaded got the key from `instant`, and
    // nothing ever asked again.
    const { chart, translate } = create();
    expect(legend(chart)).toEqual(['LIVE_DATA.CHART.EXPORT']);

    translate.setTranslation('fr', FR);
    translate.use('fr');

    expect(legend(chart)).toEqual(['Injecté sur le réseau']);
    expect(chart.options().scales.y.title.text).toBe('kWh');
  });

  it('follows a language switch, figures included', () => {
    const { chart, translate } = create();
    translate.setTranslation('fr', FR);
    translate.use('fr');
    translate.setTranslation('en', EN);
    // Drawn in French first: the switch must redraw an EXISTING chart.
    expect(legend(chart)).toEqual(['Injecté sur le réseau']);
    expect(chart.options().locale).toBe('fr');

    translate.use('en');

    expect(legend(chart)).toEqual(['Fed into the grid']);
    expect(chart.options().locale).toBe('en');
  });
});
