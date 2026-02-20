import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() typeClient: number = -1;
  @Output() typeClientChange = new EventEmitter<number>();
  @Output() formSubmitted = new EventEmitter<void>();

  submit(): void {
    if (this.typeClient != -1) {
      this.formSubmitted.emit();
    }
  }

  protected readonly MemberType = MemberType;
}
