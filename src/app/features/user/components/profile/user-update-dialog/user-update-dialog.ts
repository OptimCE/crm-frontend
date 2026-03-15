import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../../../../shared/services/user.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { UpdateUserDTO, UserDTO } from '../../../../../shared/dtos/user.dtos';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '@ngx-translate/core';
import { Checkbox, CheckboxChangeEvent } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Divider } from 'primeng/divider';

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
  billing_address_street: string;
  billing_address_number: string;
  billing_address_postcode: string;
  billing_address_supplement: string;
  billing_address_city: string;
}

@Component({
  selector: 'app-user-update-dialog',
  imports: [ReactiveFormsModule, InputText, TranslatePipe, Checkbox, Button, Ripple, Divider],
  templateUrl: './user-update-dialog.html',
  styleUrl: './user-update-dialog.css',
})
export class UserUpdateDialog implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);
  formData!: FormGroup;
  user!: UpdateUserDTO;
  protected readonly isSameAddress = signal(false);

  private readonly billingControls = [
    'billing_address_street',
    'billing_address_number',
    'billing_address_postcode',
    'billing_address_supplement',
    'billing_address_city',
  ];

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
      id: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
      surname: new FormControl('', [Validators.required]),
      phone: new FormControl('', [Validators.required]),
      iban: new FormControl('', [Validators.required]),
      same_address: new FormControl(false),
      home_address_street: new FormControl('', [Validators.required]),
      home_address_number: new FormControl('', [Validators.required]),
      home_address_postcode: new FormControl('', [Validators.required]),
      home_address_supplement: new FormControl(''),
      home_address_city: new FormControl('', [Validators.required]),
      billing_address_street: new FormControl('', [Validators.required]),
      billing_address_number: new FormControl('', [Validators.required]),
      billing_address_postcode: new FormControl('', [Validators.required]),
      billing_address_supplement: new FormControl(''),
      billing_address_city: new FormControl('', [Validators.required]),
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
    const same = Array.isArray(sameAddressValue) ? sameAddressValue[0] : !!sameAddressValue;
    this.isSameAddress.set(same as boolean);

    if (same) {
      this.billingControls.forEach((c) => this.formData.get(c)?.disable());
    } else {
      this.billingControls.forEach((c) => this.formData.get(c)?.enable());
    }
  }

  cancel(): void {
    this.ref.close(false);
  }

  submitForm(): void {
    if (this.formData.invalid) {
      this.formData.markAllAsTouched();
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
      !this.isSameAddress() &&
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
    this.userService
      .updateUserInfo(this.user)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          this.ref.close(true);
        }
      });
  }
}
