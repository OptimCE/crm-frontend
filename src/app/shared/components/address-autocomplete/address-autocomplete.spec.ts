import de from '../../../../assets/i18n/de.json';
import en from '../../../../assets/i18n/en.json';
import fr from '../../../../assets/i18n/fr.json';
import nl from '../../../../assets/i18n/nl.json';
import { Component, Input, NO_ERRORS_SCHEMA, forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlValueAccessor, FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { AutoComplete } from 'primeng/autocomplete';
import { Subject, of, throwError } from 'rxjs';
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
      // The template binds [minLength]="minSearchLength" so PrimeNG does not
      // even ask below the threshold. Drifting above the guard would silently
      // stop every query of exactly the threshold's length from being run;
      // drifting below would leave `searched` alone between the panel and a
      // "no address found" about a search that was never made.
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

    // A cache hit is `of(cached)`: the very same response object, every time.
    const cachedRows = new ApiResponse([ADDRESS_ROW], 0);
    const cachedNone = new ApiResponse<AddressSuggestionDTO[]>([], 0);

    it.each([
      ['a cached list', 'rue de la station', () => of(cachedRows)],
      ['a cached empty list', 'rue inexistante', () => of(cachedNone)],
      ['a failure envelope', 'rue de la station', () => of(new ApiResponse('Unavailable', 1))],
      ['a failed request', 'rue de la station', () => throwError(() => new Error('boom'))],
      ['a query too short once trimmed', 'ab ', () => of(cachedRows)],
    ])('answers the same query twice with two distinct lists, for %s', (_label, query, answer) => {
      // PrimeNG sets its `loading` flag before asking, and only its
      // `suggestions` setter opens the panel and clears that flag. The signal
      // and the template binding both skip an identical array (Object.is), so
      // re-sending the cached array left the panel shut and the spinner
      // spinning whenever a query was retyped.
      geocodingSpy.suggestAddresses.mockImplementation(answer);

      component.search({ query } as never);
      const first = component.suggestions();
      component.search({ query } as never);

      expect(component.suggestions()).toEqual(first);
      expect(component.suggestions()).not.toBe(first);
    });

    it('flags an empty list it never asked the register for', () => {
      // PrimeNG's minLength counts the raw text and `search()` trims it, so
      // 'Bd ' (3 raw, 2 trimmed) gets here. The template feeds the flag to
      // [showEmptyMessage]; left on, PrimeNG opened the panel on this empty
      // list to report "no address found" about a search that was never made.
      component.search({ query: 'Bd ' } as never);

      expect(geocodingSpy.suggestAddresses).not.toHaveBeenCalled();
      expect(component.suggestions()).toEqual([]);
      expect(component.searched()).toBe(false);
    });

    it('lets an empty answer from the register say so', () => {
      geocodingSpy.suggestAddresses.mockReturnValue(of(new ApiResponse([], 0)));
      component.search({ query: 'Bd ' } as never);

      component.search({ query: 'rue inexistante' } as never);

      expect(component.suggestions()).toEqual([]);
      expect(component.searched()).toBe(true);
    });
  });

  describe('search, when replies come back out of order', () => {
    // A cold first hit takes 0.6-1.5 s against the 250 ms [delay], so a newer
    // query is often answered first. PrimeNG shows whatever its `suggestions`
    // input received last, even once its spinner has stopped: a late reply to
    // 'Rue de la' replaced the list already showing for 'Rue de la S'.
    let older: Subject<ApiResponse<AddressSuggestionDTO[]>>;

    beforeEach(() => {
      older = new Subject();
      geocodingSpy.suggestAddresses.mockReturnValueOnce(older);
      component.search({ query: 'rue de la' } as never);
    });

    it('drops the reply to a query typed past', () => {
      const newer = new Subject<ApiResponse<AddressSuggestionDTO[]>>();
      geocodingSpy.suggestAddresses.mockReturnValueOnce(newer);

      component.search({ query: 'rue de la s' } as never);
      expect(older.observed).toBe(false);

      newer.next(new ApiResponse([ADDRESS_ROW], 0));
      older.next(new ApiResponse([STREET_ROW], 0));
      expect(component.suggestions()).toEqual([ADDRESS_ROW]);
      expect(component.searching()).toBe(false);
    });

    it('drops it when the query is cut below the threshold', () => {
      component.search({ query: 'Bd ' } as never);
      expect(older.observed).toBe(false);

      older.next(new ApiResponse([STREET_ROW], 0));
      expect(component.suggestions()).toEqual([]);
      expect(component.searched()).toBe(false);
    });

    it('drops it after a pick', () => {
      component.select(ADDRESS_ROW);
      expect(older.observed).toBe(false);

      older.next(new ApiResponse([STREET_ROW], 0));
      expect(component.suggestions()).toEqual([]);
      expect(component.searched()).toBe(false);
    });
  });

  describe('onQueryChange, while a search is in flight', () => {
    // PrimeNG never searches an emptied box, or text too short to search: it
    // hides the panel without asking, so its `loading` flag stayed up, and the
    // late reply reopened the panel under the emptied box, full of 'Rue du'.
    let older: Subject<ApiResponse<AddressSuggestionDTO[]>>;

    beforeEach(() => {
      older = new Subject();
      geocodingSpy.suggestAddresses.mockReturnValueOnce(older);
      component.search({ query: 'rue du' } as never);
    });

    it.each([
      ['emptied, which PrimeNG writes as null', null],
      ['emptied', ''],
      ['cut below the threshold', 'Ru'],
      ['left with blanks only', '   '],
      ['too short once trimmed', 'Bd '],
    ])('drops the reply when the box is %s', (_label, query) => {
      component.onQueryChange(query);
      expect(older.observed).toBe(false);

      older.next(new ApiResponse([STREET_ROW], 0));
      expect(component.suggestions()).toEqual([]);
      expect(component.searched()).toBe(false);
      expect(component.searching()).toBe(false);
    });

    it('lets it answer text still long enough to search', () => {
      // PrimeNG searches that text once [delay] has passed, which drops the
      // reply then. Dropping it on the keystroke would shut the panel and
      // reopen it on every edit.
      component.onQueryChange('Rue d');
      expect(older.observed).toBe(true);
    });

    it('leaves a pick to select()', () => {
      // PrimeNG writes the picked ROW into the model before `onSelect` fires,
      // in the same call: a throw here would lose the pick.
      expect(() => component.onQueryChange(ADDRESS_ROW)).not.toThrow();
      expect(older.observed).toBe(true);
    });
  });

  describe('onQueryChange, with nothing in flight', () => {
    it('leaves the list alone', () => {
      // PrimeNG closes the panel itself. Emptying the list would leave only
      // the footer in the panel while it fades out.
      component.search({ query: 'rue de la station' } as never);
      const shown = component.suggestions();

      component.onQueryChange(null);

      expect(component.suggestions()).toBe(shown);
      expect(component.searched()).toBe(true);
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

/**
 * Stands in for PrimeNG's AutoComplete, which never renders under jsdom, so the
 * spec below can run the REAL template. It records the decision PrimeNG takes in
 * its `suggestions` setter while a search is pending: open the panel if there
 * are rows, or if the empty message is on. It reports edits to the model the
 * way PrimeNG's `onInput` does.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- must match the real template's element
  selector: 'p-autoComplete',
  standalone: true,
  template: '',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AutoCompleteStub), multi: true },
  ],
})
class AutoCompleteStub implements ControlValueAccessor {
  @Input() showEmptyMessage = true;
  readonly opens: boolean[] = [];
  private onChange: (value: string | null) => void = () => undefined;

  @Input() set suggestions(rows: unknown[]) {
    this.opens.push(rows.length > 0 || this.showEmptyMessage);
  }

  /** An edit of the box: its text, or `null` once emptied. */
  type(text: string | null): void {
    this.onChange(text);
  }

  writeValue(): void {
    // no-op: what the component writes into the box plays no part here
  }

  registerOnChange(onChange: (value: string | null) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(): void {
    // no-op: see writeValue
  }
}

describe('AddressAutocomplete template', () => {
  let fixture: ComponentFixture<AddressAutocomplete>;
  let stub: AutoCompleteStub;
  let geocoding: {
    suggestAddresses: ReturnType<typeof vi.fn>;
    previewAddress: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    geocoding = {
      suggestAddresses: vi.fn().mockReturnValue(of(new ApiResponse([ADDRESS_ROW], 0))),
      previewAddress: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [AddressAutocomplete, TranslateModule.forRoot()],
      providers: [{ provide: GeocodingService, useValue: geocoding }],
    })
      .overrideComponent(AddressAutocomplete, {
        remove: { imports: [AutoComplete] },
        // The stub declares only the inputs under test; the schema lets the
        // template's other PrimeNG bindings land on nothing.
        add: { imports: [AutoCompleteStub], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AddressAutocomplete);
    fixture.componentRef.setInput('source', {
      group: buildForm(),
      names: prefixedAddressNames('home_address'),
    });
    fixture.componentRef.setInput('testId', 'test__address');
    fixture.componentRef.setInput('probe', false);
    fixture.detectChanges();
    stub = fixture.debugElement.query(By.directive(AutoCompleteStub))
      .componentInstance as AutoCompleteStub;
    stub.opens.length = 0; // the first binding is not an answer
  });

  it('switches the empty message off BEFORE PrimeNG reads it', () => {
    // [showEmptyMessage] must sit above [suggestions]: Angular sets inputs in
    // template order, and PrimeNG reads it inside its suggestions setter. Placed
    // below it, each answer would be judged by the flag of the answer before.
    const answer = (query: string): void => {
      fixture.componentInstance.search({ query } as never);
      fixture.detectChanges();
    };
    answer('rue de la station');
    answer('Bd ');
    geocoding.suggestAddresses.mockReturnValue(of(new ApiResponse([], 0)));
    answer('rue inexistante');

    // Rows; an empty list never asked for; an empty answer from the register.
    expect(stub.opens).toEqual([true, false, true]);
  });

  it('settles a search in flight when the box is emptied', () => {
    // PrimeNG reports the edit through ngModel, then hides the panel without
    // asking: only the component can settle the search before the late reply
    // reopens the panel under the emptied box.
    const older = new Subject<ApiResponse<AddressSuggestionDTO[]>>();
    geocoding.suggestAddresses.mockReturnValueOnce(older);
    fixture.componentInstance.search({ query: 'rue du' } as never);
    fixture.detectChanges();

    stub.type(null);
    fixture.detectChanges();
    older.next(new ApiResponse([ADDRESS_ROW], 0));
    fixture.detectChanges();

    // One answer: an empty list never asked for, which keeps the panel shut.
    expect(older.observed).toBe(false);
    expect(stub.opens).toEqual([false]);
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
