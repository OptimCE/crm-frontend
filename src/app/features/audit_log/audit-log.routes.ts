import { Routes } from '@angular/router';
import { AuditLogList } from './components/audit-log-list/audit-log-list';

export const AUDIT_LOG_ROUTES: Routes = [
  {
    path: '',
    component: AuditLogList,
  },
];
