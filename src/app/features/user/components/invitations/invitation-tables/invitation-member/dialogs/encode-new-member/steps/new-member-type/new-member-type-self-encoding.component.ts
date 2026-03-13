import { Component, model, output } from '@angular/core';
import { RadioButton } from 'primeng/radiobutton';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { MemberType } from '../../../../../../../../../../shared/types/member.types';

@Component({
  selector: 'app-new-member-type-self-encoding',
  imports: [RadioButton, TranslatePipe, Button, FormsModule],
  templateUrl: './new-member-type-self-encoding.component.html',
  styleUrl: './new-member-type-self-encoding.component.css',
})
export class NewMemberTypeSelfEncoding {
  readonly typeClient = model<number>(-1);
  readonly formSubmitted = output<void>();

  submit(): void {
    if (this.typeClient() != -1) {
      this.formSubmitted.emit();
    }
  }

  protected readonly MemberType = MemberType;
}
