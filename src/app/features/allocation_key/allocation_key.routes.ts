import { Routes } from '@angular/router';
import { KeysList } from './components/keys-list/keys-list';
import { KeyCreationUpdate } from './components/key-creation/key-creation-update/key-creation-update';
import { KeyCreationStepByStep } from './components/key-creation/key-creation-step-by-step/key-creation-step-by-step';
import { KeyView } from './components/key-view/key-view';
import { registerAllocationKeyAgGridModules } from './ag-grid-setup';

// Register the granular AG Grid modules used by this feature.
// Runs once when this lazy chunk is loaded, keeping AG Grid out of the initial bundle.
registerAllocationKeyAgGridModules();

export const ALLOCATION_KEY_ROUTES: Routes = [
  {
    path: '',
    component: KeysList,
  },
  {
    path: 'add',
    component: KeyCreationUpdate,
  },
  {
    path: 'add/step',
    component: KeyCreationStepByStep,
  },
  {
    path: 'update/:id',
    component: KeyCreationUpdate,
  },
  {
    path: ':id',
    component: KeyView,
  },
];
