import {Component, OnInit} from '@angular/core';
import {ConsumerDTO, IterationDTO, KeyDTO} from '../../../../../shared/dtos/key.dtos';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EventBusService} from '../../../../../core/services/event_bus/eventbus.service';
import {Router} from '@angular/router';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {InputNumber} from 'primeng/inputnumber';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {RadioButton} from 'primeng/radiobutton';
import {ErrorHandlerComponent} from '../../../../../shared/components/error.handler/error.handler.component';
import {Textarea} from 'primeng/textarea';
import {SnackbarNotification} from '../../../../../shared/services-ui/snackbar.notifcation.service';
import {ERROR_TYPE} from '../../../../../core/dtos/notification';
import {DialogService} from 'primeng/dynamicdialog';

@Component({
  selector: 'app-key-creation-step-by-step',
  standalone: true,
  imports: [
    TranslatePipe,
    InputNumber,
    Button,
    ReactiveFormsModule,
    InputText,
    RadioButton,
    ErrorHandlerComponent,
    Textarea
  ],
  templateUrl: './key-creation-step-by-step.html',
  styleUrl: './key-creation-step-by-step.css',
  providers: [DialogService]
})
export class KeyCreationStepByStep implements OnInit {
  formFirstStep!: FormGroup;
  secondStep = false;
  nbConsumers = -1;

  formSecondStep!: FormGroup;
  consumers: ConsumerDTO[] = [];
  displayIterations = [false, false, false];
  displayEnd = false;
  formIterations: FormGroup[] = [];
  iterations: IterationDTO[] = [];
  lastIteration = -1;
  numberIterations: number[] = [];
  displayErrorInj = false;
  lastForm!: FormGroup;
  constructor(
    private eventBus: EventBusService,
    private router: Router,
    private translate: TranslateService,
    private snackbar: SnackbarNotification
  ) {}

  ngOnInit() {
    this.formFirstStep = new FormGroup({
      nb_consumers: new FormControl('', [Validators.required, Validators.min(1)]),
    });
    this.lastForm = new FormGroup({
      key_name: new FormControl('', [Validators.required]),
      key_description: new FormControl('', [Validators.required]),
    });
  }

  submitFirstForm() {
    if (this.formFirstStep.valid) {
      if (!this.secondStep) {
        this.nbConsumers = this.formFirstStep.value.nb_consumers;
        this.formSecondStep = new FormGroup({});
        for (let i = 0; i < this.nbConsumers; i++) {
          this.formSecondStep.addControl('consumer_name_' + i, new FormControl('', [Validators.required]));
        }
        this.secondStep = true;
      } else {
        if (this.nbConsumers != this.formFirstStep.value.nb_consumers) {
          if (this.nbConsumers < this.formFirstStep.value.nb_consumers) {
            // Add missing ones
            for (let i = this.nbConsumers; i < this.formFirstStep.value.nb_consumers; i++) {
              this.formSecondStep.addControl('consumer_name_' + i, new FormControl('', [Validators.required]));
            }
          } else {
            // Remove the excedent
            for (let i = this.nbConsumers; i > this.formFirstStep.value.nb_consumers; i--) {
              this.formSecondStep.removeControl('consumer_name_' + (i - 1));
            }
            if (this.iterations.length > 0) {
              // Splice consumers
              const difference = this.nbConsumers - this.formFirstStep.value.nb_consumers;

              this.consumers.splice(this.consumers.length - difference - 1, difference);
              for (let i = 0; i < this.iterations.length; i++) {
                const type = this.formIterations[i].value.type;
                this.iterations[i] = this.computeIteration(type, this.formIterations[i].value.inj_percentage, i + 1);
              }
            }
          }
          this.nbConsumers = this.formFirstStep.value.nb_consumers;
        }
      }
    }
  }
  get controls() {
    return Object.keys(this.formSecondStep.controls);
  }

  submitSecondForm() {
    if (!this.formFirstStep.valid) {
      this.formFirstStep.markAllAsTouched(); // Show errors
      this.snackbar.openSnackBar(this.translate.instant('KEY.ERRORS.FIRST_STEP_ERROR'), ERROR_TYPE);
      return;
    }
    this.submitFirstForm();
    this.formSecondStep.markAllAsTouched();
    if (this.formSecondStep.valid) {
      // Creation of consumers
      this.consumers = [];
      for (let i = 0; i < this.nbConsumers; i++) {
        this.consumers.push({
          id: -1,
          name: this.formSecondStep.get('consumer_name_' + i)?.value,
          energy_allocated_percentage: -1
        })
      }
      if (this.formIterations.length == 0) {
        this.formIterations.push(
          new FormGroup({
            type: new FormControl('', [Validators.required]),
            inj_percentage: new FormControl('', [Validators.required]),
          }),
        );
        this.numberIterations.push(this.lastIteration++);
        this.displayIterations[0] = true;
      } else {
        // Update the iterations with the new consumers set
        for (let i = 0; i < this.iterations.length; i++) {
          this.iterations[i] = this.computeIteration(this.formIterations[i].value.type, this.formIterations[i].value.inj_percentage, i + 1);
        }
      }
    }
  }

