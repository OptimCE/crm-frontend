import { Routes } from '@angular/router';

import { LiveDataHub } from './components/live-data-hub/live-data-hub';

export const LIVE_DATA_ROUTES: Routes = [
  {
    path: '',
    component: LiveDataHub,
  },
];
