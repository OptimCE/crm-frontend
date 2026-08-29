import { PaginationQuery } from './query.dtos';

export interface MunicipalityPartialDTO {
  nis_code: number;
  fr_name: string;
  nl_name: string | null;
  de_name: string | null;
  region_fr: string | null;
  postal_codes: string[];
}

export interface MunicipalitySearchQuery extends PaginationQuery {
  name?: string;
  postal_code?: string;
}

/** A GeoJSON Point, as stored in `municipality.geo_point`. */
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

/** A GeoJSON Polygon or MultiPolygon, as stored in `municipality.geo_shape`. */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type MunicipalityGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

/**
 * One commune's boundary, simplified server-side.
 *
 * `geo_shape` is a bare GeoJSON geometry, not a Feature — MapLibre accepts it
 * directly. Both geometry fields are nullable because the reference dataset has
 * gaps; a commune without a shape is dropped from the map rather than drawn as
 * a point.
 */
export interface MunicipalityGeometryDTO {
  nis_code: number;
  fr_name: string;
  geo_point: GeoJsonPoint | null;
  geo_shape: MunicipalityGeometry | null;
  tolerance: number;
  original_points: number;
  simplified_points: number;
}
