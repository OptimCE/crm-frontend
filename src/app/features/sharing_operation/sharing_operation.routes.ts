import {Routes} from '@angular/router';
import {SharingOperationsList} from './components/sharing-operations-list/sharing-operations-list';
import {SharingOperationView} from './components/sharing-operation-view/sharing-operation-view';



export const SHARING_OPERATION_ROUTES: Routes = [
  {
    path: '',
    component: SharingOperationsList
  },
  {
    path: ':id',
    component: SharingOperationView
  }
]
