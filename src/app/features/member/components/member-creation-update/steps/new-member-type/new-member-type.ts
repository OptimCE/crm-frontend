import { Component, EventEmitter, Input, Output } from '@angular/core';
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
