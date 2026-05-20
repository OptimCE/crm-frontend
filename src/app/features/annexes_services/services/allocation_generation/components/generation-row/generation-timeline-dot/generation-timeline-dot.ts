import { Component, computed, input } from '@angular/core';
import { GenerationStatus } from '../../../../../../../shared/dtos/allocation_generation.dtos';

@Component({
  selector: 'app-generation-timeline-dot',
  standalone: true,
  templateUrl: './generation-timeline-dot.html',
  styleUrl: './generation-timeline-dot.css',
})
export class GenerationTimelineDot {
  readonly status = input.required<GenerationStatus>();
  readonly label = input<string | undefined>();

  readonly variant = computed<'success' | 'pending' | 'failed'>(() => {
    switch (this.status()) {
      case GenerationStatus.SUCCESS:
        return 'success';
      case GenerationStatus.FAILED:
        return 'failed';
      default:
        return 'pending';
    }
  });
}
