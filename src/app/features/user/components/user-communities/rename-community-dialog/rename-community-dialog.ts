import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { InputText, InputTextModule } from 'primeng/inputtext';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CommunityService } from '../../../../../shared/services/community.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { ApiResponse } from '../../../../../core/dtos/api.response';

/** Data passed by the opener so the field can be prefilled with the current name. */
interface RenameCommunityDialogData {
  currentName: string;
}

/**
 * Single-field dialog to rename the active community. The backend derives the target
 * community from the community-context header, so only the new name is sent.
 */
@Component({
  selector: 'app-rename-community-dialog',
  imports: [Button, InputText, TranslatePipe, FormsModule, InputTextModule, ReactiveFormsModule],
  templateUrl: './rename-community-dialog.html',
  styleUrl: './rename-community-dialog.css',
})
export class RenameCommunityDialog implements OnInit {
  private ref = inject(DynamicDialogRef);
  private config = inject(DynamicDialogConfig);
  private communityService = inject(CommunityService);
  private errorHandler = inject(ErrorMessageHandler);
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;

  ngOnInit(): void {
    const data = this.config.data as RenameCommunityDialogData | undefined;
    this.form = new FormGroup({
      name: new FormControl(data?.currentName ?? '', [Validators.required]),
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.getRawValue() as { name: string };
      this.communityService
        .updateCommunity({ name: formValue.name.trim() })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.ref.close(true);
          },
          error: (error: unknown) => {
            const errorData = error instanceof ApiResponse ? (error.data as string) : null;
            this.errorHandler.handleError(errorData);
          },
        });
    }
  }
}
