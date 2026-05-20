import { isDevMode } from '@angular/core';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  ValidationModule,
} from 'ag-grid-community';

let registered = false;

export function registerAllocationGenerationAgGridModules(): void {
  if (registered) return;
  ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    CellStyleModule,
    ...(isDevMode() ? [ValidationModule] : []),
  ]);
  registered = true;
}
