import { createGrid, GridApi } from 'ag-grid-community';
import { vi } from 'vitest';

import { registerAllocationKeyAgGridModules } from './ag-grid-setup';

/**
 * KeyView and KeyCreationUpdate are specced against a mocked GridApi, which accepts any method.
 * A real grid only runs a method whose module is registered: otherwise the call does nothing and
 * logs "AG Grid: error #200", which refreshHeader() and refreshCells() did in production.
 * Add any GridApi method the feature starts calling to the calls below.
 */
describe('registerAllocationKeyAgGridModules', () => {
  let api: GridApi | undefined;

  afterEach(() => {
    api?.destroy();
    api = undefined;
    vi.restoreAllMocks();
  });

  it('registers the module behind every GridApi method the feature calls', () => {
    registerAllocationKeyAgGridModules();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api = createGrid(document.createElement('div'), {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Consumer A' }],
    });

    api.refreshHeader(); // KeyView.onGridReady
    api.refreshCells({ force: true }); // KeyView.onGridReady, KeyCreationUpdate.refreshGrid

    const missingModules = consoleError.mock.calls
      .map((args) => args.map(String).join(' '))
      .filter((message) => message.includes('error #200'));
    expect(missingModules).toEqual([]);
  });
});
