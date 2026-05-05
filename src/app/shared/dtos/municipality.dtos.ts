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
