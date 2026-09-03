import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Step, StepList, StepPanel, StepPanels, Stepper } from 'primeng/stepper';
import { TranslatePipe } from '@ngx-translate/core';
import { NewMemberAddress } from '../../../../../../../member/components/member-creation-update/steps/new-member-address/new-member-address';
import { NewMemberBankingInfo } from '../../../../../../../member/components/member-creation-update/steps/new-member-banking-info/new-member-banking-info';
import { NewMemberInformations } from '../../../../../../../member/components/member-creation-update/steps/new-member-informations/new-member-informations';
import { NewMemberType } from '../../../../../../../member/components/member-creation-update/steps/new-member-type/new-member-type';
import { ErrorMessageHandler } from '../../../../../../../../shared/services-ui/error.message.handler';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CreateManagerDTO, CreateMemberDTO } from '../../../../../../../../shared/dtos/member.dtos';
import { ibanValidator } from '../../../../../../../../shared/validators/iban.validator';
import { numRegistreBeValidator } from '../../../../../../../member/components/member-creation-update/num_registre_nat_be.validator';
import { AddressDTO } from '../../../../../../../../shared/dtos/address.dtos';
import { CheckboxChangeEvent } from 'primeng/checkbox';
import { MemberType } from '../../../../../../../../shared/types/member.types';
import { InvitationService } from '../../../../../../../../shared/services/invitation.service';
import { MeService } from '../../../../../../../../shared/services/me.service';
import { UserService } from '../../../../../../../../shared/services/user.service';
import { UserDTO } from '../../../../../../../../shared/dtos/user.dtos';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { buildProfilePrefill, countPatched, envelopeData } from './encode-new-member-prefill';
import { AddressPicked } from '../../../../../../../../shared/components/address-autocomplete/address-autocomplete';
import {
  prefixedAddressNames,
  readAddressFields,
} from '../../../../../../../../shared/components/address-autocomplete/address-field-source';
import {
  AddressPickStore,
  withPickedGeo,
} from '../../../../../../../../shared/components/address-autocomplete/address-pick-store';

interface EncodeNewMemberDialogData {
  invitationID: number;
}

/**
 * What the prefill banner is currently saying.
 *
 * `armed` is the state that exists only because of the wizard's shape: the
 * button sits above the stepper, so it is normally pressed on step 0 — before a
 * member type is chosen, which means before the step-1 controls exist and before
 * we know whether the address even applies. The profile is held until then.
 */
