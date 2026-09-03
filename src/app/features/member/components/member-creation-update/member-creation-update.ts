import { Component, inject, OnInit, signal, computed } from '@angular/core';
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
import { ibanValidator } from '../../../../shared/validators/iban.validator';
import { numRegistreBeValidator } from './num_registre_nat_be.validator';
import { AddressDTO } from '../../../../shared/dtos/address.dtos';
import { Step, StepList, StepPanel, StepPanels, Stepper } from 'primeng/stepper';
import { NewMemberType } from './steps/new-member-type/new-member-type';
import { NewMemberInformations } from './steps/new-member-informations/new-member-informations';
import { NewMemberAddress } from './steps/new-member-address/new-member-address';
import { NewMemberBankingInfo } from './steps/new-member-banking-info/new-member-banking-info';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { AddressPicked } from '../../../../shared/components/address-autocomplete/address-autocomplete';
import {
  prefixedAddressNames,
  readAddressFields,
} from '../../../../shared/components/address-autocomplete/address-field-source';
import {
  AddressPickStore,
  withPickedGeo,
} from '../../../../shared/components/address-autocomplete/address-pick-store';

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
export class MemberCreationUpdate implements OnInit {
  protected readonly homeAddressSource = computed(() => ({
    group: this.addressForm,
    names: prefixedAddressNames('home_address'),
  }));
  protected readonly billingAddressSource = computed(() => ({
    group: this.addressForm,
    names: prefixedAddressNames('billing_address'),
  }));
  protected readonly homePick = new AddressPickStore();
  protected readonly billingPick = new AddressPickStore();

  protected onHomeAddressPicked(event: AddressPicked): void {
    this.patchPickedAddress('home_address', event);
    this.homePick.remember(event);
  }

  protected onBillingAddressPicked(event: AddressPicked): void {
    this.patchPickedAddress('billing_address', event);
    this.billingPick.remember(event);
  }

