import { Component, inject, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { RadioButtonModule } from 'primeng/radiobutton';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormErrorSummaryComponent } from '../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { MetersDTO, UpdateMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { PhaseCategory, ReadingFrequency, TarifGroup } from '../../../../shared/types/meter.types';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { CreateAddressDTO } from '../../../../shared/dtos/address.dtos';

interface MeterUpdateDialogData {
  meter: MetersDTO;
}

interface MeterCategory<T> {
  id: T;
  name: string;
}

interface MeterUpdateFormValue {
  address_street: string;
  address_number: string;
  address_postcode: string;
  address_supplement: string;
  address_city: string;
  EAN: string;
  meterNumber: string;
  tarifGroup: MeterCategory<TarifGroup>;
  phasesNumber: MeterCategory<PhaseCategory>;
  readingFrequency: MeterCategory<ReadingFrequency>;
}

@Component({
  selector: 'app-meter-update',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    ErrorHandlerComponent,
    RadioButtonModule,
    Button,
    TranslatePipe,
    FormErrorSummaryComponent,
  ],
  templateUrl: './meter-update.html',
  styleUrl: './meter-update.css',
})
export class MeterUpdate implements OnInit {
  private config = inject(DynamicDialogConfig);
  private meterService = inject(MeterService);
  private ref = inject(DynamicDialogRef);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  @Input()
  meter!: MetersDTO;
  metersForm!: FormGroup;
  tarifGroupCategory: MeterCategory<TarifGroup>[] = [
    { id: TarifGroup.LOW_TENSION, name: '' },
    { id: TarifGroup.HIGH_TENSION, name: '' },
  ];
  phaseCategory: MeterCategory<PhaseCategory>[] = [
    { id: PhaseCategory.SINGLE, name: '' },
    { id: PhaseCategory.THREE, name: '' },
  ];
  readingFrequencyCategory: MeterCategory<ReadingFrequency>[] = [
    { id: ReadingFrequency.MONTHLY, name: '' },
    { id: ReadingFrequency.YEARLY, name: '' },
  ];
  constructor() {
    const data = this.config.data as MeterUpdateDialogData;
    this.meter = data.meter;
  }

  ngOnInit(): void {
    this.metersForm = new FormGroup({
      address_street: new FormControl('', [Validators.required]),
      address_number: new FormControl('', [Validators.required]),
      address_postcode: new FormControl('', [Validators.required]),
      address_supplement: new FormControl('', []),
      address_city: new FormControl('', [Validators.required]),
      EAN: new FormControl('', [Validators.required]),
      meterNumber: new FormControl('', [Validators.required]),
      tarifGroup: new FormControl('', [Validators.required]),
      phasesNumber: new FormControl('', [Validators.required]),
      readingFrequency: new FormControl('', [Validators.required]),
    });
    this.metersForm.patchValue({
      address_street: this.meter.address.street,
      address_number: this.meter.address.number,
      address_postcode: this.meter.address.postcode,
      address_supplement: this.meter.address.supplement,
      address_city: this.meter.address.city,
      EAN: this.meter.EAN,
      meterNumber: this.meter.meter_number,
      tarifGroup: this.tarifGroupCategory.find(
        (tarifGroup) => tarifGroup.id === this.meter.tarif_group,
      ),
      phasesNumber: this.phaseCategory.find((phase) => phase.id === this.meter.phases_number),
      readingFrequency: this.readingFrequencyCategory.find(
        (readingFrequency) => readingFrequency.id === this.meter.reading_frequency,
      ),
    });
    this.setupTranslationCategory();
  }
  setupTranslationCategory(): void {
    this.setupReadingFrequencyCategory();
    this.setupPhaseCategory();
    this.setupTarifGroupCategory();
  }

  setupReadingFrequencyCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.READING_FREQUENCY.MONTHLY',
        'METER.CATEGORIES.READING_FREQUENCY.ANNUAL',
      ])
      .subscribe((translation: Record<string, string>) => {
        const translations = [
          translation['METER.CATEGORIES.READING_FREQUENCY.MONTHLY'],
          translation['METER.CATEGORIES.READING_FREQUENCY.ANNUAL'],
        ];
        this.readingFrequencyCategory.forEach((item, index) => {
          item.name = translations[index];
        });
      });
  }

  setupPhaseCategory(): void {
    this.translate
      .get(['METER.CATEGORIES.PHASE.SINGLE_PHASE', 'METER.CATEGORIES.PHASE.THREE_PHASES'])
      .subscribe((translation: Record<string, string>) => {
        const translations = [
          translation['METER.CATEGORIES.PHASE.SINGLE_PHASE'],
          translation['METER.CATEGORIES.PHASE.THREE_PHASES'],
        ];
        this.phaseCategory.forEach((item, index) => {
          item.name = translations[index];
        });
      });
  }

  setupTarifGroupCategory(): void {
    this.translate
      .get([
        'METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE',
        'METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE',
      ])
      .subscribe((translation: Record<string, string>) => {
        const translations = [
          translation['METER.CATEGORIES.TARIF_GROUP.LOW_VOLTAGE'],
          translation['METER.CATEGORIES.TARIF_GROUP.HIGH_VOLTAGE'],
        ];
        this.tarifGroupCategory.forEach((item, index) => {
          item.name = translations[index];
        });
      });
  }

  onSubmit(): void {
    if (!this.metersForm.valid) {
      return;
    }

    const formValue = this.metersForm.getRawValue() as MeterUpdateFormValue;

    const newAddress: CreateAddressDTO = {
      street: formValue.address_street,
      number: +formValue.address_number,
      postcode: formValue.address_postcode,
      city: formValue.address_city,
      supplement: formValue.address_supplement,
    };

    const updated_meter: UpdateMeterDTO = {
      EAN: formValue.EAN,
      address: newAddress,
      meter_number: formValue.meterNumber,
      phases_number: formValue.phasesNumber.id,
      reading_frequency: formValue.readingFrequency.id,
      tarif_group: formValue.tarifGroup.id,
    };

    this.meterService.updateMeter(updated_meter).subscribe({
      next: (response) => {
        if (response) {
          this.ref.close(true);
        } else {
          this.errorHandler.handleError(response);
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error);
      },
    });
  }
}
