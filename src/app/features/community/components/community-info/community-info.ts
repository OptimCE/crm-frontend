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
import { switchMap } from 'rxjs';

import { Role } from '../../../../core/dtos/role';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { CommunityService } from '../../../../shared/services/community.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { CommunityDetailDTO, MyCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { CreateAddressDTO } from '../../../../shared/dtos/address.dtos';

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
  headquarters_address: AddressFormValue;
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
  imports: [Button, Card, InputText, Textarea, Tag, ReactiveFormsModule, TranslatePipe, HeaderPage],
  templateUrl: './community-info.html',
  styleUrl: './community-info.css',
  providers: [ErrorMessageHandler],
})
export class CommunityInfo {
  protected userContextService = inject(UserContextService);
  private communityService = inject(CommunityService);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

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
  });

  protected readonly Role = Role;

  constructor() {
    this.loadCommunity();
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
    this.saving.set(true);
    const file = this.selectedFile();
    const upload$ = file ? this.communityService.uploadLogo(file) : null;
    const finishUpdate = () => {
      this.communityService
        .updateCommunity(this.buildUpdatePayload())
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
      headquarters_address: {
        street: addr?.street ?? '',
        number: addr?.number ?? null,
        city: addr?.city ?? '',
        postcode: addr?.postcode ?? '',
        supplement: addr?.supplement ?? '',
      },
    });
  }

  private buildUpdatePayload(): {
    name?: string;
    description?: string | null;
    website_url?: string | null;
    headquarters_address?: CreateAddressDTO;
  } {
    const value = this.form.getRawValue() as CommunityInfoFormValue;
    const payload: {
      name?: string;
      description?: string | null;
      website_url?: string | null;
      headquarters_address?: CreateAddressDTO;
    } = {
      name: value.name?.trim(),
      description: value.description?.trim() || null,
      website_url: value.website_url?.trim() || null,
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