type PrefillState = 'idle' | 'loading' | 'armed' | 'applied' | 'empty' | 'error';

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
    Button,
    NewMemberAddress,
    NewMemberBankingInfo,
    NewMemberInformations,
    NewMemberType,
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
export class EncodeNewMemberSelfComponent implements OnInit {
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
  private invitationService = inject(InvitationService);
  private meService = inject(MeService);
  private userService = inject(UserService);
  private router = inject(Router);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);
  readonly typeClient = signal<MemberType | -1>(-1);
  formData!: FormGroup;
  addressForm!: FormGroup;
  ibanForm!: FormGroup;
  readonly gestionnaire = signal<boolean>(false);
  invitationID!: number;

  readonly prefillState = signal<PrefillState>('idle');
  readonly prefilledCount = signal<number>(0);
  private readonly profile = signal<UserDTO | null>(null);
  /**
   * What this dialog wrote, as `group:control` to the value written.
   *
   * The value matters, not just the key: a member-type switch rebuilds the
   * step-1 controls, and `id` and `name` exist for both types. Counting them
   * by name alone would keep counting a control that came back empty.
   */
  private readonly prefilled = new Map<string, string>();
  /** The address block is settled once; re-deciding would fight the user. */
  private addressApplied = false;

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
      iban: new FormControl('', [Validators.required, ibanValidator()]),
    });
    this.formData = new FormGroup({});
  }

  buildFormGroup(): void {
    if (this.typeClient() === MemberType.INDIVIDUAL) {
      this.formData = new FormGroup({
        id: new FormControl('', [Validators.required, numRegistreBeValidator()]),
        name: new FormControl('', [Validators.required]),
        surname: new FormControl('', [Validators.required]),
        email: new FormControl('', [Validators.required, Validators.email]),
        phone: new FormControl('', [Validators.required]),
        socialRate: new FormControl(false, [Validators.required]),
      });
    } else if (this.typeClient() === MemberType.COMPANY) {
      this.formData = new FormGroup({
        id: new FormControl('', [Validators.required]),
        name: new FormControl('', [Validators.required]),
        vatNumber: new FormControl('', [Validators.required]),
      });
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

    const addressFormValue = this.addressForm.getRawValue() as EncodeMemberAddressFormValue;
    const formDataValue = this.formData.getRawValue() as EncodeMemberFormValue;
    const ibanFormValue = this.ibanForm.getRawValue() as { iban: string };

    // `geoFor` yields null the moment the form no longer matches what was
    // picked, so a stale rooftop coordinate cannot reach the payload.
    const homeAddress: AddressDTO = withPickedGeo(
      {
        id: -1,
        street: addressFormValue.home_address_street,
        number: addressFormValue.home_address_number,
        postcode: addressFormValue.home_address_postcode,
        supplement: addressFormValue.home_address_supplement,
        city: addressFormValue.home_address_city,
      },
      this.homePick.geoFor(readAddressFields(this.homeAddressSource())),
    );

    let billingAddress: AddressDTO = homeAddress;
    const sameAddress = Array.isArray(addressFormValue.same_address)
      ? addressFormValue.same_address.length > 0
      : !!addressFormValue.same_address;

    if (!sameAddress) {
      billingAddress = withPickedGeo(
        {
          id: -1,
          street: addressFormValue.billing_address_street ?? '',
          number: addressFormValue.billing_address_number ?? '',
          postcode: addressFormValue.billing_address_postcode ?? '',
          supplement: addressFormValue.billing_address_supplement ?? '',
          city: addressFormValue.billing_address_city ?? '',
        },
        this.billingPick.geoFor(readAddressFields(this.billingAddressSource())),
      );
    }
    const status = 1;
    let manager: CreateManagerDTO | undefined = undefined;
    if (this.gestionnaire()) {
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
    const typeClient = this.typeClient();
    if (typeClient === -1) {
      return;
    }
    const memberToAdd: CreateMemberDTO = {
      NRN: formDataValue.id,
      billing_address: billingAddress,
      email: formDataValue.email ?? '',
      first_name: formDataValue.name,
      home_address: homeAddress,
      iban: ibanFormValue.iban,
      member_type: typeClient,
      phone_number: formDataValue.phone ?? '',
      social_rate: socialRate,
      status: status,
      vat_number: formDataValue.vatNumber ?? '',
      name: formDataValue.surname ?? '',
      manager: manager,
    };
    if (this.typeClient() === MemberType.COMPANY) {
      // Individuals
      if (manager === undefined) {
        return;
      }
    }
    this.meService
      .acceptInvitationMemberEncoded({ invitation_id: this.invitationID, member: memberToAdd })
      .pipe(takeUntilDestroyed(this.destroyRef))
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
    // The control set just changed. `buildFormGroup()` ends here too, so this is
    // the one place that has to re-apply the profile.
    this.applyPrefill();
  }

  /**
   * Fetch the signed-in user's profile and use it to fill the wizard.
   *
   * Opt-in: nothing is read or written until the user presses the button.
   */
  useMyProfile(): void {
    if (this.prefillState() === 'loading') {
      return;
    }
    this.prefillState.set('loading');
    this.userService
      .getUserInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const user = envelopeData<UserDTO>(response);
          if (!user) {
            this.prefillState.set('error');
            return;
          }
          this.profile.set(user);
          this.applyPrefill();
        },
        error: () => {
          this.prefillState.set('error');
        },
      });
  }

  /** Leave for the profile page so the user can fill in what is missing. */
  goToProfile(): void {
    this.ref.close(false);
    void this.router.navigate(['/users']);
  }

  /**
   * Copy whatever of the stored profile applies to the current member type.
   *
   * Safe to call repeatedly: it only ever writes into controls that are still
   * empty, so it can never overwrite something the user typed, and re-running it
   * after a type change simply fills the controls that were just created.
   */
  private applyPrefill(): void {
    const user = this.profile();
    if (!user) {
      return;
    }
    const type = this.typeClient();
    if (type === -1) {
      this.prefillState.set('armed');
      return;
    }

    const prefill = buildProfilePrefill(user, type, this.gestionnaire());

    // Settle the address question once, the first time we see a type that has
    // one. Re-deciding on every type change would put the checkbox back after
    // the user had unticked it.
    if (type === MemberType.INDIVIDUAL && !this.addressApplied) {
      if (prefill.sameAddress) {
        // The array shape is load-bearing: the checkbox is a non-binary
        // `p-checkbox [value]="true"`, whose view ticks only when the model
        // *contains* that value. A scalar `true` leaves the box looking
        // unticked while the form says otherwise.
        // Before patching: the toggle removes the billing controls, so the
        // billing half of the patch is then skipped as non-existent.
        this.addressForm.get('same_address')?.setValue([true]);
        this.toggleSameAddress({} as CheckboxChangeEvent);
      }
      this.addressApplied = true;
    }

    this.patchEmpty(this.formData, 'info', prefill.informations);
    this.patchEmpty(this.addressForm, 'address', prefill.address);
    if (prefill.iban !== null) {
      this.patchEmpty(this.ibanForm, 'iban', { iban: prefill.iban });
    }

    this.prefilledCount.set(this.countLivePrefilled());
    // Keyed on what the profile *offered*, not on what was written: a user who
    // had already typed everything gets nothing written, and telling them their
    // profile is empty would be wrong.
    this.prefillState.set(countPatched(prefill) > 0 ? 'applied' : 'empty');
  }

  /** Write `values` into `group`, skipping every control that already has one. */
  private patchEmpty(group: FormGroup, groupId: string, values: Record<string, string>): void {
    for (const [name, value] of Object.entries(values)) {
      const control = group.get(name);
      if (!control) {
        continue;
      }
      const current: unknown = control.value;
      if (typeof current === 'string' && current.trim() !== '') {
        continue;
      }
      control.setValue(value);
      // Surfaces the field error straight away when the profile holds something
      // the member form rejects — a malformed national number, say.
      control.markAsDirty();
      this.prefilled.set(`${groupId}:${name}`, value);
    }
  }

  /**
   * How many controls still hold the value this dialog put there.
   *
   * Recomputed rather than accumulated: switching member type destroys and
   * rebuilds the step-1 controls, so a running total would drift. Comparing the
   * value rather than the mere existence of the control is what stops a control
   * that came back empty — or that the user has since edited — from counting.
   */
  private countLivePrefilled(): number {
    const groups: Record<string, FormGroup> = {
      info: this.formData,
      address: this.addressForm,
      iban: this.ibanForm,
    };
    let total = 0;
    for (const [key, written] of this.prefilled) {
      const [groupId, name] = key.split(':');
      if (groups[groupId]?.get(name)?.value === written) {
        total++;
      }
    }
    return total;
  }

  gestionnaireChange($event: CheckboxChangeEvent): void {
    const value = Array.isArray($event.checked) ? $event.checked.length > 0 : !!$event.checked;
    this.updateGestionnaire(value);
  }

  toggleSameAddress(_event: CheckboxChangeEvent): void {
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
      // See member-creation-update.toggleSameAddress: the same defect, copied.
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
