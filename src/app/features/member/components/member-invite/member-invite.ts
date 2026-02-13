import {Component, inject, OnInit} from '@angular/core';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { InputText } from 'primeng/inputtext';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-member-invite',
  imports: [Button, TranslatePipe, InputText, ReactiveFormsModule],
  templateUrl: './member-invite.html',
  styleUrl: './member-invite.css',
})
export class MemberInvite implements OnInit {
  private ref = inject(DynamicDialogRef)
  form!: FormGroup;


  ngOnInit() {
    this.form = new FormGroup({
      email: new FormControl('', [Validators.required]),
    });
  }

  inviteMember() {
    if (this.form.invalid) {
      return;
    }
    this.ref.close(this.form.value.email);
  }
}
