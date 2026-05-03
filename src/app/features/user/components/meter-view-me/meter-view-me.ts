import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Avatar } from 'primeng/avatar';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';

import { MeService } from '../../../../shared/services/me.service';
import { MeMeterDTO } from '../../../../shared/dtos/me.dtos';
import { MetersDataDTO } from '../../../../shared/dtos/meter.dtos';
import { MeterDataStatus } from '../../../../shared/types/meter.types';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { MapNumberStringPipe } from '../../../../shared/pipes/map-number-string/map-number-string-pipe';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { MeterDataView } from '../../../meter/components/meter-view/meter-data-view/meter-data-view';

@Component({
  selector: 'app-meter-view-me',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    TranslatePipe,
    Avatar,
    Card,
    Skeleton,
    Tag,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Select,
    Button,
    AddressPipe,
    MapNumberStringPipe,
    BackArrow,
    MeterDataView,
  ],
  templateUrl: './meter-view-me.html',
  styleUrl: './meter-view-me.css',
})
export class MeterViewMe implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private meService = inject(MeService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  id!: string;
  readonly meter = signal<MeMeterDTO | undefined>(undefined);
  readonly isLoading = signal<boolean>(false);
  readonly hasError = signal<boolean>(false);
  readonly historySelected = signal<MetersDataDTO | undefined>(undefined);
  readonly futureSelected = signal<MetersDataDTO | undefined>(undefined);

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
    if (id === null || id === '') {
      void this.router.navigate(['/users']);
      return;
    }
    this.id = id;
    this.getFullMeter();
    this.setupTranslationCategory();
  }

  getFullMeter(showLoading = true): void {
    if (showLoading) {
      this.isLoading.set(true);
      this.hasError.set(false);
    }
    this.meService
      .getMetersById(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.meter.set(response.data as MeMeterDTO);
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

  protected readonly MeterStatus = MeterDataStatus;
}
