import { Component, inject, OnInit } from '@angular/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-helper-dialog',
  standalone: true,
  imports: [],
  templateUrl: './helper-dialog.html',
  styleUrl: './helper-dialog.css',
})
export class HelperDialog implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  displayedText!: string;

  ngOnInit() {
    const text = this.config.data.displayText;
    if (text) {
      this.displayedText = text;
    } else {
      this.ref.close();
    }
  }
}
