import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import { SharingOperationMunicipalitiesUpdate } from './sharing-operation-municipalities-update';
import { SharingOperationService } from '../../../../shared/services/sharing_operation.service';
import { MunicipalityService } from '../../../../shared/services/municipality.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
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

describe('SharingOperationMunicipalitiesUpdate', () => {
  let component: SharingOperationMunicipalitiesUpdate;
  let fixture: ComponentFixture<SharingOperationMunicipalitiesUpdate>;

  let sharingOpServiceSpy: { updateMunicipalities: ReturnType<typeof vi.fn> };
  let municipalityServiceSpy: { searchMunicipalities: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sharingOpServiceSpy = { updateMunicipalities: vi.fn() };
    municipalityServiceSpy = {
      searchMunicipalities: vi
        .fn()
        .mockReturnValue(of(buildPaginatedResponse<MunicipalityPartialDTO>([]))),
    };
    dialogRefSpy = { close: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };

    const cfg = new DynamicDialogConfig();
    cfg.data = { id: 7, municipalities: [buildMunicipality(11001)] };

    await TestBed.configureTestingModule({
      imports: [SharingOperationMunicipalitiesUpdate, TranslateModule.forRoot()],
      providers: [
        { provide: SharingOperationService, useValue: sharingOpServiceSpy },
        { provide: MunicipalityService, useValue: municipalityServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: cfg },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SharingOperationMunicipalitiesUpdate, {
        set: {
          imports: [TranslateModule],
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SharingOperationMunicipalitiesUpdate);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('creates and prefills with the provided municipalities', () => {
    expect(component).toBeTruthy();
    expect(component.form.get('municipalities')?.value).toEqual([buildMunicipality(11001)]);
    expect(component.selectedCount()).toBe(1);
    expect(component.isDirty()).toBe(false);
  });

  it('marks the form as dirty when a municipality is added', () => {
    component.form
      .get('municipalities')
      ?.setValue([buildMunicipality(11001), buildMunicipality(21001)]);
    expect(component.selectedCount()).toBe(2);
    expect(component.isDirty()).toBe(true);
  });

  it('marks the form as dirty when a municipality is removed', () => {
    component.form.get('municipalities')?.setValue([]);
    expect(component.selectedCount()).toBe(0);
    expect(component.isDirty()).toBe(true);
  });

  it('hides already-selected items from suggestions', () => {
    const m1 = buildMunicipality(1);
    const m2 = buildMunicipality(2);
    component.form.get('municipalities')?.setValue([m1]);
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

  it('submits the selected municipalities and closes the dialog on success', () => {
    sharingOpServiceSpy.updateMunicipalities.mockReturnValue(of({ data: 'ok' }));
    component.form
      .get('municipalities')
      ?.setValue([buildMunicipality(11001), buildMunicipality(21001)]);

    component.onSubmitForm();

    expect(sharingOpServiceSpy.updateMunicipalities).toHaveBeenCalledWith({
      id_sharing: 7,
      municipality_nis_codes: [11001, 21001],
    });
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('submits an empty list when municipalities are cleared', () => {
    sharingOpServiceSpy.updateMunicipalities.mockReturnValue(of({ data: 'ok' }));
    component.form.get('municipalities')?.setValue([]);

    component.onSubmitForm();

    expect(sharingOpServiceSpy.updateMunicipalities).toHaveBeenCalledWith({
      id_sharing: 7,
      municipality_nis_codes: [],
    });
  });

  it('forwards backend errors to the error handler', () => {
    const error = new Error('boom');
    sharingOpServiceSpy.updateMunicipalities.mockReturnValue(throwError(() => error));

    component.onSubmitForm();

    expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(error);
  });

  it('closes the dialog with false when cancel is clicked', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });
});
