import { Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { Ripple } from 'primeng/ripple';
import { ICellRendererParams } from 'ag-grid-community';

interface ButtonRendererParams extends ICellRendererParams {
  label: string;
  onClick: (params: { event: MouseEvent; rowData: unknown }) => void;
}
@Component({
  selector: 'app-button-renderer',
  standalone: true,
  imports: [Button, Ripple],
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
