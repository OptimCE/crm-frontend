import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';

import {
  AllocationKeyDetailDTO,
  AllocationKeyPartialDTO,
  GenerationPartialDTO,
  GenerationStatus,
} from '../../../../../../shared/dtos/allocation_generation.dtos';
import { Tooltip } from 'primeng/tooltip';

import { KeysPanel } from '../keys-panel/keys-panel';
import { GenerationTimelineDot } from './generation-timeline-dot/generation-timeline-dot';

export interface KeyExpandState {
  expandedKeyId: number | null;
  detailById: ReadonlyMap<number, AllocationKeyDetailDTO>;
  loadingId: number | null;
}

@Component({
  selector: 'app-generation-row',
  standalone: true,
  imports: [
    TranslatePipe,
    Button,
    Skeleton,
    GenerationTimelineDot,
    Tooltip,
    GenerationTimelineDot,
    KeysPanel,
  ],
  templateUrl: './generation-row.html',
  styleUrl: './generation-row.css',
})
export class GenerationRow {
  readonly generation = input.required<GenerationPartialDTO>();
  readonly expanded = input.required<boolean>();
  readonly keys = input<AllocationKeyPartialDTO[] | undefined>(undefined);
  readonly keysLoading = input<boolean>(false);
  readonly keyExpandState = input<KeyExpandState>({
    expandedKeyId: null,
    detailById: new Map(),
    loadingId: null,
  });

  readonly toggled = output<number>();
  readonly deleteGeneration = output<number>();
  readonly toggleKey = output<number>();
  readonly saveKey = output<number>();
  readonly deleteKey = output<number>();

  readonly statusKey = computed<string>(() => {
    switch (this.generation().status) {
      case GenerationStatus.SUCCESS:
        return 'ALGORITHM_HUB.STATUS.SUCCESS';
      case GenerationStatus.FAILED:
        return 'ALGORITHM_HUB.STATUS.FAILED';
      default:
        return 'ALGORITHM_HUB.STATUS.PENDING';
    }
  });

  onToggle(): void {
    this.toggled.emit(this.generation().id);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteGeneration.emit(this.generation().id);
  }

  onToggleKey(idKey: number): void {
    this.toggleKey.emit(idKey);
  }

  onSaveKey(idKey: number): void {
    this.saveKey.emit(idKey);
  }

  onDeleteKey(idKey: number): void {
    this.deleteKey.emit(idKey);
  }

  isKeyExpanded(idKey: number): boolean {
    return this.keyExpandState().expandedKeyId === idKey;
  }

  detailFor(idKey: number): AllocationKeyDetailDTO | undefined {
    return this.keyExpandState().detailById.get(idKey);
  }

  isKeyLoading(idKey: number): boolean {
    return this.keyExpandState().loadingId === idKey;
  }
}
