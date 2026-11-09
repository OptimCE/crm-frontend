import { Provider } from '@angular/core';
import { of } from 'rxjs';

import { CommunityServicesStore } from '../../../core/services/community-services.store';
import { RegulatoryStatusDTO } from '../../dtos/regulatory-status.dtos';
import { AdministrativeProcedureService } from '../../services/administrative-procedure.service';
import { RegulatoryStatusService } from '../../services/regulatory-status.service';

/**
 * For the specs of a screen that shows regulatory badges: the administrative
 * module unreachable (no badge, no request) unless `rows` are given, in which
 * case it is reachable and the core answers them. Spreads into `providers`.
 */
export function provideRegulatoryTesting(rows: RegulatoryStatusDTO[] | null = null): Provider[] {
  const reachable = rows !== null;
  return [
    {
      provide: CommunityServicesStore,
      useValue: {
        canReach: () => reachable,
        isActive: () => reachable,
        ensureLoaded: () => of([]),
      },
    },
    { provide: RegulatoryStatusService, useValue: { status: () => of({ data: rows ?? [] }) } },
    {
      provide: AdministrativeProcedureService,
      useValue: {
        getInbox: () =>
          of({
            data: {
              today: '',
              banner: [],
              groups: { todo: [], waiting: [], planned: [], done: [] },
            },
          }),
        invalidate: () => undefined,
      },
    },
  ];
}
