import { Component, input, output } from '@angular/core';
import { InputGroup } from 'primeng/inputgroup';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '@ngx-translate/core';
import { Checkbox, CheckboxChangeEvent } from 'primeng/checkbox';
import { Button, ButtonLabel } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormErrorSummaryComponent } from '../../../../../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { ErrorHandlerComponent } from '../../../../../../../../../../shared/components/error.handler/error.handler.component';

@Component({
  selector: 'app-new-member-address-self-encoding',
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
    ButtonLabel,
  ],
  templateUrl: './new-member-address-self-encoding.component.html',
  styleUrl: './new-member-address-self-encoding.component.css',
})
export class NewMemberAddressSelfEncoding {
  readonly addressForm = input.required<FormGroup>();
  readonly backClicked = output<void>();
  readonly formSubmitted = output<void>();
  readonly toggleSameAddressEvent = output<CheckboxChangeEvent>();

  goBack(): void {
    this.backClicked.emit();
  }

  submit(): void {
    if (this.addressForm().valid) {
      this.formSubmitted.emit();
    }
  }
  toggleSameAddress($event: CheckboxChangeEvent): void {
    this.toggleSameAddressEvent.emit($event);
  }
}
