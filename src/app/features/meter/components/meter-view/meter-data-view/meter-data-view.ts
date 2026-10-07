import { Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { Card } from 'primeng/card';
import { TranslatePipe } from '@ngx-translate/core';
import {
  injectionStatusFromApi,
  MetersDataDTO,
  productionChainFromApi,
} from '../../../../../shared/dtos/meter.dtos';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';
import { MemberType } from '../../../../../shared/types/member.types';
import { MapNumberStringPipe } from '../../../../../shared/pipes/map-number-string/map-number-string-pipe';
import { LocaleDatePipe } from '../../../../../shared/pipes/locale-format/locale-format-pipes';

@Component({
  selector: 'app-meter-data-view',
  imports: [Card, LocaleDatePipe, MapNumberStringPipe, Tag, TranslatePipe],
  templateUrl: './meter-data-view.html',
  styleUrl: './meter-data-view.css',
})
export class MeterDataView {
  readonly meterData = input.required<MetersDataDTO>();
  readonly productionChainMap = input.required<string[]>();
  readonly injectionStatusMap = input.required<string[]>();
  readonly rateMap = input.required<string[]>();
  readonly clientTypeMap = input.required<string[]>();
  // "Aucun" is stored as null, which no map index matches: show it as the NONE label.
  protected readonly productionChain = computed(() =>
    productionChainFromApi(this.meterData().production_chain),
  );
  protected readonly injectionStatus = computed(() =>
    injectionStatusFromApi(this.meterData().injection_status),
  );
  protected readonly MeterStatus = MeterDataStatus;
  protected readonly MemberType = MemberType;
}
