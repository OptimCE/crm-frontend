import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import {
  PreferenceRow,
  preferencesFromRows,
  rowsFromPreferences,
} from '../../../../../../notifications/services/notification-preference.mapper';
import { NotificationService } from '../../../../../../notifications/services/notification.service';

/**
 * Per-recipient notification preferences.
 *
 * The mapping between "toggles the user sees" and "rows the backend stores" is
 * deliberately NOT here: it lives in `notification-preference.mapper`, which is
 * pure and specced. Absence-means-opted-in is exactly the sort of rule that
 * inverts silently, and a TestBed component spec cannot run on this repo's
 * pinned Node.
 */
@Component({
  selector: 'app-notification-preferences-user',
  imports: [TranslatePipe, TableModule, ToggleSwitch, FormsModule, Button],
  templateUrl: './notification-preferences.component.html',
  styleUrl: './notification-preferences.component.css',
  providers: [ErrorMessageHandler],
})
export class NotificationPreferencesComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = signal<PreferenceRow[]>([]);
  readonly loading = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly saved = signal<boolean>(false);
  readonly hasRows = computed(() => this.rows().length > 0);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.notificationService
      .preferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rows.set(rowsFromPreferences(response.data));
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.errorHandler.handleError(error);
        },
      });
  }

  save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.notificationService
      .savePreferences(preferencesFromRows(this.rows()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Re-render from what the server actually stored rather than from the
          // local edit, so a rejected row cannot leave the UI claiming a setting
          // that does not exist.
          this.rows.set(rowsFromPreferences(response.data));
          this.saving.set(false);
          this.saved.set(true);
        },
        error: (error) => {
          this.saving.set(false);
          this.errorHandler.handleError(error);
        },
      });
  }

  /** Any edit clears the confirmation, so it cannot linger over unsaved changes. */
  onToggle(): void {
    this.saved.set(false);
  }
}
