import { Routes } from '@angular/router';
import { MetersList } from './components/meters-list/meters-list';
import { MeterView } from './components/meter-view/meter-view';

export const METER_ROUTES: Routes = [
  {
    path: '',
    component: MetersList,
  },
  {
    path: ':id',
    component: MeterView,
  },
];
