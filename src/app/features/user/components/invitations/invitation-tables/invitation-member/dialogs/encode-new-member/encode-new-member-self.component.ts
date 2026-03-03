import { AfterViewInit, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';

import { Step, StepList, StepPanel, StepPanels, Stepper } from 'primeng/stepper';
import { TranslatePipe } from '@ngx-translate/core';
import { NewMemberAddressSelfEncoding } from './steps/new-member-address/new-member-address-self-encoding.component';
import { NewMemberBankingInfoSelfEncoding } from './steps/new-member-banking-info/new-member-banking-info-self-encoding.component';
import { NewMemberInformationsSelfEncoding } from './steps/new-member-informations/new-member-informations-self-encoding.component';
import { NewMemberTypeSelfEncoding } from './steps/new-member-type/new-member-type-self-encoding.component';
import { ErrorMessageHandler } from '../../../../../../../../shared/services-ui/error.message.handler';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CreateManagerDTO, CreateMemberDTO } from '../../../../../../../../shared/dtos/member.dtos';
import { ibanValidator } from '../../../../../../../member/components/member-creation-update/iban.validator';
import { numRegistreBeValidator } from '../../../../../../../member/components/member-creation-update/num_registre_nat_be.validator';
import { AddressDTO } from '../../../../../../../../shared/dtos/address.dtos';
import { CheckboxChangeEvent } from 'primeng/checkbox';
import { MemberType } from '../../../../../../../../shared/types/member.types';
import { InvitationService } from '../../../../../../../../shared/services/invitation.service';

interface EncodeNewMemberDialogData {
  invitationID: number;
}

interface EncodeMemberFormValue {
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

interface EncodeMemberAddressFormValue {
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
  selector: 'app-encode-new-member',
  imports: [
    NewMemberAddressSelfEncoding,
    NewMemberBankingInfoSelfEncoding,
    NewMemberInformationsSelfEncoding,
    NewMemberTypeSelfEncoding,
    Step,
    StepList,
    StepPanel,
    StepPanels,
    Stepper,
    TranslatePipe,
  ],
  templateUrl: './encode-new-member-self.component.html',
  styleUrl: './encode-new-member-self.component.css',
  providers: [ErrorMessageHandler],
})
export class EncodeNewMemberSelfComponent implements OnInit, AfterViewInit {
  private invitationService = inject(InvitationService);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private cdr = inject(ChangeDetectorRef);
  typeClient: MemberType | -1 = -1;
  formData!: FormGroup;
  addressForm!: FormGroup;
  ibanForm!: FormGroup;
  gestionnaire: boolean = false;
  invitationID!: number;

  ngOnInit(): void {
    const data = this.config.data as EncodeNewMemberDialogData;
    if (!data || !data.invitationID) {
      this.ref.close(false);
      return;
    }
    this.invitationID = data.invitationID;
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
    this.formData = new FormGroup({});
  }

  ngAfterViewInit(): void {
    this.cdr.markForCheck(); // Force change detection once content is rendered
  }

  buildFormGroup(): void {
    console.log('BUILD FORM GROUP');
    if (this.typeClient === MemberType.INDIVIDUAL) {
      this.formData = new FormGroup({
        id: new FormControl('', [
          Validators.required,
          // numRegistreBeValidator
        ]),
        name: new FormControl('', [Validators.required]),
        surname: new FormControl('', [Validators.required]),
        email: new FormControl('', [Validators.required, Validators.email]),
        phone: new FormControl('', [Validators.required]),
        socialRate: new FormControl(false, [Validators.required]),
      });
    } else if (this.typeClient === MemberType.COMPANY) {
      this.formData = new FormGroup({
        id: new FormControl('', [Validators.required]),
        name: new FormControl('', [Validators.required]),
        vatNumber: new FormControl('', [Validators.required]),
      });
    }
    this.updateGestionnaire(this.typeClient === MemberType.COMPANY);
    // this.formData = new FormGroup({
    //   id: new FormControl('', [Validators.required]),
    //   name: new FormControl('', [Validators.required]),
    // });
    // if (this.typeClient === MemberType.INDIVIDUAL) {
    //   // this.formData.controls['id'].addValidators([
    //   //   numRegistreBeValidator
    //   // ]);
    //   // Build form group for individuals
    //   this.formData.addControl('surname', new FormControl('', [Validators.required]));
    //   this.formData.addControl(
    //     'email',
    //     new FormControl('', [Validators.required, Validators.email]),
    //   );
    //   this.formData.addControl('phone', new FormControl('', [Validators.required]));
    //   this.formData.addControl('socialRate', new FormControl(false, [Validators.required]));
    // } else if (this.typeClient === MemberType.COMPANY) {
    //   this.formData.addControl('vatNumber', new FormControl('', [Validators.required]));
    // }
    // this.updateGestionnaire(this.typeClient === MemberType.COMPANY);
  }

