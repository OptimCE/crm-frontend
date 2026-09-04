import de from '../../../../assets/i18n/de.json';
import en from '../../../../assets/i18n/en.json';
import fr from '../../../../assets/i18n/fr.json';
import nl from '../../../../assets/i18n/nl.json';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../core/dtos/api.response';
import { AddressGeoPrecision, AddressSuggestionDTO } from '../../dtos/geocoding.dtos';
import { GeocodingService } from '../../services/geocoding.service';
import { AddressAutocomplete, AddressGeoState, AddressPicked } from './address-autocomplete';
import { prefixedAddressNames } from './address-field-source';

const ADDRESS_ROW: AddressSuggestionDTO = {
  id: 'geodata.wallonie.be/id/Address/1948446/2',
  kind: 'address',
  label: 'Place de la Station 20A, 5000 Namur',
  street: 'Place de la Station',
  number: '20A',
  postcode: '5000',
  city: 'Namur',
  country: 'BE',
  latitude: 50.46822,
  longitude: 4.863607,
  precision: AddressGeoPrecision.ROOFTOP,
  best_address_id: 'geodata.wallonie.be/id/Address/1948446/2',
};

const STREET_ROW: AddressSuggestionDTO = {
  id: 'geodata.wallonie.be/id/Streetname/7753485/223',
  kind: 'street',
  label: 'Place de la Station, 5000 Namur',
  street: 'Place de la Station',
  postcode: '5000',
  city: 'Namur',
  country: 'BE',
};

function buildForm(): FormGroup {
  return new FormGroup({
    home_address_street: new FormControl(''),
    home_address_number: new FormControl(''),
    home_address_supplement: new FormControl(''),
    home_address_postcode: new FormControl(''),
    home_address_city: new FormControl(''),
  });
}

