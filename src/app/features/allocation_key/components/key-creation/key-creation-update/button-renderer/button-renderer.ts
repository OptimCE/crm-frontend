import { Component } from '@angular/core';
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
  params!: ButtonRendererParams;
  label!: string|null;

  agInit(params: ButtonRendererParams): void {
    this.params = params;
    this.label = this.params.label || null;
  }

  refresh(_params: unknown): boolean {
    return true;
  }

  onClick($event: MouseEvent): void {
    const params = {
      event: $event,
      rowData: this.params.node.data as unknown,
    };
    this.params.onClick(params);
  }
}
