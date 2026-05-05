import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

import { SharingOperationCreationUpdate } from './sharing-operation-creation-update';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';

function buildMunicipality(
  nis_code: number,
  overrides: Partial<MunicipalityPartialDTO> = {},
): MunicipalityPartialDTO {
  return {
    nis_code,
    fr_name: `Ville-${nis_code}`,
    nl_name: null,
    de_name: null,
    region_fr: null,
    postal_codes: [],
    ...overrides,
  };
}

function buildPaginatedResponse<T>(data: T[] = []): ApiResponsePaginated<T[] | string> {
  return new ApiResponsePaginated<T[] | string>(data, new Pagination(1, 20, data.length, 1));
}

describe('SharingOperationCreationUpdate', () => {
  let component: SharingOperationCreationUpdate;
  let fixture: ComponentFixture<SharingOperationCreationUpdate>;

  let sharingOpServiceSpy: { createSharingOperation: ReturnType<typeof vi.fn> };
  let municipalityServiceSpy: { searchMunicipalities: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sharingOpServiceSpy = { createSharingOperation: vi.fn() };
    municipalityServiceSpy = {
      searchMunicipalities: vi
        .fn()
        .mockReturnValue(of(buildPaginatedResponse<MunicipalityPartialDTO>([]))),
    };
    dialogRefSpy = { close: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SharingOperationCreationUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: sharingOpServiceSpy },
        { provide: MunicipalityService, useValue: municipalityServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SharingOperationCreationUpdate, {
        set: {
          imports: [TranslateModule],
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SharingOperationCreationUpdate);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // =============================================
  // 1. Component Creation & Initialization
  // =============================================

  describe('creation and initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize formAddSharingOp with name, type, and municipalities controls on ngOnInit', () => {
      expect(component.formAddSharingOp).toBeDefined();
      expect(component.formAddSharingOp.get('name')).toBeTruthy();
      expect(component.formAddSharingOp.get('type')).toBeTruthy();
      expect(component.formAddSharingOp.get('municipalities')).toBeTruthy();
    });

    it('should set name and type controls as required', () => {
      const nameControl = component.formAddSharingOp.get('name');
      const typeControl = component.formAddSharingOp.get('type');

      nameControl?.setValue(null);
      typeControl?.setValue(null);

      expect(nameControl?.hasError('required')).toBe(true);
      expect(typeControl?.hasError('required')).toBe(true);
    });

    it('should treat an empty municipalities array as required', () => {
      const ctl = component.formAddSharingOp.get('municipalities');
      expect(ctl?.hasError('required')).toBe(true);
    });
  });

  // =============================================
  // 2. Categories Setup
  // =============================================

  describe('setupECCategory', () => {
    it('should populate categories signal with 3 items after translation resolves', () => {
      expect(component.categories().length).toBe(3);
    });

    it('should set correct keys (LOCAL, CER, CEC) for categories', () => {
      const keys = component.categories().map((c) => c.key);
      expect(keys).toEqual([
        SharingOperationType.LOCAL,
        SharingOperationType.CER,
        SharingOperationType.CEC,
      ]);
    });
  });

  // =============================================
  // 3. Form Validation
  // =============================================

  describe('form validation', () => {
    it('should mark form as invalid when empty', () => {
      expect(component.formAddSharingOp.invalid).toBe(true);
    });

    it('should mark form as invalid when only name is provided', () => {
      component.formAddSharingOp.patchValue({ name: 'Test' });
      expect(component.formAddSharingOp.invalid).toBe(true);
    });

    it('should mark form as invalid when only type is provided', () => {
      component.formAddSharingOp.patchValue({ type: SharingOperationType.LOCAL });
      expect(component.formAddSharingOp.invalid).toBe(true);
    });

    it('should mark form as invalid when name and type are set but municipalities is empty', () => {
      component.formAddSharingOp.patchValue({
        name: 'Test',
        type: SharingOperationType.CER,
        municipalities: [],
      });
      expect(component.formAddSharingOp.invalid).toBe(true);
      expect(component.formAddSharingOp.get('municipalities')?.hasError('required')).toBe(true);
    });

    it('should mark form as valid when name, type, and at least one municipality are provided', () => {
      component.formAddSharingOp.patchValue({
        name: 'Test Operation',
        type: SharingOperationType.CER,
        municipalities: [buildMunicipality(11001)],
      });
      expect(component.formAddSharingOp.valid).toBe(true);
    });

    it('should treat a non-array municipalities value as required', () => {
      const ctl = component.formAddSharingOp.get('municipalities');
      ctl?.setValue(null as unknown as MunicipalityPartialDTO[]);
      expect(ctl?.hasError('required')).toBe(true);
    });
  });

  // =============================================
  // 4. searchMunicipalities
  // =============================================

  describe('searchMunicipalities', () => {
    it('should call the service with the trimmed query', () => {
      component.searchMunicipalities({ query: '  Brux  ' } as never);

      expect(municipalityServiceSpy.searchMunicipalities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        name: 'Brux',
      });
    });

    it('should pass name as undefined when query is blank', () => {
      component.searchMunicipalities({ query: '   ' } as never);

      expect(municipalityServiceSpy.searchMunicipalities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        name: undefined,
      });
    });

    it('should hide already-selected items from the suggestions', () => {
      const m1 = buildMunicipality(1);
      const m2 = buildMunicipality(2);
      component.formAddSharingOp.get('municipalities')?.setValue([m1]);
      municipalityServiceSpy.searchMunicipalities.mockReturnValue(
        of(buildPaginatedResponse([m1, m2])),
      );

      component.searchMunicipalities({ query: 'foo' } as never);

      expect(component.municipalitySuggestions().map((m) => m.nis_code)).toEqual([2]);
    });

    it('should toggle municipalitySearching true → false on success', () => {
      municipalityServiceSpy.searchMunicipalities.mockReturnValue(
        of(buildPaginatedResponse<MunicipalityPartialDTO>([])),
      );

      component.searchMunicipalities({ query: 'x' } as never);

      expect(component.municipalitySearching()).toBe(false);
    });

    it('should clear suggestions and reset searching flag on error', () => {
      component.municipalitySuggestions.set([buildMunicipality(99)]);
      municipalityServiceSpy.searchMunicipalities.mockReturnValue(
        throwError(() => new Error('net')),
      );

      component.searchMunicipalities({ query: 'x' } as never);

      expect(component.municipalitySuggestions()).toEqual([]);
      expect(component.municipalitySearching()).toBe(false);
    });
  });

  // =============================================
  // 5. municipalityLabel
  // =============================================

  describe('municipalityLabel', () => {
    it('returns name with postal codes joined when present', () => {
      const m = buildMunicipality(1, { fr_name: 'Bruxelles', postal_codes: ['1000', '1020'] });
      expect(component.municipalityLabel(m)).toBe('Bruxelles (1000, 1020)');
    });

    it('returns just the name when postal_codes is empty', () => {
      const m = buildMunicipality(1, { fr_name: 'Liège', postal_codes: [] });
      expect(component.municipalityLabel(m)).toBe('Liège');
    });

    it('returns just the name when postal_codes is undefined', () => {
      const m = {
        nis_code: 1,
        fr_name: 'Liège',
        nl_name: null,
        de_name: null,
        region_fr: null,
        postal_codes: undefined as unknown as string[],
      } as MunicipalityPartialDTO;
      expect(component.municipalityLabel(m)).toBe('Liège');
    });
  });

  // =============================================
  // 6. onSubmitForm — Guard
  // =============================================

  describe('onSubmitForm — guard', () => {
    it('should not call service when form is invalid (empty)', () => {
      component.onSubmitForm();
      expect(sharingOpServiceSpy.createSharingOperation).not.toHaveBeenCalled();
    });

    it('should not call service when only municipalities is missing', () => {
      component.formAddSharingOp.patchValue({
        name: 'Test',
        type: SharingOperationType.LOCAL,
        municipalities: [],
      });

      component.onSubmitForm();

      expect(sharingOpServiceSpy.createSharingOperation).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // 7. onSubmitForm — Success
  // =============================================

  describe('onSubmitForm — success', () => {
    beforeEach(() => {
      component.formAddSharingOp.patchValue({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
        municipalities: [buildMunicipality(11001), buildMunicipality(21001)],
      });
    });

    it('should call createSharingOperation with the DTO including municipality_nis_codes', () => {
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.onSubmitForm();

      expect(sharingOpServiceSpy.createSharingOperation).toHaveBeenCalledWith({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
        municipality_nis_codes: [11001, 21001],
      });
    });

    it('should close dialog with true on successful response', () => {
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.onSubmitForm();

      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });
  });

  // =============================================
  // 8. onSubmitForm — Error Handling
  // =============================================

  describe('onSubmitForm — error handling', () => {
    beforeEach(() => {
      component.formAddSharingOp.patchValue({
        name: 'My Operation',
        type: SharingOperationType.CEC,
        municipalities: [buildMunicipality(31001)],
      });
    });

    it('should call errorHandler.handleError when response is falsy', () => {
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of(null));

      component.onSubmitForm();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it('should call errorHandler.handleError on service error', () => {
      const error = new Error('Network error');
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(throwError(() => error));

      component.onSubmitForm();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });
});
