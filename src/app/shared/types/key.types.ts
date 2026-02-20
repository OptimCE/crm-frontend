import {IterationDTO} from '../dtos/key.dtos';

export interface ColumnHeaderParameter {
  label: string;
  tooltip: string;
  click: any;
}

export interface ColumnKeyDefinition {
  headerName: string;
  field: keyof IterationDTO | string;
  cellStyle: any;
  headerComponent: any;
  headerComponentParams?: ColumnHeaderParameter;
  headerTooltip?: string;
  minWidth: number;
  suppressSizeToFit: boolean;
}

export interface KeyTableRow {
  name: string;
  vp_percentage: string;
  number?: number;
  va_percentage?: string;
  delete?: string;
  delete1?: string;
  consumers?: string;
}

export interface SetConsumersPayload {
  consumers: string[];
}
