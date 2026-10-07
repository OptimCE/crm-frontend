import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Observable, Subject, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AddressGeoPrecision,
  AddressPreviewDTO,
  AddressSuggestionDTO,
} from '../../dtos/geocoding.dtos';
import { GeocodingService } from '../../services/geocoding.service';
import {
  AddressFieldSource,
  AddressFieldValues,
  addressFingerprint,
  fieldsFromSuggestion,
  isAddressComplete,
  isAddressEmpty,
  readAddressFields,
} from './address-field-source';

/** What the strip under the address block is currently saying. */
export type AddressGeoState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'found'; precision: AddressGeoPrecision; latitude: number; longitude: number }
  | { kind: 'not_found'; suggestions: readonly AddressSuggestionDTO[] }
  /** Fail-open. A dead geocoder must not decorate every form with a warning. */
  | { kind: 'error' };

/** What the parent needs in order to patch its own controls and stash the pin. */
export interface AddressPicked {
  suggestion: AddressSuggestionDTO;
  fields: AddressFieldValues;
  fingerprint: string;
}

/** What one search hands the suggestion list. */
interface SearchAnswer {
  rows: AddressSuggestionDTO[];
  /** False when the register was not asked, so an empty `rows` proves nothing. */
  searched: boolean;
}

/** Debounce for the ambient "can we locate this?" probe. */
const PROBE_DEBOUNCE_MS = 600;

/**
 * Shortest query worth sending. Mirrors the backend's own
 * `MIN_SUGGEST_QUERY_LENGTH`, because `*ru*` matches an enormous slice of a
 * 200k-street register.
 *
 * Used twice on purpose: once to drop the request, and once as the
 * autocomplete's `minLength` so that PrimeNG (default 1) does not even ask
 * below it. That second use is not watertight: PrimeNG counts the raw text and
 * this guard counts it trimmed, so "Bd " still asks. What keeps that empty
 * answer from reporting "no address found" about a search that was never made
 * is {@link AddressAutocomplete.searched}.
 */
const MIN_QUERY_LENGTH = 3;

/**
 * A search box over the federal BeSt Address register, plus the strip that says
 * whether what is typed can be placed on the map.
 *
 * **It does not own the five address inputs.** That is the central decision and
 * it is forced, not preferred:
 *
 *  - `ErrorHandlerComponent` injects `FormGroupDirective` and resolves control
 *    names against the ROOT group. Inside the community form's
 *    `formGroupName="headquarters_address"` there is no `FormGroupDirective`,
 *    so a child rendering `formControlName="street"` would need a
 *    `ControlContainer` viewProvider — a pattern that appears nowhere in this
 *    repo — and the error handler would still resolve against the root.
 *  - With `forceSelection=false` (which suggest-only requires) binding the
 *    autocomplete to a domain control makes that control's value
 *    `string | AddressSuggestionDTO`, poisoning all six `getRawValue()` casts.
 *  - The six forms differ in label namespace, error rendering, grid, and how
 *    they hide the billing block. Owning the inputs means rewriting six
 *    templates; this way each form gains one line.
 *
 * So it READS the form through {@link AddressFieldSource} and EMITS a pick. The
 * parent patches its own controls with its own types.
 */
@Component({
  selector: 'app-address-autocomplete',
  standalone: true,
  imports: [AutoComplete, FormsModule, TranslatePipe],
  templateUrl: './address-autocomplete.html',
})
export class AddressAutocomplete {
  private readonly geocodingService = inject(GeocodingService);
  private readonly destroyRef = inject(DestroyRef);

  /** The form and the paths of its five address controls. */
  readonly source = input.required<AddressFieldSource>();
  /** `block__element--modifier`, per the repo's data-testid convention. */
  readonly testId = input.required<string>();
  /** Run the ambient locate-check. Off for a block the user has disabled. */
  readonly probe = input(true);
  readonly disabled = input(false);
  readonly labelKey = input('ADDRESS_LOOKUP.SEARCH_LABEL');
  readonly placeholderKey = input('ADDRESS_LOOKUP.SEARCH_PLACEHOLDER');

  readonly addressPicked = output<AddressPicked>();
  readonly geoChange = output<AddressGeoState>();

