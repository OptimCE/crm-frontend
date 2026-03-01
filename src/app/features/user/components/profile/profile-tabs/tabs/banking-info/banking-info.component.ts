import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UserDTO } from '../../../../../../../shared/dtos/user.dtos';

@Component({
  selector: 'app-banking-info-user',
  imports: [TranslatePipe],
  templateUrl: './banking-info.component.html',
  styleUrl: './banking-info.component.css',
})
export class BankingInfoComponent {
  @Input() user?: UserDTO | null;
}
