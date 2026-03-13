import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InputText } from 'primeng/inputtext';
import { Button, ButtonLabel } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ErrorHandlerComponent } from '../../../../../../../../../../shared/components/error.handler/error.handler.component';
import { ErrorAdded } from '../../../../../../../../../../shared/types/error.types';

@Component({
  selector: 'app-new-member-banking-info-self-encoding',
  imports: [
    ReactiveFormsModule,
    ErrorHandlerComponent,
    InputText,
    Button,
    ButtonLabel,
    Ripple,
    TranslatePipe,
  ],
  templateUrl: './new-member-banking-info-self-encoding.component.html',
  styleUrl: './new-member-banking-info-self-encoding.component.css',
})
export class NewMemberBankingInfoSelfEncoding {
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  readonly ibanForm = input.required<FormGroup>();
  readonly backClicked = output<void>();
  readonly formSubmitted = output<void>();
  readonly ibanErrorAdded = signal<ErrorAdded>({});

  constructor() {
    this.setupErrorTranslation();
  }

  setupErrorTranslation(): void {
    this.translate
      .get(['MEMBER.ADD.BANK.ERROR.IBAN'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.ibanErrorAdded.set({
          invalidIban: () => translation['MEMBER.ADD.BANK.ERROR.IBAN'],
        });
      });
  }

  goBack(): void {
    this.backClicked.emit();
  }

  submit(): void {
    if (this.ibanForm().valid) {
      this.formSubmitted.emit();
    }
  }
}
