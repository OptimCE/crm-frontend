import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  standalone: true,
  providers: [DialogService],
})
export class Profile implements OnInit, OnDestroy {
  private dialogService = inject(DialogService);
  private translateService = inject(TranslateService);
  private userService = inject(UserService);
  protected isLoading = signal<boolean>(false);
  protected user = signal<UserDTO | null>(null);
  ref?: DynamicDialogRef | null;
  ngOnInit(): void {
    this.loadUser();
  }

  private loadUser(): void {
    this.isLoading.set(true);
    this.userService.getUserInfo().subscribe({
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

  ngOnDestroy(): void {
    this.ref?.destroy();
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
    this.ref?.onClose.subscribe((response: boolean) => {
      if (response) {
        this.loadUser();
      }
    });
  }
}
