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
import { ChartModule } from 'primeng/chart';
import { DatePicker } from 'primeng/datepicker';
import { Ripple } from 'primeng/ripple';
import { ErrorHandlerComponent } from '../../../../../shared/components/error.handler/error.handler.component';
import { ApiResponse } from '../../../../../core/dtos/api.response';
import { SharingOpConsumptionDTO } from '../../../../../shared/dtos/sharing_operation.dtos';
import { SharingOperationService } from '../../../../../shared/services/sharing_operation.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';

interface ChartFormValue {
  dateDeb: string;
  dateFin: string;
}

/**
 * Standalone consumption-chart component for the sharing-operation view.
 *
 * Lives in its own file (and its own lazy chunk) so that `@defer`-ing it in
 * sharing-operation-view.html keeps `primeng/chart` and `chart.js` out of the
 * sharing_operation feature chunk. They are downloaded only when the user
 * actually scrolls the "Consumption Monitoring" card into view.
 */
@Component({
  selector: 'app-sharing-operation-consumption-chart',
  standalone: true,
  imports: [
    Button,
    ChartModule,
    DatePicker,
    ErrorHandlerComponent,
    FormsModule,
    ReactiveFormsModule,
    Ripple,
    TranslatePipe,
  ],
  templateUrl: './sharing-operation-consumption-chart.html',
})
export class SharingOperationConsumptionChart implements OnInit {
  private translate = inject(TranslateService);
  private sharingOperationService = inject(SharingOperationService);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);

  /** Sharing operation id used to query consumption data. */
  readonly idSharing = input.required<number>();

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
          text: this.translate.instant('SHARING_OPERATION.VIEW.CHART.X_TITLE_DATE') as string,
        },
        ticks: {
          callback: (_value: unknown, index: number): string => {
            const label = this.data()?.labels?.[index];
            if (!label) return '';

            const date = new Date(label);
            if (isNaN(date.getTime())) return label;

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
          },
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: this.translate.instant(
            'SHARING_OPERATION.VIEW.CHART.Y_TITLE_CONSUMPTION',
          ) as string,
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
    this.sharingOperationService
      .getSharingOperationConsumptions(this.idSharing(), {
        date_start: formValue.dateDeb,
        date_end: formValue.dateFin,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          const tmpData = response.data as SharingOpConsumptionDTO;
          this.data.set({
            labels: tmpData.timestamps,
            datasets: [
              {
                type: 'bar',
                label: this.translate.instant(
                  'SHARING_OPERATION.VIEW.CHART.CONSUMPTION_SHARED_LABEL',
                ) as string,
                stack: 'consumption',
                data: tmpData.shared,
              },
              {
                type: 'bar',
                label: this.translate.instant(
                  'SHARING_OPERATION.VIEW.CHART.CONSUMPTION_NET_LABEL',
                ) as string,
                stack: 'consumption',
                data: tmpData.net,
              },
              {
                type: 'bar',
                label: this.translate.instant(
                  'SHARING_OPERATION.VIEW.CHART.INJECTION_NET_LABEL',
                ) as string,
                stack: 'inj',
                data: tmpData.inj_net,
              },
              {
                type: 'bar',
                label: this.translate.instant(
                  'SHARING_OPERATION.VIEW.CHART.INJECTION_SHARED_LABEL',
                ) as string,
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
    this.sharingOperationService
      .downloadSharingOperationConsumptions(this.idSharing(), {
        date_start: formValue.dateDeb,
        date_end: formValue.dateFin,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
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
            } else {
              this.errorHandler.handleError(response.data ? response.data : null);
            }
          }
        },
        error: (error) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
        },
      });
  }
}
