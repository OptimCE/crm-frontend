import { AfterViewInit, ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { MemberType } from '../../../../shared/types/member.types';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CheckboxChangeEvent } from 'primeng/checkbox';
import {
  CompanyDTO,
  CreateManagerDTO,
  CreateMemberDTO,
  IndividualDTO,
  UpdateMemberDTO,
} from '../../../../shared/dtos/member.dtos';
import { MemberService } from '../../../../shared/services/member.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { TranslatePipe } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ibanValidator } from './iban.validator';
import { numRegistreBeValidator } from './num_registre_nat_be.validator';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import { Step, StepList, StepPanel, StepPanels, Stepper } from 'primeng/stepper';
import { NewMemberType } from './steps/new-member-type/new-member-type';
import { NewMemberInformations } from './steps/new-member-informations/new-member-informations';
import { NewMemberAddress } from './steps/new-member-address/new-member-address';
import { NewMemberBankingInfo } from './steps/new-member-banking-info/new-member-banking-info';
import { ApiResponse } from '../../../../core/dtos/api.response';

interface AddressFormValue {
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

interface IbanFormValue {
  iban: string;
}

interface MemberFormValue {
  id: string;
  name: string;
  surname?: string;
  email?: string;
  phone?: string;
  socialRate?: boolean | unknown[];
  vatNumber?: string;
  NRN_manager?: string;
  name_manager?: string;
  surname_manager?: string;
  email_manager?: string;
  phone_manager?: string;
}

interface NextCallback {
  emit: () => void;
}

@Component({
  selector: 'app-member-creation-update',
  imports: [
    Stepper,
    StepList,
    Step,
    TranslatePipe,
    StepPanels,
    StepPanel,
    NewMemberType,
    NewMemberInformations,
    NewMemberAddress,
    NewMemberBankingInfo,
  ],
  templateUrl: './member-creation-update.html',
  styleUrl: './member-creation-update.css',
  providers: [ErrorMessageHandler],
})
export class MemberCreationUpdate implements OnInit, AfterViewInit {
  private membersService = inject(MemberService);
  private config =
    inject<DynamicDialogConfig<{ member: IndividualDTO | CompanyDTO }>>(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private cdr = inject(ChangeDetectorRef);
  typeClient: MemberType | -1 = -1;
  formData!: FormGroup;
  addressForm!: FormGroup;
  ibanForm!: FormGroup;
  gestionnaire: boolean = false;
  existingMember?: IndividualDTO | CompanyDTO;
  step = signal(0);

  ngOnInit(): void {
    this.addressForm = new FormGroup({
      same_address: new FormControl(false),
      home_address_street: new FormControl('', [Validators.required]),
      home_address_number: new FormControl('', [Validators.required]),
      home_address_postcode: new FormControl('', [Validators.required]),
      home_address_supplement: new FormControl('', []),
      home_address_city: new FormControl('', [Validators.required]),
      billing_address_street: new FormControl('', [Validators.required]),
      billing_address_number: new FormControl('', [Validators.required]),
      billing_address_postcode: new FormControl('', [Validators.required]),
      billing_address_supplement: new FormControl('', []),
      billing_address_city: new FormControl('', [Validators.required]),
    });
    this.ibanForm = new FormGroup({
      iban: new FormControl('', [Validators.required, ibanValidator]),
    });
    if (this.config.data && this.config.data.member) {
      this.existingMember = this.config.data.member;
      if (this.existingMember) {
        this.typeClient = this.existingMember.member_type;
        this.buildFormGroup();
        this.addressForm.patchValue({
          home_address_street: this.existingMember.home_address.street,
          home_address_number: this.existingMember.home_address.number,
          home_address_postcode: this.existingMember.home_address.postcode,
          home_address_supplement: this.existingMember.home_address.supplement,
          home_address_city: this.existingMember.home_address.city,
          billing_address_street: this.existingMember.billing_address.street,
          billing_address_number: this.existingMember.billing_address.number,
          billing_address_postcode: this.existingMember.billing_address.postcode,
          billing_address_supplement: this.existingMember.billing_address.supplement,
          billing_address_city: this.existingMember.billing_address.city,
        });
        this.ibanForm.patchValue({
          iban: this.existingMember.iban,
        });
      }
    }
  }

  ngAfterViewInit(): void {
    this.cdr.markForCheck(); // Force change detection once content is rendered
  }

  buildFormGroup(): void {
    this.formData = new FormGroup({
      id: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
    });
    if (this.typeClient === MemberType.INDIVIDUAL) {
      // this.formData.controls['id'].addValidators([numRegistreBeValidator]);
      // Build form group for individuals
      this.formData.addControl('surname', new FormControl('', [Validators.required]));
      this.formData.addControl(
        'email',
        new FormControl('', [Validators.required, Validators.email]),
      );
      this.formData.addControl('phone', new FormControl('', [Validators.required]));
      this.formData.addControl('socialRate', new FormControl(false, [Validators.required]));
      if (this.existingMember) {
        this.formData.patchValue({
          id: (this.existingMember as IndividualDTO).NRN,
          name: (this.existingMember as IndividualDTO).first_name,
          surname: (this.existingMember as IndividualDTO).name,
          email: (this.existingMember as IndividualDTO).email,
          phone: (this.existingMember as IndividualDTO).phone_number,
          socialRate: (this.existingMember as IndividualDTO).social_rate,
        });
      }
    } else if (this.typeClient === MemberType.COMPANY) {
      this.formData.addControl('vatNumber', new FormControl('', [Validators.required]));
      if (this.existingMember) {
        this.formData.patchValue({
          id: (this.existingMember as CompanyDTO).vat_number,
          name: (this.existingMember as CompanyDTO).name,
          vatNumber: (this.existingMember as CompanyDTO).vat_number,
        });
      }
    }
    this.updateGestionnaire(this.typeClient === MemberType.COMPANY);
  }

  submitForm1(nextCallback: NextCallback): void {
    if (this.typeClient != -1) {
      this.buildFormGroup();
      this.step.set(1);
      nextCallback.emit();
    }
  }

  submitForm2(nextCallback: NextCallback): void {
    console.log(this.formData.valid);
    if (this.formData.valid) {
      this.step.set(2);
      nextCallback.emit();
    }
  }

  submitForm3(nextCallback: NextCallback): void {
    if (this.addressForm.valid) {
      this.step.set(3);
      nextCallback.emit();
    }
  }

  onSubmitEnd(): void {
    if (this.ibanForm.invalid) {
      return;
    }
    const addressValue = this.addressForm.getRawValue() as AddressFormValue;
    const homeAddress: AddressDTO = {
      id: -1,
      street: addressValue.home_address_street,
      number: +addressValue.home_address_number,
      postcode: addressValue.home_address_postcode,
      supplement: addressValue.home_address_supplement,
      city: addressValue.home_address_city,
    };
    if (this.existingMember) {
      if (
        this.existingMember.home_address.street === homeAddress.street &&
        this.existingMember.home_address.number === homeAddress.number &&
        this.existingMember.home_address.postcode === homeAddress.postcode &&
        this.existingMember.home_address.supplement === homeAddress.supplement &&
        this.existingMember.home_address.city === homeAddress.city
      ) {
        homeAddress.id = this.existingMember.home_address.id;
      }
    }
    let billingAddress: AddressDTO = homeAddress;
    const sameAddressChecked = Array.isArray(addressValue.same_address)
      ? addressValue.same_address.length > 0
      : Boolean(addressValue.same_address);
    if (!sameAddressChecked) {
      billingAddress = {
        id: -1,
        street: addressValue.billing_address_street ?? '',
        number: addressValue.billing_address_number ? +addressValue.billing_address_number : 1,
        postcode: addressValue.billing_address_postcode ?? '',
        supplement: addressValue.billing_address_supplement ?? '',
        city: addressValue.billing_address_city ?? '',
      };
    }
    let status = 1;
    if (this.existingMember) {
      status = this.existingMember.status;
      if (
        this.existingMember.home_address.street == homeAddress.street &&
        this.existingMember.home_address.number == homeAddress.number &&
        this.existingMember.home_address.postcode == homeAddress.postcode &&
        this.existingMember.home_address.supplement == homeAddress.supplement &&
        this.existingMember.home_address.city == homeAddress.city
      ) {
        homeAddress.id = this.existingMember.home_address.id;
      }
      if (
        this.existingMember.billing_address.street == billingAddress.street &&
        this.existingMember.billing_address.number == billingAddress.number &&
        this.existingMember.billing_address.postcode == billingAddress.postcode &&
        this.existingMember.billing_address.supplement == billingAddress.supplement &&
        this.existingMember.billing_address.city == billingAddress.city
      ) {
        billingAddress.id = this.existingMember.billing_address.id;
      }
    }
    const formValue = this.formData.getRawValue() as MemberFormValue;
    let manager: CreateManagerDTO | undefined = undefined;
    if (this.gestionnaire) {
      manager = {
        NRN: formValue.NRN_manager ?? '',
        name: formValue.name_manager ?? '',
        surname: formValue.surname_manager ?? '',
        email: formValue.email_manager ?? '',
        phone_number: formValue.phone_manager ?? '',
      };
    }
    const ibanValue = (this.ibanForm.getRawValue() as IbanFormValue).iban;
    const socialRateValue = Array.isArray(formValue.socialRate)
      ? formValue.socialRate.length > 0
      : Boolean(formValue.socialRate);
    if (this.typeClient === -1) {
      return;
    }
    const memberToAdd: CreateMemberDTO = {
      NRN: formValue.id,
      billing_address: billingAddress,
      email: formValue.email ?? '',
      first_name: formValue.name,
      home_address: homeAddress,
      iban: ibanValue,
      member_type: this.typeClient,
      phone_number: formValue.phone ?? '',
      social_rate: socialRateValue,
      status: status,
      vat_number: formValue.vatNumber ?? '',
      name: formValue.surname ?? '',
      manager: manager,
    };
    if (this.typeClient === MemberType.COMPANY) {
      // Individuals
      if (manager === undefined) {
        return;
      }
    }
    if (this.existingMember) {
      const memberToUpdate: UpdateMemberDTO = {
        id: this.existingMember.id,
        ...memberToAdd,
      };
      this.membersService.updateMember(memberToUpdate).subscribe({
        next: (response) => {
          // this.ref.close(response)
          if (response) {
            this.ref.close(2);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error: unknown) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
        },
      });
    } else {
      this.membersService.addMember(memberToAdd).subscribe({
        next: (response) => {
          if (response) {
            this.ref.close(1);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error: unknown) => {
          const errorData = error instanceof ApiResponse ? (error.data as string) : null;
          this.errorHandler.handleError(errorData);
        },
      });
    }
  }

  updateGestionnaire(value: boolean): void {
    this.gestionnaire = value;
    if (this.gestionnaire) {
      this.formData.addControl(
        'NRN_manager',
        new FormControl('', [Validators.required, numRegistreBeValidator]),
      );
      this.formData.addControl('name_manager', new FormControl('', [Validators.required]));
      this.formData.addControl('surname_manager', new FormControl('', [Validators.required]));
      this.formData.addControl(
        'email_manager',
        new FormControl('', [Validators.required, Validators.email]),
      );
      this.formData.addControl('phone_manager', new FormControl('', [Validators.required]));
      if (this.existingMember) {
        if (this.existingMember.manager) {
          this.formData.patchValue({
            NRN_manager: this.existingMember.manager.NRN,
            name_manager: this.existingMember.manager.name,
            surname_manager: this.existingMember.manager.surname,
            email_manager: this.existingMember.manager.email,
            phone_manager: this.existingMember.manager.phone_number,
          });
        }
      }
    } else {
      // Check if formData has the fields
      if (this.formData.contains('NRN_manager')) {
        this.formData.removeControl('NRN_manager');
        this.formData.removeControl('name_manager');
        this.formData.removeControl('surname_manager');
        this.formData.removeControl('email_manager');
        this.formData.removeControl('phone_manager');
      }
    }
  }

  gestionnaireChange($event: CheckboxChangeEvent): void {
    const c = ($event as { checked: unknown }).checked;
    const value = Array.isArray(c) ? c.length > 0 : Boolean(c);
    this.updateGestionnaire(value);
  }

  toggleSameAddress(event: CheckboxChangeEvent): void {
    console.log('THIS EVENT : ', event);
    const addressValue = this.addressForm.getRawValue() as AddressFormValue;
    const sameSelected = Array.isArray(addressValue.same_address)
      ? Boolean(addressValue.same_address[0])
      : Boolean(addressValue.same_address);
    if (sameSelected) {
      // Remove billing address from form
      this.addressForm.removeControl('billing_address_street');
      this.addressForm.removeControl('billing_address_number');
      this.addressForm.removeControl('billing_address_postcode');
      this.addressForm.removeControl('billing_address_supplement');
      this.addressForm.removeControl('billing_address_city');
    } else {
      this.addressForm.addControl('billing_address_street', new FormControl(''));
      this.addressForm.addControl('billing_address_number', new FormControl(''));
      this.addressForm.addControl('billing_address_postcode', new FormControl(''));
      this.addressForm.addControl('billing_address_supplement', new FormControl(''));
      this.addressForm.addControl('billing_address_city', new FormControl(''));
    }
  }

  protected readonly MemberType = MemberType;
}
