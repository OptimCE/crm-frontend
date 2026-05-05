import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CommunityInfo } from './community-info';
import { CommunityService } from '../../../../shared/services/community.service';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import {
  CommunityDetailDTO,
  MyCommunityDTO,
  UploadLogoResponse,
} from '../../../../shared/dtos/community.dtos';
import { Role } from '../../../../core/dtos/role';

// ── Helpers ────────────────────────────────────────────────────────

function buildMembership(overrides: Partial<MyCommunityDTO> = {}): MyCommunityDTO {
  return {
    id: 1,
    auth_community_id: 'auth-1',
    name: 'Test Community',
    role: Role.ADMIN,
    logo_url: null,
    ...overrides,
  };
}

function buildDetail(overrides: Partial<CommunityDetailDTO> = {}): CommunityDetailDTO {
  return {
    id: 1,
    name: 'Test Community',
    auth_community_id: 'auth-1',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-03-20T14:30:00Z',
    member_count: 10,
    description: 'A community',
    website_url: 'https://example.com',
    logo_url: 'https://cdn/logo.png',
    logo_presigned_url: 'https://cdn/logo-signed.png',
    headquarters_address: null,
    ...overrides,
  };
}

function paginated<T>(data: T[]): ApiResponsePaginated<T[] | string> {
  return new ApiResponsePaginated<T[] | string>(data, new Pagination(1, 100, data.length, 1));
}

// ── Suite ──────────────────────────────────────────────────────────

