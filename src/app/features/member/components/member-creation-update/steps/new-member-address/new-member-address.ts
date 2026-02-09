import {Component, EventEmitter, Input, Output} from '@angular/core';
import {InputGroup} from 'primeng/inputgroup';
import {InputText} from 'primeng/inputtext';
import {ErrorHandlerComponent} from '../../../../../../shared/components/error.handler/error.handler.component';
import {TranslatePipe} from '@ngx-translate/core';
import {Checkbox, CheckboxChangeEvent} from 'primeng/checkbox';
import {
  FormErrorSummaryComponent
} from '../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import {Button, ButtonLabel} from 'primeng/button';
import {Ripple} from 'primeng/ripple';
import {FormGroup, ReactiveFormsModule} from '@angular/forms';

@Component({
  selector: 'app-new-member-address',
  imports: [
    ReactiveFormsModule,
    InputGroup,
    InputText,
    ErrorHandlerComponent,
    TranslatePipe,
    Checkbox,
    FormErrorSummaryComponent,
    Button,
    Ripple,
    ButtonLabel
  ],
  templateUrl: './new-member-address.html',
  styleUrl: './new-member-address.css',
})
export class NewMemberAddress {
  @Input() addressForm!: FormGroup;
  @Output() backClicked = new EventEmitter<void>();
  @Output() formSubmitted = new EventEmitter<void>();
  @Output() toggleSameAddressEvent = new EventEmitter<CheckboxChangeEvent>();


  goBack() {
    this.backClicked.emit();
  }

  submit() {
    if (this.addressForm.valid) {
      this.formSubmitted.emit();
    }
  }
  toggleSameAddress($event: CheckboxChangeEvent) {
    this.toggleSameAddressEvent.emit($event);
  }
}
