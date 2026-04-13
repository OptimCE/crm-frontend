import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Button } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Table, TableLazyLoadEvent, TableModule, TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MemberPartialQuery, MembersPartialDTO } from '../../../../shared/dtos/member.dtos';
import { MemberType, MemberStatus } from '../../../../shared/types/member.types';
import { MemberService } from '../../../../shared/services/member.service';
import { Router } from '@angular/router';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { MemberInvite } from '../member-invite/member-invite';
import { InvitationService } from '../../../../shared/services/invitation.service';
import { MemberCreationUpdate } from '../member-creation-update/member-creation-update';
import { MeterCreation } from '../../../meter/components/meter-creation/meter-creation';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { MemberPendingInvite } from '../member-pending-invite/member-pending-invite';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { HeaderPage } from '../../../../layout/header-page/header-page';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { DebouncedPInputComponent } from '../../../../shared/components/debounced-p-input/debounced-p-input.component';

@Component({
  selector: 'app-members-list',
  imports: [
    Toast,
    ConfirmDialog,
    Button,
    TranslatePipe,
    TableModule,
    TagModule,
    Select,
    FormsModule,
    HeaderPage,
    InputGroup,
    InputGroupAddonModule,
    DebouncedPInputComponent,
  ],
  templateUrl: './members-list.html',
  styleUrl: './members-list.css',
  providers: [DialogService, ErrorMessageHandler, ConfirmationService, MessageService],
})
export class MembersList {
  private membersService = inject(MemberService);
  private invitationService = inject(InvitationService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private snackbarNotification = inject(SnackbarNotification);
  private errorHandler = inject(ErrorMessageHandler);
  private translate = inject(TranslateService);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);

  readonly membersPartialList = signal<MembersPartialDTO[]>([]);
  ref?: DynamicDialogRef | null;

  readonly paginationInfo = signal({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });
  readonly filter = signal<MemberPartialQuery>({ page: 1, limit: 10 });
  readonly currentPageReportTemplate = signal<string>('');
  readonly loading = signal<boolean>(true);

  // Filter signals
  readonly searchField = signal<string>('name');
  readonly searchText = signal<string>('');
  readonly typeFilter = signal<MemberType | null>(null);
  readonly statusFilter = signal<MemberStatus | null>(null);
  readonly hasActiveFilters = computed(
    () => !!this.searchText() || this.typeFilter() !== null || this.statusFilter() !== null,
  );
  readonly firstRow = computed(
    () => (this.paginationInfo().page - 1) * this.paginationInfo().limit,
  );
  readonly showPaginator = computed(() => this.paginationInfo().total_pages > 1);

  searchFieldOptions = [{ label: 'MEMBER.LIST.NAME_LABEL', value: 'name' }];

  typeOptions = [
    {
      label: 'MEMBER.LIST.TYPE.INDIVIDUAL_LABEL',
      value: MemberType.INDIVIDUAL,
      icon: 'pi pi-user',
    },
    { label: 'MEMBER.LIST.TYPE.COMPANY_LABEL', value: MemberType.COMPANY, icon: 'pi pi-building' },
  ];

