import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InputText } from 'primeng/inputtext';
import { Checkbox, CheckboxChangeEvent } from 'primeng/checkbox';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ErrorHandlerComponent } from '../../../../../../../../../../shared/components/error.handler/error.handler.component';
import { FormErrorSummaryComponent } from '../../../../../../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import {
  ErrorAdded,
  ErrorSummaryAdded,
} from '../../../../../../../../../../shared/types/error.types';
import { MemberType } from '../../../../../../../../../../shared/types/member.types';

@Component({
  selector: 'app-new-member-informations-self-encoding',
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
  templateUrl: './new-member-informations-self-encoding.component.html',
  styleUrl: './new-member-informations-self-encoding.component.css',
})
export class NewMemberInformationsSelfEncoding {
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  readonly form = input.required<FormGroup>();
  readonly typeClient = input.required<number>();
  readonly gestionnaire = input<boolean>(false);

  readonly backClicked = output<void>();
  readonly formSubmitted = output<void>();
  readonly gestionnaireChangeEvent = output<CheckboxChangeEvent>();
  readonly idErrorAdded = signal<ErrorAdded>({});
  readonly errorsSummaryAdded = signal<ErrorSummaryAdded>({});

  constructor() {
    this.setupErrorTranslation();
  }

  goBack(): void {
    this.backClicked.emit();
  }

  setupErrorTranslation(): void {
    this.translate
      .get(['MEMBER.ADD.INFORMATIONS.ERROR.SOCIAL_SECURITY_NUMBER'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation: Record<string, string>) => {
        this.idErrorAdded.set({
          invalidNumReg: () => translation['MEMBER.ADD.INFORMATIONS.ERROR.SOCIAL_SECURITY_NUMBER'],
        });
        this.errorsSummaryAdded.set({
          invalidNumReg: (_: unknown, _controlName: string) =>
            translation['MEMBER.ADD.INFORMATIONS.ERROR.SOCIAL_SECURITY_NUMBER'],
        });
      });
  }

  submit(): void {
    console.log('Form submit');
    console.log(this.form().errors);
    if (this.form().valid) {
      console.log('Form submitted successfully');
      this.formSubmitted.emit();
    }
  }

  gestionnaireChange($event: CheckboxChangeEvent): void {
    this.gestionnaireChangeEvent.emit($event);
  }

  protected readonly MemberType = MemberType;
}
