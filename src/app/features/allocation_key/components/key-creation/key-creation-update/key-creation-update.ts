import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { ConsumerDTO, IterationDTO, KeyDTO } from '../../../../../shared/dtos/key.dtos';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { KeyService } from '../../../../../shared/services/key.service';
import { EventBusService } from '../../../../../core/services/event_bus/eventbus.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonRenderer } from './button-renderer/button-renderer';
import { HeaderWithHelper } from '../../key-view/header-with-helper/header-with-helper';
import { HelperDialog } from '../../key-view/helper-dialog/helper-dialog';
import { Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { InputText } from 'primeng/inputtext';
import { AgGridAngular } from 'ag-grid-angular';
import { ErrorHandlerComponent } from '../../../../../shared/components/error.handler/error.handler.component';
import { Textarea } from 'primeng/textarea';
import { FormErrorSummaryComponent } from '../../../../../shared/components/summary-error.handler/summary-error.handler.component';
import { SnackbarNotification } from '../../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { VALIDATION_TYPE } from '../../../../../core/dtos/notification';

@Component({
  selector: 'app-key-creation-update',
  standalone: true,
  imports: [
    TranslatePipe,
    Button,
    Ripple,
    RouterLink,
    InputText,
    ReactiveFormsModule,
    AgGridAngular,
    ErrorHandlerComponent,
    Textarea,
    FormErrorSummaryComponent,
  ],
  templateUrl: './key-creation-update.html',
  styleUrl: './key-creation-update.css',
  providers: [DialogService],
})
export class KeyCreationUpdate implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private keyService = inject(KeyService);
  private routing = inject(Router);
  private snackbarNotification = inject(SnackbarNotification);
  private eventBus = inject(EventBusService);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private dialogService = inject(DialogService);

  key!: KeyDTO;
  @Input()
  keyInput?: KeyDTO | null;
  isLoaded: boolean;
  isSubmitted: boolean = false;
  rowData: any[] = [];
  public themeClass: string = 'ag-theme-quartz';
  public defaultColDef: any = {
    width: 250,
    editable: true,
  };
  frameworkComponents: any;

  colDefs: any = [];
  formGroup: FormGroup = new FormGroup({
    name: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
    key_data: new FormControl('', [this.keyValidator.bind(this)]),
  });
  errorsAdded: Record<string, () => string> = {};
  errorsSummaryAdded: Record<string, (params: any, controlName: string) => string> = {};
  ref?: DynamicDialogRef | null;
  gridOptions = {
    suppressCellFocus: false, // just to reduce masking
    debug: true, // enables logs
    suppressReactUi: false,
  };
  constructor() {
    this.isLoaded = false;
    this.frameworkComponents = {
      buttonRenderer: ButtonRenderer,
      headerHelperRenderer: HeaderWithHelper,
    };
  }
  refreshGrid() {
    try {
      this.formGroup.updateValueAndValidity();
      this.gridApi.refreshCells({ force: true });
    } catch (error) {
    }
  }

  initializeWithData(key: KeyDTO) {
    console.log(`Initialize with data : ${key}`)
    console.log(key)
    this.key = key;
    this.formGroup.get('name')?.setValue(key.name);
    this.formGroup.get('description')?.setValue(key.description);
    this.rowData = this.formatData();
    this.isLoaded = true;

  }

  ngOnInit(): void {
    this.loadColumnDefinitions();
    this.loadErrorMessages();
    this.keyInput = null;
    this.isLoaded = false;

    this.formGroup = new FormGroup({
      name: new FormControl('', [Validators.required]),
      description: new FormControl('', [Validators.required]),
      key_data: new FormControl('', [this.keyValidator.bind(this)]),
    });

    this.route.queryParams.subscribe((params) => {
      const id = params['id'];

      if (id) {
        // 1. If ID exists in URL, fetch from API
        this.keyService.getKey(parseInt(id)).subscribe({
          next: (response) => {
            if (response) {
              const key = response.data;
              this.keyInput = JSON.parse(JSON.stringify(key));
              this.initializeWithData(key as KeyDTO);
            } else {
              this.errorHandler.handleError();
            }
          },
          error: (error) => {
            this.errorHandler.handleError(error.data ? error.data : null);
          },
        });
      } else {
        // 2. If no ID, check if we received data via Router State (history.state)
        // We check this HERE so it doesn't conflict with the empty default below
        const transferredKey = history.state['keyData'];

        if (transferredKey) {
          console.log("Found key in history.state:", transferredKey);
          this.initializeWithData(JSON.parse(JSON.stringify(transferredKey)));
          this.keyInput = transferredKey;
        } else {
          // 3. Fallback: Initialize as completely new empty key
          this.key = {
            id: -1,
            name: '',
            description: '',
            iterations: [],
          };
          this.isLoaded = true;
        }
      }
    });

    // Global error handlers (optional to keep here)
    window.onerror = function (message, source, lineno, colno, error) {
      console.error('Global error caught:', { message, source, lineno, colno, error });
    };
  }

  loadColumnDefinitions() {
    this.translate
      .get([
        'KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL',
        'KEY.TABLE.COLUMNS.ITERATION_TOOLTIP',
        'KEY.TABLE.DELETE_ITERATION_BUTTON_LABEL',
        'KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL',
        'KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP',
        'KEY.TABLE.COLUMNS.CONSUMER_LABEL',
        'KEY.TABLE.COLUMNS.CONSUMER_NAME_LABEL',
        'KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL',
        'KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP',
        'KEY.TABLE.DELETE_CONSUMER_BUTTON_LABEL',
        'VAP_HEADER',
      ])
      .subscribe({
        next: (translations) => {
          this.colDefs = [
            {
              headerName: translations['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
              field: 'number',
              flex:1,
              editable: false,
              cellStyle: this.cellStyleNumber.bind(this),
              cellClassRules: {
                'cell-span': 'value==1',
              },
              headerComponent: 'headerHelperRenderer',
              headerComponentParams: {
                label: translations['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
                tooltip: translations['KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
                click: this.openHelper.bind(this),
              },
              headerTooltip: translations['KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
            },
            {
              headerName: translations['KEY.TABLE.DELETE_ITERATION_BUTTON_LABEL'],
              flex:1,
              field: 'delete1',
              cellRenderer: 'buttonRenderer',
              cellRendererParams: {
                onClick: this.deleteIteration.bind(this),
                label: translations['KEY.TABLE.DELETE_ITERATION_BUTTON_LABEL'],
              },
            },
            {
              headerName: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL'],
              flex:1,
              field: 'va_percentage',
              onCellValueChanged: this.onCellValueChanged.bind(this),
              headerComponent: 'headerHelperRenderer', // ✅ class, not string
              headerComponentParams: {
                label: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL'],
                tooltip: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
                click: this.openHelper.bind(this),
              },
              headerTooltip: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
            },
            {
              headerName: translations['KEY.TABLE.COLUMNS.CONSUMER_LABEL'],
              flex:2,
              field: 'consumers',
              cellStyle: { 'text-align': 'center' },
              children: [
                {
                  headerName: translations['KEY.TABLE.COLUMNS.CONSUMER_NAME_LABEL'],
                  flex:1,
                  field: 'name',
                },
                {
                  headerName: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL'],
                  flex:1,
                  field: 'vp_percentage',
                  onCellValueChanged: this.onCellValueChanged.bind(this),
                  cellStyle: { 'text-align': 'center' },
                  headerComponent: 'headerHelperRenderer', // ✅ class, not string
                  headerComponentParams: {
                    label: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL'],
                    tooltip: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
                    click: this.openHelper.bind(this),
                  },
                  headerTooltip: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
                },
              ],
            },
            {
              headerName: translations['KEY.TABLE.DELETE_CONSUMER_BUTTON_LABEL'],
              flex:1,
              field: 'delete',
              cellRenderer: 'buttonRenderer',
              cellRendererParams: {
                onClick: this.deleteConsumer.bind(this),
                label: translations['KEY.TABLE.DELETE_CONSUMER_BUTTON_LABEL'],
              },
            },
          ];
        },
        error: (error) => {
          console.error('LOAD COLUMN DEFINITIONS ERROR : ', error);
        },
      });
  }

  loadErrorMessages() {
    this.translate
      .get([
        'KEY.CREATE.ERROR.NO_ITERATION',
        'KEY.CREATE.ERROR.NO_CONSUMERS',
        'KEY.CREATE.ERROR.SUM_ITERATIONS_ERROR',
        'KEY.CREATE.ERROR.SUM_CONSUMERS',
        'KEY.CREATE.ERROR.CONSUMER_NAME_REQUIRED',
        'KEY.CREATE.ERROR.NO_CHANGE',
      ])
      .subscribe({
        next: (translations) => {
          this.errorsAdded = {
            NoIteration: () => translations['KEY.CREATE.ERROR.NO_ITERATION'],
            NoConsumers: () => translations['KEY.CREATE.ERROR.NO_CONSUMERS'],
            SumIterations: () => translations['KEY.CREATE.ERROR.SUM_ITERATIONS_ERROR'],
            SumConsumers: () => translations['KEY.CREATE.ERROR.SUM_CONSUMERS'],
            ConsumerName: () => translations['KEY.CREATE.ERROR.CONSUMER_NAME_REQUIRED'],
            NoChange: () => translations['CREATE_ALLOCATION_KEY_NO_CHANGE'],
          };

          this.errorsSummaryAdded = {
            NoIteration: (_: any, _controlName: string) =>
              translations['KEY.CREATE.ERROR.NO_ITERATION'],
            NoConsumers: (_: any, _controlName: string) =>
              translations['KEY.CREATE.ERROR.NO_CONSUMERS'],
            SumIterations: (_: any, _controlName: string) =>
              translations['KEY.CREATE.ERROR.SUM_ITERATIONS_ERROR'],
            SumConsumers: (_: any, _controlName: string) =>
              translations['KEY.CREATE.ERROR.SUM_CONSUMERS'],
            ConsumerName: (_: any, _controlName: string) =>
              translations['KEY.CREATE.ERROR.CONSUMER_NAME_REQUIRED'],
            NoChange: (_: any, _controlName: string) =>
              translations['CREATE_ALLOCATION_KEY_NO_CHANGE'],
          };
        },
        error: (error) => {
          console.error('ERROR LOAD ERROR MESSAGE : ', error);
        },
      });
  }

  private keyValidator(control: AbstractControl): ValidationErrors | null {
    try {
      const invalid = false;
      const errors: any = {};
      if (this.key !== undefined) {
        if (this.key.iterations.length === 0) {
          errors['NoIteration'] = true;
          return errors;
        } else {
          if (this.key.iterations[0].consumers.length === 0) {
            errors['NoConsumers'] = true;
            return errors;
          }
          // La somme des itérations doit être égale à 1
          let sum = 0;
          this.key.iterations.forEach((iteration) => {
            sum += iteration.energy_allocated_percentage;
          });
          if (sum !== 1) {
            errors['SumIterations'] = true;
            return errors;
          }
          // La somme des consommateurs doit être égale à 1 pour chaque itération ou bien être Prorata
          this.key.iterations.forEach((iteration) => {
            let sum = 0;
            iteration.consumers.forEach((consumer) => {
              sum += consumer.energy_allocated_percentage;
              if (consumer.name === null || consumer.name === '') {
                errors['ConsumerName'] = true;
                return errors;
              }
            });
            if (sum >= 0.999 && sum <= 1.001) {
              sum = 1;
            }
            if (sum !== 1) {
              // Autoriser une approximation (0.9999 doit être acceptée ainsi que 1.0001)
              let prorata = true;
              iteration.consumers.forEach((consumer) => {
                if (consumer.energy_allocated_percentage !== -1) {
                  prorata = false;
                }
              });
              if (!prorata) {
                errors['SumConsumers'] = true;
                return errors;
              }
            }
          });
        }
      }
      if (this.keyInput !== null && this.keyInput !== undefined) {
        const name: string | null = control.get('name')?.value;
        const description: string | null = control.get('description')?.value;
        let count = 0;
        if (this.keyInput.name === name) {
          count++;
        }
        if (this.keyInput.description === description) {
          count++;
        }
        // Check if iterations are the same
        if (this.keyInput.iterations.length === this.key.iterations.length) {
          // count++;
          let countIterationSame = 0;
          let counterIterationConsumersSame = 0;
          for (let i = 0; i < this.key.iterations.length; i++) {
            let counterConsumerSame = 0;
            if (
              this.keyInput.iterations[i].energy_allocated_percentage ===
              this.key.iterations[i].energy_allocated_percentage
            ) {
              countIterationSame++;
            }
            if (
              this.keyInput.iterations[i].consumers.length ===
              this.key.iterations[i].consumers.length
            ) {
              for (let j = 0; j < this.key.iterations[i].consumers.length; j++) {
                if (
                  this.keyInput.iterations[i].consumers[j].name ===
                    this.key.iterations[i].consumers[j].name &&
                  this.keyInput.iterations[i].consumers[j].energy_allocated_percentage ===
                    this.key.iterations[i].consumers[j].energy_allocated_percentage
                ) {
                  counterConsumerSame++;
                }
              }
            }
            if (counterConsumerSame === this.keyInput.iterations[i].consumers.length) {
              counterIterationConsumersSame++;
            }
          }
          if (countIterationSame === this.keyInput.iterations.length) {
            count++;
          }
          if (counterIterationConsumersSame === this.keyInput.iterations.length) {
            count++;
          }
        }

        if (!invalid && count === 4) {
          errors['NoChange'] = true;
          return errors;
        }
      }
      return errors;
    } catch (e) {
      return null;
    }
  }

  openHelper(displayText: string) {
    this.ref = this.dialogService.open(HelperDialog, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      data: {
        displayText: displayText,
      },
    });
  }

  onSubmit() {
    this.isSubmitted = true;
    this.formGroup.get('key_data')?.updateValueAndValidity();

    this.formGroup.updateValueAndValidity();
    if (this.formGroup.invalid) {
      return;
    }
    this.key.name = this.formGroup.get('name')?.value;
    this.key.description = this.formGroup.get('description')?.value;
    if (this.keyInput) {
      this.keyService.updateKey(this.key).subscribe({
        next: (response) => {
          if (response) {
            this.snackbarNotification.openSnackBar(
              this.translate.instant('KEY.SUCCESS.KEY_UPDATED'),
              VALIDATION_TYPE,
            );
            this.routing.navigate(['/keys']);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error.data ? error.data : null);
        },
      });
    } else {
      this.keyService.addKey(this.key).subscribe({
        next: (response) => {
          if (response) {
            this.snackbarNotification.openSnackBar(
              this.translate.instant('KEY.SUCCESS.KEY_ADDED'),
              VALIDATION_TYPE,
            );
            this.routing.navigate(['/keys']);
          } else {
            this.errorHandler.handleError();
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error.data ? error.data : null);
        },
      });
    }
  }

  gridApi: any;
  onGridReady(event: any) {
    console.log("On grid ready")
    this.rowData = [];
    if (this.keyInput) {
      this.rowData = this.formatData();
    }

    this.gridApi = event.api;
    KeyCreationUpdate.displayedNumbers.clear();

    this.eventBus.on('setConsumers', (data: any) => {
      const listEAN = data.detail;
      this.newIteration();
      this.key.iterations[0].consumers[0].name = listEAN.shift();

      for (const ean of listEAN) {
        this.key.iterations[0].consumers.push({
          id: -1,
          name: ean,
          energy_allocated_percentage: 0,
        });
      }
      this.rowData = this.formatData();
      this.refreshGrid();
    });

    // this.eventBus.on('keyStepByStep', (data: any) => {
    //   console.log("Event Bus Key Step By Step : ", data)
    //   const key = data.detail;
    //   this.initializeWithData(key);
    // });
  }

  formatData() {
    const formattedData: any[] = [];

    if (this.key && this.key.iterations) {
      this.key.iterations.forEach((iteration) => {
        iteration.consumers.forEach((consumer) => {
          let vp_percentage = consumer.energy_allocated_percentage * 100 + '%';
          if (consumer.energy_allocated_percentage === -1) {
            vp_percentage = this.translate.instant('KEY.CREATE.PRORATA_LABEL');
          }
          formattedData.push({
            number: iteration.number,
            va_percentage: iteration.energy_allocated_percentage * 100 + '%',
            name: consumer.name,
            vp_percentage: vp_percentage,
          });
        });
      });
    }
    console.log("FORMATTED DATA");
    console.log(formattedData);
    return formattedData;
  }
  newConsumer() {
    const newConsumer: ConsumerDTO = {
      id: -1,
      name: '',
      energy_allocated_percentage: 0,
    };
    for (const iteration of this.key.iterations) {
      if (iteration.consumers[0].energy_allocated_percentage === -1) {
        iteration.consumers.push({ id: -1, name: '', energy_allocated_percentage:-1 });
      } else {
        iteration.consumers.push(newConsumer);
      }
    }
    this.rowData = this.formatData();
    this.refreshGrid();
  }

  newIterationCheck(): [number, ConsumerDTO[]?] {
    let number = 1;
    if (this.key.iterations.length > 0) {
      number = this.key.iterations[this.key.iterations.length - 1].number + 1;
      if (number > 3) {
        return [-1, undefined];
      }
    }
    const consumers: ConsumerDTO[] = [{ id: -1, name: '', energy_allocated_percentage: 0 }];
    return [number, consumers];
  }

  newIteration() {
    try {
      const [number, initialConsumers] = this.newIterationCheck();
      let consumers = initialConsumers;
      if (number === -1 || !consumers) {
        return;
      }
      if (number > 1) {
        consumers = this.key.iterations[this.key.iterations.length - 1].consumers.map(
          (consumer) => {
            return {
              id: -1,
              name: consumer.name,
              energy_allocated_percentage: 0,
            };
          },
        );
      }
      const newIteration: IterationDTO = {
        id: -1,
        number: number,
        energy_allocated_percentage: 1,
        consumers: consumers,
      };
      this.key.iterations.push(newIteration);
      this.rowData = this.formatData();
      this.refreshGrid();
      // this.gridApi.applyTransaction({add: [newIteration]});
      // this.gridApi.refresh();
    } catch (error) {
      console.error(error);
    }
  }
  newIterationProrata() {
    const [number, initialConsumer] = this.newIterationCheck();
    let consumers = initialConsumer;
    if (number === -1 || !consumers) {
      return;
    }
    if (number > 1) {
      consumers = this.key.iterations[this.key.iterations.length - 1].consumers.map((consumer) => {
        return {
          id: -1,
          name: consumer.name,
          energy_allocated_percentage: -1,
        };
      });
    }
    const newIteration: IterationDTO = {
      id: -1,
      number: number,
      energy_allocated_percentage: 1,
      consumers: consumers,
    };
    newIteration.consumers.forEach((consumer) => (consumer.energy_allocated_percentage = -1));
    this.key.iterations.push(newIteration);
    this.rowData = this.formatData();
    this.refreshGrid();
    // this.gridApi.applyTransaction({add: [newIteration]});
    // this.grid
  }
  static lastNumberCellStyleNumber = 0;
  static lastParams: any = null;
  cellStyleNumber(params: any) {
    KeyCreationUpdate.lastParams = params;
    if (params.node.data.number !== KeyCreationUpdate.lastNumberCellStyleNumber) {
      KeyCreationUpdate.lastNumberCellStyleNumber = params.node.data.number;
      return { height: '100%' };
    } else {
      //return {height: '0px', visibility: 'hidden'};
      return { height: '100%' };
    }
  }
  static displayedNumbers = new Set<number>();

  onCellValueChanged(event: any) {
    const colId = event.colDef.field;
    const data = event.data;
    const iterationIndex = this.key.iterations.findIndex(
      (iteration) => iteration.number === data.number,
    );
    if (iterationIndex !== -1) {
      if (colId === 'va_percentage') {
        this.key.iterations[iterationIndex].energy_allocated_percentage =
          parseFloat(data.va_percentage) / 100;
        if (data.va_percentage.includes('%')) {
          data.va_percentage = data.va_percentage.replace('%', '');
        }
        if (data.va_percentage.match('^\\d+(\\.\\d+)*$')) {
          //this.rowData[event.node.rowIndex].va_percentage = data.va_percentage + "%";
          data.va_percentage = data.va_percentage + '%';
          for (const rData of this.rowData) {
            if (rData.number === data.number) {
              rData.va_percentage = data.va_percentage;
            }
          }
          // for (let i = 0; i < this.rowData.length; i++) {
          //   if (this.rowData[i].number === data.number) {
          //     this.rowData[i].va_percentage = data.va_percentage;
          //   }
          // }
          this.refreshGrid();
        } else {
          data.va_percentage = '';
          this.refreshGrid();
        }
      } else {
        //const consumerIndex = this.key.iterations[iterationIndex].consumers.findIndex(consumer => consumer.name === data.name);
        const consumerIndex = event.node.rowIndex % this.key.iterations[0].consumers.length;
        if (consumerIndex !== -1) {
          if (colId === 'vp_percentage') {
            if (data.vp_percentage.includes('%')) {
              data.vp_percentage = data.vp_percentage.replace('%', '');
            }
            this.key.iterations[iterationIndex].consumers[
              consumerIndex
            ].energy_allocated_percentage = parseFloat(data.vp_percentage) / 100;
            if (data.vp_percentage.match('^\\d+(\\.\\d+)*$')) {
              this.rowData[event.node.rowIndex].vp_percentage = data.vp_percentage + '%';
              this.refreshGrid();
            } else {
              data.vp_percentage = '';
              this.refreshGrid();
            }
          } else if (colId === 'name') {
            for (const iteration of this.key.iterations) {
              iteration.consumers[consumerIndex].name = data.name;
            }
            // for (let i = 0; i < this.key.iterations.length; i++) {
            //   this.key.iterations[i].consumers[consumerIndex].name = data.name;
            // }
            this.rowData = this.formatData(); // A changer
            this.refreshGrid();

            //this.key.iterations[iterationIndex].consumers[consumerIndex].name = data.name;
          }
        }
      }
    }
    this.formGroup.updateValueAndValidity();
  }

  deleteIteration(params: any) {
    const number = params.rowData.number;
    const index = this.key.iterations.findIndex((iteration) => iteration.number === number);
    if (index !== -1) {
      let start = 1;
      if (index > 0) {
        start = index + 1;
      }
      for (let i = start; i < this.key.iterations.length; i++) {
        this.key.iterations[i].number = this.key.iterations[i].number - 1;
      }
      this.key.iterations.splice(index, 1);
    }
    this.rowData = this.formatData();
    this.refreshGrid();
  }
  deleteConsumer(params: any) {
    const name = params.rowData.name;
    for (const iteration of this.key.iterations) {
      const index = iteration.consumers.findIndex((consumer) => consumer.name === name);
      if (index !== -1) {
        iteration.consumers.splice(index, 1);
      }
    }
    // for (let i = 0; i < this.key.iterations.length; i++) {
    //   const index = this.key.iterations[i].consumers.findIndex((consumer) => consumer.name === name);
    //   if (index !== -1) {
    //     this.key.iterations[i].consumers.splice(index, 1);
    //   }
    // }
    if (this.key.iterations[0].consumers.length === 0) {
      this.key.iterations = [];
    }
    this.rowData = this.formatData();
    this.refreshGrid();
  }

  getContext() {
    return {
      form: this.formGroup,
    };
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.destroy();
    }
  }
}
