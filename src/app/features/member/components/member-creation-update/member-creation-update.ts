import {AfterViewInit, ChangeDetectorRef, Component, inject, OnInit} from '@angular/core';
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
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private cdr = inject(ChangeDetectorRef);
  typeClient: number = -1;
  formData!: FormGroup;
  addressForm!: FormGroup;
  ibanForm!: FormGroup;
  gestionnaire: boolean = false;
  existingMember?: IndividualDTO | CompanyDTO;


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
    } else if (this.typeClient == 2) {
      this.formData.addControl('vatNumber', new FormControl('', [Validators.required]));
      if (this.existingMember) {
        this.formData.patchValue({
          id: (this.existingMember as CompanyDTO).vat_number,
          name: (this.existingMember as CompanyDTO).name,
          vatNumber: (this.existingMember as CompanyDTO).vat_number,
        });
      }
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
    if (this.existingMember) {
      if (
        this.existingMember.home_address.street == homeAddress.street &&
        this.existingMember.home_address.number == homeAddress.number &&
        this.existingMember.home_address.postcode == homeAddress.postcode &&
        this.existingMember.home_address.supplement == homeAddress.supplement &&
        this.existingMember.home_address.city == homeAddress.city
      ) {
        homeAddress.id = this.existingMember.home_address.id;
      }
    }
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
    if (this.existingMember) {
      const memberToUpdate: UpdateMemberDTO = {
        id: this.existingMember.id,
        ...memberToAdd,
      };
      this.membersService.updateMember(memberToUpdate).subscribe({
        next: (response) => {
          // this.ref.close(response)
          if (response) {
            this.ref.close(true);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error.data ? error.data : null);
        },
      });
    } else {
      this.membersService.addMember(memberToAdd).subscribe({
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
