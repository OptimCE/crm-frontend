import { Routes } from '@angular/router';

import { AdministrativeDocumentHub } from './components/administrative-document-hub/administrative-document-hub';
import { BaselineConfirm } from './procedures/baseline-confirm/baseline-confirm';
import { ProcedureDetail } from './procedures/procedure-detail/procedure-detail';

export const ADMINISTRATIVE_DOCUMENT_ROUTES: Routes = [
  { path: '', component: AdministrativeDocumentHub },
  // Deep-linkable: the dashboard, the agenda and notifications link here.
  { path: 'procedures/:id', component: ProcedureDetail },
  { path: 'baseline', component: BaselineConfirm },
  // July links (notifications already sent, bookmarks): every July dossier was
  // converted into a procedure with the same id.
  { path: 'dossiers/:id', redirectTo: 'procedures/:id' },
];
