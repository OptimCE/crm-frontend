import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Tag } from 'primeng/tag';
import { Card } from 'primeng/card';
import { TranslatePipe } from '@ngx-translate/core';
import { MetersDataDTO } from '../../../../../shared/dtos/meter.dtos';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';
import { MemberType } from '../../../../../shared/types/member.types';
import { MapNumberStringPipe } from '../../../../../shared/pipes/map-number-string/map-number-string-pipe';

@Component({
  selector: 'app-meter-data-view',
  imports: [Card, DatePipe, MapNumberStringPipe, Tag, TranslatePipe],
  templateUrl: './meter-data-view.html',
  styleUrl: './meter-data-view.css',
})
export class MeterDataView {
  readonly meterData = input.required<MetersDataDTO>();
  readonly productionChainMap = input.required<string[]>();
  readonly injectionStatusMap = input.required<string[]>();
  readonly rateMap = input.required<string[]>();
  readonly clientTypeMap = input.required<string[]>();
  protected readonly MeterStatus = MeterDataStatus;
  protected readonly MemberType = MemberType;
}
