import {Component, inject, Input, OnInit} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-meter-deactivation',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './meter-deactivation.html',
  styleUrl: './meter-deactivation.css',
})
export class MeterDeactivation implements OnInit {
  private config = inject(DynamicDialogConfig);

  @Input()
  ean: string;
  deleteForm!: FormGroup;
  calendarOpen: boolean;

  constructor(
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