  private patchPickedAddress(prefix: string, event: AddressPicked): void {
    // patchValue, not setValue: the billing controls are REMOVED from this form
    // when "same address" is ticked, and patchValue tolerates that.
    this.addressForm.patchValue({
      [`${prefix}_street`]: event.fields.street,
      [`${prefix}_number`]: event.fields.number,
      [`${prefix}_postcode`]: event.fields.postcode,
      [`${prefix}_city`]: event.fields.city,
    });
  }
  private membersService = inject(MemberService);
  private config =
    inject<DynamicDialogConfig<{ member: IndividualDTO | CompanyDTO }>>(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  readonly typeClient = signal<MemberType | -1>(-1);
  formData!: FormGroup;
  addressForm!: FormGroup;
  ibanForm!: FormGroup;
  readonly gestionnaire = signal<boolean>(false);
  readonly existingMember = signal<IndividualDTO | CompanyDTO | undefined>(undefined);
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
      iban: new FormControl('', [Validators.required, ibanValidator()]),
    });
    if (this.config.data && this.config.data.member) {
      this.existingMember.set(this.config.data.member);
      const member = this.existingMember();
      if (member) {
        this.typeClient.set(member.member_type);
        this.buildFormGroup();
        this.addressForm.patchValue({
          home_address_street: member.home_address.street,
          home_address_number: member.home_address.number,
          home_address_postcode: member.home_address.postcode,
          home_address_supplement: member.home_address.supplement,
          home_address_city: member.home_address.city,
          billing_address_street: member.billing_address.street,
          billing_address_number: member.billing_address.number,
          billing_address_postcode: member.billing_address.postcode,
          billing_address_supplement: member.billing_address.supplement,
          billing_address_city: member.billing_address.city,
        });
        this.ibanForm.patchValue({
          iban: member.iban,
        });
      }
    }
  }

  buildFormGroup(): void {
    this.formData = new FormGroup({
      id: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
    });
    if (this.typeClient() === MemberType.INDIVIDUAL) {
      this.formData.controls['id'].addValidators([numRegistreBeValidator()]);
      // Build form group for individuals
      this.formData.addControl('surname', new FormControl('', [Validators.required]));
      this.formData.addControl(
        'email',
        new FormControl('', [Validators.required, Validators.email]),
      );
      this.formData.addControl('phone', new FormControl('', [Validators.required]));
      this.formData.addControl('socialRate', new FormControl(false, [Validators.required]));
      if (this.existingMember()) {
        this.formData.patchValue({
          id: (this.existingMember() as IndividualDTO).NRN,
          name: (this.existingMember() as IndividualDTO).first_name,
          surname: (this.existingMember() as IndividualDTO).name,
          email: (this.existingMember() as IndividualDTO).email,
          phone: (this.existingMember() as IndividualDTO).phone_number,
          socialRate: (this.existingMember() as IndividualDTO).social_rate,
        });
      }
    } else if (this.typeClient() === MemberType.COMPANY) {
      this.formData.addControl('vatNumber', new FormControl('', [Validators.required]));
      if (this.existingMember()) {
        this.formData.patchValue({
          id: (this.existingMember() as CompanyDTO).vat_number,
          name: (this.existingMember() as CompanyDTO).name,
          vatNumber: (this.existingMember() as CompanyDTO).vat_number,
        });
      }
    }
    this.updateGestionnaire(this.typeClient() === MemberType.COMPANY);
  }
  onTypeClientChange(type: MemberType | -1): void {
    this.typeClient.set(type);
    if (type !== -1) {
      this.buildFormGroup();
    }
  }
  submitForm1(activateCallback: (step: number) => void): void {
    if (this.typeClient() !== -1) {
      activateCallback(1);
    }
  }
  submitForm2(activateCallback: (step: number) => void): void {
    if (this.formData.valid) {
      // nextCallback.emit();
      activateCallback(2);
    }
  }

  submitForm3(activateCallback: (step: number) => void): void {
    if (this.addressForm.valid) {
      // nextCallback.emit();
      activateCallback(3);
    }
  }

  onSubmitEnd(): void {
    if (this.ibanForm.invalid) {
      return;
    }
    const addressValue = this.addressForm.getRawValue() as AddressFormValue;
    // `geoFor` yields null the moment the form no longer matches what was
    // picked, so a stale rooftop coordinate cannot reach the payload.
    const homeAddress: AddressDTO = withPickedGeo(
      {
        id: -1,
        street: addressValue.home_address_street,
        number: addressValue.home_address_number,
        postcode: addressValue.home_address_postcode,
        supplement: addressValue.home_address_supplement,
        city: addressValue.home_address_city,
      },
      this.homePick.geoFor(readAddressFields(this.homeAddressSource())),
    );
    const existing = this.existingMember();
    if (existing) {
      if (
        existing.home_address.street === homeAddress.street &&
        existing.home_address.number === homeAddress.number &&
        existing.home_address.postcode === homeAddress.postcode &&
        existing.home_address.supplement === homeAddress.supplement &&
        existing.home_address.city === homeAddress.city
      ) {
        homeAddress.id = existing.home_address.id;
      }
    }
    let billingAddress: AddressDTO = homeAddress;
    const sameAddressChecked = Array.isArray(addressValue.same_address)
      ? addressValue.same_address.length > 0
      : Boolean(addressValue.same_address);
    if (!sameAddressChecked) {
      billingAddress = withPickedGeo(
        {
          id: -1,
          street: addressValue.billing_address_street ?? '',
          number: addressValue.billing_address_number ?? '',
          postcode: addressValue.billing_address_postcode ?? '',
          supplement: addressValue.billing_address_supplement ?? '',
          city: addressValue.billing_address_city ?? '',
        },
        this.billingPick.geoFor(readAddressFields(this.billingAddressSource())),
      );
    }
    let status = 1;
    if (existing) {
      status = existing.status;
      if (
        existing.home_address.street == homeAddress.street &&
        existing.home_address.number == homeAddress.number &&
        existing.home_address.postcode == homeAddress.postcode &&
        existing.home_address.supplement == homeAddress.supplement &&
        existing.home_address.city == homeAddress.city
      ) {
        homeAddress.id = existing.home_address.id;
      }
      if (
        existing.billing_address.street == billingAddress.street &&
        existing.billing_address.number == billingAddress.number &&
        existing.billing_address.postcode == billingAddress.postcode &&
        existing.billing_address.supplement == billingAddress.supplement &&
        existing.billing_address.city == billingAddress.city
      ) {
        billingAddress.id = existing.billing_address.id;
      }
    }
    const formValue = this.formData.getRawValue() as MemberFormValue;
    let manager: CreateManagerDTO | undefined = undefined;
    if (this.gestionnaire()) {
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
    const typeClient = this.typeClient();

    if (typeClient === -1) {
      return;
    }

    const isCompany = typeClient === MemberType.COMPANY;

    const memberToAdd: CreateMemberDTO = {
      NRN: formValue.id,
      billing_address: billingAddress,
      email: formValue.email ?? '',
      first_name: isCompany ? '' : formValue.name,
      home_address: homeAddress,
      iban: ibanValue,
      member_type: typeClient,
      phone_number: formValue.phone ?? '',
      social_rate: socialRateValue,
      status: status,
      vat_number: formValue.vatNumber ?? '',
      name: isCompany ? formValue.name : (formValue.surname ?? ''),
      manager: manager,
    };
    if (this.typeClient() === MemberType.COMPANY) {
      // Individuals
      if (manager === undefined) {
        return;
      }
    }
    const existingForUpdate = this.existingMember();
    if (existingForUpdate) {
      const memberToUpdate: UpdateMemberDTO = {
        id: existingForUpdate.id,
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
    this.gestionnaire.set(value);
    if (this.gestionnaire()) {
      this.formData.addControl(
        'NRN_manager',
        new FormControl('', [Validators.required, numRegistreBeValidator()]),
      );
      this.formData.addControl('name_manager', new FormControl('', [Validators.required]));
      this.formData.addControl('surname_manager', new FormControl('', [Validators.required]));
      this.formData.addControl(
        'email_manager',
        new FormControl('', [Validators.required, Validators.email]),
      );
      this.formData.addControl('phone_manager', new FormControl('', [Validators.required]));
      const memberForManager = this.existingMember();
      if (memberForManager?.manager) {
        this.formData.patchValue({
          NRN_manager: memberForManager.manager.NRN,
          name_manager: memberForManager.manager.name,
          surname_manager: memberForManager.manager.surname,
          email_manager: memberForManager.manager.email,
          phone_manager: memberForManager.manager.phone_number,
        });
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

  toggleSameAddress(_event: CheckboxChangeEvent): void {
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
      // Re-add WITH the validators the initial form definition gives them.
      // Without them, tick-then-untick left the billing address optional and an
      // empty one reached the API.
      this.addressForm.addControl(
        'billing_address_street',
        new FormControl('', Validators.required),
      );
      this.addressForm.addControl(
        'billing_address_number',
        new FormControl('', Validators.required),
      );
      this.addressForm.addControl(
        'billing_address_postcode',
        new FormControl('', Validators.required),
      );
      this.addressForm.addControl('billing_address_supplement', new FormControl(''));
      this.addressForm.addControl('billing_address_city', new FormControl('', Validators.required));
    }
  }

  protected readonly MemberType = MemberType;
}
