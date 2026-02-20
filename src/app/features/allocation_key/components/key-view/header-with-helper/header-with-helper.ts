import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IHeaderAngularComp } from 'ag-grid-angular';
import { IHeaderParams } from 'ag-grid-community';
@Component({
  selector: 'app-header-with-helper',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './header-with-helper.html',
  styleUrl: './header-with-helper.css',
})
export class HeaderWithHelper implements IHeaderAngularComp {
  refresh(_params: IHeaderParams): boolean {
    return true;
  }

  @Input() params: any;

  agInit(params: any): void {
    this.params = params;
  }

  onClick(): void {
    const tooltip = this.params?.tooltip;
    this.params?.click?.(tooltip);
  }
}