  getSumOfIter() {
    let sumInj = 0;
    for (let i = 0; i < this.iterations.length; i++) {
      sumInj += this.iterations[i].energy_allocated_percentage;
    }
    return sumInj;
  }

  computeIteration(type: number, inj_percentage: number, number_iteration: number): IterationDTO {
    // Create a deep copy of consumers to avoid reference issues
    const newConsumers: ConsumerDTO[] = this.consumers.map(
      (con) => {
        return <ConsumerDTO>{
          id: con.id,
          name: con.name,
          energy_allocated_percentage: con.energy_allocated_percentage
        }
      }
    );

    if (type == 1) {
      // Prorata: Keep initial value (-1) to be computed later
      newConsumers.forEach((con) => (con.energy_allocated_percentage = -1));
    } else {
      // Egalitaire: Divide energy equally among consumers
      newConsumers.forEach((con) => (con.energy_allocated_percentage = 1.0 / newConsumers.length));
    }
    return {
      id: -1,
      number: number_iteration,
      consumers: newConsumers,
      energy_allocated_percentage: inj_percentage/100
    }
  }

  addIteration(index: number) {
    if (this.formIterations.length < 3) {
      this.formIterations.push(
        new FormGroup({
          type: new FormControl('', [Validators.required]),
          inj_percentage: new FormControl('', [Validators.required]),
        }),
      );
      this.displayIterations[index] = true;
    }
  }

  submitIteration() {
    if (!this.formFirstStep.valid) {
      this.formFirstStep.markAllAsTouched();
      this.snackbar.openSnackBar(this.translate.instant('KEY.ERRORS.FIRST_STEP_ERROR'), ERROR_TYPE);
      return;
    }
    this.submitFirstForm();

    if (!this.formSecondStep.valid) {
      this.formSecondStep.markAllAsTouched();
      this.snackbar.openSnackBar(this.translate.instant('KEY.ERRORS.SECOND_STEP_ERROR'), ERROR_TYPE);
      return;
    }
    this.submitSecondForm();
    for (const fIteration of this.formIterations) {
      if (fIteration.invalid) {
        return;
      }
    }

    for (let i = 0; i < this.formIterations.length; i++) {
      const type = this.formIterations[i].value.type;
      this.iterations[i] = this.computeIteration(type, this.formIterations[i].value.inj_percentage, i + 1);
    }

    const sumInj = this.getSumOfIter();
    this.displayErrorInj = false;
    if (sumInj >= 0.99 && sumInj <= 1.01) {
      this.displayEnd = true;
    } else if (sumInj > 1.01) {
      this.displayErrorInj = true;
    } else if (this.formIterations.length < 3) {
      this.addIteration(this.formIterations.length);
    } else {
      this.displayErrorInj = true;
    }
  }
  recalculateIterationDisplay() {
    this.displayEnd = this.getSumOfIter() >= 99 && this.getSumOfIter() <= 101;
  }
  deleteIteration(index: number) {
    if (this.formIterations.length > 1) {
      this.displayErrorInj = false;
      this.formIterations.splice(index, 1);
      this.iterations.splice(index, 1);
      this.displayIterations.splice(index, 1);
      this.recalculateIterationDisplay();
    }
  }

  submitKey() {
    if (!this.formFirstStep.valid) {
      this.formFirstStep.markAllAsTouched();
      this.snackbar.openSnackBar(this.translate.instant('KEY.ERRORS.FIRST_STEP_ERROR'), ERROR_TYPE);
      return;
    }
    this.submitFirstForm();

    if (!this.formSecondStep.valid) {
      this.formSecondStep.markAllAsTouched();
      this.snackbar.openSnackBar(this.translate.instant('KEY.ERRORS.SECOND_STEP_ERROR'), ERROR_TYPE);
      return;
    }
    this.submitSecondForm();
    for (const fIteration of this.formIterations) {
      if (fIteration.invalid) {
        fIteration.markAllAsTouched();
        return;
      }
    }

    this.submitIteration();

    if (this.lastForm.valid) {
      const key: KeyDTO = {id: -1, name: this.lastForm.value.key_name, description: this.lastForm.value.key_description, iterations: this.iterations}
      this.eventBus.emit('keyStepByStep', key);
      this.router.navigate(['/key/add']);
    }
  }
}
