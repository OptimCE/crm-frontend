import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import { MeterUpdate } from './meter-update';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { MetersDTO } from '../../../../shared/dtos/meter.dtos';
import { PhaseCategory, ReadingFrequency, TarifGroup } from '../../../../shared/types/meter.types';
import { UpdateMeterDTO } from '../../../../shared/dtos/meter.dtos';
import { AddressGeoPrecision, AddressSuggestionDTO } from '../../../../shared/dtos/geocoding.dtos';
import { AddressPicked } from '../../../../shared/components/address-autocomplete/address-autocomplete';
import { addressFingerprint } from '../../../../shared/components/address-autocomplete/address-field-source';

const mockMeter: MetersDTO = {
  EAN: '54000000001',
  meter_number: 'M-001',
  address: {
    id: 1,
    street: 'Rue Test',
    number: '10',
    postcode: '1000',
    city: 'Brussels',
    supplement: 'A',
  },
  tarif_group: TarifGroup.LOW_TENSION,
  phases_number: PhaseCategory.SINGLE,
  reading_frequency: ReadingFrequency.MONTHLY,
};

/**
 * Drive the picker's output the way the template does. `onAddressPicked` is
 * `protected` because only the template calls it in production.
 */
function pickAddress(
  component: MeterUpdate,
  fields: { street: string; number: string; postcode: string; city: string },
): void {
  const suggestion: AddressSuggestionDTO = {
    id: 'best:42',
    kind: 'address',
    label: `${fields.street} ${fields.number}, ${fields.postcode} ${fields.city}`,
    street: fields.street,
    number: fields.number,
    postcode: fields.postcode,
    city: fields.city,
    country: 'BE',
    latitude: 50.851609,
    longitude: 4.354555,
    precision: AddressGeoPrecision.ROOFTOP,
    best_address_id: 'best:42',
  };
  const handler = component as unknown as { onAddressPicked: (event: AddressPicked) => void };
  handler.onAddressPicked({
    suggestion,
    fields: { ...fields, supplement: '' },
    fingerprint: addressFingerprint({ ...fields, supplement: '' }),
  });
}

/** `addressDetailsOpen` is protected: only the template reads it in production. */
function detailsOpen(component: MeterUpdate): boolean {
  return (component as unknown as { addressDetailsOpen: () => boolean }).addressDetailsOpen();
}

