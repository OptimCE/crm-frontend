import {Component, Input, OnInit} from '@angular/core';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ErrorHandlerComponent} from '../../../../shared/components/error.handler/error.handler.component';
import {TranslatePipe} from '@ngx-translate/core';
import {DatePicker} from 'primeng/datepicker';
import {Button} from 'primeng/button';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {MeterService} from '../../../../shared/services/meter.service';
import {ErrorMessageHandler} from '../../../../shared/services-ui/error.message.handler';

@Component({
  selector: 'app-meter-deactivation',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ErrorHandlerComponent, TranslatePipe, DatePicker, Button],
  templateUrl: './meter-deactivation.html',
  styleUrl: './meter-deactivation.css',
})
export class MeterDeactivation implements OnInit {
  @Input()
  ean: string;
  deleteForm!: FormGroup;
  minDate = new Date();
  calendarOpen: boolean;

  constructor(
    private config: DynamicDialogConfig,
    private meterService: MeterService,
    private ref: DynamicDialogRef,
    private errorHandler: ErrorMessageHandler,
  ) {
    this.ean = this.config.data.ean;
    this.calendarOpen = false;
  }

  ngOnInit(): void {

    this.deleteForm = new FormGroup({
      date: new FormControl('', [Validators.required]),
    });
  }

  // onSubmit() {
  //   if (this.deleteForm.invalid) {
  //     return;
  //   }
  //   this.meterService.postDeactivateMeters(this.ean, this.deleteForm.value.date).subscribe(
  //     {
  //       next:(response)=>
  //       {
  //         if (response && response.success) {
  //           this.ref.close(true);
  //         } else {
  //           this.errorHandler.handleError(response);
  //         }
  //       },
  //       error:(error) => {
  //         this.errorHandler.handleError(error);
  //       },
  //     }
  //   );
  // }
}
