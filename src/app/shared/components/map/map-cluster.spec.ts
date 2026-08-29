import {
  buildPointSource,
  buildZoneCentroids,
  colorForKey,
  computeBounds,
  groupCoincidentPoints,
  ringCentroid,
} from './map-cluster';
import type { Polygon } from 'geojson';
import { MAP_PRECISION_APPROXIMATE, type MapPoint, type MapZone } from './map.types';

function point(overrides: Partial<MapPoint> & Pick<MapPoint, 'id' | 'lat' | 'lng'>): MapPoint {
  return { precision: 2, rank: 0, title: overrides.id, ...overrides };
}

function square(
  id: string,
  lng: number,
  lat: number,
  colorKey = id,
  groupKey = id,
): MapZone & { geometry: Polygon } {
  return {
    id,
    groupKey,
    colorKey,
    title: id,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng, lat],
          [lng + 1, lat],
          [lng + 1, lat + 1],
          [lng, lat + 1],
          [lng, lat],
        ],
      ],
    },
  };
}

describe('groupCoincidentPoints', () => {
  it('merges points identical to 5 decimal places into one group', () => {
    const groups = groupCoincidentPoints([
      point({ id: 'a', lat: 50.85, lng: 4.35 }),
      point({ id: 'b', lat: 50.850001, lng: 4.350001 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('does not merge points about 20 m apart', () => {
    const groups = groupCoincidentPoints([
      point({ id: 'a', lat: 50.85, lng: 4.35 }),
      point({ id: 'b', lat: 50.8502, lng: 4.35 }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('drops points with non-finite coordinates rather than plotting them at 0,0', () => {
    const groups = groupCoincidentPoints([
      point({ id: 'ok', lat: 50.85, lng: 4.35 }),
      point({ id: 'nan', lat: Number.NaN, lng: 4.35 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].members[0].id).toBe('ok');
  });

  it('returns an empty array for no input', () => {
    expect(groupCoincidentPoints([])).toEqual([]);
  });
});

describe('buildPointSource', () => {
  it('carries the true member count, which is what the cluster badge sums', () => {
    const groups = groupCoincidentPoints([
      point({ id: 'a', lat: 50.85, lng: 4.35 }),
      point({ id: 'b', lat: 50.85, lng: 4.35 }),
      point({ id: 'c', lat: 51, lng: 4.4 }),
    ]);

    const source = buildPointSource(groups);
    const counts = source.features.map((f) => f.properties.count).sort();

    // Two features, three meters. `point_count` would report 2; `count` summed
    // through clusterProperties reports 3, which is the number a user expects.
    expect(counts).toEqual([1, 2]);
  });

  it('takes the worst rank in a group', () => {
    const groups = groupCoincidentPoints([
      point({ id: 'a', lat: 50.85, lng: 4.35, rank: 0 }),
      point({ id: 'b', lat: 50.85, lng: 4.35, rank: 2 }),
    ]);

    expect(buildPointSource(groups).features[0].properties.rank).toBe(2);
  });

  it('marks a group approximate only when EVERY member is approximate', () => {
    const allApprox = groupCoincidentPoints([
      point({ id: 'a', lat: 50.85, lng: 4.35, precision: MAP_PRECISION_APPROXIMATE }),
      point({ id: 'b', lat: 50.85, lng: 4.35, precision: MAP_PRECISION_APPROXIMATE }),
    ]);
    const mixed = groupCoincidentPoints([
      point({ id: 'a', lat: 50.85, lng: 4.35, precision: MAP_PRECISION_APPROXIMATE }),
      point({ id: 'b', lat: 50.85, lng: 4.35, precision: 2 }),
    ]);

    expect(buildPointSource(allApprox).features[0].properties.approx).toBe(1);
    expect(buildPointSource(mixed).features[0].properties.approx).toBe(0);
  });

  it('writes coordinates as [longitude, latitude]', () => {
    const source = buildPointSource(
      groupCoincidentPoints([point({ id: 'a', lat: 50.85, lng: 4.35 })]),
    );

    expect(source.features[0].geometry.coordinates).toEqual([4.35, 50.85]);
  });
});

describe('colorForKey', () => {
  it('is deterministic', () => {
    expect(colorForKey('community-7')).toBe(colorForKey('community-7'));
  });

  it('gives different colours to different keys', () => {
    expect(colorForKey('community-7')).not.toBe(colorForKey('community-8'));
  });

  it('separates the hues of sequential ids by more than a few degrees', () => {
    // The case that matters: communities 4, 5 and 6 overlapping on one commune.
    // A plain `% 360` would land them in neighbouring hues and make the overlap
    // unreadable.
    const hue = (key: string): number =>
      Number(/hsl\((\d+(?:\.\d+)?)/.exec(colorForKey(key))?.[1] ?? '0');
    const hues = ['4', '5', '6'].map(hue);

    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const delta = Math.abs(hues[i] - hues[j]);
        expect(Math.min(delta, 360 - delta)).toBeGreaterThan(20);
      }
    }
  });

  it('always produces a valid hsl() string', () => {
    for (const key of ['', 'a', 'community-999', '2c8a0ea5-d597-49d6']) {
      expect(colorForKey(key)).toMatch(/^hsl\(\d+(\.\d+)?, 62%, 46%\)$/);
    }
  });
});

describe('ringCentroid', () => {
  it('averages the outer ring of a Polygon', () => {
    const centroid = ringCentroid(square('a', 0, 0).geometry);

    // The closing point is duplicated, so the mean is pulled slightly toward it
    // — fine for positioning a badge, and stated here so the number is not a
    // surprise later.
    expect(centroid?.[0]).toBeCloseTo(0.4, 5);
    expect(centroid?.[1]).toBeCloseTo(0.4, 5);
  });

  it('uses the first polygon of a MultiPolygon', () => {
    const centroid = ringCentroid({
      type: 'MultiPolygon',
      coordinates: [
        square('a', 10, 10).geometry.coordinates,
        square('b', 0, 0).geometry.coordinates,
      ],
    });

    expect(centroid?.[0]).toBeGreaterThan(9);
  });

  it('returns null for an empty geometry', () => {
    expect(ringCentroid({ type: 'Polygon', coordinates: [] })).toBeNull();
  });
});

describe('buildZoneCentroids', () => {
  it('emits one centroid per distinct polygon, not per entity', () => {
    // Two communities covering the same commune: one badge, two entries.
    const groups = buildZoneCentroids([
      square('c1:21004', 4, 50, 'c1', '21004'),
      square('c2:21004', 4, 50, 'c2', '21004'),
      square('c1:21009', 5, 50, 'c1', '21009'),
    ]);

    expect(groups).toHaveLength(2);
    const shared = groups.find((g) => g.key === '21004');
    expect(shared?.members.map((m) => m.id)).toEqual(['c1:21004', 'c2:21004']);
  });
});

describe('computeBounds', () => {
  it('returns null when there is nothing to frame', () => {
    expect(computeBounds([], [])).toBeNull();
  });

  it('covers both points and polygon rings', () => {
    const bounds = computeBounds([point({ id: 'a', lat: 51.5, lng: 3.5 })], [square('z', 5, 49)]);

    expect(bounds).toEqual([3.5, 49, 6, 51.5]);
  });

  it('ignores non-finite coordinates', () => {
    const bounds = computeBounds(
      [
        point({ id: 'a', lat: 50.85, lng: 4.35 }),
        point({ id: 'bad', lat: Number.NaN, lng: Number.NaN }),
      ],
      [],
    );

    expect(bounds).toEqual([4.35, 50.85, 4.35, 50.85]);
  });

  it('walks every polygon of a MultiPolygon', () => {
    const zone: MapZone = {
      ...square('m', 0, 0),
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          square('a', 0, 0).geometry.coordinates,
          square('b', 10, 10).geometry.coordinates,
        ],
      },
    };

    expect(computeBounds([], [zone])).toEqual([0, 0, 11, 11]);
  });
});
