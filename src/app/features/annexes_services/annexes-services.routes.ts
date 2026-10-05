import { Routes } from '@angular/router';
import { AnnexesServicesList } from './components/annexes-services-list/annexes-services-list';
import { minRoleGuard } from '../../core/guards/can_activate';
import { activeFeatureGuard } from '../../core/guards/active-feature.guard';
import { Role } from '../../core/dtos/role';
import { registerAllocationGenerationAgGridModules } from './services/allocation_generation/ag-grid-setup';
import { AllocationGenerationHub } from './services/allocation_generation/components/allocation-generation-hub/allocation-generation-hub';
import { SimulationHub } from './services/simulation/components/simulation-hub/simulation-hub';

// Register the granular AG Grid modules used by the allocation-generation hub.
// Runs once when this lazy chunk is loaded.
registerAllocationGenerationAgGridModules();

export const ANNEXES_SERVICES_ROUTES: Routes = [
  {
    // Not subscription-gated: this is the page a manager subscribes from.
    path: '',
    component: AnnexesServicesList,
  },
  // Subscription-gated AND role-gated: both hubs are manager tools. (`live-data`
  // in app.routes.ts is subscription-gated only; its hub branches on the role
  // instead.) The list only links subscribed annexes, but a bookmark or a
  // typed URL reaches these routes directly — for a community that is not
  // subscribed, or on a deployment whose catalog hides the annex
  // (`ANNEX_CATALOG_DISABLE`, `defaultEnabled: false`). The hubs never read the
  // store, so without the guard they open onto API calls the Python
  // `require_feature` refuses.
  {
    path: 'algorithm',
    component: AllocationGenerationHub,
    canActivate: [minRoleGuard, activeFeatureGuard('algorithm')],
    data: { minRole: Role.GESTIONNAIRE },
  },
  {
    path: 'simulation',
    component: SimulationHub,
    canActivate: [minRoleGuard, activeFeatureGuard('simulation')],
    data: { minRole: Role.GESTIONNAIRE },
  },
];
