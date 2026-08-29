import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';
import { MAP_PRECISION_APPROXIMATE, type MapPoint, type MapZone } from './map.types';

/**
 * Decimal places used to decide that two points are "the same place".
 *
 * 5 dp is ~1.1 m at 50°N: it merges two flats geocoded to one rooftop, and it
 * does not merge two adjacent terraced houses. This is a judgement call rather
 * than a measured constant — tune it here, once, against real geocoded data.
 */
const COORD_DP = 5;

/** Feature properties. Flat primitives only — see {@link buildPointSource}. */
export interface PointGroupProps {
  readonly group_key: string;
  /** How many points this feature stands for. Summed across a cluster. */
  readonly count: number;
  readonly rank: number;
  /** 1 only when EVERY member is approximate. */
  readonly approx: 0 | 1;
  [key: string]: unknown;
}

export interface PointGroup {
  readonly key: string;
  readonly lat: number;
  readonly lng: number;
  readonly members: readonly MapPoint[];
}

export function coincidenceKey(lat: number, lng: number): string {
  return `${lat.toFixed(COORD_DP)},${lng.toFixed(COORD_DP)}`;
}

/**
 * Collapses points that share a coordinate into one feature.
 *
 * MapLibre's own clustering cannot help here: two features at IDENTICAL
 * coordinates never separate however far you zoom, so without this the second
 * meter in a building is invisible and unclickable forever. Grouping first
 * turns that into a pin with a count badge and a multi-entry popup.
 */
export function groupCoincidentPoints(points: readonly MapPoint[]): PointGroup[] {
  const byKey = new Map<string, MapPoint[]>();

  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      continue;
    }
    const key = coincidenceKey(point.lat, point.lng);
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.push(point);
    } else {
      byKey.set(key, [point]);
    }
  }

  return [...byKey].map(([key, members]) => ({
    key,
    lat: members[0].lat,
    lng: members[0].lng,
    members,
  }));
}

/**
 * Turns groups into a GeoJSON source payload.
 *
 * The member objects are deliberately NOT put in `properties`: the payload is
 * serialised into the web worker on every update, and the popup can look the
 * members up by `group_key` from a Map on the component instead.
 */
export function buildPointSource(
  groups: readonly PointGroup[],
): FeatureCollection<Point, PointGroupProps> {
  return {
    type: 'FeatureCollection',
    features: groups.map((group) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [group.lng, group.lat] },
      properties: {
        group_key: group.key,
        count: group.members.length,
        rank: group.members.reduce((worst, member) => Math.max(worst, member.rank), 0),
        approx: group.members.every((member) => member.precision === MAP_PRECISION_APPROXIMATE)
          ? 1
          : 0,
      },
    })),
  };
}

/** Zone fill features, one per (entity, polygon) pair, carrying their colour. */
export function buildZoneSource(
  zones: readonly MapZone[],
): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: zones.map(
      (zone): Feature<Polygon | MultiPolygon> => ({
        type: 'Feature',
        geometry: zone.geometry,
        properties: {
          zone_key: zone.id,
          group_key: zone.groupKey,
          color: colorForKey(zone.colorKey),
        },
      }),
    ),
  };
}

/**
 * Centroid points for the zone layer, one per distinct polygon.
 *
 * MapLibre clusters Point geometries only, so the low-zoom "3 communities here"
 * badge has to run on a separate centroid source while the fills are drawn
 * from their own, unclustered one.
 */
export function buildZoneCentroids(zones: readonly MapZone[]): PointGroup[] {
  const byGroup = new Map<string, MapZone[]>();
  for (const zone of zones) {
    const bucket = byGroup.get(zone.groupKey);
    if (bucket) {
      bucket.push(zone);
    } else {
      byGroup.set(zone.groupKey, [zone]);
    }
  }

  const groups: PointGroup[] = [];
  for (const [groupKey, members] of byGroup) {
    const centroid = ringCentroid(members[0].geometry);
    if (!centroid) {
      continue;
    }
    groups.push({
      key: groupKey,
      lat: centroid[1],
      lng: centroid[0],
      // A zone is not a MapPoint, so the popup resolves these by group_key too.
      members: members.map((zone) => ({
        id: zone.id,
        lat: centroid[1],
        lng: centroid[0],
        precision: null,
        rank: 0,
        title: zone.title,
        fields: zone.fields,
        badges: zone.badges,
        routerLink: zone.routerLink,
      })),
    });
  }
  return groups;
}

/**
 * Mean of a polygon's outer ring.
 *
 * Deliberately not a true area centroid: this only positions a badge, and a
 * vertex mean is stable, cheap, and always inside the bounding box. A
 * pole-of-inaccessibility algorithm would be the right call if the badge ever
 * had to sit visually inside a crescent-shaped commune.
 */
export function ringCentroid(geometry: Polygon | MultiPolygon): [number, number] | null {
  const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
  if (!ring || ring.length === 0) {
    return null;
  }
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

/**
 * A stable colour per entity.
 *
 * FNV-1a hash, then a golden-angle stride rather than `% 360`: sequential ids
 * hashed and taken modulo tend to land in neighbouring hues, which is exactly
 * the case that matters here (communities 4, 5 and 6 overlapping on one
 * commune). Saturation and lightness are fixed so contrast against the basemap
 * stays even whatever hue comes out.
 */
export function colorForKey(key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = ((hash >>> 0) * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 62%, 46%)`;
}

/** [west, south, east, north], or null for an empty dataset. */
export type MapBounds = [number, number, number, number];

/** Bounding box over points and/or polygons. Null when there is nothing to frame. */
export function computeBounds(
  points: readonly MapPoint[],
  zones: readonly MapZone[],
): MapBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (lng: number, lat: number): void => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return;
    }
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  };

  for (const point of points) {
    visit(point.lng, point.lat);
  }
  for (const zone of zones) {
    const rings =
      zone.geometry.type === 'Polygon'
        ? zone.geometry.coordinates
        : zone.geometry.coordinates.flat();
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        visit(lng, lat);
      }
    }
  }

  return Number.isFinite(west) ? [west, south, east, north] : null;
}
