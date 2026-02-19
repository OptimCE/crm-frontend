
export interface ColumnHeaderParameter {
  label: string;
  tooltip: string;
  click: any;
}

export interface ColumnKeyDefinition {
  headerName: string;
  field: string;
  cellStyle: any;
  headerComponent: any;
  headerComponentParams?: ColumnHeaderParameter
  headerTooltip?: string;
  minWidth: number;
  suppressSizeToFit: boolean;
}
