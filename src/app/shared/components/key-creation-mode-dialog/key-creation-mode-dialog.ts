import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

/** The two ways of building an allocation key, both reachable from every "create a key" button. */
export type KeyCreationMode = 'full' | 'step';

interface ModeOption {
  readonly mode: KeyCreationMode;
  readonly icon: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly actionKey: string;
}

/**
 * Asks how the user wants to build a key, instead of hiding the wizard behind a split button whose
 * visible half looked like it could not make a standard key.
 *
 * Picking a card acts straight away — the descriptions are the explanation, so a second "confirm"
 * click would add nothing. Closes with the chosen mode, or `null` when dismissed.
 */
@Component({
  selector: 'app-key-creation-mode-dialog',
  standalone: true,
  imports: [TranslatePipe, Button],
  templateUrl: './key-creation-mode-dialog.html',
  styleUrl: './key-creation-mode-dialog.css',
})
export class KeyCreationModeDialog {
  private readonly ref = inject(DynamicDialogRef);

  readonly options: readonly ModeOption[] = [
    {
      mode: 'full',
      icon: 'pi pi-table',
      titleKey: 'KEY.CREATE_MODE.FULL.TITLE',
      descriptionKey: 'KEY.CREATE_MODE.FULL.DESCRIPTION',
      actionKey: 'KEY.CREATE_MODE.FULL.ACTION',
    },
    {
      mode: 'step',
      icon: 'pi pi-list-check',
      titleKey: 'KEY.CREATE_MODE.STEP.TITLE',
      descriptionKey: 'KEY.CREATE_MODE.STEP.DESCRIPTION',
      actionKey: 'KEY.CREATE_MODE.STEP.ACTION',
    },
  ];

  choose(mode: KeyCreationMode): void {
    this.ref.close(mode);
  }

  close(): void {
    this.ref.close(null);
  }
}
