import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ErrorAdded } from '../../../../../../shared/types/error.types';

@Component({
  selector: 'app-new-member-banking-info',
  imports: [ReactiveFormsModule, ErrorHandlerComponent, InputText, Button, Ripple, TranslatePipe],
  templateUrl: './new-member-banking-info.html',
  styleUrl: './new-member-banking-info.css',
})
export class NewMemberBankingInfo implements OnInit {
  private translate = inject(TranslateService);
  readonly ibanForm = input.required<FormGroup>();
  readonly backClicked = output<void>();
  readonly formSubmitted = output<void>();
  readonly ibanErrorAdded = signal<ErrorAdded>({});

  ngOnInit(): void {
    this.setupErrorTranslation();
  }

  setupErrorTranslation(): void {
    this.translate
      .get(['MEMBER.ADD.BANK.ERROR.IBAN'])
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
