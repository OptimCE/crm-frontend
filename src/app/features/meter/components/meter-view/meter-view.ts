import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { DatePipe } from '@angular/common';
import { Tag } from 'primeng/tag';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Ripple } from 'primeng/ripple';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Card } from 'primeng/card';
import { MetersDataDTO, MetersDTO } from '../../../../shared/dtos/meter.dtos';
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
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { Skeleton } from 'primeng/skeleton';
import { Avatar } from 'primeng/avatar';
import { MeterConsumptionChart } from './meter-consumption-chart/meter-consumption-chart';

@Component({
  selector: 'app-meter-view',
  standalone: true,
  imports: [
    Button,
    FormsModule,
    AddressPipe,
    DatePipe,
    Tag,
    TranslatePipe,
    Ripple,
    Select,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Card,
    MapNumberStringPipe,
    MeterDataView,
    BackArrow,
    Skeleton,
    Avatar,
    MeterConsumptionChart,
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
  private destroyRef = inject(DestroyRef);
  id!: string;
  readonly meter = signal<MetersDTO | undefined>(undefined);
  readonly isLoading = signal<boolean>(false);
  readonly hasError = signal<boolean>(false);
  readonly historySelected = signal<MetersDataDTO | undefined>(undefined);
  readonly futureSelected = signal<MetersDataDTO | undefined>(undefined);
  ref?: DynamicDialogRef | null;

  readonly hasMeterData = computed(() => !!this.meter()?.meter_data);
  readonly hasHistory = computed(() => !!this.meter()?.meter_data_history?.length);
  readonly hasFutureData = computed(() => !!this.meter()?.futur_meter_data?.length);

  readonly currentStatus = computed(() => this.meter()?.meter_data?.status);

  readonly productionChainMap = signal<string[]>([]);
  readonly readingFrequencyMap = signal<string[]>([]);
  readonly phasesNumberMap = signal<string[]>([]);
  readonly tarifGroupMap = signal<string[]>([]);
  readonly rateMap = signal<string[]>([]);
  readonly clientTypeMap = signal<string[]>([]);
  readonly injectionStatusMap = signal<string[]>([]);

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
    this.getFullMeter();
    this.setupTranslationCategory();
  }

  getFullMeter(showLoading = true): void {
    if (showLoading) {
      this.isLoading.set(true);
      this.hasError.set(false);
    }
    this.metersService
      .getMeter(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.meter.set(response.data as MetersDTO);
          } else {
            this.hasError.set(true);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.productionChainMap.set([
          '',
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.PHOTOVOLTAIC'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.WIND'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.HYDROELECTRIC'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.SOLID_BIOMASS'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.BIOGAS'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.FOSSIL_FIRE_COGENERATION'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.OTHER'],
          translation['METER.CATEGORIES.PRODUCTION_CHAIN.NONE'],
        ]);
      });
  }

  setupRateCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.RATE.SIMPLE',
        'METER.CATEGORIES.RATE.BI_HOURLY',
        'METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.rateMap.set([
          '',
          translation['METER.CATEGORIES.RATE.SIMPLE'],
          translation['METER.CATEGORIES.RATE.BI_HOURLY'],
          translation['METER.CATEGORIES.RATE.EXCLUSIVE_NIGHT'],
        ]);
      });
  }

  setupClientCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.CLIENT.RESIDENTIAL',
        'METER.CATEGORIES.CLIENT.PROFESSIONAL',
        'METER.CATEGORIES.CLIENT.INDUSTRIAL',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.clientTypeMap.set([
          '',
          translation['METER.CATEGORIES.CLIENT.RESIDENTIAL'],
          translation['METER.CATEGORIES.CLIENT.PROFESSIONAL'],
          translation['METER.CATEGORIES.CLIENT.INDUSTRIAL'],
        ]);
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.injectionStatusMap.set([
          '',
          translation['METER.CATEGORIES.INJECTION_STATUS.AUTOPRODUCER_OWNER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.SELF_PRODUCTION_RIGHT_OF_USER'],
          translation['METER.CATEGORIES.INJECTION_STATUS.OWNER_PURE_INJECTION'],
          translation['METER.CATEGORIES.INJECTION_STATUS.PURE_INJECTION_RIGHT_OF_USE'],
          translation['METER.CATEGORIES.INJECTION_STATUS.NONE'],
        ]);
      });
  }

  setupReadingFrequencyCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.READING_FREQUENCY.MONTHLY',
        'METER.CATEGORIES.READING_FREQUENCY.ANNUAL',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.readingFrequencyMap.set([
          '',
          translation['METER.CATEGORIES.READING_FREQUENCY.MONTHLY'],
          translation['METER.CATEGORIES.READING_FREQUENCY.ANNUAL'],
        ]);
      });
  }

  setupPhaseCategory(): void {
    this.translate
      .get(['METER.CATEGORIES.PHASE.SINGLE_PHASE', 'METER.CATEGORIES.PHASE.THREE_PHASES'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.phasesNumberMap.set([
          '',
          translation['METER.CATEGORIES.PHASE.SINGLE_PHASE'],
          translation['METER.CATEGORIES.PHASE.THREE_PHASES'],
        ]);
      });
  }

  setupTarifGroupCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE',
        'METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE',
      ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.tarifGroupMap.set([
          '',
          translation['METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE'],
          translation['METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE'],
        ]);
      });
  }

  toModify(): void {
    this.ref = this.dialogService.open(MeterUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '600px',
      header: this.translate.instant('METER.FULL.METER_MODIFICATION_HEADER') as string,
      data: {
        meter: this.meter(),
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
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

  toUpdate(): void {
    const meter = this.meter();
    if (!meter) return;
    this.ref = this.dialogService.open(MeterDataUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('METER.FULL.METER_DATA_UPDATE_HEADER') as string,
      width: '1000px',
      data: {
        id: meter.EAN,
        meterData: meter.meter_data,
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
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

  toDeactivate(): void {
    const meter = this.meter();
    if (!meter) return;
    this.ref = this.dialogService.open(MeterDeactivation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('METER.FULL.METER_DEACTIVATE_HEADER') as string,
      data: {
        ean: meter.EAN,
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
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

  protected readonly MeterStatus = MeterDataStatus;
}
