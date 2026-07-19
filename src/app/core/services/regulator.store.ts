import { computed, inject, Injectable, signal } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';

import { RegulatorDTO } from '../../shared/dtos/community.dtos';
import { CommunityService } from '../../shared/services/community.service';

/**
 * Signal-backed, session-cached store of the regulator reference list
 * (`GET /communities/regulators`). Static, tenant-agnostic data: loaded once on
 * first access and reused for the rest of the session. Drives the regulator
 * dropdowns and localized label rendering.
 */
@Injectable({ providedIn: 'root' })
export class RegulatorStore {
  private readonly communityService = inject(CommunityService);

  readonly regulators = signal<RegulatorDTO[]>([]);
  /** Only the codes assignable today (used by the create/edit dropdowns). */
  readonly activeRegulators = computed(() => this.regulators().filter((r) => r.active));
  private loaded = false;

  /** Returns the loaded list, fetching once on first access. */
  ensureLoaded(): Observable<RegulatorDTO[]> {
    if (this.loaded) return of(this.regulators());
    return this.fetch();
  }

  private fetch(): Observable<RegulatorDTO[]> {
    return this.communityService.getRegulators().pipe(
      map((response) => response.data ?? []),
      tap((regulators) => {
        this.regulators.set(regulators);
        this.loaded = true;
      }),
    );
  }
}
