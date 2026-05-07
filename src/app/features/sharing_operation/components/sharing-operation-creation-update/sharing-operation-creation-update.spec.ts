import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import { SharingOperationCreationUpdate } from './sharing-operation-creation-update';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SharingOperationType } from '../../../../shared/types/sharing_operation.types';
import { MunicipalityPartialDTO } from '../../../../shared/dtos/municipality.dtos';
import { SharingOperationDTO } from '../../../../shared/dtos/sharing_operation.dtos';
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

  let sharingOpServiceSpy: {
    createSharingOperation: ReturnType<typeof vi.fn>;
    updateSharingOperation: ReturnType<typeof vi.fn>;
  };
  let municipalityServiceSpy: { searchMunicipalities: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let dialogConfig: DynamicDialogConfig;

  async function setup(config: DynamicDialogConfig = new DynamicDialogConfig()): Promise<void> {
    sharingOpServiceSpy = {
      createSharingOperation: vi.fn(),
      updateSharingOperation: vi.fn(),
    };
    municipalityServiceSpy = {
      searchMunicipalities: vi
        .fn()
        .mockReturnValue(of(buildPaginatedResponse<MunicipalityPartialDTO>([]))),
    };
    dialogRefSpy = { close: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    dialogConfig = config;

    await TestBed.configureTestingModule({
      imports: [SharingOperationCreationUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: sharingOpServiceSpy },
        { provide: MunicipalityService, useValue: municipalityServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfig },
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
  }

  describe('create mode', () => {
    beforeEach(async () => {
      await setup();
    });

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

    it('should treat an empty municipalities array as valid (optional at creation)', () => {
      const ctl = component.formAddSharingOp.get('municipalities');
      expect(ctl?.valid).toBe(true);
    });

    it('should mark form as valid when only name and type are provided (no municipalities)', () => {
      component.formAddSharingOp.patchValue({
        name: 'Test',
        type: SharingOperationType.LOCAL,
        municipalities: [],
      });
      expect(component.formAddSharingOp.valid).toBe(true);
    });

    it('should populate categories signal with 3 items', () => {
      expect(component.categories().length).toBe(3);
    });

    it('should run in create mode (isUpdateMode is false)', () => {
      expect(component.isUpdateMode()).toBe(false);
    });

    it('should call the service with the trimmed query', () => {
      component.searchMunicipalities({ query: '  Brux  ' } as never);

      expect(municipalityServiceSpy.searchMunicipalities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        name: 'Brux',
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

    it('returns name with postal codes joined when present', () => {
      const m = buildMunicipality(1, { fr_name: 'Bruxelles', postal_codes: ['1000', '1020'] });
      expect(component.municipalityLabel(m)).toBe('Bruxelles (1000, 1020)');
    });

    it('should not call any service when form is invalid (empty)', () => {
      component.onSubmitForm();
      expect(sharingOpServiceSpy.createSharingOperation).not.toHaveBeenCalled();
      expect(sharingOpServiceSpy.updateSharingOperation).not.toHaveBeenCalled();
    });

    it('should call createSharingOperation with the DTO and close dialog on success', () => {
      component.formAddSharingOp.patchValue({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
        municipalities: [buildMunicipality(11001), buildMunicipality(21001)],
      });
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.onSubmitForm();

      expect(sharingOpServiceSpy.createSharingOperation).toHaveBeenCalledWith({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
        municipality_nis_codes: [11001, 21001],
      });
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should create with an empty municipalities array', () => {
      component.formAddSharingOp.patchValue({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
        municipalities: [],
      });
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.onSubmitForm();

      expect(sharingOpServiceSpy.createSharingOperation).toHaveBeenCalledWith({
        name: 'My Operation',
        type: SharingOperationType.LOCAL,
        municipality_nis_codes: [],
      });
    });

    it('should call errorHandler.handleError on service error', () => {
      component.formAddSharingOp.patchValue({
        name: 'My Operation',
        type: SharingOperationType.CEC,
        municipalities: [buildMunicipality(31001)],
      });
      const error = new Error('Network error');
      sharingOpServiceSpy.createSharingOperation.mockReturnValue(throwError(() => error));

      component.onSubmitForm();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });

  describe('update mode', () => {
    const existingOp: SharingOperationDTO = {
      id: 42,
      name: 'Existing',
      type: SharingOperationType.CER,
      is_public: false,
      municipalities: [buildMunicipality(11001)],
    } as SharingOperationDTO;

    beforeEach(async () => {
      const cfg = new DynamicDialogConfig();
      cfg.data = { operation: existingOp };
      await setup(cfg);
    });

    it('should run in update mode', () => {
      expect(component.isUpdateMode()).toBe(true);
    });

    it('should prefill the form with the existing operation', () => {
      const value = component.formAddSharingOp.getRawValue() as {
        name: string;
        type: SharingOperationType;
        municipalities: MunicipalityPartialDTO[];
      };
      expect(value.name).toBe('Existing');
      expect(value.type).toBe(SharingOperationType.CER);
      expect(value.municipalities).toEqual([buildMunicipality(11001)]);
    });

    it('should call updateSharingOperation with the operation id and close on success', () => {
      sharingOpServiceSpy.updateSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.formAddSharingOp.patchValue({
        name: 'Renamed',
        type: SharingOperationType.CEC,
        municipalities: [buildMunicipality(11001), buildMunicipality(21001)],
      });
      component.onSubmitForm();

      expect(sharingOpServiceSpy.updateSharingOperation).toHaveBeenCalledWith(42, {
        name: 'Renamed',
        type: SharingOperationType.CEC,
        municipality_nis_codes: [11001, 21001],
      });
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('should not call createSharingOperation in update mode', () => {
      sharingOpServiceSpy.updateSharingOperation.mockReturnValue(of({ data: 'ok' }));

      component.formAddSharingOp.patchValue({
        name: 'Renamed',
        type: SharingOperationType.CEC,
        municipalities: [buildMunicipality(11001)],
      });
      component.onSubmitForm();

      expect(sharingOpServiceSpy.createSharingOperation).not.toHaveBeenCalled();
    });

    it('should surface backend errors via errorHandler', () => {
      const error = new Error('boom');
      sharingOpServiceSpy.updateSharingOperation.mockReturnValue(throwError(() => error));
      component.formAddSharingOp.patchValue({
        name: 'Renamed',
        type: SharingOperationType.CER,
        municipalities: [],
      });

      component.onSubmitForm();

      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
    });
  });
});
