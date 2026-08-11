import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';

import { Role } from '../../../../../core/dtos/role';
import { UserContextService } from '../../../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../../../core/services/community-services.store';
import { CommunityAnnex } from '../../../../../shared/dtos/annexes_services.dtos';
import { AnnexesServicesService } from '../../../../../shared/services/annexes_services.service';

/** localStorage key prefix. Dismissal is per user session AND per community. */
const DISMISS_KEY_PREFIX = 'dashboard.modules.dismissed';

/**
 * One collapsed strip listing the modules this community has not enabled.
 *
 * Collected into a single strip rather than scattered half-empty cards through
 * the grid, and dismissible, because a discovery surface that cannot be silenced
 * is nagware.
 *
 * **Role-aware, and that is not cosmetic.** Only an ADMIN can subscribe
 * (`POST /annexes-services/:feature/subscribe` is `roleChecker(Role.ADMIN)`), so
 * a MANAGER clicking "Enable" would get a 403 they can do nothing about. They get
 * a sentence instead — not a disabled button, which is a dead end for anyone
 * navigating by keyboard or screen reader.
 *
 * Never rendered on the member view: a member cannot buy a module, so
 * advertising one to them is pure noise. Enforced structurally (the member
 * dashboard does not import this) and defensively below.
 */
@Component({
  selector: 'app-module-discovery-strip',
  standalone: true,
  imports: [TranslatePipe, RouterLink, Button],
  templateUrl: './module-discovery-strip.html',
})
export class ModuleDiscoveryStrip {
  private readonly store = inject(CommunityServicesStore);
  private readonly annexesService = inject(AnnexesServicesService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly userContext = inject(UserContextService);

  private readonly dismissed = signal<boolean>(this.readDismissed());
  readonly busy = signal<string | null>(null);

  /** Modules the catalogue offers this role but the community has not enabled. */
  readonly available = computed<CommunityAnnex[]>(() =>
    this.store.services().filter((service) => !service.subscribed),
  );

  readonly canSubscribe = computed(() => this.userContext.compareWithActiveRole(Role.ADMIN));

  /** Defensive: a member must never see this even if it were rendered by mistake. */
  readonly visible = computed(
    () =>
      !this.dismissed() &&
      this.available().length > 0 &&
      this.userContext.compareWithActiveRole(Role.GESTIONNAIRE),
  );

  dismiss(): void {
    this.dismissed.set(true);
    localStorage.setItem(this.storageKey(), '1');
  }

  enable(annex: CommunityAnnex): void {
    if (!this.canSubscribe()) return;
    this.busy.set(annex.feature);
    this.annexesService
      .subscribe(annex.subscribePath)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.store.reload().subscribe({
            next: () => this.busy.set(null),
            error: () => this.busy.set(null),
          });
        },
        error: () => this.busy.set(null),
      });
  }

  /** Dismissing in community A must not hide the strip in community B. */
  private storageKey(): string {
    return `${DISMISS_KEY_PREFIX}.${this.userContext.activeCommunityId() ?? 'none'}`;
  }

  private readDismissed(): boolean {
    return localStorage.getItem(this.storageKey()) === '1';
  }
}
