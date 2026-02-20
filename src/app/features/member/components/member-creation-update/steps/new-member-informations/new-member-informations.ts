import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { ErrorHandlerComponent } from '../../../../../../shared/components/error.handler/error.handler.component';
import { InputText } from 'primeng/inputtext';
import { Checkbox, CheckboxChangeEvent } from 'primeng/checkbox';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormErrorSummaryComponent } from '../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ErrorAdded, ErrorSummaryAdded } from '../../../../../../shared/types/error.types';
import { MemberType } from '../../../../../../shared/types/member.types';

@Component({
  selector: 'app-new-member-informations',
  imports: [
    ReactiveFormsModule,
    ErrorHandlerComponent,
    InputText,
    Checkbox,
    TranslatePipe,
    FormErrorSummaryComponent,
    Button,
    Ripple,
  ],
  templateUrl: './new-member-informations.html',
  styleUrl: './new-member-informations.css',
})
export class NewMemberInformations implements OnInit {
  private translate = inject(TranslateService);
  @Input() form!: FormGroup;
  @Input() typeClient!: number;
  @Input() gestionnaire: boolean = false;

  @Output() backClicked = new EventEmitter<void>();
  @Output() formSubmitted = new EventEmitter<void>();
  @Output() gestionnaireChangeEvent = new EventEmitter<CheckboxChangeEvent>();
  idErrorAdded: ErrorAdded = {};
  errorsSummaryAdded: ErrorSummaryAdded = {};

  ngOnInit(): void {
    this.setupErrorTranslation();
  }

  goBack(): void{
    this.backClicked.emit();
  }

  setupErrorTranslation(): void{
    this.translate
      .get(['MEMBER.ADD.INFORMATIONS.ERROR.SOCIAL_SECURITY_NUMBER'])
      .subscribe((translation: Record<string, string>) => {
        this.idErrorAdded = {
          invalidNumReg: () => translation['MEMBER.ADD.INFORMATIONS.ERROR.SOCIAL_SECURITY_NUMBER'],
        };
        this.errorsSummaryAdded = {
          invalidNumReg: (_: unknown, _controlName: string) =>
            translation['MEMBER.ADD.INFORMATIONS.ERROR.SOCIAL_SECURITY_NUMBER'],
        };
      });
  }

  submit(): void {
    console.log(this.form)
    console.log(this.form.valid)
    if (this.form.valid) {
      this.formSubmitted.emit();
    }else{
      this.form.markAsTouched()
    }
  }

  gestionnaireChange($event: CheckboxChangeEvent): void {
    this.gestionnaireChangeEvent.emit($event);
  }

  protected readonly MemberType = MemberType;
}
