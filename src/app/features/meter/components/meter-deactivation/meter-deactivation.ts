import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { DatePicker } from 'primeng/datepicker';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { MeterService } from '../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ErrorHandlerComponent } from '../../../../shared/components/error.handler/error.handler.component';
import { ApiResponse } from '../../../../core/dtos/api.response';
import { toLocalDateString } from '../../../../shared/utils/date.utils';

interface MeterDeactivationDialogData {
  ean: string;
}

@Component({
  selector: 'app-meter-deactivation',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePicker,
    Button,
    TranslatePipe,
    ErrorHandlerComponent,
  ],
  templateUrl: './meter-deactivation.html',
  styleUrl: './meter-deactivation.css',
})
export class MeterDeactivation {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private meterService = inject(MeterService);
  private errorHandler = inject(ErrorMessageHandler);

  readonly ean: string;
  readonly minDate = new Date();
  readonly deleteForm = new FormGroup({
    date: new FormControl('', [Validators.required]),
  });

  constructor() {
    const data = this.config.data as MeterDeactivationDialogData;
    this.ean = data.ean;
  }

  onSubmit(): void {
    if (this.deleteForm.invalid) {
      this.deleteForm.markAllAsTouched();
      return;
    }
    const date = toLocalDateString(this.deleteForm.getRawValue().date as unknown as Date);
    this.meterService.deactivateMeter(this.ean, date).subscribe({
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
