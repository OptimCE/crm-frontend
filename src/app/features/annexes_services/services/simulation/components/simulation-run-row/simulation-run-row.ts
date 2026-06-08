import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import {
  SimulationDetailDTO,
  SimulationPartialDTO,
  SimulationStatus,
} from '../../../../../../shared/dtos/simulation.dtos';
import { SimulationResults } from '../simulation-results/simulation-results';

@Component({
  selector: 'app-simulation-run-row',
  standalone: true,
  imports: [TranslatePipe, Button, Skeleton, Tooltip, SimulationResults],
  templateUrl: './simulation-run-row.html',
  styleUrl: './simulation-run-row.css',
})
export class SimulationRunRow {
  readonly run = input.required<SimulationPartialDTO>();
  readonly expanded = input.required<boolean>();
  readonly detail = input<SimulationDetailDTO | undefined>(undefined);
  readonly detailLoading = input<boolean>(false);

  readonly toggled = output<number>();
  readonly deleteRun = output<number>();

  readonly variant = computed<'success' | 'pending' | 'failed'>(() => {
    switch (this.run().status) {
      case SimulationStatus.SUCCESS:
        return 'success';
      case SimulationStatus.FAILED:
        return 'failed';
      default:
        return 'pending';
    }
  });

  readonly statusKey = computed<string>(() => {
    switch (this.run().status) {
      case SimulationStatus.SUCCESS:
        return 'SIMULATION_HUB.STATUS.SUCCESS';
      case SimulationStatus.FAILED:
        return 'SIMULATION_HUB.STATUS.FAILED';
      default:
        return 'SIMULATION_HUB.STATUS.PENDING';
    }
  });
}
