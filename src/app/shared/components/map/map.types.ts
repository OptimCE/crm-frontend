import type { MultiPolygon, Polygon } from 'geojson';

/** Which of the two views a list page is showing. */
export type MapViewMode = 'list' | 'map';

/**
 * How exact a point is. Mirrors the backend `AddressGeoPrecision` but keeps this
 * module free of any domain import — the map knows about points, not meters.
 */
export const MAP_PRECISION_APPROXIMATE = 4;

/** A translated label/value pair rendered in a popup entry. */
export interface MapFieldSpec {
  /** i18n key. The popup resolves it, so this module stays string-free. */
  readonly labelKey: string;
  readonly value: string;
}

/** A PrimeNG tag rendered in a popup entry. */
export interface MapBadgeSpec {
  readonly labelKey: string;
  readonly severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
}

/** One plottable thing. Feature-agnostic: adapters map their DTOs onto this. */
export interface MapPoint {
  /** Stable identity, unique within the dataset. */
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  /** Lower is better; `MAP_PRECISION_APPROXIMATE` renders as a weak pin. */
  readonly precision: number | null;
  /**
   * Severity rank, 0 = healthy. Drives the pin colour, and is accumulated with
   * `max` across a cluster so a cluster shows its worst member.
   */
  readonly rank: number;
  readonly title: string;
  readonly fields?: readonly MapFieldSpec[];
  readonly badges?: readonly MapBadgeSpec[];
  /**
   * ABSOLUTE router path, e.g. `/meters/541448...`.
   *
   * The popup component is created with the environment injector, so its
   * RouterLink resolves ActivatedRoute to the ROOT route — a relative link
   * would resolve against `/`, not against the page it was opened from.
   */
  readonly routerLink?: string;
}

/** One polygon belonging to one entity. Several zones can share a `groupKey`. */
export interface MapZone {
  /** Unique per (entity, polygon) pair. */
  readonly id: string;
  /** Zones sharing this key occupy the SAME polygon — e.g. one commune. */
  readonly groupKey: string;
  /** Identity the deterministic colour is derived from — e.g. a community id. */
  readonly colorKey: string;
  readonly geometry: Polygon | MultiPolygon;
  readonly title: string;
  readonly fields?: readonly MapFieldSpec[];
  readonly badges?: readonly MapBadgeSpec[];
  readonly routerLink?: string;
}

/** What the map should frame once its data arrives. */
export type MapFitTarget = 'points' | 'zones' | 'all' | 'none';

/** A click resolved to the entities under the cursor. Always at least one. */
export type MapSelection =
  | {
      readonly kind: 'points';
      readonly lng: number;
      readonly lat: number;
      readonly points: readonly MapPoint[];
    }
  | {
      readonly kind: 'zones';
      readonly lng: number;
      readonly lat: number;
      readonly zones: readonly MapZone[];
    };

/** Why the map is not usable. Each maps to a distinct translated message. */
export type MapErrorKind = 'webgl' | 'load';

/** Belgium, framed. Used until real data arrives. */
export const MAP_DEFAULT_CENTER: readonly [number, number] = [4.6, 50.6];
export const MAP_DEFAULT_ZOOM = 7;
