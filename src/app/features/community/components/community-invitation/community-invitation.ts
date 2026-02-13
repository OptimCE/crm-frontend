import {Component, OnInit} from '@angular/core';
import {ErrorHandlerComponent} from '../../../../shared/components/error.handler/error.handler.component';
import {InputTextModule} from 'primeng/inputtext';
import {PaginatorModule} from 'primeng/paginator';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Button} from 'primeng/button';
import {TranslateModule} from '@ngx-translate/core';
import {DynamicDialogRef} from 'primeng/dynamicdialog';

@Component({
  selector: 'app-community-invitation',
  standalone: true,
  imports: [ErrorHandlerComponent, InputTextModule, PaginatorModule, ReactiveFormsModule, Button, TranslateModule],
  templateUrl: './community-invitation.html',
  styleUrl: './community-invitation.css',
})
export class CommunityInvitation implements OnInit {
  form!: FormGroup;
  constructor(private ref: DynamicDialogRef) { }

  ngOnInit(): void {
    this.form = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
    });
  }

  onSubmit() {
    if (this.form.valid) {
      this.ref.close(this.form.value.email);
    }
  }
}
