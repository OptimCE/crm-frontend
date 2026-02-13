import { Routes } from '@angular/router';
import { AuthPage } from './components/auth-page/auth-page';

export const AUTH_ROUTES: Routes = [
  {
    path: '', // This matches /auth
    component: AuthPage,
  },
];
