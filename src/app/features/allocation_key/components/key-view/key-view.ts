import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { KeyDTO } from '../../../../shared/dtos/key.dtos';
import { ActivatedRoute, Router } from '@angular/router';
import { KeyService } from '../../../../shared/services/key.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HeaderWithHelper } from './header-with-helper/header-with-helper';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { formatPercent, SlicePipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { CellClassParams, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { KeyTableRow } from '../../../../shared/types/key.types';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { LocaleService } from '../../../../core/services/language/locale.service';
@Component({
  selector: 'app-key-view',
  standalone: true,
  imports: [Button, Card, Skeleton, SlicePipe, AgGridAngular, TranslatePipe, BackArrow],
  templateUrl: './key-view.html',
  styleUrl: './key-view.css',
})
export class KeyView implements OnInit {
  private route = inject(ActivatedRoute);
  private keyService = inject(KeyService);
  readonly routing = inject(Router);
  private snackbarNotification = inject(SnackbarNotification);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorMessageHandler);
  private locale = inject(LocaleService).locale;

  readonly key = signal<KeyDTO | undefined>(undefined);
  readonly isLoaded = signal(false);
  readonly hasError = signal(false);
  readonly displayAllDescription = signal(false);
  readonly iterationCount = computed(() => this.key()?.iterations?.length ?? 0);
  readonly consumerCount = computed(() => {
    const k = this.key();
    if (!k?.iterations?.length) return 0;
    return k.iterations[0].consumers.length;
  });
  readonly rowData = signal<KeyTableRow[]>([]);
  readonly colDefs = signal<ColDef<KeyTableRow>[]>([]);
  public defaultColDef = {
    width: 250,
    flex: 1,
    minWidth: 140,
  };
  gridApi!: GridApi;
  frameworkComponents: Record<string, unknown> = {
    headerHelperRenderer: HeaderWithHelper,
  };

  static lastNumberCellStyleNumber = 0;

  colorGradient = [
    {
      backgroundColor: '#e8f5e9',
      visibility: 'visible',
      'border-bottom': '1px solid #c8e6c9',
    },
    {
      backgroundColor: '#c8e6c9',
      visibility: 'visible',
      'border-bottom': '1px solid #a5d6a7',
    },
    {
      backgroundColor: '#a5d6a7',
      visibility: 'visible',
      'border-bottom': '1px solid #81c784',
    },
  ];

  cellStyleNumber(params: CellClassParams<KeyTableRow>): {
    backgroundColor: string;
    visibility: string;
    'border-bottom': string;
  } {
    if (
      params.node.data &&
      params.node.data.number !== undefined &&
      params.node.data.number != KeyView.lastNumberCellStyleNumber
    ) {
      KeyView.lastNumberCellStyleNumber = params.node.data.number;
    }
    return this.colorGradient[KeyView.lastNumberCellStyleNumber - 1];
  }

  formatData(): KeyTableRow[] {
    const formattedData: KeyTableRow[] = [];
    let alreadyAdded = false;
    const key = this.key();
    const locale = this.locale();
    if (key && key.iterations) {
      key.iterations.forEach((iteration) => {
        alreadyAdded = false;
        iteration.consumers.forEach((consumer) => {
          let vp_percentage = formatPercent(consumer.energy_allocated_percentage, locale, '1.2-2');
          if (consumer.energy_allocated_percentage === -1) {
            vp_percentage = this.translate.instant('KEY.CREATE.PRORATA_LABEL') as string;
          }
          if (alreadyAdded) {
            formattedData.push({
              name: consumer.name,
              vp_percentage: vp_percentage,
            });
          } else {
            formattedData.push({
              number: iteration.number,
              va_percentage: formatPercent(iteration.energy_allocated_percentage, locale, '1.2-2'),
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

  ngOnInit(): void {
    KeyView.lastNumberCellStyleNumber = 0;
    this.loadColumnDefinitions();

    this.isLoaded.set(false);
    const idParam = this.route.snapshot.paramMap.get('id');
    const id: number = idParam !== null ? +idParam : -1;
    if (id == -1) {
      void this.routing.navigate(['/keys']);
    }
    this.keyService.getKey(id).subscribe({
      next: (response) => {
        if (response) {
          this.key.set(response.data as KeyDTO);
          this.isLoaded.set(true);
        } else {
          this.errorHandler.handleError();
          void this.routing.navigate(['/keys']);
        }
      },
      error: (error: unknown) => {
        this.errorHandler.handleError(extractApiErrorMessage(error));
        this.hasError.set(true);
      },
    });
  }

  loadColumnDefinitions(): void {
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
      .subscribe((translations: Record<string, string>) => {
        // The help text goes to HeaderWithHelper alone (its title + popover). TooltipModule is
        // registered here, so a headerTooltip would show the same text again in AG Grid's tooltip.
        this.colDefs.set([
          {
            headerName: translations['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
            field: 'number',
            cellStyle: this.cellStyleNumber.bind(this),
            headerComponent: HeaderWithHelper,
            headerComponentParams: {
              label: translations['KEY.TABLE.COLUMNS.ITERATION_NUMBER_LABEL'],
              tooltip: translations['KEY.TABLE.COLUMNS.ITERATION_TOOLTIP'],
            },
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
            },
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
            },
            minWidth: 120,
            suppressSizeToFit: false,
          },
        ]);
      });
  }

  onGridReady(event: GridReadyEvent): void {
    this.rowData.set(this.formatData());
    this.gridApi = event.api;

    // No sizeColumnsToFit(): every column is flex (defaultColDef), which already fills the grid and
    // follows its resizes. sizeColumnsToFit() turns flex off on the columns it resizes, so a load
    // narrower than the minWidths (a phone) would leave them stuck at 120 px on any wider screen.
    setTimeout((): void => {
      this.gridApi.refreshHeader();
      this.gridApi.refreshCells({ force: true });
    }, 0);
  }

  deleteKey(): void {
    const k = this.key();
    if (k) {
      this.keyService.deleteKey(k.id).subscribe({
        next: (response) => {
          if (response) {
            this.snackbarNotification.openSnackBar(
              this.translate.instant('KEY.SUCCESS.KEY_DELETED') as string,
              VALIDATION_TYPE,
            );
          } else {
            this.errorHandler.handleError();
          }
          void this.routing.navigate(['/keys']);
        },
        error: (error: unknown) => {
          this.errorHandler.handleError(extractApiErrorMessage(error));
          void this.routing.navigate(['/keys']);
        },
      });
    }
  }

  exportExcel(): void {
    const k = this.key();
    if (k) {
      this.keyService.downloadKey(k.id).subscribe({
        next: (response) => {
          if (response) {
            // Check if the response contains the blob/filename object
            if ('blob' in response) {
              this.snackbarNotification.openSnackBar(
                this.translate.instant('KEY.SUCCESS.KEY_EXPORTED') as string,
                VALIDATION_TYPE,
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
              // this.errorHandler.handleError(response.data ? response.data : null);
            }
          }
        },
        error: (error) => {
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
    }
  }

  updateKey(): void {
    const k = this.key();
    if (k) {
      void this.routing.navigate(['/keys/add'], { queryParams: { id: k.id } });
    }
  }

  toggleDescription(): void {
    this.displayAllDescription.update((v) => !v);
  }
}
