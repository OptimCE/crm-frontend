import {Component, OnInit} from '@angular/core';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {ErrorHandlerComponent} from '../../../../shared/components/error.handler/error.handler.component';
import {Button} from 'primeng/button';
import {RadioButtonModule} from 'primeng/radiobutton';
import {InputTextModule} from 'primeng/inputtext';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ErrorMessageHandler} from '../../../../shared/services-ui/error.message.handler';
import {SharingOperationService} from '../../../../shared/services/sharing_operation.service';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import {SharingOperationType} from '../../../../shared/types/sharing_operation.types';
import {CreateSharingOperationDTO} from '../../../../shared/dtos/sharing_operation.dtos';

@Component({
  selector: 'app-sharing-operation-creation-update',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule, RadioButtonModule, Button, ErrorHandlerComponent, TranslatePipe],
  templateUrl: './sharing-operation-creation-update.html',
  styleUrl: './sharing-operation-creation-update.css',
  providers: [ErrorMessageHandler],
})
export class SharingOperationCreationUpdate implements OnInit {
  formAddSharingOp!: FormGroup;
  categories: any[] = [];
  constructor(
    private sharingOpService: SharingOperationService,
    private ref: DynamicDialogRef,
    private translate: TranslateService,
    private errorHandler: ErrorMessageHandler,
  ) {}

  ngOnInit(): void {
    this.formAddSharingOp = new FormGroup({
      name: new FormControl(null, Validators.required),
      type: new FormControl(null, Validators.required),
    });
    this.setupTranslationCategory();
  }
  setupTranslationCategory() {
    this.setupECCategory();
  }

  setupECCategory() {
    this.translate
      .get([
        'SHARING_OPERATION.TYPE.INSIDE_BUILDING',
        'SHARING_OPERATION.TYPE.CER',
        'SHARING_OPERATION.TYPE.CEC'])
      .subscribe((translation) => {
        this.categories = [
          { key: SharingOperationType.LOCAL, value: translation['SHARING_OPERATION.TYPE.INSIDE_BUILDING'] },
          { key: SharingOperationType.CER, value: translation['SHARING_OPERATION.TYPE.CER'] },
          { key: SharingOperationType.CEC, value: translation['SHARING_OPERATION.TYPE.CEC'] },
        ];
      });
  }
  onSubmitForm() {
    if (this.formAddSharingOp.invalid) {
      return;
    }
    const newSharing: CreateSharingOperationDTO ={
      name: this.formAddSharingOp.value.name, type: this.formAddSharingOp.value.type

    }
    this.sharingOpService.createSharingOperation(newSharing).subscribe(
      {
        next:(response)=>
        {
          if (response) {
            this.ref.close(true);
          } else {
            this.errorHandler.handleError(response);
          }
        },
        error: (error) => {
          this.errorHandler.handleError(error);
        },
      }
    );
  }
}
