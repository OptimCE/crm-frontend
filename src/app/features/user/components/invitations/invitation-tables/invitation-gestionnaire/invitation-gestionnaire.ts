import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Pagination } from '../../../../../../core/dtos/api.response';
import {
  UserManagerInvitationDTO,
  UserManagerInvitationQuery,
} from '../../../../../../shared/dtos/invitation.dtos';
import { InvitationService } from '../../../../../../shared/services/invitation.service';
import { DialogService } from 'primeng/dynamicdialog';
import { MeService } from '../../../../../../shared/services/me.service';
import { DebouncedPInputComponent } from '../../../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-invitation-gestionnaire',
  imports: [TableModule, TranslatePipe, Button, DebouncedPInputComponent],
  templateUrl: './invitation-gestionnaire.html',
  styleUrl: './invitation-gestionnaire.css',
  providers: [DialogService],
})
export class InvitationGestionnaire {
  private invitationService = inject(InvitationService);
  private meService = inject(MeService);
  private destroyRef = inject(DestroyRef);

  readonly pagination = signal<Pagination>({ page: 1, total: 0, total_pages: 1, limit: 10 });
  readonly gestionnaireInvitation = signal<UserManagerInvitationDTO[]>([]);
  readonly loading = signal<boolean>(false);
  readonly filter = signal<UserManagerInvitationQuery>({ page: 1, limit: 10 });
  readonly currentPageReportTemplate = signal<string>('');

  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);

  // Filter signals
  readonly searchText = signal<string>('');
  readonly hasActiveFilters = computed(() => !!this.searchText());

  applyFilters(): void {
    const current: UserManagerInvitationQuery = { page: 1, limit: this.filter().limit };

    const text = this.searchText();
    if (text) {
      current.name = text;
    }

    this.filter.set(current);
    this.loadGestionnaireInvitation();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.filter.set({ page: 1, limit: 10 });
    this.loadGestionnaireInvitation();
  }

  loadGestionnaireInvitation(): void {
    this.loading.set(true);
    this.meService
      .getOwnManagerPendingInvitation(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.gestionnaireInvitation.set(response.data as UserManagerInvitationDTO[]);
            if (response.pagination) {
              this.pagination.set(response.pagination);
            }
          }
          this.loading.set(false);
        },
        error: (error) => {
          console.error(error);
          this.loading.set(false);
        },
      });
  }

  lazyLoadGestionnaireInvitation($event: TableLazyLoadEvent): void {
    const current: UserManagerInvitationQuery = { ...this.filter() };

    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }

    this.filter.set(current);
    this.loadGestionnaireInvitation();
  }

  pageChange($event: TablePageEvent): void {
    const current: UserManagerInvitationQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadGestionnaireInvitation();
  }

  acceptGestionnaireInvitation(invitation: UserManagerInvitationDTO): void {
    this.meService
      .acceptInvitationManager({ invitation_id: invitation.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadGestionnaireInvitation();
          }
        },
        error: (error) => {
          console.error(error);
        },
      });
  }

  refuseGestionnaireInvitation(invitation: UserManagerInvitationDTO): void {
    this.meService
      .refuseManagerInvitation(invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadGestionnaireInvitation();
          }
        },
        error: (error) => {
          console.error(error);
        },
      });
  }
}
