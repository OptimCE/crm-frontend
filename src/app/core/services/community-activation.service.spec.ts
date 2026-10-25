import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import Keycloak from 'keycloak-js';
import { of, throwError } from 'rxjs';

import { CommunityService } from '../../shared/services/community.service';
import { UserContextService } from './authorization/authorization.service';
import { CommunityActivationService } from './community-activation.service';

type Orgs = Record<string, { orgId: string }>;

describe('CommunityActivationService', () => {
  let communitiesById: ReturnType<typeof signal<Orgs>>;
  let afterRefresh: Orgs;
  let switchCommunity: ReturnType<typeof vi.fn>;
  let updateToken: ReturnType<typeof vi.fn>;
  let getMyCommunities: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    communitiesById = signal<Orgs>({ a: { orgId: 'a' } });
    afterRefresh = { a: { orgId: 'a' }, b: { orgId: 'b' } };
    switchCommunity = vi.fn();
    updateToken = vi.fn().mockResolvedValue(true);
    getMyCommunities = vi.fn().mockReturnValue(
      of({
        data: [
          { id: 1, auth_community_id: 'a' },
          { id: 2, auth_community_id: 'b' },
        ],
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: Keycloak, useValue: { updateToken } },
        {
          provide: UserContextService,
          useValue: {
            communitiesById,
            refreshUserContext: () => communitiesById.set(afterRefresh),
            switchCommunity,
          },
        },
        { provide: CommunityService, useValue: { getMyCommunities } },
      ],
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  const service = () => TestBed.inject(CommunityActivationService);

  it('should refresh the token, then activate the community a creation added', async () => {
    expect(await service().activateCreated()).toBe('b');
    expect(updateToken).toHaveBeenCalledWith(-1);
    expect(switchCommunity).toHaveBeenCalledWith('b');
  });

  it('should activate nothing when the refreshed token added no community', async () => {
    afterRefresh = { a: { orgId: 'a' } };
    expect(await service().activateCreated()).toBeNull();
    expect(switchCommunity).not.toHaveBeenCalled();
  });

  it('should activate the community of an accepted invitation', async () => {
    expect(await service().activateJoined(2)).toBe('b');
    expect(switchCommunity).toHaveBeenCalledWith('b');
  });

  it('should activate a community the user already belonged to (member made manager)', async () => {
    afterRefresh = { a: { orgId: 'a' } };
    expect(await service().activateJoined(1)).toBe('a');
    expect(switchCommunity).toHaveBeenCalledWith('a');
  });

  it('should still refresh the context when the token refresh fails', async () => {
    updateToken.mockRejectedValue(new Error('offline'));
    expect(await service().activateCreated()).toBe('b');
  });

  it('should activate nothing when the memberships cannot be read', async () => {
    getMyCommunities.mockReturnValue(throwError(() => new Error('500')));
    expect(await service().activateJoined(2)).toBeNull();
    expect(switchCommunity).not.toHaveBeenCalled();
  });
});
