import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { DatePicker } from 'primeng/datepicker';
import { Ripple } from 'primeng/ripple';
import { ErrorHandlerComponent } from '../../../../../shared/components/error.handler/error.handler.component';
import { MeterConsumptionDTO } from '../../../../../shared/dtos/meter.dtos';
import { MeterService } from '../../../../../shared/services/meter.service';
import {
  toLocalDateString,
  formatBrusselsWallClockDateTime,
} from '../../../../../shared/utils/date.utils';

interface ChartFormValue {
  dateDeb: string;
  dateFin: string;
}

/**
 * Standalone consumption-chart component for the meter view's "consumption" tab.
 *
 * Lives in its own file (and its own lazy chunk) so that `@defer`-ing it in
 * meter-view.html keeps `primeng/chart` and `chart.js` out of the meter
 * feature chunk. They are downloaded only when the user actually scrolls/opens
 * the consumption tab.
 */
@Component({
  selector: 'app-meter-consumption-chart',
  standalone: true,
  imports: [
    Button,
    Card,
    ChartModule,
    DatePicker,
    ErrorHandlerComponent,
    FormsModule,
    ReactiveFormsModule,
    Ripple,
    TranslatePipe,
  ],
  templateUrl: './meter-consumption-chart.html',
})
export class MeterConsumptionChart implements OnInit {
  private translate = inject(TranslateService);
  private metersService = inject(MeterService);
  private destroyRef = inject(DestroyRef);

  /** EAN of the meter to query consumption data for. */
  readonly ean = input.required<string>();

  readonly data = signal<{
    labels: string[];
    datasets: {
      type: string;
      label: string;
      stack: string;
      data: number[];
    }[];
  } | null>(null);

  readonly displayDownloadButton = signal<boolean>(false);

  formChart!: FormGroup;

  options = {
    maintainAspectRatio: false,
    aspectRatio: 0.8,
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items: { label?: string }[]): string => {
            const label = items[0]?.label;
            return label ? formatBrusselsWallClockDateTime(label) : '';
          },
          label: function (tooltipItem: { dataset: { label?: string }; raw: unknown }): string {
            const label = tooltipItem.dataset.label || '';
            const value = tooltipItem.raw as number;
            return `${label}: ${value} kWh`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: this.translate.instant('METER.FULL.CHART.X_TITLE_DATE') as string,
        },
        ticks: {
          callback: (_value: unknown, index: number): string => {
            const label = this.data()?.labels?.[index];
            if (!label) return '';
            return formatBrusselsWallClockDateTime(label);
          },
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: this.translate.instant('METER.FULL.CHART.Y_TITLE_CONSUMPTION') as string,
        },
      },
    },
  };

  ngOnInit(): void {
    this.formChart = new FormGroup({
      dateDeb: new FormControl('', [Validators.required]),
      dateFin: new FormControl('', [Validators.required]),
    });
  }

  loadChart(): void {
    this.displayDownloadButton.set(false);
    if (this.formChart.invalid) {
      return;
    }
    const formValue = this.formChart.getRawValue() as ChartFormValue;
    this.metersService
      .getMeterConsumptions(this.ean(), {
        date_start: toLocalDateString(formValue.dateDeb as unknown as Date),
        date_end: toLocalDateString(formValue.dateFin as unknown as Date),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          const tmpData = response.data as MeterConsumptionDTO;
          this.data.set({
            labels: tmpData.timestamps,
            datasets: [
              {
                type: 'bar',
                label: this.translate.instant(
                  'METER.FULL.CHART.CONSUMPTION_SHARED_LABEL',
                ) as string,
                stack: 'consumption',
                data: tmpData.shared,
              },
              {
                type: 'bar',
                label: this.translate.instant('METER.FULL.CHART.CONSUMPTION_NET_LABEL') as string,
                stack: 'consumption',
                data: tmpData.net,
              },
              {
                type: 'bar',
                label: this.translate.instant('METER.FULL.CHART.INJECTION_NET_LABEL') as string,
                stack: 'inj',
                data: tmpData.inj_net,
              },
              {
                type: 'bar',
                label: this.translate.instant('METER.FULL.CHART.INJECTION_SHARED_LABEL') as string,
                stack: 'inj',
                data: tmpData.inj_shared,
              },
            ],
          });
          this.displayDownloadButton.set(true);
        }
      });
  }

  downloadTotalConsumption(): void {
    const formValue = this.formChart.getRawValue() as ChartFormValue;
    this.metersService
      .downloadMeterConsumptions(this.ean(), {
        date_start: toLocalDateString(formValue.dateDeb as unknown as Date),
        date_end: toLocalDateString(formValue.dateFin as unknown as Date),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          if ('blob' in response) {
            const url = window.URL.createObjectURL(response.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
        }
      });
  }
}
