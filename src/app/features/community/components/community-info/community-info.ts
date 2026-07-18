import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Tag } from 'primeng/tag';
import { Select } from 'primeng/select';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { switchMap } from 'rxjs';

import { Role } from '../../../../core/dtos/role';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { RegulatorStore } from '../../../../core/services/regulator.store';
import { CommunityService } from '../../../../shared/services/community.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { CommunityDetailDTO, MyCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { CreateAddressDTO } from '../../../../shared/dtos/address.dtos';
import { ibanValidator } from '../../../../shared/validators/iban.validator';

/** Wallonia-only default applied when a community has no regulator yet. */
const DEFAULT_REGULATOR = 'BE-WAL-CWAPE';

interface CommunityUpdatePayload {
  name?: string;
  description?: string | null;
  website_url?: string | null;
  regulator?: string;
  headquarters_address?: CreateAddressDTO;
  vat_number?: string | null;
  legal_name?: string | null;
  iban?: string | null;
  account_holder_name?: string | null;
}

interface AddressFormValue {
  street: string;
  number: number | null;
  city: string;
  postcode: string;
  supplement: string;
}

interface CommunityInfoFormValue {
  name: string;
  description: string;
  website_url: string;
  regulator: string;
  headquarters_address: AddressFormValue;
  vat_number: string;
  legal_name: string;
  iban: string;
  account_holder_name: string;
}

/**
 * Address sub-group is valid when either every required field is filled or every field is empty.
 * Mixed (partial) state surfaces as a `partialAddress` error.
 */
