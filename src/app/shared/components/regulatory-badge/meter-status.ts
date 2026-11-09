import { Component, computed, input } from '@angular/core';

import { RegulatoryStatusDTO, RegulatorySubjectType } from '../../dtos/regulatory-status.dtos';
import { RegulatoryBadgeComponent } from './regulatory-badge';
import { regulatoryBadge } from './regulatory-badge.format';

/**
 * A meter's one status in an operation (2026-11-01). With the administrative
 * module active, a meter its procedure tracks shows the procedure's status,
 * linking to it; the CRM's own status follows it (the core aligns
 * `meter_data.status` when the episode goes active) and is not shown. Any
 * other meter (module off, a regulator with no plugin, a withdrawn episode)
 * shows the screen's own tag, projected as content.
 *
 *   <app-meter-status [regulatory]="regulatoryOf(meter.EAN)" testId="…">
 *     <p-tag … />   <!-- the hand-set status -->
 *   </app-meter-status>
 */
@Component({
  selector: 'app-meter-status',
  standalone: true,
  imports: [RegulatoryBadgeComponent],
  template: `
    @if (shown(); as row) {
      <app-regulatory-badge
        [state]="row"
        [subjectType]="meterType"
        [procedureId]="row.regulatory_ref"
        [testId]="testId()"
      />
    } @else {
      <ng-content />
    }
  `,
})
export class MeterStatusComponent {
  readonly regulatory = input<RegulatoryStatusDTO | null | undefined>(null);
  /** The badge's test id (kept from the screens' `…__regulatory--…` ids). */
  readonly testId = input<string | null>(null);

  protected readonly meterType = RegulatorySubjectType.METER;
  protected readonly shown = computed(() => {
    const row = this.regulatory();
    return row && regulatoryBadge(row, RegulatorySubjectType.METER) ? row : null;
  });
}