describe('AddressAutocomplete', () => {
  let fixture: ComponentFixture<AddressAutocomplete>;
  let component: AddressAutocomplete;
  let geocodingSpy: {
    suggestAddresses: ReturnType<typeof vi.fn>;
    previewAddress: ReturnType<typeof vi.fn>;
  };
  let form: FormGroup;

  beforeEach(async () => {
    geocodingSpy = {
      suggestAddresses: vi.fn().mockReturnValue(of(new ApiResponse([ADDRESS_ROW], 0))),
      previewAddress: vi
        .fn()
        .mockReturnValue(of(new ApiResponse({ found: false, suggestions: [] }, 0))),
    };

    await TestBed.configureTestingModule({
      imports: [AddressAutocomplete, TranslateModule.forRoot()],
      providers: [{ provide: GeocodingService, useValue: geocodingSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Blank the template so PrimeNG never renders under jsdom — the repo's
      // idiom for autocomplete specs (sharing-operation-municipalities-update).
      .overrideComponent(AddressAutocomplete, {
        set: {
          imports: [TranslateModule],
          template: '',
          providers: [{ provide: GeocodingService, useValue: geocodingSpy }],
        },
      })
      .compileComponents();

    form = buildForm();
    fixture = TestBed.createComponent(AddressAutocomplete);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('source', {
      group: form,
      names: prefixedAddressNames('home_address'),
    });
    fixture.componentRef.setInput('testId', 'test__address');
    fixture.componentRef.setInput('probe', false);
    await fixture.whenStable();
  });

  describe('search', () => {
    it('asks the register once the query is long enough', () => {
      component.search({ query: 'rue de la station' } as never);

      expect(geocodingSpy.suggestAddresses).toHaveBeenCalledWith('rue de la station');
      expect(component.suggestions()).toEqual([ADDRESS_ROW]);
    });

    it('stays quiet below three characters', () => {
      // `*ru*` matches an enormous slice of the register and is not a suggestion.
      component.search({ query: 'ru' } as never);

      expect(geocodingSpy.suggestAddresses).not.toHaveBeenCalled();
      expect(component.suggestions()).toEqual([]);
    });

    it('exposes to the template exactly the threshold it enforces', () => {
      // The template binds [minLength]="minSearchLength" so PrimeNG will not open
      // its panel below the threshold. If that value drifted from the guard
      // here, the panel would open on a query `search()` refuses to run, find
      // the empty list, and report "no address found" about a search that was
      // never made — which is the bug the translated empty message would then
      // state fluently in four languages.
      const min = (component as unknown as { minSearchLength: number }).minSearchLength;

      component.search({ query: 'x'.repeat(min - 1) } as never);
      expect(geocodingSpy.suggestAddresses).not.toHaveBeenCalled();

      component.search({ query: 'x'.repeat(min) } as never);
      expect(geocodingSpy.suggestAddresses).toHaveBeenCalledTimes(1);
    });

    it('treats an envelope carrying a STRING as no results', () => {
      // The backend reuses the success envelope for failures, so `data` can be
      // a translated message rather than an array.
      geocodingSpy.suggestAddresses.mockReturnValue(of(new ApiResponse('Service unavailable', 1)));

      component.search({ query: 'rue de la station' } as never);

      expect(component.suggestions()).toEqual([]);
    });

    it('degrades to no suggestions when the request fails', () => {
      // Advisory, never a visible error: the form must stay usable.
      geocodingSpy.suggestAddresses.mockReturnValue(throwError(() => new Error('boom')));

      component.search({ query: 'rue de la station' } as never);

      expect(component.suggestions()).toEqual([]);
      expect(component.searching()).toBe(false);
    });
  });

  describe('select', () => {
    it('emits the fields the parent should write, plus a fingerprint', () => {
      let picked: AddressPicked | undefined;
      component.addressPicked.subscribe((event) => (picked = event));

      component.select(ADDRESS_ROW);

      expect(picked?.fields).toEqual({
        street: 'Place de la Station',
        number: '20A',
        supplement: '',
        postcode: '5000',
        city: 'Namur',
      });
      expect(picked?.suggestion.best_address_id).toBe('geodata.wallonie.be/id/Address/1948446/2');
      expect(picked?.fingerprint).toBeTruthy();
    });

    it('reports the address as located, with its precision', () => {
      const states: AddressGeoState[] = [];
      component.geoChange.subscribe((state) => states.push(state));

      component.select(ADDRESS_ROW);

      expect(component.geo()).toEqual({
        kind: 'found',
        precision: AddressGeoPrecision.ROOFTOP,
        latitude: 50.46822,
        longitude: 4.863607,
      });
      expect(states).toHaveLength(1);
    });

    it('does NOT claim a location for a street row', () => {
      // A street row is real and official; it simply has no coordinate, because
      // the register stores geometry per address rather than per street.
      component.select(STREET_ROW);

      expect(component.geo()).toEqual({ kind: 'idle' });
    });

    it('keeps a house number already typed when a street row is picked', () => {
      form.get('home_address_number')?.setValue('42');
      let picked: AddressPicked | undefined;
      component.addressPicked.subscribe((event) => (picked = event));

      component.select(STREET_ROW);

      expect(picked?.fields.number).toBe('42');
    });

    it('clears the scratch query and the dropdown after a pick', () => {
      component.search({ query: 'place de la station' } as never);
      component.select(ADDRESS_ROW);

      expect(component.suggestions()).toEqual([]);
    });
  });

  describe('probeNow', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('probe', true);
    });

    it('does nothing while the address is incomplete', () => {
      // A half-typed address is not a failure to locate one.
      form.patchValue({ home_address_street: 'Rue de la Loi' });

      component.probeNow();

      expect(geocodingSpy.previewAddress).not.toHaveBeenCalled();
      expect(component.geo()).toEqual({ kind: 'idle' });
    });

    it('warns, with alternatives, when the address cannot be located', () => {
      geocodingSpy.previewAddress.mockReturnValue(
        of(new ApiResponse({ found: false, suggestions: [ADDRESS_ROW] }, 0)),
      );
      form.patchValue({
        home_address_street: 'Rue Inexistante',
        home_address_number: '1',
        home_address_postcode: '9999',
        home_address_city: 'Nowhere',
      });

      component.probeNow();

      expect(component.geo()).toEqual({ kind: 'not_found', suggestions: [ADDRESS_ROW] });
    });

    it('reports an approximate pin distinctly from an exact one', () => {
      geocodingSpy.previewAddress.mockReturnValue(
        of(
          new ApiResponse(
            {
              found: true,
              latitude: 50.87,
              longitude: 4.37,
              precision: AddressGeoPrecision.MUNICIPALITY,
              suggestions: [],
            },
            0,
          ),
        ),
      );
      form.patchValue({
        home_address_street: 'Rue de la Loi',
        home_address_number: '16',
        home_address_postcode: '1000',
        home_address_city: 'Bruxelles',
      });

      component.probeNow();

      expect(component.located()?.precision).toBe(AddressGeoPrecision.MUNICIPALITY);
    });

    it('FAILS OPEN — a dead geocoder shows nothing, not a warning', () => {
      geocodingSpy.previewAddress.mockReturnValue(throwError(() => new Error('down')));
      form.patchValue({
        home_address_street: 'Rue de la Loi',
        home_address_number: '16',
        home_address_postcode: '1000',
        home_address_city: 'Bruxelles',
      });

      component.probeNow();

      // 'error' renders nothing: a geocoder having a bad minute must not put a
      // warning under every address field in the app.
      expect(component.geo()).toEqual({ kind: 'error' });
      expect(component.unlocated()).toBeNull();
    });

    it('does not re-ask about an address just picked', () => {
      component.select(ADDRESS_ROW);
      form.patchValue({
        home_address_street: 'Place de la Station',
        home_address_number: '20A',
        home_address_postcode: '5000',
        home_address_city: 'Namur',
      });
      geocodingSpy.previewAddress.mockClear();

      component.probeNow();

      expect(geocodingSpy.previewAddress).not.toHaveBeenCalled();
    });

    it('stays silent for a disabled block', () => {
      fixture.componentRef.setInput('disabled', true);
      form.patchValue({
        home_address_street: 'Rue de la Loi',
        home_address_number: '16',
        home_address_postcode: '1000',
        home_address_city: 'Bruxelles',
      });

      component.probeNow();

      expect(geocodingSpy.previewAddress).not.toHaveBeenCalled();
    });
  });
});

describe('ADDRESS_LOOKUP translations', () => {
  const locales = { en, fr, nl, de } as Record<string, { ADDRESS_LOOKUP: Record<string, string> }>;

  it('defines the same keys in every language', () => {
    // The bug this guards: PrimeNG falls back to its own config translation for
    // an unbound empty message, which is the hardcoded English "No results
    // found". A key present in en.json but missing elsewhere reproduces exactly
    // that symptom, in the languages nobody checked.
    const reference = Object.keys(locales['en'].ADDRESS_LOOKUP).sort();

    for (const [name, bundle] of Object.entries(locales)) {
      expect(Object.keys(bundle.ADDRESS_LOOKUP).sort(), name).toEqual(reference);
    }
  });

  it('leaves none of them blank', () => {
    for (const [name, bundle] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(bundle.ADDRESS_LOOKUP)) {
        expect(value.trim(), `${name}.${key}`).not.toBe('');
      }
    }
  });
});
