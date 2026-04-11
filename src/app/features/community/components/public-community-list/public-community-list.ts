import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TagModule } from 'primeng/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { PublicCommunityDTO, CommunityDetailDTO } from '../../../../shared/dtos/community.dtos';
import { CommunityService } from '../../../../shared/services/community.service';
import { HeaderPage } from '../../../../layout/header-page/header-page';

@Component({
  selector: 'app-public-community-list',
  standalone: true,
  imports: [TagModule, TranslatePipe, DatePipe, HeaderPage],
  templateUrl: './public-community-list.html',
  styleUrl: './public-community-list.css',
})
export class PublicCommunityList {
  private communityService = inject(CommunityService);
  private destroyRef = inject(DestroyRef);

  communities = signal<PublicCommunityDTO[]>([]);
  communityDetails = signal<Map<number, CommunityDetailDTO>>(new Map());
  expandedCommunityId = signal<number | null>(null);
  brokenLogos = signal<Set<number>>(new Set());

  onLogoError(communityId: number): void {
    const updated = new Set(this.brokenLogos());
    updated.add(communityId);
    this.brokenLogos.set(updated);
  }

  hasValidLogo(community: PublicCommunityDTO): boolean {
    return !!community.logo_url && !this.brokenLogos().has(community.id);
  }

  constructor() {
    this.loadPublicCommunities();
  }

  private loadPublicCommunities(): void {
    this.communityService
      .getPublicCommunities({ page: 1, limit: 10 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response) {
          this.communities.set(response.data as PublicCommunityDTO[]);
        }
      });
  }

  private loadCommunityDetail(communityId: number): void {
    if (this.communityDetails().has(communityId)) {
      return;
    }
    this.communityService
      .getCommunityDetail(communityId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        if (response?.data) {
          const updatedMap = new Map(this.communityDetails());
          updatedMap.set(communityId, response.data);
          this.communityDetails.set(updatedMap);
        }
      });
  }

  toggleAccordion(communityId: number): void {
    if (this.expandedCommunityId() === communityId) {
      this.expandedCommunityId.set(null);
    } else {
      this.expandedCommunityId.set(communityId);
      this.loadCommunityDetail(communityId);
    }
  }

  isExpanded(communityId: number): boolean {
    return this.expandedCommunityId() === communityId;
  }

  getCommunityDetail(id: number): CommunityDetailDTO | undefined {
    return this.communityDetails().get(id);
  }
}
