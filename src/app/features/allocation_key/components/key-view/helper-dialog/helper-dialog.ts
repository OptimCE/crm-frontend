import {Component, OnInit} from '@angular/core';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';

@Component({
  selector: 'app-helper-dialog',
  standalone: true,
  imports: [],
  templateUrl: './helper-dialog.html',
  styleUrl: './helper-dialog.css',
})
export class HelperDialog implements OnInit{
  displayedText!: string;
  constructor(private config: DynamicDialogConfig,
              private ref: DynamicDialogRef) {

  }

  ngOnInit() {
    const text = this.config.data.displayText;
    if(text) {
      this.displayedText = text;
    }else{
      this.ref.close();
    }
  }
}
