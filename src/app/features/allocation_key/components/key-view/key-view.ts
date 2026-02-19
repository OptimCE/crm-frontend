import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { IterationDTO, KeyDTO } from '../../../../shared/dtos/key.dtos';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import { KeyService } from '../../../../shared/services/key.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { HeaderWithHelper } from './header-with-helper/header-with-helper';
import { HelperDialog } from './helper-dialog/helper-dialog';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { SlicePipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { ColDef } from 'ag-grid-community';
@Component({
  selector: 'app-key-view',
  standalone: true,
  imports: [Button, Card, SlicePipe, AgGridAngular, TranslatePipe, RouterLink],
  templateUrl: './key-view.html',
  styleUrl: './key-view.css',
  providers: [DialogService],
})
export class KeyView implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private keyService = inject(KeyService);
  private routing = inject(Router);
  private snackbarNotification = inject(SnackbarNotification);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private dialogService = inject(DialogService);

  key?: KeyDTO;
  public isLoaded: boolean;
  displayAllDescription: boolean = false;
  rowData: IterationDTO[] = [];
  colDefs!: ColDef<any>[];
  public defaultColDef = {
    width: 250,
    flex: 1,
    minWidth: 140,
  };
  gridApi: any;
  ref?: DynamicDialogRef | null;
  frameworkComponents: any;
  constructor() {
    this.isLoaded = false;
    this.frameworkComponents = {
      headerHelperRenderer: HeaderWithHelper,
    };
  }

  static lastNumberCellStyleNumber = 0;

  colorGradient = [
    {
      backgroundColor: 'rgb(30,75,190, 0.2)',
      visibility: 'visible',
      'border-bottom': '1px solid black',
    },
    {
      backgroundColor: 'rgb(0, 144, 230, 0.2)',
      visibility: 'visible',
      'border-bottom': '1px solid black',
    },
    {
      backgroundColor: 'rgb(0, 208, 255, 0.2)',
      visibility: 'visible',
      'border-bottom': '1px solid black',
    },
  ];

  cellStyleNumber(params: any) {
    if (
      params.node.data.number !== undefined &&
      params.node.data.number != KeyView.lastNumberCellStyleNumber
    ) {
      KeyView.lastNumberCellStyleNumber = params.node.data.number;
    }
    return this.colorGradient[KeyView.lastNumberCellStyleNumber - 1];
  }

  formatData() {
    const formattedData: any[] = [];
    let alreadyAdded = false;
    if (this.key && this.key.iterations) {
      this.key.iterations.forEach((iteration) => {
        alreadyAdded = false;
        iteration.consumers.forEach((consumer) => {
          let vp_percentage = (consumer.energy_allocated_percentage * 100).toFixed(2) + '%';
          if (consumer.energy_allocated_percentage === -1) {
            vp_percentage = this.translate.instant('KEY.CREATE.PRORATA_LABEL');
          }
          if (alreadyAdded) {
            formattedData.push({
              name: consumer.name,
              vp_percentage: vp_percentage,
            });
          } else {
            formattedData.push({
              number: iteration.number,
              va_percentage: (iteration.energy_allocated_percentage * 100).toFixed(2) + '%',
              name: consumer.name,
              vp_percentage: vp_percentage,
            });
            alreadyAdded = true;
          }
        });
      });
    }
    return formattedData;
  }

  ngOnInit() {
    KeyView.lastNumberCellStyleNumber = 0;
    this.loadColumnDefinitions();

    this.isLoaded = false;
    const idParam = this.route.snapshot.paramMap.get('id');
    const id: number = idParam !== null ? +idParam : -1;
    if (id == -1) {
      this.routing.navigate(['/keys']);
    }
    this.keyService.getKey(id).subscribe({
      next: (response) => {
        if (response) {
          this.key = response.data as KeyDTO;
          this.isLoaded = true;
        } else {
          this.errorHandler.handleError();
          this.routing.navigate(['/keys']);
        }
      },
      error: (error) => {
        this.errorHandler.handleError(error.data ? error.data : null);
        this.routing.navigate(['/keys']);
      },
    });
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
      .subscribe((translations) => {
        this.colDefs = [
          {
            headerName: translations['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
            field: 'number',
            cellStyle: this.cellStyleNumber.bind(this),
            headerComponent: HeaderWithHelper,
            headerComponentParams: {
              label: translations['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
              tooltip: translations['KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
              click: this.openHelper.bind(this),
            },
            headerTooltip: translations['KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
            minWidth: 120,
            suppressSizeToFit: false,
          },
          {
            headerName: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL'],
            field: 'va_percentage',
            cellStyle: this.cellStyleNumber.bind(this),
            headerComponent: HeaderWithHelper,
            headerComponentParams: {
              label: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_LABEL'],
              tooltip: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
              click: this.openHelper.bind(this),
            },
            headerTooltip: translations['KEY.TABLE.COLUMNS.VA_PERCENTAGE_TOOLTIP'],
            minWidth: 120,
            suppressSizeToFit: false,
          },
          {
            headerName: translations['KEY.TABLE.COLUMNS.CONSUMER_NAME_LABEL'],
            field: 'name',
            cellStyle: this.cellStyleNumber.bind(this),
            minWidth: 120,
            suppressSizeToFit: false,
            headerComponent: undefined,
          },
          {
            headerName: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL'],
            field: 'vp_percentage',
            cellStyle: this.cellStyleNumber.bind(this),
            headerComponent: HeaderWithHelper,
            headerComponentParams: {
              label: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_LABEL'],
              tooltip: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
              click: this.openHelper.bind(this),
            },
            headerTooltip: translations['KEY.TABLE.COLUMNS.CONSUMER_VAP_TOOLTIP'],
            minWidth: 120,
            suppressSizeToFit: false,
          },
        ];
      });
  }

  onGridReady(event: any) {
    this.rowData = this.formatData();
    this.gridApi = event.api;

    // Ensure columns are sized properly
    setTimeout(() => {
      this.gridApi.sizeColumnsToFit();
      this.gridApi.refreshHeader();
      this.gridApi.refreshCells({ force: true });
    }, 0);
  }

  deleteKey() {
    this.keyService.deleteKey(this.key!.id).subscribe({
      next: (response) => {
        if (response) {
          this.snackbarNotification.openSnackBar(
            this.translate.instant('KEY.SUCCESS.KEY_DELETED'),
            VALIDATION_TYPE,
          );
        } else {
          this.errorHandler.handleError();
        }
        this.routing.navigate(['/keys']);
      },
      error: (error) => {
        this.errorHandler.handleError(error.data ? error.data : null);
        this.routing.navigate(['/keys']);
      },
    });
  }

  exportExcel() {
    this.keyService.downloadKey(this.key!.id).subscribe({
      next: (response) => {
        if (response) {
          // Check if the response contains the blob/filename object
          if ('blob' in response) {
            this.snackbarNotification.openSnackBar(
              this.translate.instant('KEY.SUCCESS.KEY_EXPORTED'),
              VALIDATION_TYPE
            );

            const url = window.URL.createObjectURL(response.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.filename; // Use the dynamic filename!
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } else {
            // This is the ApiResponse error case
            this.errorHandler.handleError(response.data ? response.data : null);
          }
        }
      },
      error: (error) => this.errorHandler.handleError(error)
    });
  }

  updateKey() {
    this.routing.navigate(['/keys/add'], { queryParams: { id: this.key!.id } });
  }

  openHelper(displayText: string) {
    this.ref = this.dialogService.open(HelperDialog, {
      closable: true,
      modal: true,
      closeOnEscape: true,
      data: {
        displayText: displayText,
      },
    });
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.destroy();
    }
  }
}