  readonly suggestions = signal<AddressSuggestionDTO[]>([]);
  /**
   * Whether {@link suggestions} is the register's answer, which is what lets an
   * empty list say "no address found". The template binds it to PrimeNG's
   * `[showEmptyMessage]`.
   *
   * False when the list was emptied without asking: for a query too short once
   * trimmed (PrimeNG's `minLength` counts the raw text, so "Bd " gets here), or
   * after a pick, which empties the box. PrimeNG would otherwise open the panel
   * on that empty list to report a search that was never made.
   *
   * The binding sits ABOVE `[suggestions]` on purpose: Angular sets inputs in
   * template order, and PrimeNG decides whether to open inside its
   * `suggestions` setter, with `showEmptyMessage` as it stands at that moment.
   */
  readonly searched = signal(false);
  readonly searching = signal(false);
  readonly geo = signal<AddressGeoState>({ kind: 'idle' });

  /**
   * Narrowed views of {@link geo}, so the template never needs `$any`.
   *
   * Angular's `@switch` does not narrow a discriminated union the way
   * TypeScript's does, so reading `geo().precision` inside a `@case` only
   * compiles with `$any` — which switches template type-checking off for that
   * expression, exactly where a typo would be silent. Narrowing here keeps
   * `strictTemplates` doing its job.
   */
  readonly located = computed(() => {
    const state = this.geo();
    return state.kind === 'found' ? state : null;
  });
  readonly unlocated = computed(() => {
    const state = this.geo();
    return state.kind === 'not_found' ? state : null;
  });
  readonly checking = computed(() => this.geo().kind === 'checking');

  /**
   * Scratch text for the search box. Never persisted — see the class docstring.
   *
   * Typed as a union because PrimeNG writes the picked ROW into the model before
   * `onSelect` fires; `select()` resets it to '' immediately after. An emptied
   * box it writes as `null`, not ''. Declaring it `string` would be a lie that
   * happens to compile.
   */
  protected query: string | AddressSuggestionDTO | null = '';

  /** The search box's query, trimmed. See the pipeline in the constructor. */
  private readonly searchTerms = new Subject<string>();
  private readonly probeRequests = new Subject<AddressFieldValues>();
  /** Set on pick, so the probe does not re-ask about an address just resolved. */
  private lastPickedFingerprint: string | null = null;

  protected readonly Precision = AddressGeoPrecision;
  protected readonly minSearchLength = MIN_QUERY_LENGTH;

