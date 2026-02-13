import {Component, EventEmitter, inject, Input, OnInit, Output} from '@angular/core';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { InputText } from 'primeng/inputtext';
import { Button, ButtonLabel } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ErrorAdded } from '../../../../../../shared/types/error.types';

@Component({
  selector: 'app-new-member-banking-info',
  imports: [
    ReactiveFormsModule,
    ErrorHandlerComponent,
    InputText,
    Button,
    ButtonLabel,
    Ripple,
    TranslatePipe,
  ],
  templateUrl: './new-member-banking-info.html',
  styleUrl: './new-member-banking-info.css',
})
export class NewMemberBankingInfo implements OnInit {
  private translate = inject(TranslateService);
  @Input() ibanForm!: FormGroup;
  @Output() backClicked = new EventEmitter<void>();
  @Output() formSubmitted = new EventEmitter<void>();
  ibanErrorAdded: ErrorAdded = {};


  ngOnInit() {
    this.setupErrorTranslation();
  }

  setupErrorTranslation() {
    this.translate.get(['MEMBER.ADD.BANK.ERROR.IBAN']).subscribe((translation) => {
      this.ibanErrorAdded = {
        invalidIban: () => translation['MEMBER.ADD.BANK.ERROR.IBAN'],
      };
    });
  }

  goBack() {
    this.backClicked.emit();
  }

  submit() {
    if (this.ibanForm.valid) {
      this.formSubmitted.emit();
    }
  }
}
