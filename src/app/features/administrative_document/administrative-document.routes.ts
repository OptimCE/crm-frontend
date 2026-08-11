import { Routes } from '@angular/router';

import { AdministrativeDocumentHub } from './components/administrative-document-hub/administrative-document-hub';
import { DossierDetail } from './components/dossier-detail/dossier-detail';

export const ADMINISTRATIVE_DOCUMENT_ROUTES: Routes = [
  { path: '', component: AdministrativeDocumentHub },
  // Deep-linkable: the deadline dashboard links straight to a dossier.
  { path: 'dossiers/:id', component: DossierDetail },
];
