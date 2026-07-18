import { Component, inject } from '@angular/core';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { BillingAdminConsole } from '../billing-admin-console/billing-admin-console';
import { BillingMemberInvoices } from '../billing-member-invoices/billing-member-invoices';

/**
 * Entry point for `/billing`. Both members and managers reach this route
 * (the route is gated only by subscription, not by role). Managers/admins get
 * the admin console; pure members get their own invoices, server-scoped via
 * `GET /invoices/mine`.
 */
@Component({
  selector: 'app-billing-hub',
  standalone: true,
  imports: [BillingAdminConsole, BillingMemberInvoices],
  templateUrl: './billing-hub.html',
})
export class BillingHub {
  protected readonly userContext = inject(UserContextService);
  protected readonly Role = Role;
}
