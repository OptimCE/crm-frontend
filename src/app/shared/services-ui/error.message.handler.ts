import {inject, Injectable} from '@angular/core';
import { SnackbarNotification } from './snackbar.notifcation.service';
import { TranslateService } from '@ngx-translate/core';
import { ERROR_TYPE } from '../../core/dtos/notification';

@Injectable({
  providedIn: 'root',
})
export class ErrorMessageHandler {
  private snackbarNotification = inject(SnackbarNotification)
  private translate = inject(TranslateService);

  handleError(message: any = undefined) {
    if (message) {
      this.snackbarNotification.openSnackBar(message, ERROR_TYPE);
    } else {
      this.snackbarNotification.openSnackBar(this.translate.instant('COMMON.ERRORS.EXCEPTION'), ERROR_TYPE);
    }
  }
}
