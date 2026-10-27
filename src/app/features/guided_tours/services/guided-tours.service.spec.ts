import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Role } from '../../../core/dtos/role';
import { UserContextService } from '../../../core/services/authorization/authorization.service';
import { CommunityServicesStore } from '../../../core/services/community-services.store';
import { TourManifest } from '../tour-catalog';
import { GuidedToursService, TOUR_MANIFEST_URL } from './guided-tours.service';

const MANIFEST: TourManifest = { defaultLocale: 'fr', tours: [] };

describe('GuidedToursService', () => {
  let http: HttpTestingController;
  let ensureLoaded: ReturnType<typeof vi.fn>;
  const role = signal<Role | null>(Role.GESTIONNAIRE);

  beforeEach(() => {
    ensureLoaded = vi.fn().mockReturnValue(
      of([
        { feature: 'news', subscribed: true },
        { feature: 'billing', subscribed: false },
      ]),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { url: '/meters?view=map' } },
        { provide: UserContextService, useValue: { activeCommunityRole: role } },
        { provide: CommunityServicesStore, useValue: { ensureLoaded } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function load() {
    const service = TestBed.inject(GuidedToursService);
    const pending = service.load();
    await Promise.resolve();
    return { service, pending };
  }

  it('should read the manifest the overlay loads, and what the guards read', async () => {
    const { pending } = await load();
    http.expectOne(TOUR_MANIFEST_URL).flush(MANIFEST);

    const state = await pending;
    expect(state.manifest).toEqual(MANIFEST);
    expect(state.context.role).toBe(Role.GESTIONNAIRE);
    expect([...state.context.activeFeatures]).toEqual(['news']);
    expect(state.context.url).toBe('/meters?view=map');
  });

  it('should fetch the manifest once', async () => {
    const { service, pending } = await load();
    http.expectOne(TOUR_MANIFEST_URL).flush(MANIFEST);
    await pending;

    await service.load();
    http.expectNone(TOUR_MANIFEST_URL);
  });

  it('should report a failed manifest as null, and retry on the next open', async () => {
    const { service, pending } = await load();
    http.expectOne(TOUR_MANIFEST_URL).flush('nope', { status: 404, statusText: 'Not Found' });
    expect((await pending).manifest).toBeNull();

    const retry = service.load();
    await Promise.resolve();
    http.expectOne(TOUR_MANIFEST_URL).flush(MANIFEST);
    expect((await retry).manifest).toEqual(MANIFEST);
  });

  it('should count no annex as active when the catalogue fails to load, like the guard', async () => {
    ensureLoaded.mockReturnValue(throwError(() => new Error('500')));
    const { pending } = await load();
    http.expectOne(TOUR_MANIFEST_URL).flush(MANIFEST);

    expect((await pending).context.activeFeatures.size).toBe(0);
  });
});
