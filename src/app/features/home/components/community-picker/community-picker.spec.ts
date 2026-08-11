import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { MyCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { CommunityPicker } from './community-picker';

function community(overrides: Partial<MyCommunityDTO> = {}): MyCommunityDTO {
  return {
    id: 1,
    auth_community_id: 'org-a',
    name: 'CE de Namur',
    role: Role.MEMBER,
    ...overrides,
  } as MyCommunityDTO;
}

describe('CommunityPicker', () => {
  let fixture: ComponentFixture<CommunityPicker>;
  let switchCommunity: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    switchCommunity = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CommunityPicker, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: UserContextService,
          useValue: { switchCommunity, activeCommunityId: signal<string | null>(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityPicker);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fixture.componentRef.setInput('communities', [community()]);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('failed', false);
    fixture.detectChanges();
  });

  it('switches the community and then navigates', () => {
    fixture.componentInstance.enter(community());

    // Order matters: navigating first would land on /dashboard while
    // `activeCommunityGuard` still sees no community, and bounce straight back.
    expect(switchCommunity).toHaveBeenCalledWith('org-a');
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('resumes the route the guard interrupted', () => {
    fixture.componentRef.setInput('returnUrl', '/billing');
    fixture.detectChanges();

    fixture.componentInstance.enter(community());

    expect(navigateByUrl).toHaveBeenCalledWith('/billing');
  });

  it('refuses a returnUrl that would leave the site', () => {
    // The value reaches `navigateByUrl` and arrives from the query string, so a
    // crafted link could otherwise steer the user off-site.
    fixture.componentRef.setInput('returnUrl', '//evil.example');
    fixture.detectChanges();

    fixture.componentInstance.enter(community());

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a busy state on the community being entered', () => {
    fixture.componentInstance.enter(community({ auth_community_id: 'org-a' }));

    // `user-communities.ts` sets this signal and never renders it, so its Enter
    // button looks dead on a slow switch. Here it is bound.
    expect(fixture.componentInstance.entering()).toBe('org-a');
  });

  it('explains itself when the user belongs to no community', () => {
    fixture.componentRef.setInput('communities', []);
    fixture.detectChanges();

    // The state of every brand-new account. An empty grid would read as a page
    // that failed to load.
    expect(fixture.componentInstance.isEmpty()).toBe(true);
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('community-picker__empty');
  });

  it('offers to open rather than to enter when there is exactly one community', () => {
    // It is already selected by `initializeDefaultCommunity`, so "Enter" would
    // describe something that has already happened.
    expect(fixture.componentInstance.isOnlyCommunity()).toBe(true);
  });

  it('does not claim to be empty while still loading', () => {
    fixture.componentRef.setInput('communities', []);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.isEmpty()).toBe(false);
  });
});
