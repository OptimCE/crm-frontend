import { Routes } from '@angular/router';
import { AnnexesServicesList } from './components/annexes-services-list/annexes-services-list';
import { minRoleGuard } from '../../core/guards/can_activate';
import { Role } from '../../core/dtos/role';
import { registerAllocationGenerationAgGridModules } from './services/allocation_generation/ag-grid-setup';
import { AllocationGenerationHub } from './services/allocation_generation/components/allocation-generation-hub/allocation-generation-hub';
import { SimulationHub } from './services/simulation/components/simulation-hub/simulation-hub';

// Register the granular AG Grid modules used by the allocation-generation hub.
// Runs once when this lazy chunk is loaded.
registerAllocationGenerationAgGridModules();

export const ANNEXES_SERVICES_ROUTES: Routes = [
  {
    path: '',
    component: AnnexesServicesList,
  },
  {
    path: 'algorithm',
    component: AllocationGenerationHub,
    canActivate: [minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
  },
  {
    path: 'simulation',
    component: SimulationHub,
    canActivate: [minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
  },
];
