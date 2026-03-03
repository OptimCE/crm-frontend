import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { AddressPipe } from '../../../../../../shared/pipes/address/address-pipe';
import { Tag } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { TabsModule } from 'primeng/tabs';
import { BadgeModule } from 'primeng/badge';
import { SharingOperationService } from '../../../../../../shared/services/sharing_operation.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  SharingOperationMetersQuery,
  SharingOperationMetersQueryType,
} from '../../../../../../shared/dtos/sharing_operation.dtos';
import { PartialMeterDTO } from '../../../../../../shared/dtos/meter.dtos';
import { Pagination } from '../../../../../../core/dtos/api.response';
import { MeterDataStatus } from '../../../../../../shared/types/meter.types';
import { NgTemplateOutlet } from '@angular/common';
interface SelectMeterNewKeySharing {
  idSharing: number;
}
@Component({
  selector: 'app-select-meter-new-key-dialog',
  imports: [
    TableModule,
    Button,
    TranslatePipe,
    FormsModule,
    Tag,
    AddressPipe,
    CheckboxModule,
    TabsModule,
    BadgeModule,
    NgTemplateOutlet,
  ],
  templateUrl: './select-meter-new-key-dialog.html',
  styleUrl: './select-meter-new-key-dialog.css',
})
export class SelectMeterNewKeyDialog implements OnInit {
  private sharingOperationService = inject(SharingOperationService);
  private ref = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);

  QueryType = SharingOperationMetersQueryType;
  activeTab = 0;

  // Per-tab state
  listNow = signal<PartialMeterDTO[]>([]);
  listFuture = signal<PartialMeterDTO[]>([]);
  loadingNow = signal(true);
  loadingFuture = signal(true);
  paginationNow = signal<Pagination>({ total: 0, total_pages: 0, page: 1, limit: 10 });
  paginationFuture = signal<Pagination>({ total: 0, total_pages: 0, page: 1, limit: 10 });
  filterNow = signal<SharingOperationMetersQuery>({
    page: 1,
    limit: 10,
    type: SharingOperationMetersQueryType.NOW,
  });
  filterFuture = signal<SharingOperationMetersQuery>({
    page: 1,
    limit: 10,
    type: SharingOperationMetersQueryType.FUTURE,
  });

  selectedMeters = new Map<string, SharingOperationMetersQueryType>();

  private idSharing!: number;

  ngOnInit(): void {
    const data = this.config.data as SelectMeterNewKeySharing;
    this.idSharing = data.idSharing;
    this.loadMeters(SharingOperationMetersQueryType.NOW);
    this.loadMeters(SharingOperationMetersQueryType.FUTURE);
  }

  getList(type: SharingOperationMetersQueryType): WritableSignal<PartialMeterDTO[]> {
    return type === this.QueryType.NOW ? this.listNow : this.listFuture;
  }
  getLoading(type: SharingOperationMetersQueryType): WritableSignal<boolean> {
    return type === this.QueryType.NOW ? this.loadingNow : this.loadingFuture;
  }
  getPagination(type: SharingOperationMetersQueryType): WritableSignal<Pagination> {
    return type === this.QueryType.NOW ? this.paginationNow : this.paginationFuture;
  }
  getFilter(type: SharingOperationMetersQueryType): WritableSignal<SharingOperationMetersQuery> {
    return type === this.QueryType.NOW ? this.filterNow : this.filterFuture;
  }

  private loadMeters(type: SharingOperationMetersQueryType): void {
    this.getLoading(type).set(true);
    this.sharingOperationService
      .getSharingOperationMetersList(this.idSharing, this.getFilter(type)())
      .subscribe({
        next: (response) => {
          if (response) {
            this.getList(type).set(response.data as PartialMeterDTO[]);
            this.getPagination(type).set(response.pagination);
            this.getLoading(type).set(false);
          }
        },
      });
  }

  lazyLoad(event: TableLazyLoadEvent, type: SharingOperationMetersQueryType): void {
    const current = { ...this.getFilter(type)() };
    if (event.first !== undefined && event.rows) {
      current.page = event.first / event.rows + 1;
    }
    if (event.filters?.['EAN']) {
      const f = event.filters['EAN'];
      if (!Array.isArray(f) && f.value) current.EAN = f.value as string;
      else delete current.EAN;
    }
    this.getFilter(type).set(current);
    this.loadMeters(type);
  }

  // --- Selection logic ---
  isSelected(ean: string): boolean {
    return this.selectedMeters.has(ean);
  }

  toggleMeter(meter: PartialMeterDTO, type: SharingOperationMetersQueryType): void {
    if (this.selectedMeters.has(meter.EAN)) {
      this.selectedMeters.delete(meter.EAN);
    } else {
      this.selectedMeters.set(meter.EAN, type);
    }
  }

  isPageFullySelected(type: SharingOperationMetersQueryType): boolean {
    const list = this.getList(type)();
    return list.length > 0 && list.every((m) => this.selectedMeters.has(m.EAN));
  }

  togglePage(type: SharingOperationMetersQueryType, selectAll: boolean): void {
    this.getList(type)().forEach((m) =>
      selectAll ? this.selectedMeters.set(m.EAN, type) : this.selectedMeters.delete(m.EAN),
    );
  }

  // Selects ALL records (not just current page) — triggers a full load
  selectAllInTab(type: SharingOperationMetersQueryType): void {
    const allFilter = { ...this.getFilter(type)(), page: 1, limit: 9999 };
    this.sharingOperationService
      .getSharingOperationMetersList(this.idSharing, allFilter)
      .subscribe((response) => {
        (response.data as PartialMeterDTO[]).forEach((m) => this.selectedMeters.set(m.EAN, type));
      });
  }

  countSelected(type: SharingOperationMetersQueryType): number {
    return [...this.selectedMeters.values()].filter((t) => t === type).length;
  }

  selectedMetersArray(): { meter: PartialMeterDTO; type: SharingOperationMetersQueryType }[] {
    // Build from both lists for display (only selected)
    return [
      ...this.listNow()
        .filter((m) => this.selectedMeters.has(m.EAN))
        .map((m) => ({ meter: m, type: this.QueryType.NOW })),
      ...this.listFuture()
        .filter((m) => this.selectedMeters.has(m.EAN))
        .map((m) => ({ meter: m, type: this.QueryType.FUTURE })),
    ];
  }

  getStatusSeverity(status: MeterDataStatus): 'success' | 'danger' | 'warn' | 'info' {
    const map: Record<MeterDataStatus, string> = {
      [MeterDataStatus.ACTIVE]: 'success',
      [MeterDataStatus.INACTIVE]: 'danger',
      [MeterDataStatus.WAITING_GRD]: 'warn',
      [MeterDataStatus.WAITING_MANAGER]: 'warn',
    };
    return (map[status] as 'success' | 'danger' | 'warn' | 'info') ?? 'info';
  }

  confirm(): void {
    this.ref.close([...this.selectedMeters.keys()]);
  }

  cancel(): void {
    this.ref.close(null);
  }
}
