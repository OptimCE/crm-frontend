import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Skeleton } from 'primeng/skeleton';

import { IncompleteMeterDTO, PreviewBlockerDTO } from '../../dtos/crm_data_source.dtos';

/**
 * Normalised pre-flight result, produced by whichever hub owns the HTTP call.
 *
 * Generation and simulation return slightly different payloads (`can_generate`
 * vs `can_simulate`, and only simulation has participants), so each hub maps its
 * own DTO into this shape and the panel stays presentational.
 */
export interface CrmPreviewView {
  /** Whether the run may start. Bound to the submit button by the parent. */
  ok: boolean;
  meterCount: number;
  readingCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  totalConsumptionKwh: number;
  totalInjectionKwh: number;
  incompleteMeters: IncompleteMeterDTO[];
  blockers: PreviewBlockerDTO[];
  /** Simulation only — the key participants that matched a meter. */
  matchedParticipants?: string[];
  /** Simulation only — the key participants that matched nothing. */
  unmatchedParticipants?: string[];
}

/**
 * "Here is what we found" panel for the CRM data source.
 *
 * The audience is an energy-community manager, not an engineer, so the panel
 * answers three questions in plain language before anything is launched: is
 * there data, is it complete, and can I press the button. A red state always
 * says which meter or participant caused it — "it did not work" is not
 * actionable for someone who has to go and fix the underlying import.
 */
@Component({
  selector: 'app-crm-data-preview',
  imports: [DatePipe, DecimalPipe, Skeleton, TranslatePipe],
  templateUrl: './crm-data-preview.html',
  styleUrl: './crm-data-preview.css',
})
export class CrmDataPreview {
  /** Null before a period has been chosen, or while the first look is loading. */
  readonly preview = input<CrmPreviewView | null>(null);
  readonly loading = input(false);
  /** Set when the preview request itself failed (offline, 5xx). */
  readonly failed = input(false);

  readonly hasBlockers = computed(() => (this.preview()?.blockers.length ?? 0) > 0);
  readonly hasWarnings = computed(() => (this.preview()?.incompleteMeters.length ?? 0) > 0);
  readonly unmatched = computed(() => this.preview()?.unmatchedParticipants ?? []);
  readonly matched = computed(() => this.preview()?.matchedParticipants ?? []);

  /** Green only when there is genuinely nothing to flag. */
  readonly isClean = computed(
    () => !!this.preview()?.ok && !this.hasWarnings() && this.unmatched().length === 0,
  );
}
