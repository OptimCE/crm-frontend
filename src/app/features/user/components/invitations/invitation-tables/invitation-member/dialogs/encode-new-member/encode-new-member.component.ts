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
  templateUrl: './encode-new-member.component.html',
  styleUrl: './encode-new-member.component.css',
  providers: [ErrorMessageHandler],
})
export class EncodeNewMemberComponent implements OnInit, AfterViewInit {
  private invitationService = inject(InvitationService);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private cdr = inject(ChangeDetectorRef);
  typeClient: number = -1;
  formData!: FormGroup;
  addressForm!: FormGroup;
  ibanForm!: FormGroup;
  gestionnaire: boolean = false;
  invitationID!: number;

  ngOnInit(): void {
    if (!this.config.data || !this.config.data.invitationID) {
      this.ref.close(false);
    }
    this.invitationID = this.config.data.invitationID;
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
  }

  ngAfterViewInit() {
    this.cdr.markForCheck(); // Force change detection once content is rendered
  }

  buildFormGroup() {
    this.formData = new FormGroup({
      id: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
    });
    if (this.typeClient == 1) {
      this.formData.controls['id'].addValidators([numRegistreBeValidator]);
      // Build form group for individuals
      this.formData.addControl('surname', new FormControl('', [Validators.required]));
      this.formData.addControl(
        'email',
        new FormControl('', [Validators.required, Validators.email]),
      );
      this.formData.addControl('phone', new FormControl('', [Validators.required]));
      this.formData.addControl('socialRate', new FormControl(false, [Validators.required]));
    } else if (this.typeClient == 2) {
      this.formData.addControl('vatNumber', new FormControl('', [Validators.required]));
    }
    this.updateGestionnaire(this.typeClient == 2);
  }

  submitForm1(nextCallback: any) {
    if (this.typeClient != -1) {
      this.buildFormGroup();
      nextCallback.emit();
    }
  }

  submitForm2(nextCallback: any) {
    if (this.formData.valid) {
      nextCallback.emit();
    }
  }

  submitForm3(nextCallback: any) {
    if (this.addressForm.valid) {
      nextCallback.emit();
    }
  }

  onSubmitEnd() {
    if (this.ibanForm.invalid) {
      return;
    }
    const homeAddress: AddressDTO = {
      id: -1,
      street: this.addressForm.value.home_address_street,
      number: this.addressForm.value.home_address_number,
      postcode: this.addressForm.value.home_address_postcode,
      supplement: this.addressForm.value.home_address_supplement,
      city: this.addressForm.value.home_address_city,
    };

    let billingAddress: AddressDTO = homeAddress;
    if (this.addressForm.value.same_address.length == 0) {
      billingAddress = {
        id: -1,
        street: this.addressForm.value.billing_address_street,
        number: this.addressForm.value.billing_address_number,
        postcode: this.addressForm.value.billing_address_postcode,
        supplement: this.addressForm.value.billing_address_supplement,
        city: this.addressForm.value.billing_address.city,
      };
    }
    let status = 1;
    let manager: CreateManagerDTO | undefined = undefined;
    if (this.gestionnaire) {
      manager = {
        NRN: this.formData.value.NRN_manager,
        name: this.formData.value.name_manager,
        surname: this.formData.value.surname_manager,
        email: this.formData.value.email_manager,
        phone_number: this.formData.value.phone_manager,
      };
    }
    // let memberToAdd: IndividualDTO | CompanyDTO;
    const memberToAdd: CreateMemberDTO = {
      NRN: this.formData.value.id,
      billing_address: billingAddress,
      email: this.formData.value.email,
      first_name: this.formData.value.name,
      home_address: homeAddress,
      iban: this.ibanForm.value.iban,
      member_type: this.typeClient,
      phone_number: this.formData.value.phone,
      social_rate: this.formData.value.socialRate && this.formData.value.socialRate.length > 0,
      status: status,
      vat_number: this.formData.value.vatNumber,
      name: this.formData.value.surname,
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
        error: (error) => {
          this.errorHandler.handleError(error.data ? error.data : null);
        },
      });
  }

  updateGestionnaire(value: boolean) {
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

  gestionnaireChange($event: CheckboxChangeEvent) {
    const value = $event.checked.length > 0;
    this.updateGestionnaire(value);
  }

  toggleSameAddress(event: CheckboxChangeEvent) {
    console.log('THIS EVENT : ', event);
    console.log(this.addressForm.value.same_address);
    if (this.addressForm.value.same_address[0]) {
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
