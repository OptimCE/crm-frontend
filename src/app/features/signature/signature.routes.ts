import { Routes } from '@angular/router';

import { Role } from '../../core/dtos/role';
import { activeFeatureGuard } from '../../core/guards/active-feature.guard';
import { minRoleGuard } from '../../core/guards/can_activate';
import { SignatureFollow } from './components/signature-follow/signature-follow';
import { SignatureInbox } from './components/signature-inbox/signature-inbox';
import { SignatureRequestView } from './components/signature-request-view/signature-request-view';
import { SignatureSign } from './components/signature-sign/signature-sign';

/**
 * `/signatures`. The parent route carries `canActivateAuth` only: the inbox,
 * the signing screen and a request's page are cross-community (the annexe
 * filters by module and by who may see what). Only the follow-up list is the
 * ACTIVE community's, for its managers, with the module on.
 *
 * Literal segments first: `community` and `requests/:id` must not be read as a
 * request id.
 */
export const SIGNATURE_ROUTES: Routes = [
  { path: '', component: SignatureInbox },
  {
    path: 'community',
    component: SignatureFollow,
    canActivate: [activeFeatureGuard('signature'), minRoleGuard],
    data: { minRole: Role.GESTIONNAIRE },
  },
  { path: 'requests/:requestId', component: SignatureRequestView },
  { path: ':requestId/signers/:signerId', component: SignatureSign },
];
