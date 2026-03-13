import { Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IHeaderAngularComp } from 'ag-grid-angular';
import { IHeaderParams } from 'ag-grid-community';

type HeaderWithHelperParams = IHeaderParams & {
  tooltip?: string;
  label?: string;
  click?: (tooltip: string) => void;
};

@Component({
  selector: 'app-header-with-helper',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './header-with-helper.html',
  styleUrl: './header-with-helper.css',
})
export class HeaderWithHelper implements IHeaderAngularComp {
  readonly params = signal<HeaderWithHelperParams | undefined>(undefined);

  refresh(_params: IHeaderParams): boolean {
    return true;
  }

  agInit(params: HeaderWithHelperParams): void {
    this.params.set(params);
  }

  onClick(): void {
    const tooltip = this.params()?.tooltip;
    if (tooltip) {
      this.params()?.click?.(tooltip);
    }
  }
}
