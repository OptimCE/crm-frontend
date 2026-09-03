import { Component, computed, input, output } from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { TranslatePipe } from '@ngx-translate/core';
import { Checkbox, CheckboxChangeEvent } from 'primeng/checkbox';
import { FormErrorSummaryComponent } from '../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  AddressAutocomplete,
  AddressGeoState,
  AddressPicked,
} from '../../../../../../shared/components/address-autocomplete/address-autocomplete';
import { prefixedAddressNames } from '../../../../../../shared/components/address-autocomplete/address-field-source';

@Component({
  selector: 'app-new-member-address',
  imports: [
    ReactiveFormsModule,
    InputText,
    ErrorHandlerComponent,
    TranslatePipe,
    Checkbox,
    FormErrorSummaryComponent,
    Button,
    Ripple,
    AddressAutocomplete,
  ],
  templateUrl: './new-member-address.html',
  styleUrl: './new-member-address.css',
})
/**
 * Still a dumb component: it renders the two pickers and passes their events
 * straight up, exactly as it already does for the "same address" checkbox. The
 * form and the payload stay entirely the parent's business — which matters here
 * because this step is shared by the member wizard AND the invitation
 * self-encoding flow, and the two build different DTOs.
 */
export class NewMemberAddress {
  readonly addressForm = input.required<FormGroup>();
  readonly backClicked = output<void>();
  readonly formSubmitted = output<void>();
  readonly toggleSameAddressEvent = output<CheckboxChangeEvent>();

  readonly homeAddressPicked = output<AddressPicked>();
  readonly homeGeoChange = output<AddressGeoState>();
  readonly billingAddressPicked = output<AddressPicked>();
  readonly billingGeoChange = output<AddressGeoState>();

  protected readonly homeSource = computed(() => ({
    group: this.addressForm(),
    names: prefixedAddressNames('home_address'),
  }));
  protected readonly billingSource = computed(() => ({
    group: this.addressForm(),
    names: prefixedAddressNames('billing_address'),
  }));

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
