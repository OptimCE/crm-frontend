import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Ripple } from 'primeng/ripple';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Card } from 'primeng/card';
import { Avatar } from 'primeng/avatar';
import { Tooltip } from 'primeng/tooltip';
import { UserService } from '../../../../shared/services/user.service';
import { UserDTO } from '../../../../shared/dtos/user.dtos';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { UserUpdateDialog } from './user-update-dialog/user-update-dialog';
import { ProfileTabs } from './profile-tabs/profile-tabs';

@Component({
  selector: 'app-profile',
  imports: [
    Skeleton,
    Button,
    TranslatePipe,
    Ripple,
    Card,
    Avatar,
    Tooltip,
    AddressPipe,
    TranslateModule,
    ProfileTabs,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  standalone: true,
  providers: [DialogService],
})
export class Profile {
  private dialogService = inject(DialogService);
  private translateService = inject(TranslateService);
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly hasError = signal<boolean>(false);
  protected readonly user = signal<UserDTO | null>(null);
  protected readonly userInitials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return ((u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '')).toUpperCase() || '?';
  });
  private ref?: DynamicDialogRef | null;

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
    this.loadUser();
  }

  protected loadUser(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.userService
      .getUserInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.user.set(response.data as UserDTO);
          }
          this.isLoading.set(false);
        },
        error: (_error) => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  updateMember(): void {
    this.ref = this.dialogService.open(UserUpdateDialog, {
      header: this.translateService.instant('PROFILE.UPDATE_PROFILE.TITLE') as string,
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '40rem',
      breakpoints: { '960px': '90vw' },
      data: {
        user: this.user(),
      },
    });
    this.ref?.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response: boolean) => {
      if (response) {
        this.loadUser();
      }
    });
  }
}