  onTypeClientChange(type: MemberType | -1): void {
    this.typeClient = type;
    if (type !== -1) {
      this.buildFormGroup();
    }
  }

  submitForm1(activateCallback: (step: number) => void): void {
    if (this.typeClient !== -1) {
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

    const addressFormValue = this.addressForm.getRawValue() as EncodeMemberAddressFormValue;
    const formDataValue = this.formData.getRawValue() as EncodeMemberFormValue;
    const ibanFormValue = this.ibanForm.getRawValue() as { iban: string };

    const homeAddress: AddressDTO = {
      id: -1,
      street: addressFormValue.home_address_street,
      number: +addressFormValue.home_address_number,
      postcode: addressFormValue.home_address_postcode,
      supplement: addressFormValue.home_address_supplement,
      city: addressFormValue.home_address_city,
    };

    let billingAddress: AddressDTO = homeAddress;
    const sameAddress = Array.isArray(addressFormValue.same_address)
      ? addressFormValue.same_address.length > 0
      : !!addressFormValue.same_address;

    if (!sameAddress) {
      billingAddress = {
        id: -1,
        street: addressFormValue.billing_address_street ?? '',
        number: addressFormValue.billing_address_number
          ? +addressFormValue.billing_address_number
          : 1,
        postcode: addressFormValue.billing_address_postcode ?? '',
        supplement: addressFormValue.billing_address_supplement ?? '',
        city: addressFormValue.billing_address_city ?? '',
      };
    }
    const status = 1;
    let manager: CreateManagerDTO | undefined = undefined;
    if (this.gestionnaire) {
      manager = {
        NRN: formDataValue.NRN_manager ?? '',
        name: formDataValue.name_manager ?? '',
        surname: formDataValue.surname_manager ?? '',
        email: formDataValue.email_manager ?? '',
        phone_number: formDataValue.phone_manager ?? '',
      };
    }

    const socialRate = Array.isArray(formDataValue.socialRate)
      ? formDataValue.socialRate.length > 0
      : !!formDataValue.socialRate;
    if (this.typeClient === -1) {
      return;
    }
    const memberToAdd: CreateMemberDTO = {
      NRN: formDataValue.id,
      billing_address: billingAddress,
      email: formDataValue.email ?? '',
      first_name: formDataValue.name,
      home_address: homeAddress,
      iban: ibanFormValue.iban,
      member_type: this.typeClient,
      phone_number: formDataValue.phone ?? '',
      social_rate: socialRate,
      status: status,
      vat_number: formDataValue.vatNumber ?? '',
      name: formDataValue.surname ?? '',
      manager: manager,
    };
    if (this.typeClient === MemberType.COMPANY) {
      // Individuals
      if (manager === undefined) {
        return;
      }
    }
    this.invitationService
      .acceptInvitationMemberEncoded({ invitation_id: this.invitationID, member: memberToAdd })
      .subscribe({
        next: (response) => {
          if (response) {
            this.ref.close(response.data);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error: { data?: unknown }) => {
          this.errorHandler.handleError(error.data ?? null);
        },
      });
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
    const value = Array.isArray($event.checked) ? $event.checked.length > 0 : !!$event.checked;
    this.updateGestionnaire(value);
  }

  toggleSameAddress(event: CheckboxChangeEvent): void {
    console.log('THIS EVENT : ', event);
    const addressFormValue = this.addressForm.getRawValue() as EncodeMemberAddressFormValue;
    const isSameAddress = Array.isArray(addressFormValue.same_address)
      ? addressFormValue.same_address[0]
      : !!addressFormValue.same_address;

    if (isSameAddress) {
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
