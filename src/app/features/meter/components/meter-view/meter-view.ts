import { Component, inject, Input, OnInit } from '@angular/core';
import { Button } from 'primeng/button';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';
import { Ripple } from 'primeng/ripple';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { Card } from 'primeng/card';
import { MeterConsumptionDTO, MetersDataDTO, MetersDTO } from '../../../../shared/dtos/meter.dtos';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ActivatedRoute, Router } from '@angular/router';
import { MeterService } from '../../../../shared/services/meter.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { MeterUpdate } from '../meter-update/meter-update';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { MeterDataUpdate } from '../meter-data-update/meter-data-update';
import { MeterDeactivation } from '../meter-deactivation/meter-deactivation';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { MapNumberStringPipe } from '../../../../shared/pipes/map-number-string/map-number-string-pipe';
import { MeterDataView } from './meter-data-view/meter-data-view';

@Component({
  selector: 'app-meter-view',
  standalone: true,
  imports: [
    Button,
    FormsModule,
    AddressPipe,
    InputTextModule,
    CheckboxModule,
    DatePipe,
    TagModule,
    TranslatePipe,
    ChartModule,
    Ripple,
    ErrorHandlerComponent,
    ReactiveFormsModule,
    Select,
    DatePicker,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TableModule,
    Card,
    MapNumberStringPipe,
    MeterDataView,
  ],
  templateUrl: './meter-view.html',
  styleUrl: './meter-view.css',
  providers: [DialogService],
})
export class MeterView implements OnInit {
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private metersService = inject(MeterService);
  private dialogService = inject(DialogService);
  private snackbar = inject(SnackbarNotification);
  private router = inject(Router);
  @Input()
  id!: string;
  meter!: MetersDTO;
  isLoaded: boolean;
  historySelected?: MetersDataDTO;
  futureSelected?: MetersDataDTO;
  ref?: DynamicDialogRef | null;

