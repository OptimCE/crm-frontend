import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../../../../shared/services/user.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { UpdateUserDTO } from '../../../../../shared/dtos/user.dtos';
import { InputGroup } from 'primeng/inputgroup';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '@ngx-translate/core';
import { Checkbox, CheckboxChangeEvent } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';

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
    if (this.config.data && this.config.data.user) {
      this.user = this.config.data.user as UpdateUserDTO;
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
    if (this.formData.value.same_address[0]) {
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
    this.user.nrn = this.formData.value.id;
    this.user.first_name = this.formData.value.name;
    this.user.last_name = this.formData.value.surname;
    this.user.phone_number = this.formData.value.phone;
    this.user.iban = this.formData.value.iban;
    if (
      this.formData.value.home_address_street &&
      this.formData.value.home_address_number &&
      this.formData.value.home_address_postcode &&
      this.formData.value.home_address_city
    ) {
      this.user.home_address = {
        street: this.formData.value.home_address_street,
        number: this.formData.value.home_address_number,
        postcode: this.formData.value.home_address_postcode,
        supplement: this.formData.value.home_address_supplement,
        city: this.formData.value.home_address_city,
      };
    }
    if (
      this.formData.value.billing_address_street &&
      this.formData.value.billing_address_number &&
      this.formData.value.billing_address_postcode &&
      this.formData.value.billing_address_city
    ) {
      this.user.billing_address = {
        street: this.formData.value.billing_address_street,
        number: this.formData.value.billing_address_number,
        postcode: this.formData.value.billing_address_postcode,
        supplement: this.formData.value.billing_address_supplement,
        city: this.formData.value.billing_address_city,
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
