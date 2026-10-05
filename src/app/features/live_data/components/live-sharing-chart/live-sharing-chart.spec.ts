import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LiveSeries } from '../../../../shared/dtos/live-data.dtos';
import { sharingStackSegments } from '../../live-data-format';
import { LiveSharingChart } from './live-sharing-chart';

const SERIES: LiveSeries = {
  indicative: true,
  resolution: 'hour',
  start: '2026-10-04T08:00:00Z',
  end: '2026-10-04T10:00:00Z',
  points: [
    {
      bucket: '2026-10-04T09:00:00Z',
      n_devices: 3,
      import_wh: 300,
      export_wh: 700,
      shared_wh: 250,
    },
  ],
  suppressed_buckets: 0,
  truncated: false,
  cap: 1464,
  absent: [],
};

describe('LiveSharingChart', () => {
  /** Template emptied: chart.js cannot draw on jsdom's canvas; the data is the subject. */
  function create() {
    TestBed.configureTestingModule({ imports: [LiveSharingChart, TranslateModule.forRoot()] });
    TestBed.overrideComponent(LiveSharingChart, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(LiveSharingChart);
    fixture.componentRef.setInput('series', SERIES);
    fixture.componentRef.setInput('segments', sharingStackSegments(SERIES.points));
    return { chart: fixture.componentInstance, translate: TestBed.inject(TranslateService) };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('stacks two bars per bucket on stacked axes', () => {
    const { chart } = create();
    const datasets = chart.data().datasets;
    expect(datasets.map((dataset) => dataset.stack)).toEqual([
      'offtake',
      'offtake',
      'injection',
      'injection',
    ]);
    expect(datasets.every((dataset) => dataset.type === 'bar')).toBe(true);
    expect(chart.options().scales.x.stacked).toBe(true);
    expect(chart.options().scales.y.stacked).toBe(true);
  });

  it('relabels the legend once the language file arrives', () => {
    // The legend cannot use the translate pipe; without the reactivity it kept
    // the key it was given before the file loaded (reported 2026-10-04).
    const { chart, translate } = create();
    expect(chart.data().datasets[0].label).toBe('LIVE_DATA.SHARING.OFFTAKE_SHARED');

    translate.setTranslation('fr', {
      LIVE_DATA: { SHARING: { OFFTAKE_SHARED: 'Prélèvement couvert par la communauté' } },
    });
    translate.use('fr');

    expect(chart.data().datasets[0].label).toBe('Prélèvement couvert par la communauté');
  });
});
