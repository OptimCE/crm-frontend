import { Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

interface ButtonRendererParams extends ICellRendererParams {
  /** Accessible name and tooltip of the icon-only delete button. */
  label: string;
  onClick: (params: { event: MouseEvent; rowData: unknown }) => void;
}
@Component({
  selector: 'app-button-renderer',
  standalone: true,
  imports: [Button, Tooltip],
  templateUrl: './button-renderer.html',
  styleUrl: './button-renderer.css',
})
export class ButtonRenderer implements ICellRendererAngularComp {
  readonly params = signal<ButtonRendererParams | undefined>(undefined);
  readonly label = signal<string | null>(null);

  agInit(params: ButtonRendererParams): void {
    this.params.set(params);
    this.label.set(params.label || null);
  }

  refresh(_params: unknown): boolean {
    return true;
  }

  onClick($event: MouseEvent): void {
    const p = this.params();
    if (!p) return;
    p.onClick({ event: $event, rowData: p.node.data as unknown });
  }
}