describe('MeterUpdate', () => {
  let component: MeterUpdate;
  let fixture: ComponentFixture<MeterUpdate>;

  let meterServiceSpy: { updateMeter: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigSpy: { data: { meter: MetersDTO } };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    meterServiceSpy = { updateMeter: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    dialogConfigSpy = { data: { meter: mockMeter } };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MeterUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfigSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterUpdate);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  function fillFormValid(): void {
    const phase = component.phaseCategory().find((p) => p.id === PhaseCategory.SINGLE);
    const freq = component
      .readingFrequencyCategory()
      .find((r) => r.id === ReadingFrequency.MONTHLY);
    const tarif = component.tarifGroupCategory().find((t) => t.id === TarifGroup.LOW_TENSION);

    component.metersForm.patchValue({
      address_street: 'Rue Neuve',
      address_number: '5',
      address_postcode: '1000',
      address_supplement: '',
      address_city: 'Brussels',
      EAN: '54000000002',
      meterNumber: 'M-002',
      tarifGroup: tarif,
      phasesNumber: phase,
      readingFrequency: freq,
    });
  }

  // ── 1. Initialization ───────────────────────────────────────────────

  describe('Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize metersForm with all 10 controls', () => {
      const controlNames = [
        'address_street',
        'address_number',
        'address_postcode',
        'address_supplement',
        'address_city',
        'EAN',
        'meterNumber',
        'tarifGroup',
        'phasesNumber',
        'readingFrequency',
      ];
      controlNames.forEach((name) => {
        expect(component.metersForm.get(name)).toBeTruthy();
      });
    });

    it('should patch form with meter data from dialog config on init', () => {
      expect(component.metersForm.get('address_street')?.value).toBe('Rue Test');
      expect(component.metersForm.get('address_number')?.value).toBe('10');
      expect(component.metersForm.get('address_postcode')?.value).toBe('1000');
      expect(component.metersForm.get('address_supplement')?.value).toBe('A');
      expect(component.metersForm.get('address_city')?.value).toBe('Brussels');
      expect(component.metersForm.get('EAN')?.value).toBe('54000000001');
      expect(component.metersForm.get('meterNumber')?.value).toBe('M-001');
      expect((component.metersForm.get('tarifGroup')?.value as { id: TarifGroup }).id).toBe(
        TarifGroup.LOW_TENSION,
      );
      expect((component.metersForm.get('phasesNumber')?.value as { id: PhaseCategory }).id).toBe(
        PhaseCategory.SINGLE,
      );
      expect(
        (component.metersForm.get('readingFrequency')?.value as { id: ReadingFrequency }).id,
      ).toBe(ReadingFrequency.MONTHLY);
    });
  });

  // ── 2. Form validation ──────────────────────────────────────────────

  describe('Form validation', () => {
    it('should mark form invalid when required fields are empty', () => {
      component.metersForm.patchValue({
        address_street: '',
        address_number: '',
        address_postcode: '',
        address_city: '',
        EAN: '',
        meterNumber: '',
        tarifGroup: '',
        phasesNumber: '',
        readingFrequency: '',
      });
      expect(component.metersForm.valid).toBe(false);
    });

    it('should mark form valid when all required fields are filled', () => {
      fillFormValid();
      expect(component.metersForm.valid).toBe(true);
    });
  });

  // ── 3. Category signals ─────────────────────────────────────────────

  describe('Category signals', () => {
    it('should have 2 tarif group categories', () => {
      const categories = component.tarifGroupCategory();
      expect(categories.length).toBe(2);
      expect(categories[0].id).toBe(TarifGroup.LOW_TENSION);
      expect(categories[1].id).toBe(TarifGroup.HIGH_TENSION);
    });

    it('should have 2 phase categories', () => {
      const categories = component.phaseCategory();
      expect(categories.length).toBe(2);
      expect(categories[0].id).toBe(PhaseCategory.SINGLE);
      expect(categories[1].id).toBe(PhaseCategory.THREE);
    });

    it('should have 2 reading frequency categories', () => {
      const categories = component.readingFrequencyCategory();
      expect(categories.length).toBe(2);
      expect(categories[0].id).toBe(ReadingFrequency.MONTHLY);
      expect(categories[1].id).toBe(ReadingFrequency.YEARLY);
    });
  });

  // ── 4. onSubmit — invalid form ──────────────────────────────────────

  describe('onSubmit — invalid form', () => {
    it('should not call meterService.updateMeter when form is invalid', () => {
      component.metersForm.patchValue({ address_street: '' });
      component.onSubmit();
      expect(meterServiceSpy.updateMeter).not.toHaveBeenCalled();
    });
  });

  // ── 5. onSubmit — valid form, success ───────────────────────────────

  describe('onSubmit — valid form, success', () => {
    it('should call meterService.updateMeter with correct UpdateMeterDTO', () => {
      fillFormValid();
      meterServiceSpy.updateMeter.mockReturnValue(of({ data: 'ok' }));

      component.onSubmit();

      expect(meterServiceSpy.updateMeter).toHaveBeenCalledWith({
        EAN: '54000000002',
        address: {
          street: 'Rue Neuve',
          number: '5',
          postcode: '1000',
          city: 'Brussels',
          supplement: '',
        },
        meter_number: 'M-002',
        phases_number: PhaseCategory.SINGLE,
        reading_frequency: ReadingFrequency.MONTHLY,
        tarif_group: TarifGroup.LOW_TENSION,
      });
    });

    it('carries a picked coordinate into the payload', () => {
      // The whole point of the picker: a register pick lands on the map without
      // waiting for a geocoder round trip, because the backend stores a
      // caller-supplied pin directly.
      fillFormValid();
      meterServiceSpy.updateMeter.mockReturnValue(of({ data: 'ok' }));
      pickAddress(component, {
        street: 'Rue Neuve',
        number: '5',
        postcode: '1000',
        city: 'Brussels',
      });

      component.onSubmit();

      const dto = meterServiceSpy.updateMeter.mock.calls[0][0] as UpdateMeterDTO;
      expect(dto.address).toMatchObject({
        latitude: 50.851609,
        longitude: 4.354555,
        best_address_id: 'best:42',
      });
    });

    it('DROPS the picked coordinate once the address is edited afterwards', () => {
      // The failure this guards: pick "…5", hand-edit to 7, and the rooftop
      // coordinate now points at the wrong building — a lie the map would
      // render confidently.
      fillFormValid();
      meterServiceSpy.updateMeter.mockReturnValue(of({ data: 'ok' }));
      pickAddress(component, {
        street: 'Rue Neuve',
        number: '5',
        postcode: '1000',
        city: 'Brussels',
      });
      component.metersForm.get('address_number')?.setValue('7');

      component.onSubmit();

      const dto = meterServiceSpy.updateMeter.mock.calls[0][0] as UpdateMeterDTO;
      expect(dto.address).not.toHaveProperty('latitude');
      expect(dto.address).not.toHaveProperty('best_address_id');
      expect(dto.address.number).toBe('7');
    });

    it('should close dialog with true on successful response', () => {
      fillFormValid();
      meterServiceSpy.updateMeter.mockReturnValue(of({ data: 'ok' }));

      component.onSubmit();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });
  });

  // ── 6. onSubmit — valid form, falsy response ────────────────────────

  describe('onSubmit — valid form, falsy response', () => {
    it('should call errorHandler.handleError when response is falsy', () => {
      fillFormValid();
      meterServiceSpy.updateMeter.mockReturnValue(of(null));

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });
  });

  // ── 7. onSubmit — valid form, error ─────────────────────────────────

  describe('onSubmit — valid form, error', () => {
    it('should call errorHandler.handleError on HTTP error', () => {
      fillFormValid();
      const error = new Error('Network error');
      meterServiceSpy.updateMeter.mockReturnValue(throwError(() => error));

      component.onSubmit();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  // ── 8. Address details disclosure ───────────────────────────────────

  describe('address details disclosure', () => {
    it('shows the detailed fields immediately, because the address is already there', () => {
      // The whole difference from the creation dialog, and it needs no special
      // case: the rule is "open when the form carries an address", and an
      // existing meter always does.
      expect(detailsOpen(component)).toBe(true);
    });

    it('renders the inputs rather than the manual link', () => {
      // Behavioural state is not enough on its own — the template has to
      // actually honour the flag.
      const host = fixture.nativeElement as HTMLElement;
      const street = host.querySelector('[data-testid="meter-update__input--street"]');
      const manual = host.querySelector('[data-testid="meter-update__button--address-manual"]');

      expect(street).not.toBeNull();
      expect(manual).toBeNull();
    });

    it('keeps them open after a pick', () => {
      pickAddress(component, {
        street: 'Rue Neuve',
        number: '40',
        postcode: '1000',
        city: 'Brussels',
      });

      expect(detailsOpen(component)).toBe(true);
    });
  });
});
