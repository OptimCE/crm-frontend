import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
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
export class NewMemberBankingInfoSelfEncoding implements OnInit {
  private translate = inject(TranslateService);
  @Input() ibanForm!: FormGroup;
  @Output() backClicked = new EventEmitter<void>();
  @Output() formSubmitted = new EventEmitter<void>();
  ibanErrorAdded: ErrorAdded = {};

  ngOnInit(): void {
    this.setupErrorTranslation();
  }

  setupErrorTranslation(): void {
    this.translate.get(['MEMBER.ADD.BANK.ERROR.IBAN']).subscribe((translation: Record<string, string>) => {
      this.ibanErrorAdded = {
        invalidIban: () => translation['MEMBER.ADD.BANK.ERROR.IBAN'],
      };
    });
  }

  goBack(): void {
    this.backClicked.emit();
  }

  submit(): void {
    if (this.ibanForm.valid) {
      this.formSubmitted.emit();
    }
  }
}
