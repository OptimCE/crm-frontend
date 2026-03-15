import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { UserDTO } from '../../../../../../../shared/dtos/user.dtos';

@Component({
  selector: 'app-banking-info-user',
  imports: [TranslatePipe, Button, Tooltip],
  templateUrl: './banking-info.component.html',
  styleUrl: './banking-info.component.css',
})
export class BankingInfoComponent {
  readonly user = input<UserDTO | null>();

  copyIban(): void {
    const iban = this.user()?.iban;
    if (iban) {
      void navigator.clipboard.writeText(iban);
    }
  }
}
