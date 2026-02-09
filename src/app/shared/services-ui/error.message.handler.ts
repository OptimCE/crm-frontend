import {Injectable} from '@angular/core';
import {SnackbarNotification} from './snackbar.notifcation.service';
import {TranslateService} from '@ngx-translate/core';
import {ERROR_TYPE} from '../../core/dtos/notification';

@Injectable({
  providedIn: 'root',
})
export class ErrorMessageHandler {
  constructor(
    private snackbarNotification: SnackbarNotification,
    private translate: TranslateService,
  ) {}

  handleError(message: any = undefined) {
    let translationKey = 'COMMON.ERRORS.EXCEPTION';
    if (message){
      this.snackbarNotification.openSnackBar(message, ERROR_TYPE)
    }else{
      this.snackbarNotification.openSnackBar(this.translate.instant(translationKey), ERROR_TYPE);
    }
  }
}
