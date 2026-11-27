import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { HeaderPage } from '../../../../layout/header-page/header-page';
import { DataExportPanel } from '../data-export-panel/data-export-panel';

/**
 * `/communities/exports` (ADMIN of the active community): the community's
 * exports, whoever asked for them, and the button that asks for a new one.
 */
@Component({
  selector: 'app-community-exports',
  standalone: true,
  imports: [TranslatePipe, HeaderPage, DataExportPanel],
  templateUrl: './community-exports.html',
})
export class CommunityExports {}
