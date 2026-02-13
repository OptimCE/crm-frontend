import { inject, Pipe, PipeTransform } from '@angular/core';
import { Role } from '../../../core/dtos/role';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'role',
})
export class RolePipe implements PipeTransform {
  private translateService = inject(TranslateService);
  transform(value: Role): string {
    switch (value) {
      case Role.ADMIN:
        return this.translateService.instant('COMMON.ROLE.ADMIN');
      case Role.GESTIONNAIRE:
        return this.translateService.instant('COMMON.ROLE.MANAGER');
      case Role.MEMBER:
        return this.translateService.instant('COMMON.ROLE.MEMBER');
      default:
        return '/';
    }
  }
}
