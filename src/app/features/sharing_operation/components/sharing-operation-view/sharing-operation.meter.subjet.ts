import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SharingOperationMeterEventService {
  private meterAddedSource = new Subject<void>();
  meterAdded$ = this.meterAddedSource.asObservable();

  notifyMeterAdded(): void {
    this.meterAddedSource.next();
  }
}
