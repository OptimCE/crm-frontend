import { isDevMode } from '@angular/core';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  RenderApiModule,
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
 *  - RenderApiModule: api.refreshHeader() in key-view, api.refreshCells() in both
 *  - ValidationModule: dev-only validation messages (tree-shaken in prod)
 *
 * A GridApi method whose module is missing does nothing and logs "AG Grid: error #200",
 * while the component specs (which mock GridApi) stay green: ag-grid-setup.spec.ts calls
 * each method the feature uses on a real grid.
 */
export function registerAllocationKeyAgGridModules(): void {
  if (registered) return;
  ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    CellStyleModule,
    TextEditorModule,
    RenderApiModule,
    ...(isDevMode() ? [ValidationModule] : []),
  ]);
  registered = true;
}
