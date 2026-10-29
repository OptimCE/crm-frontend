import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { ProcedureStatus } from '../../../../shared/dtos/administrative-procedure.dtos';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { modifDefinition, procedureItem } from '../../procedures/procedure-fixtures';
import { procedureStatusLabelKey } from '../../procedures/procedure-format';
import { DossierList } from './dossier-list';

/** The string a dotted i18n key points at in a locale bundle. */
function lookup(bundle: unknown, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle);
  if (typeof value !== 'string') throw new Error(`no string at ${key}`);
  return value;
}

describe('DossierList (all procedures)', () => {
  let fixture: ComponentFixture<DossierList>;
  let component: DossierList;
  let translate: TranslateService;
  let listProcedures: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listProcedures = vi
      .fn()
      .mockReturnValue(
        of(new ApiResponsePaginated([procedureItem()], new Pagination(1, 20, 1, 1))),
      );
    await TestBed.configureTestingModule({
      imports: [DossierList, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: AdministrativeProcedureService,
          useValue: {
            listProcedures,
            listDefinitions: vi
              .fn()
              .mockReturnValue(
                of(
                  new ApiResponse([
                    modifDefinition(),
                    modifDefinition({ version: 2 }),
                    modifDefinition({ code: 'ETAT_DE_DEPART', purpose: 'baseline' }),
                  ]),
                ),
              ),
            invalidate: vi.fn(),
          },
        },
        {
          provide: AdministrativeDocumentService,
          useValue: { listSharingOperations: vi.fn().mockReturnValue(of(new ApiResponse([]))) },
        },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();

    translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.setTranslation('en', en as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(DossierList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('lists every procedure, finished ones included: no bucket, no status by default', () => {
    expect(listProcedures).toHaveBeenCalledWith({ page: 1, limit: 20 });
    const row = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="dossier-list__row--0"]',
    );
    expect(row?.textContent).toContain('Modification du partage');
    expect(row?.textContent).toContain('Op Centre');
    expect(row?.textContent).toContain('Brouillon');
  });

  it('filters by the catalogue’s type and the common status', () => {
    component.typeFilter = 'PARTAGE_MODIF';
    component.statusFilter = ProcedureStatus.SENT;
    component.operationFilter = 3;
    component.applyFilters();

    expect(listProcedures).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      code: 'PARTAGE_MODIF',
      status: ProcedureStatus.SENT,
      operation_id: 3,
    });
  });

  it('offers each filing type once, labelled from the catalogue, never the starting state', () => {
    expect(component.typeOptions()).toEqual([
      { value: 'PARTAGE_MODIF', label: 'Modification du partage' },
    ]);
  });

  it('opens a row on the procedure detail', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.openProcedure(procedureItem({ id: 33 }));
    expect(navigate).toHaveBeenCalledWith(['/administrative-document/procedures', 33]);
  });

  // The labels used to be translated once: a language switch left the filters
  // in the old language until a reload.
  describe('status filter labels', () => {
    const labelsIn = (bundle: unknown): string[] =>
      component.statusOptions().map((o) => lookup(bundle, procedureStatusLabelKey(o.value)));

    it('labels every common status in the current language', () => {
      expect(component.statusOptions().map((o) => o.label)).toEqual(labelsIn(fr));
    });

    it('translates them again when the language changes', () => {
      translate.use('en');
      expect(component.statusOptions().map((o) => o.label)).toEqual(labelsIn(en));
    });
  });
});
