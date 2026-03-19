import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { CommunityService } from '../../../../../shared/services/community.service';

@Component({
  selector: 'app-community-dialog',
  imports: [Button, InputText, TranslatePipe, FormsModule, InputTextModule, ReactiveFormsModule],
  templateUrl: './community-dialog.html',
  styleUrl: './community-dialog.css',
})
export class CommunityDialog implements OnInit {
  private ref = inject(DynamicDialogRef);
  private communityService = inject(CommunityService);
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;

  ngOnInit(): void {
    this.form = new FormGroup({
      new_name: new FormControl('', [Validators.required]),
    });
  }
  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.getRawValue() as { new_name: string };
      this.communityService
        .createCommunity({ name: formValue.new_name })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (_response) => {
            this.ref.close(true);
          },
          error: (_error) => {
            // TODO Handle error
          },
        });
    }
  }
}
