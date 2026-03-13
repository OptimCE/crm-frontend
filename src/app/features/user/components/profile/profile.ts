import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Ripple } from 'primeng/ripple';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Card } from 'primeng/card';
import { UserService } from '../../../../shared/services/user.service';
import { UserDTO } from '../../../../shared/dtos/user.dtos';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { UserUpdateDialog } from './user-update-dialog/user-update-dialog';
import { ProfileTabs } from './profile-tabs/profile-tabs';
import { HeaderPage } from '../../../../layout/header-page/header-page';
@Component({
  selector: 'app-profile',
  imports: [
    ProgressSpinner,
    Button,
    TranslatePipe,
    Ripple,
    Card,
    AddressPipe,
    TranslateModule,
    ProfileTabs,
    HeaderPage,
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
  protected readonly user = signal<UserDTO | null>(null);
  private ref?: DynamicDialogRef | null;

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
    this.loadUser();
  }

  private loadUser(): void {
    this.isLoading.set(true);
    this.userService
      .getUserInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.user.set(response.data as UserDTO);
            this.isLoading.set(false);
          }
        },
        error: (_error) => {
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
