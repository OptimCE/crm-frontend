import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';

export const SRC_POINTS = 'app-points';
export const SRC_ZONE_FILL = 'app-zone-fill';
export const SRC_ZONE_CENTROIDS = 'app-zone-centroids';

export const L_CLUSTER = 'app-cluster';
export const L_CLUSTER_COUNT = 'app-cluster-count';
export const L_POINT = 'app-point';
export const L_POINT_COUNT = 'app-point-count';
export const L_ZONE_FILL = 'app-zone-fill';
export const L_ZONE_LINE = 'app-zone-line';
export const L_ZONE_CLUSTER = 'app-zone-cluster';
export const L_ZONE_CLUSTER_COUNT = 'app-zone-cluster-count';

/**
 * Below this zoom the zone layer shows clustered badges; at and above it, the
 * real polygons. The two are mutually exclusive by min/maxzoom so badges and
 * fills never fight for the same pixels.
 */
export const ZONE_DETAIL_ZOOM = 9;

/** Rank 0/1/2 → healthy / warning / problem. Matches the PrimeNG tag severities. */
const C_OK = '#43a047';
const C_WARN = '#f9a825';
const C_BAD = '#e53935';
const C_NEUTRAL = '#78909c';

const rankColor: ExpressionSpecification = [
  'match',
  ['get', 'rank'],
  0,
  C_OK,
  1,
  C_WARN,
  2,
  C_BAD,
  C_NEUTRAL,
];

/**
 * Abbreviates a count for a badge label.
 *
 * Hand-rolled rather than using `point_count_abbreviated`, which counts
 * FEATURES — and after coincidence grouping one feature can stand for a whole
 * building. Summing `count` through `clusterProperties` is the only way the
 * badge shows the number of meters a user would count themselves.
 */
function abbreviate(value: ExpressionSpecification): ExpressionSpecification {
  return [
    'case',
    ['>=', value, 1000],
    ['concat', ['to-string', ['floor', ['/', value, 1000]]], 'k'],
    ['to-string', value],
  ];
}

export function pointLayers(fontStack: string[]): LayerSpecification[] {
  return [
    {
      id: L_CLUSTER,
      type: 'circle',
      source: SRC_POINTS,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'total'], 14, 10, 18, 50, 24, 200, 30],
        'circle-color': rankColor,
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    },
    {
      id: L_CLUSTER_COUNT,
      type: 'symbol',
      source: SRC_POINTS,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': abbreviate(['get', 'total']),
        'text-font': fontStack,
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    },
    {
      id: L_POINT,
      type: 'circle',
      source: SRC_POINTS,
      filter: ['!', ['has', 'point_count']],
      paint: {
        // A coincidence group is drawn larger so its badge fits inside it.
        'circle-radius': ['case', ['>', ['get', 'count'], 1], 11, 7],
        'circle-color': rankColor,
        // An approximate pin reads visibly weaker: it is a commune centroid,
        // not a building, and it must not look like a surveyed position.
        'circle-opacity': ['case', ['==', ['get', 'approx'], 1], 0.5, 0.95],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': ['case', ['==', ['get', 'approx'], 1], 0.55, 1],
      },
    },
    {
      id: L_POINT_COUNT,
      type: 'symbol',
      source: SRC_POINTS,
      // Only groups that never separate on zoom need their own badge.
      filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'count'], 1]],
      layout: {
        'text-field': ['to-string', ['get', 'count']],
        'text-font': fontStack,
        'text-size': 11,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    },
  ];
}

export function zoneLayers(fontStack: string[]): LayerSpecification[] {
  return [
    {
      id: L_ZONE_FILL,
      type: 'fill',
      source: SRC_ZONE_FILL,
      minzoom: ZONE_DETAIL_ZOOM,
      paint: {
        'fill-color': ['get', 'color'],
        // 0.18 is chosen so three stacked communities land near 0.45 and stay
        // readable, rather than compositing to mud.
        'fill-opacity': 0.18,
        'fill-antialias': true,
      },
    },
    {
      id: L_ZONE_LINE,
      type: 'line',
      source: SRC_ZONE_FILL,
      minzoom: ZONE_DETAIL_ZOOM,
      paint: {
        'line-color': ['get', 'color'],
        // Full strength on purpose: fills blend and become ambiguous, outlines
        // never do, so a user can always trace which polygon is which. The 1.5px
        // width also hides the sub-pixel gaps that independent simplification
        // leaves between neighbouring communes.
        'line-width': 1.5,
        'line-opacity': 0.9,
      },
    },
    {
      id: L_ZONE_CLUSTER,
      type: 'circle',
      source: SRC_ZONE_CENTROIDS,
      maxzoom: ZONE_DETAIL_ZOOM,
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 20, 24],
        'circle-color': '#1e88e5',
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    },
    {
      id: L_ZONE_CLUSTER_COUNT,
      type: 'symbol',
      source: SRC_ZONE_CENTROIDS,
      maxzoom: ZONE_DETAIL_ZOOM,
      layout: {
        // point_count here, NOT a summed total — and that asymmetry with the
        // meters layer is deliberate. Summing per-commune community counts
        // double-counts a community present in three communes, so the badge
        // would show a number that is simply wrong. Communes is a number a user
        // can verify; the popup then names the communities.
        'text-field': [
          'case',
          ['has', 'point_count'],
          abbreviate(['get', 'point_count']),
          ['to-string', ['get', 'count']],
        ],
        'text-font': fontStack,
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    },
  ];
}
