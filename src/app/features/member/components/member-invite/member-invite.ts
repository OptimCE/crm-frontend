import { Component, inject, OnInit } from '@angular/core';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { InputText } from 'primeng/inputtext';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

interface MemberInviteForm {
  email: string;
}

@Component({
  selector: 'app-member-invite',
  imports: [Button, TranslatePipe, InputText, ReactiveFormsModule],
  templateUrl: './member-invite.html',
  styleUrl: './member-invite.css',
})
export class MemberInvite implements OnInit {
  private ref = inject(DynamicDialogRef);
  form!: FormGroup;

  ngOnInit(): void {
    this.form = new FormGroup({
      email: new FormControl('', [Validators.required]),
    });
  }

  inviteMember(): void {
    if (this.form.invalid) {
      return;
    }
    const formValue = this.form.getRawValue() as MemberInviteForm;
    this.ref.close(formValue.email);
  }
}
