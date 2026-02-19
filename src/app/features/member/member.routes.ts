import { Routes } from '@angular/router';
import { MembersList } from './components/members-list/members-list';
import { MemberView } from './components/member-view/member-view';

export const MEMBER_ROUTES: Routes = [
  {
    path: '',
    component: MembersList,
  },
  {
    path: ':id',
    component: MemberView,
  },
];
