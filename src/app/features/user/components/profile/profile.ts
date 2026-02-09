import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import { Button } from 'primeng/button';
import {ProgressSpinner, ProgressSpinnerModule} from 'primeng/progressspinner';
import {TranslateModule, TranslatePipe, TranslateService} from '@ngx-translate/core';
import { Ripple } from 'primeng/ripple';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Card} from "primeng/card";
import {UserService} from '../../../../shared/services/user.service';
import {UserDTO} from '../../../../shared/dtos/user.dtos';
import {AddressPipe} from '../../../../shared/pipes/address/address-pipe';
@Component({
  selector: 'app-profile',
  imports: [
    ProgressSpinner,
    Button,
    TranslatePipe,
    Ripple,
    Card,
    AddressPipe,
    TranslateModule
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  standalone: true,
  providers: [DialogService]
})
export class Profile implements OnInit, OnDestroy {
  private dialogService = inject(DialogService);
  private translateService = inject(TranslateService);
  private userService = inject(UserService);
  protected isLoading = signal<boolean>(false)
  protected user = signal<UserDTO|null>(null);
  ref?: DynamicDialogRef<any> | null
  ngOnInit() {
    this.loadUser();
  }

  private loadUser() {
    this.isLoading.set(true);
    this.userService.getUserInfo().subscribe({
      next: (response)=>{
        if(response && response.data){
          this.user.set(response.data as UserDTO);
          this.isLoading.set(false);
        }
      },
      error: error => {
        this.isLoading.set(false);
      }
    })
  }

  ngOnDestroy() {
    this.ref?.destroy();
  }

  updateMember() {

  }
}
