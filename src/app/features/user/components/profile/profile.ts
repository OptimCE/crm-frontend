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
@Component({
  selector: 'app-profile',
  imports: [ProgressSpinner, Button, TranslatePipe, Ripple, Card, AddressPipe, TranslateModule],
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
  ref?: DynamicDialogRef<any> | null;
  ngOnInit() {
    this.loadUser();
  }

  private loadUser() {
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

  ngOnDestroy() {
    this.ref?.destroy();
  }

  updateMember() {
    this.ref = this.dialogService.open(UserUpdateDialog, {
      header: this.translateService.instant('PROFILE.UPDATE_PROFILE.TITLE'),
      modal: true,
      closable: true,
      closeOnEscape: true,
      data: {
        user: this.user,
      },
    });
    this.ref?.onClose.subscribe((response) => {
      if (response) {
        this.loadUser();
      }
    });
  }
}
