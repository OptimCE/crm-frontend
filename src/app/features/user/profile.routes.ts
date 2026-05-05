import { Routes } from '@angular/router';
import { Profile } from './components/profile/profile';
import { Invitations } from './components/invitations/invitations';
import { UserCommunities } from './components/user-communities/user-communities';
import { MemberViewMe } from './components/member-view-me/member-view-me';
import { MeterViewMe } from './components/meter-view-me/meter-view-me';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    component: Profile,
  },
  {
    path: 'invitations',
    component: Invitations,
  },
  {
    path: 'communities',
    component: UserCommunities,
  },
  {
    path: 'me/members/:id',
    component: MemberViewMe,
  },
  {
    path: 'me/meters/:id',
    component: MeterViewMe,
  },
];
