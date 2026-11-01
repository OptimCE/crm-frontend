import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';

import { RegulatorySubjectType } from '../../dtos/regulatory-status.dtos';
import { RegulatoryState, regulatoryBadge } from './regulatory-badge.format';

/**
 * A meter's or a key's regulatory status, linking to the procedure that drives
 * it. Renders nothing when the subject is not tracked. For a meter, screens use
 * `app-meter-status`, which shows it in place of the CRM's own status.
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
