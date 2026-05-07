import { Component, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IHeaderAngularComp } from 'ag-grid-angular';
import { IHeaderParams } from 'ag-grid-community';
import { Popover } from 'primeng/popover';

type HeaderWithHelperParams = IHeaderParams & {
  tooltip?: string;
  label?: string;
};

@Component({
  selector: 'app-header-with-helper',
  standalone: true,
  imports: [TranslatePipe, Popover],
  templateUrl: './header-with-helper.html',
  styleUrl: './header-with-helper.css',
})
export class HeaderWithHelper implements IHeaderAngularComp {
  readonly params = signal<HeaderWithHelperParams | undefined>(undefined);
  readonly popover = viewChild<Popover>('helpPopover');
  readonly isOpen = signal(false);

  refresh(_params: IHeaderParams): boolean {
    return true;
  }

  agInit(params: HeaderWithHelperParams): void {
    this.params.set(params);
  }

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.popover()?.toggle(event);
  }
}
