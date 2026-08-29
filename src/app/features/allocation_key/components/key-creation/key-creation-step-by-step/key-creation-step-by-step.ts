import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConsumerDTO, IterationDTO, KeyDTO } from '../../../../../shared/dtos/key.dtos';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EventBusService } from '../../../../../core/services/event_bus/eventbus.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InputNumber } from 'primeng/inputnumber';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { RadioButton } from 'primeng/radiobutton';
import { ErrorHandlerComponent } from '../../../../../shared/components/error.handler/error.handler.component';
import { Textarea } from 'primeng/textarea';
import { SnackbarNotification } from '../../../../../shared/services-ui/snackbar.notifcation.service';
import { ERROR_TYPE, VALIDATION_TYPE } from '../../../../../core/dtos/notification';
import { DialogService } from 'primeng/dynamicdialog';
import { Step, StepList, StepPanel, StepPanels, Stepper } from 'primeng/stepper';
import { Card } from 'primeng/card';
import { BackArrow } from '../../../../../layout/back-arrow/back-arrow';
import { ImportSharingOperationMeters } from '../../../../../shared/components/import-sharing-operation-meters/import-sharing-operation-meters';
import { sanitizeReturnUrl } from '../../../../../shared/utils/navigation.utils';
/** Where the participant list comes from at step 0. */
type ParticipantSource = 'manual' | 'operation';

interface FirstStepValue {
  nb_consumers: number;
}
type SecondStepValue = Record<`consumer_name_${number}`, string>;

