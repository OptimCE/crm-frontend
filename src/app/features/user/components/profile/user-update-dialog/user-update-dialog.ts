import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../../../../shared/services/user.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { UpdateUserDTO, UserDTO } from '../../../../../shared/dtos/user.dtos';
import { InputGroup } from 'primeng/inputgroup';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '@ngx-translate/core';
import { Checkbox, CheckboxChangeEvent } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';

interface UserUpdateDialogData {
  user: UserDTO;
}

interface UserUpdateFormValue {
  id: string;
  name: string;
  surname: string;
  phone: string;
  iban: string;
  same_address: boolean | unknown[];
  home_address_street: string;
  home_address_number: string;
  home_address_postcode: string;
  home_address_supplement: string;
  home_address_city: string;
  billing_address_street?: string;
  billing_address_number?: string;
  billing_address_postcode?: string;
  billing_address_supplement?: string;
  billing_address_city?: string;
}

@Component({
  selector: 'app-user-update-dialog',
  imports: [ReactiveFormsModule, InputGroup, InputText, TranslatePipe, Checkbox, Button, Ripple],
  templateUrl: './user-update-dialog.html',
  styleUrl: './user-update-dialog.css',
})
export class UserUpdateDialog implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private userService = inject(UserService);
  formData!: FormGroup;
  user!: UpdateUserDTO;

  ngOnInit(): void {
    this.initializeForm();
    const data = this.config.data as UserUpdateDialogData;
    if (data && data.user) {
      this.user = data.user as unknown as UpdateUserDTO;
      this.patchValue();
    }
  }

  initializeForm(): void {
    this.formData = new FormGroup({
      id: new FormControl('', []),
      name: new FormControl('', []),
      surname: new FormControl('', []),
      phone: new FormControl('', []),
      iban: new FormControl('', []),
      same_address: new FormControl(false),
      home_address_street: new FormControl('', []),
      home_address_number: new FormControl('', []),
      home_address_postcode: new FormControl('', []),
      home_address_supplement: new FormControl('', []),
      home_address_city: new FormControl('', []),
      billing_address_street: new FormControl('', []),
      billing_address_number: new FormControl('', []),
      billing_address_postcode: new FormControl('', []),
      billing_address_supplement: new FormControl('', []),
      billing_address_city: new FormControl('', []),
    });
  }

  patchValue(): void {
    if (this.user) {
      this.formData.patchValue({
        id: this.user.nrn,
        name: this.user.first_name,
        surname: this.user.last_name,
        phone: this.user.phone_number,
        iban: this.user.iban,
      });
      if (this.user.home_address) {
        this.formData.patchValue({
          home_address_street: this.user.home_address.street,
          home_address_number: this.user.home_address.number,
          home_address_postcode: this.user.home_address.postcode,
          home_address_supplement: this.user.home_address.supplement,
          home_address_city: this.user.home_address.city,
        });
      }
      if (this.user.billing_address) {
        this.formData.patchValue({
          billing_address_street: this.user.billing_address.street,
          billing_address_number: this.user.billing_address.number,
          billing_address_postcode: this.user.billing_address.postcode,
          billing_address_supplement: this.user.billing_address.supplement,
          billing_address_city: this.user.billing_address.city,
        });
      }
    }
  }

  toggleSameAddress(_event: CheckboxChangeEvent): void {
    const formValue = this.formData.getRawValue() as UserUpdateFormValue;
    const sameAddressValue = formValue.same_address;
    const isSameAddress = Array.isArray(sameAddressValue)
      ? sameAddressValue[0]
      : !!sameAddressValue;

    if (isSameAddress) {
      // Remove billing address from form
      this.formData.removeControl('billing_address_street');
      this.formData.removeControl('billing_address_number');
      this.formData.removeControl('billing_address_postcode');
      this.formData.removeControl('billing_address_supplement');
      this.formData.removeControl('billing_address_city');
    } else {
      this.formData.addControl('billing_address_street', new FormControl(''));
      this.formData.addControl('billing_address_number', new FormControl(''));
      this.formData.addControl('billing_address_postcode', new FormControl(''));
      this.formData.addControl('billing_address_supplement', new FormControl(''));
      this.formData.addControl('billing_address_city', new FormControl(''));
    }
  }

  submitForm(): void {
    if (this.formData.invalid) {
      return;
    }
    const formValue = this.formData.getRawValue() as UserUpdateFormValue;

    this.user.nrn = formValue.id;
    this.user.first_name = formValue.name;
    this.user.last_name = formValue.surname;
    this.user.phone_number = formValue.phone;
    this.user.iban = formValue.iban;
    if (
      formValue.home_address_street &&
      formValue.home_address_number &&
      formValue.home_address_postcode &&
      formValue.home_address_city
    ) {
      this.user.home_address = {
        street: formValue.home_address_street,
        number: +formValue.home_address_number,
        postcode: formValue.home_address_postcode,
        supplement: formValue.home_address_supplement,
        city: formValue.home_address_city,
      };
    }
    if (
      formValue.billing_address_street &&
      formValue.billing_address_number &&
      formValue.billing_address_postcode &&
      formValue.billing_address_city
    ) {
      this.user.billing_address = {
        street: formValue.billing_address_street,
        number: +formValue.billing_address_number,
        postcode: formValue.billing_address_postcode,
        supplement: formValue.billing_address_supplement,
        city: formValue.billing_address_city,
      };
    }
    console.log(this.user);
    this.userService.updateUserInfo(this.user).subscribe((response) => {
      if (response) {
        this.ref.close(true);
      }
    });
  }
}
