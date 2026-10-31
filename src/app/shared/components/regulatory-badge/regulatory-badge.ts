import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';

import { RegulatorySubjectType } from '../../dtos/regulatory-status.dtos';
import { RegulatoryState, regulatoryBadge } from './regulatory-badge.format';

/**
 * A meter's or a key's regulatory status, beside the CRM's own status (never in
 * place of it: that one stays the manager's), linking to the procedure that
 * drives it. Renders nothing when the subject is not tracked.
 */
@Component({
  selector: 'app-regulatory-badge',
  standalone: true,
  imports: [RouterLink, TranslatePipe, TagModule],
  templateUrl: './regulatory-badge.html',
})
export class RegulatoryBadgeComponent {
  readonly state = input<RegulatoryState | null | undefined>(null);
  readonly subjectType = input<RegulatorySubjectType>(RegulatorySubjectType.METER);
  /** The annexe procedure to link to; no link when absent. */
  readonly procedureId = input<string | number | null | undefined>(null);
  readonly testId = input<string | null>(null);

  readonly badge = computed(() => regulatoryBadge(this.state(), this.subjectType()));
  readonly link = computed(() => {
    const id = this.procedureId();
    return id === null || id === undefined || id === ''
      ? null
      : ['/administrative-document/procedures', String(id)];
  });
}
