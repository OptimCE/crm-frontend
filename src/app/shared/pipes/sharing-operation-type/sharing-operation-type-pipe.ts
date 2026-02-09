import {inject, Pipe, PipeTransform} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {SharingOperationType} from '../../types/sharing_operation.types';

@Pipe({
  name: 'sharingOperationType',
  standalone: true,
})
export class SharingOperationTypePipe implements PipeTransform {
  private translate = inject(TranslateService)
  type_dict = [
    { id: SharingOperationType.LOCAL, name: this.translate.instant('SHARING_OPERATION.TYPE.INSIDE_BUILDING') },
    { id: SharingOperationType.CER, name: this.translate.instant('SHARING_OPERATION.TYPE.CER')  },
    { id: SharingOperationType.CEC, name: this.translate.instant('SHARING_OPERATION.TYPE.CEC')  },
  ];
  constructor() {
  }
  transform(value: number): string {
    const type = this.type_dict.find((x) => x.id === value);
    if (type) {
      return type.name;
    }
    return 'Unknown';
  }
}
