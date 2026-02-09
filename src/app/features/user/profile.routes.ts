import {Routes} from '@angular/router';
import {Profile} from './components/profile/profile';
import {Invitations} from './components/invitations/invitations';
import {UserCommunities} from './components/user-communities/user-communities';

export const PROFILE_ROUTES: Routes = [
  {
    path:'',
    component: Profile
  },
  {
    path:'invitations',
    component: Invitations
  },
  {
    path:'communities',
    component: UserCommunities
  }
]
