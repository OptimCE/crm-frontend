import { isDevMode } from '@angular/core';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  TextEditorModule,
  ValidationModule,
} from 'ag-grid-community';

let registered = false;

/**
 * Registers only the AG Grid community modules actually used by the
 * allocation_key feature. Called from the feature's lazy-loaded routes
 * so AG Grid is excluded from the initial bundle.
 *
 * Modules in use:
 *  - ClientSideRowModelModule: core row model for both grids
 *  - CellStyleModule: cellStyle callbacks in key-view & key-creation-update
 *  - TextEditorModule: default text editor for editable cells in key-creation-update
 *  - ValidationModule: dev-only validation messages (tree-shaken in prod)
 */
export function registerAllocationKeyAgGridModules(): void {
  if (registered) return;
  ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    CellStyleModule,
    TextEditorModule,
    ...(isDevMode() ? [ValidationModule] : []),
  ]);
  registered = true;
}
