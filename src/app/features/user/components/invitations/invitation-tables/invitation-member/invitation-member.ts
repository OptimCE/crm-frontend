import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { DatePipe } from '@angular/common';
import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../../core/dtos/api.response';
import {
  UserMemberInvitationDTO,
  UserMemberInvitationQuery,
} from '../../../../../../shared/dtos/invitation.dtos';
import { InvitationService } from '../../../../../../shared/services/invitation.service';
import { EncodeNewMemberSelfComponent } from './dialogs/encode-new-member/encode-new-member-self.component';
import { CompanyDTO, IndividualDTO } from '../../../../../../shared/dtos/member.dtos';
import { InvitationDetailComponent } from './dialogs/invitation-detail/invitation-detail.component';
import { MeService } from '../../../../../../shared/services/me.service';
import { DebouncedPInputComponent } from '../../../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-invitation-member',
  imports: [
    TableModule,
    TranslatePipe,
    Tag,
    Button,
    DatePipe,
    Select,
    FormsModule,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './invitation-member.html',
  styleUrl: './invitation-member.css',
  providers: [DialogService],
})
export class InvitationMember {
  private invitationService = inject(InvitationService);
  private meService = inject(MeService);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly pagination = signal<Pagination>({ page: 1, total: 0, total_pages: 1, limit: 10 });
  readonly invitations = signal<UserMemberInvitationDTO[]>([]);
  readonly loading = signal<boolean>(false);
  readonly filter = signal<UserMemberInvitationQuery>({ page: 1, limit: 10 });
  readonly currentPageReportTemplate = signal<string>('');

  readonly firstRow = computed(() => (this.pagination().page - 1) * this.pagination().limit);
  readonly showPaginator = computed(() => this.pagination().total_pages > 1);

  // Filter signals
  readonly searchText = signal<string>('');
  readonly stateFilter = signal<boolean | null>(null);
  readonly hasActiveFilters = computed(() => !!this.searchText() || this.stateFilter() !== null);

  stateOptions = [
    { label: 'INVITATION.MEMBER.TO_BE_ENCODED', value: true },
    { label: 'INVITATION.MEMBER.ENCODED', value: false },
  ];

  private ref: DynamicDialogRef | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
  }

  applyFilters(): void {
    const current: UserMemberInvitationQuery = { page: 1, limit: this.filter().limit };

    const text = this.searchText();
    if (text) {
      current.name = text;
    }

    const state = this.stateFilter();
    if (state !== null) {
      current.to_be_encoded = state;
    }

    this.filter.set(current);
    this.loadMemberInvitation();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  onStateFilterChange(state: boolean | null): void {
    this.stateFilter.set(state);
    this.applyFilters();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.stateFilter.set(null);
    this.filter.set({ page: 1, limit: 10 });
    this.loadMemberInvitation();
  }

  loadMemberInvitation(): void {
    this.loading.set(true);
    this.meService
      .getOwnMembersPendingInviation(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ApiResponsePaginated<UserMemberInvitationDTO[] | string>) => {
          if (response && response.data) {
            this.invitations.set(response.data as UserMemberInvitationDTO[]);
            if (response.pagination) {
              this.pagination.set(response.pagination);
            }
          }
          this.loading.set(false);
        },
        error: (error: unknown) => {
          console.error(error);
          this.loading.set(false);
        },
      });
  }

  lazyLoadMemberInvitation($event: TableLazyLoadEvent): void {
    const current: UserMemberInvitationQuery = { ...this.filter() };

    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }

    this.filter.set(current);
    this.loadMemberInvitation();
  }

  pageChange($event: TablePageEvent): void {
    const current: UserMemberInvitationQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadMemberInvitation();
  }

  acceptInvitation(invitation: UserMemberInvitationDTO): void {
    this.meService
      .acceptInvitationMember({ invitation_id: invitation.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadMemberInvitation();
          }
        },
        error: (error: unknown) => {
          console.error(error);
        },
      });
  }

  refuseInvitation(invitation: UserMemberInvitationDTO): void {
    this.meService
      .refuseMemberInvitation(invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            this.loadMemberInvitation();
          }
        },
        error: (error: unknown) => {
          console.error(error);
        },
      });
  }

  fetchDetail(invitation: UserMemberInvitationDTO): void {
    this.meService
      .getOwnMemberPendingInvitationById(invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response: ApiResponse<IndividualDTO | CompanyDTO | string>) => {
        if (response && response.data) {
          const data = response.data as IndividualDTO | CompanyDTO;
          this.ref = this.dialogService.open(InvitationDetailComponent, {
            header: this.translate.instant('INVITATION.MEMBER.SEE_DETAIL.TITLE') as string,
            modal: true,
            closable: true,
            closeOnEscape: true,
            data: {
              member: data,
              member_type: data.member_type,
            },
          });
        }
      });
  }

  encodeNewMember(invitation: UserMemberInvitationDTO): void {
    this.ref = this.dialogService.open(EncodeNewMemberSelfComponent, {
      header: this.translate.instant('INVITATION.ENCODE_NEW_MEMBER_TITLE') as string,
      modal: true,
      closable: true,
      closeOnEscape: true,
      data: {
        invitationID: invitation.id,
      },
    });
    this.ref?.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: boolean) => {
      if (result) {
        this.loadMemberInvitation();
      }
    });
  }
}