  constructor() {
    // Only the newest search may answer. Replies do not come back in order (a
    // cold first hit takes 0.6-1.5 s against the 250 ms [delay]), and PrimeNG
    // shows whatever its `suggestions` input received last, even once its
    // spinner has stopped: a late reply to "Rue de la" replaced the list
    // already showing for "Rue de la S". So a newer query, one too short once
    // trimmed, a pick, or an edit too short to search (see `onQueryChange()`)
    // drops the reply still in flight. Its request still completes and is
    // cached, because `cachedGet` shares it without refCount.
    //
    // No debounce and no distinctUntilChanged, unlike the probe below: [delay]
    // already debounces, and a repeated query must be answered again.
    this.searchTerms
      .pipe(
        switchMap((term) => this.suggestionsFor(term)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((answer) => {
        this.searched.set(answer.searched);
        this.suggestions.set(answer.rows);
        this.searching.set(false);
      });

    this.probeRequests
      .pipe(
        debounceTime(PROBE_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => addressFingerprint(a) === addressFingerprint(b)),
        switchMap((fields) =>
          this.geocodingService
            .previewAddress({
              street: fields.street,
              number: fields.number,
              postcode: fields.postcode,
              city: fields.city,
              supplement: fields.supplement || undefined,
            })
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.applyPreview(response?.data);
      });

    // The form is the source of truth, so watch it rather than asking each of
    // the six parents to notify us. `effect` cannot see FormGroup changes, so
    // the subscription is (re)established whenever the source input changes.
    effect((onCleanup) => {
      const source = this.source();
      const sub = source.group.valueChanges.subscribe(() => {
        this.onFormChanged();
      });
      onCleanup(() => {
        sub.unsubscribe();
      });
    });
  }

  /**
   * PrimeNG debounces the keystrokes for us via `[delay]`; see the template.
   *
   * Every call must be answered with a NEW array, even an empty one, unless a
   * newer call, a pick or an edit supersedes it (see the constructor):
   * PrimeNG's `loading` is one flag, and the newest answer clears it. PrimeNG
   * sets that flag before asking, and only its `suggestions` setter opens the
   * panel and clears it. The signal and the template binding both skip an
   * identical array (`Object.is`), so handing the last array over again leaves
   * the panel shut and the spinner spinning.
   */
  search(event: AutoCompleteCompleteEvent): void {
    this.searching.set(true);
    this.searchTerms.next((event.query || '').trim());
  }

  /**
   * The box was edited. PrimeNG writes every edit into the model: the text,
   * `null` for an emptied box, or the row for a pick, which `select()` handles.
   *
   * Text too short to search, an emptied box included, is never searched:
   * PrimeNG hides the panel without asking, so its `loading` flag stays up.
   * Its `suggestions` setter opens the panel on any rows while that flag is
   * up, so the late reply reopened it under the emptied box, full of rows for
   * a query no longer there. So that reply is dropped, and the list emptied
   * without asking, as after a pick: the flag comes down and the panel stays
   * shut.
   *
   * Only while a search is in flight. Otherwise PrimeNG closes the panel
   * itself, and emptying the list would leave only the footer in the panel
   * while it fades out.
   */
  onQueryChange(query: string | AddressSuggestionDTO | null): void {
    if (query !== null && typeof query !== 'string') {
      return;
    }
    if (this.searching() && (query ?? '').trim().length < MIN_QUERY_LENGTH) {
      this.searchTerms.next('');
    }
  }

  /** A row was chosen — tell the parent what to write, and stop warning. */
  select(suggestion: AddressSuggestionDTO): void {
    const current = readAddressFields(this.source());
    const fields = fieldsFromSuggestion(suggestion, current);
    const fingerprint = addressFingerprint(fields);
    this.lastPickedFingerprint = fingerprint;

    if (suggestion.latitude !== undefined && suggestion.longitude !== undefined) {
      this.setGeo({
        kind: 'found',
        precision: suggestion.precision ?? AddressGeoPrecision.ROOFTOP,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      });
    } else {
      // A street row: real, official, and simply not positioned yet.
      this.setGeo({ kind: 'idle' });
    }

    this.addressPicked.emit({ suggestion, fields, fingerprint });
    // The box has done its job; the five controls now show the address.
    // Searching the emptied box empties the list without asking, and drops a
    // reply still in flight: it answers a query the user is done with.
    this.query = '';
    this.searchTerms.next('');
  }

  /** Offered under a "we could not locate this" warning. */
  useSuggestion(suggestion: AddressSuggestionDTO): void {
    this.select(suggestion);
  }

  /**
   * Probe now rather than waiting for the debounce.
   *
   * The step gates in the two wizards call this: by the time the final submit
   * runs, the address panel is destroyed and there is nowhere for a "fix it"
   * action to go.
   */
  probeNow(): void {
    this.onFormChanged(true);
  }

  /** One query's answer. Every call builds a NEW array: see `search()`. */
  private suggestionsFor(term: string): Observable<SearchAnswer> {
    if (term.length < MIN_QUERY_LENGTH) {
      return of({ rows: [], searched: false });
    }

    return this.geocodingService.suggestAddresses(term).pipe(
      // The backend reuses the success envelope for failures, so `data` can
      // be a translated string. Every service in this repo guards this way.
      // Copied because a repeated query is a cache hit, which returns the
      // very same response object: see `search()`.
      map((response) => ({
        rows: Array.isArray(response.data) ? [...response.data] : [],
        searched: true,
      })),
      // Suggestions are advisory: an empty list, never a visible error.
      catchError(() => of({ rows: [], searched: true })),
    );
  }

  private onFormChanged(immediate = false): void {
    if (!this.probe() || this.disabled()) {
      return;
    }
    const fields = readAddressFields(this.source());

    if (isAddressEmpty(fields) || !isAddressComplete(fields)) {
      // Not a warning: a half-typed address is not a failure to locate one.
      this.setGeo({ kind: 'idle' });
      return;
    }

    // A freshly picked suggestion already carries its coordinate.
    if (this.lastPickedFingerprint === addressFingerprint(fields)) {
      return;
    }

    this.setGeo({ kind: 'checking' });
    if (immediate) {
      this.geocodingService
        .previewAddress({
          street: fields.street,
          number: fields.number,
          postcode: fields.postcode,
          city: fields.city,
          supplement: fields.supplement || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.applyPreview(response.data);
          },
          error: () => {
            this.setGeo({ kind: 'error' });
          },
        });
      return;
    }
    this.probeRequests.next(fields);
  }

  private applyPreview(data: AddressPreviewDTO | string | undefined | null): void {
    if (!data || typeof data === 'string') {
      this.setGeo({ kind: 'error' });
      return;
    }
    if (data.found && data.latitude !== undefined && data.longitude !== undefined) {
      this.setGeo({
        kind: 'found',
        precision: data.precision ?? AddressGeoPrecision.ROOFTOP,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      return;
    }
    this.setGeo({ kind: 'not_found', suggestions: data.suggestions });
  }

  private setGeo(state: AddressGeoState): void {
    this.geo.set(state);
    this.geoChange.emit(state);
  }
}
