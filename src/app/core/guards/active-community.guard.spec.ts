import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { UserContextService } from '../services/authorization/authorization.service';
import {
  activeCommunityGuard,
  COMMUNITY_PICKER_URL,
  safeReturnUrl,
} from './active-community.guard';

describe('activeCommunityGuard', () => {
  let activeCommunityId: WritableSignal<string | null>;

  function run(url: string): boolean | UrlTree {
    activeCommunityId = activeCommunityId ?? signal<string | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UserContextService, useValue: { activeCommunityId } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      activeCommunityGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  beforeEach(() => {
    activeCommunityId = signal<string | null>(null);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows the navigation when a community is active', () => {
    activeCommunityId.set('org-a');
    expect(run('/dashboard')).toBe(true);
  });

  it('redirects to the picker carrying where the user was going', () => {
    const result = run('/dashboard');

    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    const router = TestBed.inject(Router);
    // Without the returnUrl the user is silently dropped somewhere else, which is
    // the behaviour this guard exists to replace.
    expect(router.serializeUrl(tree)).toBe(`${COMMUNITY_PICKER_URL}?returnUrl=%2Fdashboard`);
  });
});

describe('safeReturnUrl', () => {
  it('accepts a path-absolute same-origin url', () => {
    expect(safeReturnUrl('/dashboard')).toBe('/dashboard');
    expect(safeReturnUrl('/meters?status=3')).toBe('/meters?status=3');
  });

  it('rejects anything that could navigate off-site', () => {
    // These all reach Router.navigateByUrl, and the value comes from the query
    // string — a crafted link must not be able to steer the user away.
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil.example')).toBeNull();
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects an absent value', () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
    expect(safeReturnUrl('')).toBeNull();
  });
});
