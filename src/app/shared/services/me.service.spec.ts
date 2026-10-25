import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';

import { environments } from '../../../environments/environments';
import { CacheService } from '../../core/services/cache/cache.service';
import { MeService } from './me.service';

describe('MeService invitation acceptance', () => {
  let http: HttpTestingController;
  let invalidate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invalidate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CacheService, useValue: { invalidate } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, (s: MeService) => Observable<unknown>, string][] = [
    ['member', (s) => s.acceptInvitationMember({ invitation_id: 1 }), '/invitations/accept'],
    [
      'encoded member',
      (s) => s.acceptInvitationMemberEncoded({ invitation_id: 1 } as never),
      '/invitations/accept/encoded',
    ],
    [
      'manager',
      (s) => s.acceptInvitationManager({ invitation_id: 1 }),
      '/invitations/accept/manager',
    ],
  ];

  it.each(cases)(
    'should drop the cached memberships once a %s invitation is accepted',
    async (_label, accept, path) => {
      const pending = firstValueFrom(accept(TestBed.inject(MeService)));
      http.expectOne(environments.apiUrl + '/me' + path).flush({ data: 'success', error_code: 0 });
      await pending;
      expect(invalidate).toHaveBeenCalledWith('communities-own');
      expect(invalidate).toHaveBeenCalledWith('me:members');
    },
  );
});