describe('CommunityInfo', () => {
  let component: CommunityInfo;
  let fixture: ComponentFixture<CommunityInfo>;

  let communitySpy: {
    getMyCommunities: ReturnType<typeof vi.fn>;
    getCommunityDetail: ReturnType<typeof vi.fn>;
    updateCommunity: ReturnType<typeof vi.fn>;
    uploadLogo: ReturnType<typeof vi.fn>;
    deleteLogo: ReturnType<typeof vi.fn>;
  };
  let userContextSpy: {
    activeCommunityId: ReturnType<typeof signal<string | null>>;
    compareWithActiveRole: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  async function configure(opts?: {
    activeOrgId?: string | null;
    isAdmin?: boolean;
  }): Promise<void> {
    const activeOrgId =
      opts && Object.prototype.hasOwnProperty.call(opts, 'activeOrgId')
        ? (opts.activeOrgId as string | null)
        : 'auth-1';
    userContextSpy = {
      activeCommunityId: signal<string | null>(activeOrgId),
      compareWithActiveRole: vi.fn().mockReturnValue(opts?.isAdmin ?? true),
    };
    communitySpy = {
      getMyCommunities: vi.fn().mockReturnValue(of(paginated([buildMembership()]))),
      getCommunityDetail: vi.fn().mockReturnValue(of(new ApiResponse(buildDetail()))),
      updateCommunity: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
      uploadLogo: vi.fn().mockReturnValue(
        of(
          new ApiResponse<UploadLogoResponse>({
            logo_url: 'https://cdn/new.png',
            logo_presigned_url: 'https://cdn/new-signed.png',
          }),
        ),
      ),
      deleteLogo: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
    };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommunityInfo, TranslateModule.forRoot()],
      providers: [
        { provide: CommunityService, useValue: communitySpy },
        { provide: UserContextService, useValue: userContextSpy },
      ],
    })
      .overrideComponent(CommunityInfo, {
        set: {
          schemas: [NO_ERRORS_SCHEMA],
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();
  }

  function create(): void {
    fixture = TestBed.createComponent(CommunityInfo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── creation & load ───────────────────────────────────────────────

  describe('creation & load', () => {
    it('creates the component', async () => {
      await configure();
      create();
      expect(component).toBeTruthy();
    });

    it('loads the active community via getMyCommunities + getCommunityDetail', async () => {
      await configure();
      create();
      expect(communitySpy.getMyCommunities).toHaveBeenCalledWith({ page: 1, limit: 100 });
      expect(communitySpy.getCommunityDetail).toHaveBeenCalledWith(1);
      expect(component.community()?.id).toBe(1);
      expect(component.loading()).toBe(false);
    });

    it('does nothing and clears loading when there is no active community id', async () => {
      await configure({ activeOrgId: null });
      create();
      expect(communitySpy.getMyCommunities).not.toHaveBeenCalled();
      expect(communitySpy.getCommunityDetail).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
      expect(component.community()).toBeNull();
    });

    it('reports an error when no membership matches the active community', async () => {
      await configure();
      // Override to return memberships that do not include 'auth-1'
      communitySpy.getMyCommunities.mockReturnValue(
        of(paginated([buildMembership({ auth_community_id: 'other' })])),
      );
      create();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('reports an error when getCommunityDetail fails', async () => {
      await configure();
      communitySpy.getCommunityDetail.mockReturnValue(throwError(() => new Error('boom')));
      create();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('resets the form to the loaded values', async () => {
      await configure();
      communitySpy.getCommunityDetail.mockReturnValue(
        of(
          new ApiResponse(
            buildDetail({
              name: 'Resolved',
              description: 'desc',
              website_url: 'https://r.example',
            }),
          ),
        ),
      );
      create();
      expect(component.form.controls.name.value).toBe('Resolved');
      expect(component.form.controls.description.value).toBe('desc');
      expect(component.form.controls.website_url.value).toBe('https://r.example');
    });
  });

  // ── role gating (canEdit) ─────────────────────────────────────────

  describe('role gating', () => {
    it('canEdit() reflects compareWithActiveRole(ADMIN)', async () => {
      await configure({ isAdmin: false });
      create();
      expect(component.canEdit()).toBe(false);
      expect(userContextSpy.compareWithActiveRole).toHaveBeenCalledWith(Role.ADMIN);
    });

    it('enterEdit is a no-op when not ADMIN', async () => {
      await configure({ isAdmin: false });
      create();
      component.enterEdit();
      expect(component.editMode()).toBe(false);
    });

    it('enterEdit flips editMode to true when ADMIN', async () => {
      await configure({ isAdmin: true });
      create();
      component.enterEdit();
      expect(component.editMode()).toBe(true);
    });

    it('save() does not call services when not ADMIN', async () => {
      await configure({ isAdmin: false });
      create();
      component.save();
      expect(communitySpy.updateCommunity).not.toHaveBeenCalled();
      expect(communitySpy.uploadLogo).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('removeLogo() is a no-op when not ADMIN', async () => {
      await configure({ isAdmin: false });
      create();
      component.removeLogo();
      expect(communitySpy.deleteLogo).not.toHaveBeenCalled();
    });
  });

  // ── edit / cancel ─────────────────────────────────────────────────

  describe('edit / cancel', () => {
    beforeEach(async () => {
      await configure({ isAdmin: true });
      create();
    });

    it('cancelEdit reverts editMode and clears file/preview', () => {
      component.enterEdit();
      component.selectedFile.set(new File(['x'], 'a.png'));
      component.logoPreview.set('data:image/png;base64,abc');

      component.cancelEdit();

      expect(component.editMode()).toBe(false);
      expect(component.selectedFile()).toBeNull();
      expect(component.logoPreview()).toBeNull();
    });

    it('cancelEdit resets the form to the originally loaded values', () => {
      component.enterEdit();
      component.form.patchValue({ name: 'Mutated', description: 'mutated desc' });

      component.cancelEdit();

      expect(component.form.controls.name.value).toBe('Test Community');
      expect(component.form.controls.description.value).toBe('A community');
    });
  });

  // ── onFileSelected ────────────────────────────────────────────────

  describe('onFileSelected', () => {
    beforeEach(async () => {
      await configure({ isAdmin: true });
      create();
    });

    it('clears state when no file is provided', () => {
      component.selectedFile.set(new File(['x'], 'a.png'));
      component.logoPreview.set('data:image/png;base64,abc');

      component.onFileSelected({ target: { files: [] } } as unknown as Event);

      expect(component.selectedFile()).toBeNull();
      expect(component.logoPreview()).toBeNull();
    });

    it('stores the file and triggers FileReader to set logoPreview', () => {
      const file = new File(['hello'], 'logo.png', { type: 'image/png' });
      const readers: { onload: (() => void) | null; result: string }[] = [];
      class FakeFileReader {
        onload: (() => void) | null = null;
        result: string = '';
        readAsDataURL(): void {
          this.result = 'data:image/png;base64,fake';
          readers.push(this);
        }
      }
      vi.stubGlobal('FileReader', FakeFileReader);

      component.onFileSelected({ target: { files: [file] } } as unknown as Event);

      expect(component.selectedFile()).toBe(file);
      // Trigger the onload callback the component installed
      readers[0].onload?.();

      expect(component.logoPreview()).toBe('data:image/png;base64,fake');
      vi.unstubAllGlobals();
    });
  });

  // ── save() ─────────────────────────────────────────────────────────

  describe('save() — without file', () => {
    beforeEach(async () => {
      await configure({ isAdmin: true });
      create();
      component.enterEdit();
    });

    it('does not call services when the form is invalid', () => {
      component.form.controls.name.setValue('');
      component.save();
      expect(communitySpy.updateCommunity).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('sends a trimmed payload and reloads on success', () => {
      // The website_url validator forbids whitespace inside the value, so the URL
      // itself is set unpadded; the trim still applies to name and description.
      component.form.patchValue({
        name: '  Updated  ',
        description: '   ',
        website_url: 'https://new.example',
      });
      communitySpy.getMyCommunities.mockClear();
      communitySpy.getCommunityDetail.mockClear();

      component.save();

      expect(communitySpy.updateCommunity).toHaveBeenCalledWith({
        name: 'Updated',
        description: null, // empty after trim → null
        website_url: 'https://new.example',
      });
      expect(component.saving()).toBe(false);
      expect(component.editMode()).toBe(false);
      // loadCommunity is called again
      expect(communitySpy.getMyCommunities).toHaveBeenCalled();
    });

    it('includes headquarters_address when fully filled', () => {
      component.form.patchValue({
        name: 'Updated',
        description: '',
        website_url: '',
        headquarters_address: {
          street: 'Rue X',
          number: 12,
          city: 'Brux',
          postcode: '1000',
          supplement: 'Box A',
        },
      });

      component.save();

      const payload = communitySpy.updateCommunity.mock.calls[0][0] as {
        headquarters_address?: unknown;
      };
      expect(payload.headquarters_address).toEqual({
        street: 'Rue X',
        number: 12,
        city: 'Brux',
        postcode: '1000',
        supplement: 'Box A',
      });
    });

    it('omits headquarters_address when the address is fully empty', () => {
      // All address fields empty → partialAddressValidator passes,
      // but buildUpdatePayload still omits the address (no field is truthy).
      component.form.patchValue({
        name: 'Updated',
        description: '',
        website_url: '',
        headquarters_address: {
          street: '',
          number: null,
          city: '',
          postcode: '',
          supplement: '',
        },
      });

      component.save();

      const payload = communitySpy.updateCommunity.mock.calls[0][0] as {
        headquarters_address?: unknown;
      };
      expect(payload.headquarters_address).toBeUndefined();
    });

    it('omits the supplement when empty', () => {
      component.form.patchValue({
        name: 'Updated',
        description: '',
        website_url: '',
        headquarters_address: {
          street: 'Rue X',
          number: 12,
          city: 'Brux',
          postcode: '1000',
          supplement: '',
        },
      });

      component.save();

      const payload = communitySpy.updateCommunity.mock.calls[0][0] as {
        headquarters_address?: { supplement?: string };
      };
      expect(payload.headquarters_address?.supplement).toBeUndefined();
    });

    it('reports the error and clears saving on update failure', () => {
      communitySpy.updateCommunity.mockReturnValue(throwError(() => new Error('fail')));

      component.save();

      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });
  });

  describe('save() — with file', () => {
    beforeEach(async () => {
      await configure({ isAdmin: true });
      create();
      component.enterEdit();
      component.selectedFile.set(new File(['x'], 'a.png', { type: 'image/png' }));
    });

    it('uploads the logo first, then updates the community', () => {
      const callOrder: string[] = [];
      communitySpy.uploadLogo.mockImplementation(() => {
        callOrder.push('upload');
        return of(
          new ApiResponse<UploadLogoResponse>({
            logo_url: 'u',
            logo_presigned_url: 'us',
          }),
        );
      });
      communitySpy.updateCommunity.mockImplementation(() => {
        callOrder.push('update');
        return of(new ApiResponse('ok'));
      });

      component.save();

      expect(callOrder).toEqual(['upload', 'update']);
    });

    it('does not call updateCommunity when uploadLogo fails', () => {
      communitySpy.uploadLogo.mockReturnValue(throwError(() => new Error('upload boom')));

      component.save();

      expect(communitySpy.updateCommunity).not.toHaveBeenCalled();
      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });
  });

  // ── removeLogo ────────────────────────────────────────────────────

  describe('removeLogo', () => {
    it('calls deleteLogo then reloads when ADMIN', async () => {
      await configure({ isAdmin: true });
      create();
      communitySpy.getMyCommunities.mockClear();

      component.removeLogo();

      expect(communitySpy.deleteLogo).toHaveBeenCalled();
      // loadCommunity is invoked on success → getMyCommunities runs again
      expect(communitySpy.getMyCommunities).toHaveBeenCalled();
    });

    it('forwards errors to the error handler', async () => {
      await configure({ isAdmin: true });
      create();
      communitySpy.deleteLogo.mockReturnValue(throwError(() => new Error('nope')));

      component.removeLogo();

      expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    });
  });

  // ── partialAddressValidator ───────────────────────────────────────

  describe('partialAddressValidator', () => {
    beforeEach(async () => {
      await configure({ isAdmin: true });
      create();
    });

    it('passes when every field is empty', () => {
      component.form.controls.headquarters_address.setValue({
        street: '',
        number: null,
        city: '',
        postcode: '',
        supplement: '',
      });
      expect(component.form.controls.headquarters_address.errors).toBeNull();
    });

    it('passes when every required field is filled', () => {
      component.form.controls.headquarters_address.setValue({
        street: 'A',
        number: 1,
        city: 'B',
        postcode: '1000',
        supplement: '',
      });
      expect(component.form.controls.headquarters_address.errors).toBeNull();
    });

    it('flags partial state with `partialAddress: true`', () => {
      component.form.controls.headquarters_address.setValue({
        street: 'A',
        number: null,
        city: '',
        postcode: '',
        supplement: '',
      });
      expect(component.form.controls.headquarters_address.errors).toEqual({
        partialAddress: true,
      });
    });

    it('whitespace-only values count as empty', () => {
      component.form.controls.headquarters_address.setValue({
        street: '   ',
        number: null,
        city: '',
        postcode: '',
        supplement: '',
      });
      expect(component.form.controls.headquarters_address.errors).toBeNull();
    });
  });
});
