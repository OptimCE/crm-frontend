import { Component, input, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';

@Component({
  selector: 'app-field-label-helper',
  standalone: true,
  imports: [TranslatePipe, Popover],
  templateUrl: './field-label-helper.html',
  styleUrl: './field-label-helper.css',
})
export class FieldLabelHelper {
  readonly label = input.required<string>();
  readonly tooltip = input.required<string>();
  readonly forId = input<string | undefined>(undefined);
  readonly required = input(false);

  readonly popover = viewChild<Popover>('helpPopover');
  readonly isOpen = signal(false);

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.popover()?.toggle(event);
  }
}