function partialAddressValidator(group: AbstractControl): ValidationErrors | null {
  const value = group.value as Partial<AddressFormValue> | null;
  if (!value) return null;
  const required: (keyof AddressFormValue)[] = ['street', 'number', 'city', 'postcode'];
  const filled = required.filter((key) => {
    const v = value[key];
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
  if (filled.length === 0 || filled.length === required.length) return null;
  return { partialAddress: true };
}

@Component({
  selector: 'app-community-info',
  standalone: true,
  imports: [
    Button,
    Card,
    InputText,
    Textarea,
    Tag,
    Select,
    ConfirmDialog,
    ReactiveFormsModule,
    TranslatePipe,
    HeaderPage,
  ],
  templateUrl: './community-info.html',
  styleUrl: './community-info.css',
  providers: [ErrorMessageHandler, ConfirmationService],
})
export class CommunityInfo {
  protected userContextService = inject(UserContextService);
  private communityService = inject(CommunityService);
  private regulatorStore = inject(RegulatorStore);
  private confirmationService = inject(ConfirmationService);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  /** Active regulators with localized labels, for the dropdown. */
  readonly regulatorOptions = signal<{ code: string; label: string }[]>([]);

  readonly community = signal<CommunityDetailDTO | null>(null);
  readonly loading = signal<boolean>(false);
  readonly editMode = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly selectedFile = signal<File | null>(null);
  readonly logoPreview = signal<string | null>(null);

  readonly canEdit = computed(() => this.userContextService.compareWithActiveRole(Role.ADMIN));

  readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string>('', { nonNullable: true }),
    website_url: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.pattern(/^https?:\/\/[^\s]+$/i)],
    }),
    regulator: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    headquarters_address: new FormGroup(
      {
        street: new FormControl<string>('', { nonNullable: true }),
        number: new FormControl<number | null>(null),
        city: new FormControl<string>('', { nonNullable: true }),
        postcode: new FormControl<string>('', { nonNullable: true }),
        supplement: new FormControl<string>('', { nonNullable: true }),
      },
      { validators: partialAddressValidator },
    ),
    vat_number: new FormControl<string>('', { nonNullable: true }),
    legal_name: new FormControl<string>('', { nonNullable: true }),
    iban: new FormControl<string>('', { nonNullable: true, validators: [ibanValidator()] }),
    account_holder_name: new FormControl<string>('', { nonNullable: true }),
  });

  protected readonly Role = Role;

  constructor() {
    this.loadCommunity();
    this.regulatorStore
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildRegulatorOptions());
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildRegulatorOptions());
  }

  private buildRegulatorOptions(): void {
    this.regulatorOptions.set(
      this.regulatorStore.activeRegulators().map((r) => ({
        code: r.code,
        label: this.translate.instant('REGULATORS.' + r.code) as string,
      })),
    );
  }

  loadCommunity(): void {
    this.loading.set(true);
    const activeOrgId = this.userContextService.activeCommunityId();
    if (!activeOrgId) {
      this.loading.set(false);
      return;
    }
    this.communityService
      .getMyCommunities({ page: 1, limit: 100 })
      .pipe(
        switchMap((response) => {
          const list = (response.data as MyCommunityDTO[]) ?? [];
          const match = list.find((c) => c.auth_community_id === activeOrgId);
          if (!match) {
            throw new Error('Active community not found in user memberships');
          }
          return this.communityService.getCommunityDetail(match.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response: ApiResponse<CommunityDetailDTO>) => {
          this.community.set(response.data);
          this.resetForm();
          this.loading.set(false);
        },
        error: (error) => {
          this.errorHandler.handleError(error);
          this.loading.set(false);
        },
      });
  }

  enterEdit(): void {
    if (!this.canEdit()) return;
    this.resetForm();
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
    this.selectedFile.set(null);
    this.logoPreview.set(null);
    this.resetForm();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.selectedFile.set(null);
      this.logoPreview.set(null);
      return;
    }
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () =>
      this.logoPreview.set(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }

  save(): void {
    if (!this.canEdit() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.buildUpdatePayload();
    const current = this.community()?.regulator;
    // Changing the regulator re-points billing + administrative documents: confirm first.
    if (payload.regulator && current && payload.regulator !== current) {
      this.confirmationService.confirm({
        header: this.translate.instant('COMMUNITY_INFO.REGULATOR_CHANGE_CONFIRM_TITLE') as string,
        message: this.translate.instant(
          'COMMUNITY_INFO.REGULATOR_CHANGE_CONFIRM_MESSAGE',
        ) as string,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: this.translate.instant('COMMON.ACTIONS.VALIDATE') as string,
        rejectLabel: this.translate.instant('COMMON.ACTIONS.CANCEL') as string,
        accept: () => this.performSave(payload),
      });
      return;
    }
    this.performSave(payload);
  }

  private performSave(payload: CommunityUpdatePayload): void {
    this.saving.set(true);
    const file = this.selectedFile();
    const upload$ = file ? this.communityService.uploadLogo(file) : null;
    const finishUpdate = () => {
      this.communityService
        .updateCommunity(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.editMode.set(false);
            this.selectedFile.set(null);
            this.logoPreview.set(null);
            this.loadCommunity();
          },
          error: (error) => {
            this.errorHandler.handleError(error);
            this.saving.set(false);
          },
        });
    };
    if (upload$) {
      upload$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: finishUpdate,
        error: (error) => {
          this.errorHandler.handleError(error);
          this.saving.set(false);
        },
      });
    } else {
      finishUpdate();
    }
  }

  removeLogo(): void {
    if (!this.canEdit()) return;
    this.communityService
      .deleteLogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadCommunity(),
        error: (error) => this.errorHandler.handleError(error),
      });
  }

  private resetForm(): void {
    const c = this.community();
    if (!c) {
      this.form.reset();
      return;
    }
    const addr = c.headquarters_address;
    this.form.reset({
      name: c.name ?? '',
      description: c.description ?? '',
      website_url: c.website_url ?? '',
      regulator: c.regulator ?? DEFAULT_REGULATOR,
      headquarters_address: {
        street: addr?.street ?? '',
        number: addr?.number ?? null,
        city: addr?.city ?? '',
        postcode: addr?.postcode ?? '',
        supplement: addr?.supplement ?? '',
      },
      vat_number: c.vat_number ?? '',
      legal_name: c.legal_name ?? '',
      iban: c.iban ?? '',
      account_holder_name: c.account_holder_name ?? '',
    });
  }

  private buildUpdatePayload(): CommunityUpdatePayload {
    const value = this.form.getRawValue() as CommunityInfoFormValue;
    const legalName = value.legal_name?.trim() || null;
    const accountHolder = value.account_holder_name?.trim() || null;
    const payload: CommunityUpdatePayload = {
      name: value.name?.trim(),
      description: value.description?.trim() || null,
      website_url: value.website_url?.trim() || null,
      regulator: value.regulator,
      vat_number: value.vat_number?.trim() || null,
      legal_name: legalName,
      // Persist the IBAN canonically: no spaces, upper-cased.
      iban: value.iban?.replace(/\s+/g, '').toUpperCase() || null,
      // "Bank name" = account holder name: only stored when it differs from the
      // legal name. If it matches (case-insensitive), we don't persist it.
      account_holder_name:
        accountHolder && accountHolder.toLowerCase() === (legalName ?? '').toLowerCase()
          ? null
          : accountHolder,
    };
    const a = value.headquarters_address;
    if (a.street && a.number !== null && a.city && a.postcode) {
      payload.headquarters_address = {
        street: a.street.trim(),
        number: a.number,
        city: a.city.trim(),
        postcode: a.postcode.trim(),
        supplement: a.supplement?.trim() || undefined,
      };
    }
    return payload;
  }

  /** Used by the template to display the partialAddress error consistently. */
  protected hasPartialAddressError(): boolean {
    const group = this.form.controls.headquarters_address;
    return group.touched && !!group.errors?.['partialAddress'];
  }

  /** Reads the current preview (newly selected) or the persisted presigned URL. */
  protected logoSource(): string | null {
    return this.logoPreview() ?? this.community()?.logo_presigned_url ?? null;
  }

  /** Display a friendly translation token for the active role. */
  protected roleLabelFor(role: string | null | undefined): string {
    switch (role) {
      case Role.ADMIN:
        return this.translate.instant('COMMON.ROLE.ADMIN') as string;
      case Role.GESTIONNAIRE:
        return this.translate.instant('COMMON.ROLE.MANAGER') as string;
      case Role.MEMBER:
        return this.translate.instant('COMMON.ROLE.MEMBER') as string;
      default:
        return '';
    }
  }
}