  statusOptions = [
    {
      label: 'MEMBER.VIEW.STATUS.ACTIVE_LABEL',
      value: MemberStatus.ACTIVE,
      severity: 'success' as const,
    },
    {
      label: 'MEMBER.VIEW.STATUS.INACTIVE_LABEL',
      value: MemberStatus.INACTIVE,
      severity: 'danger' as const,
    },
    {
      label: 'MEMBER.VIEW.STATUS.PENDING_LABEL',
      value: MemberStatus.PENDING,
      severity: 'warn' as const,
    },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => this.ref?.destroy());
    this.updatePaginationTranslation();
  }

  updatePaginationTranslation(): void {
    this.translate
      .get('MEMBER.LIST.PAGE_REPORT_TEMPLATE_MEMBER_LABEL', {
        page: this.paginationInfo().page,
        total_pages: this.paginationInfo().total_pages,
        total: this.paginationInfo().total,
      })
      .subscribe((translatedText: string) => {
        this.currentPageReportTemplate.set(translatedText);
      });
  }

  loadMembers(): void {
    this.loading.set(true);
    this.membersService.getMembersList(this.filter()).subscribe({
      next: (response) => {
        if (response) {
          this.membersPartialList.set(response.data as MembersPartialDTO[]);
          this.paginationInfo.set(response.pagination);
          this.updatePaginationTranslation();
        } else {
          this.errorHandler.handleError(response);
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.errorHandler.handleError(error);
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    const current: MemberPartialQuery = { page: 1, limit: this.filter().limit };
    const text = this.searchText();
    if (text) {
      current.name = text;
    }
    const type = this.typeFilter();
    if (type !== null) {
      current.member_type = type;
    }
    const status = this.statusFilter();
    if (status !== null) {
      current.status = status;
    }
    this.filter.set(current);
    this.loadMembers();
  }

  onSearchTextChange(query: string): void {
    this.searchText.set(query);
    this.applyFilters();
  }

  onSearchFieldChange(): void {
    if (this.searchText()) {
      this.applyFilters();
    }
  }

  onTypeFilterChange(type: MemberType | null): void {
    this.typeFilter.set(type);
    this.applyFilters();
  }

  onStatusFilterChange(status: MemberStatus | null): void {
    this.statusFilter.set(status);
    this.applyFilters();
  }

  onInviteMember(): void {
    this.ref = this.dialogService.open(MemberInvite, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.INVITE_MEMBER_HEADER') as string,
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((email: unknown) => {
        if (typeof email === 'string' && email) {
          this.invitationService.inviteUserToBecomeMember({ user_email: email }).subscribe({
            next: (response) => {
              if (response) {
                console.log('success');
              } else {
                console.error(response);
              }
            },
            error: (error) => {
              console.error(error);
            },
          });
        }
      });
    }
  }

  onAddMember(event: Event): void {
    this.ref = this.dialogService.open(MemberCreationUpdate, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.ADD_MEMBER_HEADER') as string,
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: unknown) => {
        if (typeof result === 'number' && result > 0) {
          this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: this.translate.instant(
              'MEMBER.LIST.ADD_METER_FOR_MEMBER_CONFIRMATION_LABEL',
            ) as string,
            header: this.translate.instant('MEMBER.LIST.CONFIRMATION_HEADER') as string,
            icon: 'pi pi-exclamation-triangle',
            acceptIcon: 'none',
            rejectIcon: 'none',
            acceptLabel: this.translate.instant('COMMON.ACTIONS.YES') as string,
            rejectLabel: this.translate.instant('COMMON.ACTIONS.NO') as string,
            rejectButtonStyleClass: 'p-button-text',
            accept: () => {
              this.addMeter(result);
            },
            reject: () => {
              this.addMemberSuccess();
            },
          });
        }
      });
    }
  }

  addMeter(member_id: number): void {
    this.ref = this.dialogService.open(MeterCreation, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      width: '700px',
      header: this.translate.instant('MEMBER.LIST.ADD_METER_HEADER') as string,
      data: {
        holder_id: member_id,
      },
    });
    if (this.ref) {
      this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
        if (response) {
          this.snackbarNotification.openSnackBar(
            this.translate.instant('MEMBER.LIST.METER_MEMBER_ADDED_SUCCESSFULLY_LABEL') as string,
            VALIDATION_TYPE,
          );
          this.loadMembers();
        }
      });
    }
  }

  addMemberSuccess(): void {
    this.snackbarNotification.openSnackBar(
      this.translate.instant('MEMBER.LIST.MEMBER_ADDED_SUCCESSFULLY_LABEL') as string,
      VALIDATION_TYPE,
    );
    this.loadMembers();
  }

  lazyLoadMembers($event: TableLazyLoadEvent): void {
    const current: MemberPartialQuery = { ...this.filter() };
    if ($event.first !== undefined && $event.rows !== undefined) {
      current.page = $event.rows ? $event.first / $event.rows + 1 : 1;
    }
    if (current.page < 1) {
      current.page = 1;
    }
    this.filter.set(current);
    this.loadMembers();
  }

  pageChange($event: TablePageEvent): void {
    const current: MemberPartialQuery = { ...this.filter() };
    current.page = ($event.first ?? 0) / ($event.rows ?? 10) + 1;
    this.filter.set(current);
    this.loadMembers();
  }

  clear(table: Table): void {
    table.clear();
    this.searchText.set('');
    this.searchField.set('name');
    this.typeFilter.set(null);
    this.statusFilter.set(null);
    this.filter.set({ page: 1, limit: 10 });
    this.loadMembers();
  }

  onRowClick(member: MembersPartialDTO): void {
    void this.router.navigate(['/members/', member.id]);
  }

  seePendingInvite(): void {
    this.ref = this.dialogService.open(MemberPendingInvite, {
      modal: true,
      closable: true,
      closeOnEscape: true,
      header: this.translate.instant('MEMBER.LIST.PENDING_INVITATION_HEADER') as string,
    });
  }

  protected readonly MemberType = MemberType;
  protected readonly MemberStatus = MemberStatus;
}
