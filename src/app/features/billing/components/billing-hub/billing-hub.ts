import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { BillingAdminConsole } from '../billing-admin-console/billing-admin-console';
import { BillingMemberInvoices } from '../billing-member-invoices/billing-member-invoices';

/**
 * Entry point for `/billing`. Both members and managers reach this route
 * (the route is gated only by subscription, not by role). Managers/admins get
 * the admin console; pure members get their own invoices, server-scoped via
 * `GET /invoices/mine`.
 *
 * It also translates the deep-link query params into console inputs. The hub is
 * the only component on the route, but the filters live two levels down in
 * `TrackingBoard` / `RunGenerate`, so the values have to be threaded through.
 *
 * The member branch deliberately ignores all of them: `/billing?participant=4`
 * must never look like it filters a member's own invoice list, which the server
 * already scopes to them.
 */
@Component({
  selector: 'app-billing-hub',
  standalone: true,
  imports: [BillingAdminConsole, BillingMemberInvoices],
  templateUrl: './billing-hub.html',
})
export class BillingHub {
  protected readonly userContext = inject(UserContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly Role = Role;

  /** Console tab to open, e.g. `tracking` from a member's invoice link. */
  readonly tab = signal<string | null>(null);
  /** Member whose invoices to show — the wire name is `participant`, not `id_member`. */
  readonly participant = signal<number | null>(null);
  /** Sharing operation to preselect on the generation tab. */
  readonly operation = signal<number | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tab.set(params.get('tab'));
      this.participant.set(positiveInt(params.get('participant')));
      this.operation.set(positiveInt(params.get('operation')));
    });
  }
}

/** Query params are caller-supplied; only a positive integer id is meaningful. */
function positiveInt(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}
