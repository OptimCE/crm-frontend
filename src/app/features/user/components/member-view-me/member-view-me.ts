import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Avatar } from 'primeng/avatar';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Button } from 'primeng/button';

import { MeService } from '../../../../shared/services/me.service';
import { MeCompanyDTO, MeIndividualDTO } from '../../../../shared/dtos/me.dtos';
import { MemberStatus, MemberType } from '../../../../shared/types/member.types';
import { AddressPipe } from '../../../../shared/pipes/address/address-pipe';
import { BackArrow } from '../../../../layout/back-arrow/back-arrow';
import { MemberViewBankingInfoTab } from '../../../member/components/member-view/member-view-tabs/tabs/member-view-banking-info-tab/member-view-banking-info-tab';
import { MemberViewManagerTab } from '../../../member/components/member-view/member-view-tabs/tabs/member-view-manager-tab/member-view-manager-tab';

@Component({
  selector: 'app-member-view-me',
  standalone: true,
  imports: [
    TranslatePipe,
    Avatar,
    Card,
    Skeleton,
    Tag,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Button,
    AddressPipe,
    BackArrow,
    MemberViewBankingInfoTab,
    MemberViewManagerTab,
  ],
  templateUrl: './member-view-me.html',
  styleUrl: './member-view-me.css',
})
export class MemberViewMe implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private meService = inject(MeService);
  private destroyRef = inject(DestroyRef);

  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);
  readonly id = signal<number>(0);
  readonly individual = signal<MeIndividualDTO | undefined>(undefined);
  readonly legalEntity = signal<MeCompanyDTO | undefined>(undefined);

  readonly member = computed(() => this.individual() ?? this.legalEntity());
  readonly status = computed(() => this.member()?.status);
  readonly membersType = computed(() => this.member()?.member_type);
  readonly manager = computed(() => this.individual()?.manager ?? this.legalEntity()?.manager);

  protected readonly memberInitials = computed(() => {
    const ind = this.individual();
    if (ind) return ((ind.first_name?.[0] ?? '') + (ind.name?.[0] ?? '')).toUpperCase() || '?';
    const le = this.legalEntity();
    if (le) return (le.name?.[0] ?? '').toUpperCase() || '?';
    return '?';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (id === '') {
      void this.router.navigate(['/users']);
      return;
    }
    this.id.set(+id);
    if (this.id()) {
      this.loadMember();
    }
  }

  loadMember(): void {
    this.hasError.set(false);
    this.isLoading.set(true);
    this.meService
      .getMemberById(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response) {
            const memberData = response.data as MeIndividualDTO | MeCompanyDTO;
            if (memberData.member_type === MemberType.INDIVIDUAL) {
              this.individual.set(memberData as MeIndividualDTO);
              this.legalEntity.set(undefined);
            } else if (memberData.member_type === MemberType.COMPANY) {
              this.legalEntity.set(memberData as MeCompanyDTO);
              this.individual.set(undefined);
            }
          } else {
            this.hasError.set(true);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  protected readonly MemberType = MemberType;
  protected readonly MemberStatus = MemberStatus;
}
