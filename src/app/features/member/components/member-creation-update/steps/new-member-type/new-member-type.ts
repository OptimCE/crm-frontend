import { Component, model, output } from '@angular/core';
import { RadioButton } from 'primeng/radiobutton';
import { MemberType } from '../../../../../../shared/types/member.types';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-member-type',
  imports: [RadioButton, TranslatePipe, Button, FormsModule],
  templateUrl: './new-member-type.html',
  styleUrl: './new-member-type.css',
})
export class NewMemberType {
  readonly typeClient = model<number>(-1);
  readonly formSubmitted = output<void>();

  submit(): void {
    if (this.typeClient() !== -1) {
      this.formSubmitted.emit();
    }
  }

  protected readonly MemberType = MemberType;
}
