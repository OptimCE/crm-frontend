import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClassParams, ColDef } from 'ag-grid-community';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import {
  AllocationKeyDetailDTO,
  AllocationKeyPartialDTO,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { HeaderWithHelper } from '../../../../../allocation_key/components/key-view/header-with-helper/header-with-helper';

interface KeyTableRow {
  number?: number;
  va_percentage?: string;
  name: string;
  vp_percentage: string;
  __iterationIndex: number;
}

const COLOR_GRADIENT: { backgroundColor: string; 'border-bottom': string }[] = [
  { backgroundColor: '#e8f5e9', 'border-bottom': '1px solid #c8e6c9' },
  { backgroundColor: '#c8e6c9', 'border-bottom': '1px solid #a5d6a7' },
  { backgroundColor: '#a5d6a7', 'border-bottom': '1px solid #81c784' },
];

@Component({
  selector: 'app-allocation-key-row',
  standalone: true,
  imports: [TranslatePipe, AgGridAngular, Button, Skeleton, Tag, Tooltip],
  templateUrl: './keys-panel.html',
  styleUrl: './keys-panel.css',
})
export class KeysPanel {
  private readonly translate = inject(TranslateService);

  readonly key = input.required<AllocationKeyPartialDTO>();
  readonly expanded = input.required<boolean>();
  readonly detail = input<AllocationKeyDetailDTO | undefined>(undefined);
  readonly detailLoading = input<boolean>(false);

  readonly toggled = output<void>();
  readonly save = output<void>();
  readonly delete = output<void>();

  readonly colDefs = signal<ColDef<KeyTableRow>[]>([]);
  readonly defaultColDef: ColDef = { width: 200, flex: 1, minWidth: 120 };

  readonly rowData = computed<KeyTableRow[]>(() => this.flattenDetail(this.detail()));

  readonly surplusFormatted = computed<string>(() => {
    const value = this.key().surplus_total;
    return Number.isFinite(value) ? value.toFixed(2) : '—';
  });

  constructor() {
    this.loadColumnDefinitions();
  }

  onToggle(): void {
    this.toggled.emit();
  }

  onSave(event: MouseEvent): void {
    event.stopPropagation();
    this.save.emit();
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit();
  }

  private cellStyle(params: CellClassParams<KeyTableRow>): Record<string, string> | undefined {
    const idx = params.data?.__iterationIndex;
    if (idx === undefined) return undefined;
    return COLOR_GRADIENT[idx % COLOR_GRADIENT.length];
  }

  private flattenDetail(detail: AllocationKeyDetailDTO | undefined): KeyTableRow[] {
    if (!detail) return [];
    const rows: KeyTableRow[] = [];
    detail.iterations.forEach((iteration, iterationIndex) => {
      let firstConsumerOfIteration = true;
      iteration.consumers.forEach((consumer) => {
        const vp =
          consumer.energy_allocated_percentage === -1
            ? (this.translate.instant('KEY.CREATE.PRORATA_LABEL') as string)
            : (consumer.energy_allocated_percentage * 100).toFixed(2) + '%';
        rows.push({
          number: firstConsumerOfIteration ? iteration.number : undefined,
          va_percentage: firstConsumerOfIteration
            ? (iteration.energy_allocated_percentage * 100).toFixed(2) + '%'
            : undefined,
          name: consumer.name,
          vp_percentage: vp,
          __iterationIndex: iterationIndex,
        });
        firstConsumerOfIteration = false;
      });
    });
    return rows;
  }

  private loadColumnDefinitions(): void {
    this.translate
      .get([
        'KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL',
        'KEY.TABLE.COLUMNS.ITERATION_TOOLTIP',
        'KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL',
        'KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP',
        'KEY.TABLE.COLUMNS.CONSUMER_NAME_LABEL',
        'KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL',
        'KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP',
      ])
      .subscribe((t: Record<string, string>) => {
        this.colDefs.set([
          {
            headerName: t['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
            field: 'number',
            cellStyle: this.cellStyle.bind(this),
            headerComponent: HeaderWithHelper,
            headerComponentParams: {
              label: t['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
              tooltip: t['KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
            },
            headerTooltip: t['KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
            minWidth: 110,
          },
          {
            headerName: t['KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL'],
            field: 'va_percentage',
            cellStyle: this.cellStyle.bind(this),
            headerComponent: HeaderWithHelper,
            headerComponentParams: {
              label: t['KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL'],
              tooltip: t['KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
            },
            headerTooltip: t['KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
            minWidth: 120,
          },
          {
            headerName: t['KEY.TABLE.COLUMNS.CONSUMER_NAME_LABEL'],
            field: 'name',
            cellStyle: this.cellStyle.bind(this),
            minWidth: 140,
          },
          {
            headerName: t['KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL'],
            field: 'vp_percentage',
            cellStyle: this.cellStyle.bind(this),
            headerComponent: HeaderWithHelper,
            headerComponentParams: {
              label: t['KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL'],
              tooltip: t['KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
            },
            headerTooltip: t['KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
            minWidth: 120,
          },
        ]);
      });
  }
}
