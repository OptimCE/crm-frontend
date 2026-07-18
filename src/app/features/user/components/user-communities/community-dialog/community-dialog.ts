import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
import { RegulatorStore } from '../../../../../core/services/regulator.store';

/** Wallonia-only default preselected in the create form. */
const DEFAULT_REGULATOR = 'BE-WAL-CWAPE';

@Component({
  selector: 'app-community-dialog',
  imports: [
    Button,
    InputText,
    Select,
    TranslatePipe,
    FormsModule,
    InputTextModule,
    ReactiveFormsModule,
  ],
  templateUrl: './community-dialog.html',
  styleUrl: './community-dialog.css',
})
export class CommunityDialog implements OnInit {
  private ref = inject(DynamicDialogRef);
  private communityService = inject(CommunityService);
  private regulatorStore = inject(RegulatorStore);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;

  /** Active regulators with localized labels, for the dropdown. */
  readonly regulatorOptions = signal<{ code: string; label: string }[]>([]);

  ngOnInit(): void {
    this.form = new FormGroup({
      new_name: new FormControl('', [Validators.required]),
      regulator: new FormControl(DEFAULT_REGULATOR, [Validators.required]),
    });
    this.regulatorStore
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildRegulatorOptions());
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildRegulatorOptions());
  }

  private buildRegulatorOptions(): void {
    this.regulatorOptions.set(
      this.regulatorStore.activeRegulators().map((r) => ({
        code: r.code,
        label: this.translate.instant('REGULATORS.' + r.code) as string,
      })),
    );
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.getRawValue() as { new_name: string; regulator: string };
      this.communityService
        .createCommunity({ name: formValue.new_name, regulator: formValue.regulator })
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
