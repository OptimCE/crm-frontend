import {Component, OnInit} from '@angular/core';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {TranslatePipe} from '@ngx-translate/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import {CommunityService} from '../../../../../shared/services/community.service';

@Component({
  selector: 'app-community-dialog',
  imports: [
    Button,
    InputText,
    TranslatePipe,
    FormsModule, InputTextModule, ReactiveFormsModule
  ],
  templateUrl: './community-dialog.html',
  styleUrl: './community-dialog.css',
})
export class CommunityDialog implements OnInit{
  form!: FormGroup;
  constructor(private ref: DynamicDialogRef,
              private communityService: CommunityService) {}
  ngOnInit(): void {
    this.form = new FormGroup({
      new_name: new FormControl('', [Validators.required]),
    });
  }
  onSubmit() {
    if (this.form.valid) {
      this.communityService.createCommunity({name: this.form.value.new_name}).subscribe({
        next: (response)=>{
          this.ref.close(true);
        },
        error: (error)=>{
          // TODO Handle error
        }
      })
    }
  }
}
