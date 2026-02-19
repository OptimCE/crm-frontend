import { Component } from '@angular/core';
import { Button } from 'primeng/button';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { Ripple } from 'primeng/ripple';

@Component({
  selector: 'app-button-renderer',
  standalone: true,
  imports: [Button, Ripple],
  templateUrl: './button-renderer.html',
  styleUrl: './button-renderer.css',
})
export class ButtonRenderer implements ICellRendererAngularComp {
  params: any;
  label!: string;

  agInit(params: any): void {
    this.params = params;
    this.label = this.params.label || null;
  }

  refresh(_params: any): boolean {
    return true;
  }

  onClick($event: MouseEvent) {
    if (this.params.onClick instanceof Function) {
      const params = {
        event: $event,
        rowData: this.params.node.data,
      };
      this.params.onClick(params);
    }
  }
}