  productionChainMap: string[] = [];
  readingFrequencyMap: string[] = [];
  phasesNumberMap: string[] = [];
  tarifGroupMap: string[] = [];
  rateMap: string[] = [];
  clientTypeMap: string[] = [];
  injectionStatusMap: string[] = [];
  data: any;
  options = {
    maintainAspectRatio: false,
    aspectRatio: 0.8,
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function (tooltipItem: any): string {
            const label = tooltipItem.dataset.label || '';
            const value = tooltipItem.raw;
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
          _callback: (_value: any, index: number): string => {
            // Make sure 'this' refers to the component context
            const label = this.data?.labels?.[index];
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
          text: this.translate.instant('METER.FULL.CHART.Y_TITLE_CONSUMPTION') as string,
        },
      },
    },
  };
  displayDownloadButton: any;
  formChart!: FormGroup;
  constructor() {
    this.isLoaded = false;
    this.historySelected = undefined;
    this.futureSelected = undefined;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === null) {
      console.error('No id provided');
      void this.router.navigate(['/members/meter']);
      return;
    }
    this.id = id;
    if (!this.id) {
      console.error('No id provided');
    }
    this.getFullMeter(true);
    this.formChart = new FormGroup({
      dateDeb: new FormControl('', [Validators.required]),
      dateFin: new FormControl('', [Validators.required]),
    });
    this.setupTranslationCategory();
  }
  getFullMeter(changeIsLoaded = true): void {
    if (changeIsLoaded) {
      this.isLoaded = false;
    }
    this.metersService.getMeter(this.id).subscribe({
      next: (response) => {
        if (response) {
          this.meter = response.data as MetersDTO;
          if (changeIsLoaded) {
            this.isLoaded = true;
          }
        } else {
          console.error('Error fetching meter', response);
        }
      },
      error: (error) => {
        console.error('Error fetching meter', error);
      },
    });
  }

  setupTranslationCategory(): void {
    this.setupProductionChainCategory();
    this.setupRateCategory();
    this.setupClientCategory();
    this.setupInjectionStatusCategory();
    this.setupReadingFrequencyCategory();
    this.setupPhaseCategory();
    this.setupTarifGroupCategory();
  }

  setupProductionChainCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.PRODUCTION_CHAIN.PHOTOVOLTAIC',
        'METER.CATEGORIES.PRODUCTION_CHAIN.WIND',
        'METER.CATEGORIES.PRODUCTION_CHAIN.HYDROELECTRIC',
        'METER.CATEGORIES.PRODUCTION_CHAIN.SOLID_BIOMASS',
        'METER.CATEGORIES.PRODUCTION_CHAIN.BIOGAS',
        'METER.CATEGORIES.PRODUCTION_CHAIN.FOSSIL_FIRE_COGENERATION',
        'METER.CATEGORIES.PRODUCTION_CHAIN.OTHER',
        'METER.CATEGORIES.PRODUCTION_CHAIN.NONE',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.productionChainMap = [
          '',
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.PHOTOVOLTAIC'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.WIND'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.HYDROELECTRIC'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.SOLID_BIOMASS'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.BIOGAS'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.FOSSIL_FIRE_COGENERATION'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.OTHER'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.NONE'],
        ];
      });
  }

  setupRateCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.RATE.SIMPLE',
        'METER.CATEGORIES.RATE.BI_HOURLY',
        'METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.rateMap = [
          '',
          translation['METER.CATEGORIES.RATE.SIMPLE'],
          translation['METER.CATEGORIES.RATE.BI_HOURLY'],
          translation['METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT'],
        ];
      });
  }

  setupClientCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.CLIENT.RESIDENTIAL',
        'METER.CATEGORIES.CLIENT.PROFESSIONAL',
        'METER.CATEGORIES.CLIENT.INDUSTRIAL',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.clientTypeMap = [
          '',
          translation['METER.CATEGORIES.CLIENT.RESIDENTIAL'],
          translation['METER.CATEGORIES.CLIENT.PROFESSIONAL'],
          translation['METER.CATEGORIES.CLIENT.INDUSTRIAL'],
        ];
      });
  }

  setupInjectionStatusCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.INJECTION_STATUS.NONE',
        'METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER',
        'METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER',
        'METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION',
        'METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.injectionStatusMap = [
          '',
          translation['METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION'],
          translation['METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE'],
          translation['METER.CATEGORIES.INJECTION_STATUS.NONE'],
        ];
      });
  }

  setupReadingFrequencyCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.READING_FREQUENCY.MONTHLY',
        'METER.CATEGORIES.READING_FREQUENCY.ANNUAL',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.readingFrequencyMap = [
          '',
          translation['METER.CATEGORIES.READING_FREQUENCY.MONTHLY'],
          translation['METER.CATEGORIES.READING_FREQUENCY.ANNUAL'],
        ];
      });
  }

  setupPhaseCategory(): void {
    this.translate
      .get(['METER.CATEGORIES.PHASE.SINGLE_PHASE', 'METER.CATEGORIES.PHASE.THREE_PHASES'])
      .subscribe((translation: Record<string, string>) => {
        this.phasesNumberMap = [
          '',
          translation['METER.CATEGORIES.PHASE.SINGLE_PHASE'],
          translation['METER.CATEGORIES.PHASE.THREE_PHASES'],
        ];
      });
  }

  setupTarifGroupCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE',
        'METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE',
      ])
      .subscribe((translation: Record<string, string>) => {
        this.tarifGroupMap = [
          '',
          translation['METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE'],
          translation['METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE'],
        ];
      });
  }

  toModify(): void {
    this.ref = this.dialogService.open(MeterUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('METER.FULL.METER_MODIFICATION_HEADER') as string,
      data: {
        meter: this.meter,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('METER.FULL.METER_MODIFIED_SUCCESS_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.getFullMeter(false);
        }
      });
    }
  }
  toUpdate($event: Event): void {
    $event.stopPropagation();
    this.ref = this.dialogService.open(MeterDataUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('METER.FULL.METER_DATA_UPDATE_HEADER') as string,
      width: '1000px',
      data: {
        id: this.meter.EAN,
        meterData: this.meter.meter_data,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('METER.FULL.METER_DATA_UPDATE_SUCCESS_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.getFullMeter(false);
        }
      });
    }
  }

  toDeactivate(): void{
    this.ref = this.dialogService.open(MeterDeactivation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('METER.FULL.METER_DEACTIVATE_HEADER') as string,
      data: {
        ean: this.meter.EAN,
      },
    });
    if (this.ref) {
      this.ref.onClose.subscribe((response) => {
        if (response) {
          this.snackbar.openSnackBar(
            this.translate.instant('METER.FULL.METER_DEACTIVATED_SUCCESS_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.getFullMeter(false);
        }
      });
    }
  }

  downloadTotalConsumption(): void {
    this.metersService
      .downloadMeterConsumptions(this.meter.EAN, {
        date_start: this.formChart.value.dateDeb,
        date_end: this.formChart.value.dateFin,
      })
      .subscribe((response) => {
        if (response) {
          // const blob = new Blob([response], { type: 'xlsx' });
          // const url = window.URL.createObjectURL(blob);
          // const a = document.createElement('a');
          // a.href = url;
          // a.download = this.translate.instant('meters.full.consumption_file_prefix') + this.meter.EAN + '.xlsx';
          // document.body.appendChild(a);
          // a.click();
          // window.URL.revokeObjectURL(url);
          // document.body.removeChild(a);
        }
      });
  }

  loadChart(): void {
    this.displayDownloadButton = false;
    if (this.formChart.invalid) {
      return;
    }

    this.metersService
      .getMeterConsumptions(this.meter.EAN, {
        date_start: this.formChart.value.dateDeb,
        date_end: this.formChart.value.dateFin,
      })
      .subscribe((response) => {
        if (response) {
          const tmpData = response.data as MeterConsumptionDTO;
          this.data = {
            labels: tmpData.timestamps,
            datasets: [
              {
                type: 'bar',
                label: this.translate.instant('METER.FULL.CHART.CONSUMPTION_SHARED_LABEL') as string,
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
          };
          this.displayDownloadButton = true;
        }
      });
  }

  protected readonly MeterStatus = MeterDataStatus;
}