interface LastFormValue {
  key_name: string;
  key_description: string;
}
interface IterationFormValue {
  type: number;
  inj_percentage: number;
}
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
    Textarea,
    Stepper,
    Step,
    StepList,
    StepPanel,
    StepPanels,
    Card,
    BackArrow,
  ],
  templateUrl: './key-creation-step-by-step.html',
  styleUrl: './key-creation-step-by-step.css',
  providers: [DialogService],
})
export class KeyCreationStepByStep implements OnInit {
  private eventBus = inject(EventBusService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private snackbar = inject(SnackbarNotification);
  private dialogService = inject(DialogService);
  private destroyRef = inject(DestroyRef);
  formFirstStep!: FormGroup;
  readonly secondStep = signal(false);
  nbConsumers = -1;

  /** Manual count, or the meters of a sharing operation. Drives what step 0 shows. */
  readonly participantSource = signal<ParticipantSource>('manual');
  /** EANs pulled from a sharing operation, index-aligned with the `consumer_name_i` controls. */
  readonly participantNames = signal<string[]>([]);
  /**
   * Set when the wizard was opened from a sharing operation's page: the meter dialog then stays
   * scoped to that operation instead of asking which one again.
   */
  private fixedIdSharing: number | null = null;
  /**
   * Where to go once the key is saved. The wizard does not save — it hands the draft to the full
   * creator — so this has to be forwarded there, or the round-trip back to the caller is lost.
   */
  readonly returnUrl = signal<string | null>(null);
  /** Back-arrow target: whoever sent us here, else the keys list. */
  readonly backUrl = computed(() => this.returnUrl() ?? '/keys');

  formSecondStep!: FormGroup;
  consumers: ConsumerDTO[] = [];
  readonly displayEnd = signal(false);
  readonly formIterations = signal<FormGroup[]>([]);
  iterations: IterationDTO[] = [];
  lastIteration = -1;
  numberIterations: number[] = [];
  readonly displayErrorInj = signal(false);
  lastForm!: FormGroup;

  ngOnInit(): void {
    this.formFirstStep = new FormGroup({
      inputSource: new FormControl<ParticipantSource>('manual'),
      // `null`, not `''`: p-inputNumber renders its model through
      // `Intl.NumberFormat.format()`, which turns an empty string into a `0` the
      // user then has to clear. Only null/undefined render as a blank field.
      nb_consumers: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    });
    this.lastForm = new FormGroup({
      key_name: new FormControl('', [Validators.required]),
      key_description: new FormControl('', [Validators.required]),
    });

    const params = this.route.snapshot.queryParamMap;
    this.returnUrl.set(sanitizeReturnUrl(params.get('returnUrl')));
    const idSharing = Number(params.get('idSharing'));
    this.fixedIdSharing = Number.isInteger(idSharing) && idSharing > 0 ? idSharing : null;

    // Arriving from a sharing operation: its meters were already picked, so land on a step 0 that
    // is filled in rather than asking for a count the caller has already answered.
    const state = history.state as { consumers?: string[] } | null;
    const transferred = state?.consumers;
    if (transferred?.length) {
      this.onParticipantSourceChange('operation');
      this.applyImportedParticipants(transferred, false);
    }
  }

  /** Step 0's source radio — switching back to a manual count drops the imported names. */
  onParticipantSourceChange(source: ParticipantSource): void {
    this.participantSource.set(source);
    this.formFirstStep.get('inputSource')?.setValue(source);
    if (source === 'manual' && this.participantNames().length > 0) {
      this.participantNames.set([]);
      this.resetParticipants(0);
    }
  }

  /**
   * Picks the meters of a sharing operation and turns them into the participant list.
   *
   * Reuses the very dialog the full creator opens, so both entry points import the same way: the
   * operation is fixed when the wizard was opened from an operation's page, and chosen in the
   * dialog otherwise.
   */
  importFromSharingOperation(): void {
    const ref = this.dialogService.open(ImportSharingOperationMeters, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('KEY.IMPORT_FROM_SHARING_OPERATION.HEADER') as string,
      width: '900px',
      data: this.fixedIdSharing ? { idSharing: this.fixedIdSharing } : {},
    });

    ref?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedEANs: string[] | null) => {
        if (!selectedEANs?.length) return;
        this.applyImportedParticipants(selectedEANs, true);
      });
  }

  /**
   * Makes the imported EANs the participants: they set the count *and* pre-fill the names, so
   * `nb_consumers` stays the single source of truth every later step already reads.
   */
  private applyImportedParticipants(eans: string[], notify: boolean): void {
    const names = [...new Set(eans.map((ean) => ean.trim()).filter((ean) => ean !== ''))];
    if (names.length === 0) return;

    this.participantNames.set(names);
    this.resetParticipants(names.length);

    if (notify) {
      this.snackbar.openSnackBar(
        this.translate.instant('KEY.IMPORT_FROM_SHARING_OPERATION.IMPORTED', {
          added: names.length,
        }) as string,
        VALIDATION_TYPE,
      );
    }
  }

  /**
   * Rebuilds step 1 from scratch for a new participant count. `submitFirstForm` only grows or
   * shrinks the existing controls, so the previous names have to be cleared out first or an import
   * would leave stale ones behind.
   */
  private resetParticipants(count: number): void {
    // See `ngOnInit`: blanking the field means `null`, an empty string shows a `0`.
    this.formFirstStep.patchValue({ nb_consumers: count > 0 ? count : null });
    this.secondStep.set(false);
    this.nbConsumers = -1;
    this.consumers = [];
    if (count > 0) {
      this.submitFirstForm();
    }
  }

  submitFirstForm(): void {
    if (this.formFirstStep.valid) {
      const firstStepValue = this.formFirstStep.getRawValue() as FirstStepValue;
      if (!this.secondStep()) {
        this.nbConsumers = firstStepValue.nb_consumers;
        this.formSecondStep = new FormGroup({});
        for (let i = 0; i < this.nbConsumers; i++) {
          this.formSecondStep.addControl(
            'consumer_name_' + i,
            new FormControl(this.participantNames()[i] ?? '', [Validators.required]),
          );
        }
        this.secondStep.set(true);
      } else {
        if (this.nbConsumers != firstStepValue.nb_consumers) {
          if (this.nbConsumers < firstStepValue.nb_consumers) {
            // Add missing ones
            for (let i = this.nbConsumers; i < firstStepValue.nb_consumers; i++) {
              this.formSecondStep.addControl(
                'consumer_name_' + i,
                new FormControl(this.participantNames()[i] ?? '', [Validators.required]),
              );
            }
          } else {
            // Remove the excedent
            for (let i = this.nbConsumers; i > firstStepValue.nb_consumers; i--) {
              this.formSecondStep.removeControl('consumer_name_' + (i - 1));
            }
            if (this.iterations.length > 0) {
              // Splice consumers
              const difference = this.nbConsumers - firstStepValue.nb_consumers;

              this.consumers.splice(this.consumers.length - difference - 1, difference);
              const iterationValues = this.formIterations().map(
                (form) => form.getRawValue() as IterationFormValue,
              );
              for (let i = 0; i < this.iterations.length; i++) {
                const type = +iterationValues[i].type;
                this.iterations[i] = this.computeIteration(
                  type,
                  +iterationValues[i].inj_percentage,
                  i + 1,
                );
              }
            }
          }
          this.nbConsumers = +firstStepValue.nb_consumers;
        }
      }
    }
  }
  get controls(): string[] {
    return Object.keys(this.formSecondStep.controls);
  }

  submitSecondForm(): void {
    if (!this.formFirstStep.valid) {
      this.formFirstStep.markAllAsTouched(); // Show errors
      this.snackbar.openSnackBar(
        this.translate.instant('KEY.ERRORS.FIRST_STEP_ERROR') as string,
        ERROR_TYPE,
      );
      return;
    }
    this.submitFirstForm();
    this.formSecondStep.markAllAsTouched();
    if (this.formSecondStep.valid) {
      // Creation of consumers
      this.consumers = [];
      const secondStepValue = this.formSecondStep.getRawValue() as SecondStepValue;
      for (let i = 0; i < this.nbConsumers; i++) {
        this.consumers.push({
          id: -1,
          name: secondStepValue[`consumer_name_${i}`],
          energy_allocated_percentage: -1,
        });
      }
      if (this.formIterations().length === 0) {
        this.formIterations.update((arr) => [
          ...arr,
          new FormGroup({
            type: new FormControl('', [Validators.required]),
            inj_percentage: new FormControl('', [Validators.required]),
          }),
        ]);
        this.numberIterations.push(this.lastIteration++);
      } else {
        // Update the iterations with the new consumers set
        const iterationValues = this.formIterations().map(
          (form) => form.getRawValue() as IterationFormValue,
        );
        for (let i = 0; i < this.iterations.length; i++) {
          this.iterations[i] = this.computeIteration(
            iterationValues[i].type,
            iterationValues[i].inj_percentage,
            i + 1,
          );
        }
      }
    }
  }

  getSumOfIter(): number {
    let sumInj = 0;
    for (const iteration of this.iterations) {
      sumInj += iteration.energy_allocated_percentage;
    }
    return sumInj;
  }

  computeIteration(type: number, inj_percentage: number, number_iteration: number): IterationDTO {
    // Create a deep copy of consumers to avoid reference issues
    const newConsumers: ConsumerDTO[] = this.consumers.map((con) => {
      return {
        id: con.id,
        name: con.name,
        energy_allocated_percentage: con.energy_allocated_percentage,
      } as ConsumerDTO;
    });

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
      energy_allocated_percentage: inj_percentage / 100,
    };
  }

  addIteration(_index: number): void {
    if (this.formIterations().length < 3) {
      this.formIterations.update((arr) => [
        ...arr,
        new FormGroup({
          type: new FormControl('', [Validators.required]),
          inj_percentage: new FormControl('', [Validators.required]),
        }),
      ]);
    }
  }

  submitIteration(): void {
    if (!this.formFirstStep.valid) {
      this.formFirstStep.markAllAsTouched();
      this.snackbar.openSnackBar(
        this.translate.instant('KEY.ERRORS.FIRST_STEP_ERROR') as string,
        ERROR_TYPE,
      );
      return;
    }
    this.submitFirstForm();

    if (!this.formSecondStep.valid) {
      this.formSecondStep.markAllAsTouched();
      this.snackbar.openSnackBar(
        this.translate.instant('KEY.ERRORS.SECOND_STEP_ERROR') as string,
        ERROR_TYPE,
      );
      return;
    }
    this.submitSecondForm();
    const currentFormIterations = this.formIterations();
    for (const fIteration of currentFormIterations) {
      if (fIteration.invalid) {
        return;
      }
    }
    const iterationValues = currentFormIterations.map(
      (form) => form.getRawValue() as IterationFormValue,
    );
    for (let i = 0; i < currentFormIterations.length; i++) {
      const type = +iterationValues[i].type;
      this.iterations[i] = this.computeIteration(type, +iterationValues[i].inj_percentage, i + 1);
    }

    const sumInj = this.getSumOfIter();
    this.displayErrorInj.set(false);
    if (sumInj >= 0.99 && sumInj <= 1.01) {
      this.displayEnd.set(true);
    } else if (sumInj > 1.01) {
      this.displayErrorInj.set(true);
    } else if (currentFormIterations.length < 3) {
      this.addIteration(currentFormIterations.length);
    } else {
      this.displayErrorInj.set(true);
    }
  }
  recalculateIterationDisplay(): void {
    this.displayEnd.set(this.getSumOfIter() >= 99 && this.getSumOfIter() <= 101);
  }
  deleteIteration(index: number): void {
    if (this.formIterations().length > 1) {
      this.displayErrorInj.set(false);
      this.formIterations.update((arr) => {
        const n = [...arr];
        n.splice(index, 1);
        return n;
      });
      this.iterations.splice(index, 1);
      this.recalculateIterationDisplay();
    }
  }

  submitKey(): void {
    if (!this.formFirstStep.valid) {
      this.formFirstStep.markAllAsTouched();
      this.snackbar.openSnackBar(
        this.translate.instant('KEY.ERRORS.FIRST_STEP_ERROR') as string,
        ERROR_TYPE,
      );
      return;
    }
    this.submitFirstForm();

    if (!this.formSecondStep.valid) {
      this.formSecondStep.markAllAsTouched();
      this.snackbar.openSnackBar(
        this.translate.instant('KEY.ERRORS.SECOND_STEP_ERROR') as string,
        ERROR_TYPE,
      );
      return;
    }
    this.submitSecondForm();
    for (const fIteration of this.formIterations()) {
      if (fIteration.invalid) {
        fIteration.markAllAsTouched();
        return;
      }
    }

    this.submitIteration();
    if (this.lastForm.valid) {
      const lastFormValue = this.lastForm.getRawValue() as LastFormValue;
      const key: KeyDTO = {
        id: -1,
        name: lastFormValue.key_name,
        description: lastFormValue.key_description,
        iterations: this.iterations,
      };
      this.eventBus.emit('keyStepByStep', key);
      const returnUrl = this.returnUrl();
      void this.router.navigate(['/keys/add'], {
        queryParams: returnUrl ? { returnUrl } : {},
        state: { keyData: key },
      });
    }
  }
}
