import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import fr from '../../../../../assets/i18n/fr.json';
import { ApiResponse, ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { DeadlineStatus } from '../../../../shared/dtos/administrative-document.dtos';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { deadlineStatusLabelKey, deadlineTypeLabelKey } from '../../administrative-document-format';
import { DeadlineDashboard } from './deadline-dashboard';

/** The string a dotted i18n key points at in a locale bundle. */
function lookup(bundle: unknown, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle);
  if (typeof value !== 'string') throw new Error(`no string at ${key}`);
  return value;
}

describe('DeadlineDashboard', () => {
  let fixture: ComponentFixture<DeadlineDashboard>;
  let component: DeadlineDashboard;
  let translate: TranslateService;

  function ariaLabelOf(testId: string): string | null {
    return (
      (fixture.nativeElement as HTMLElement)
        .querySelector(`[data-testid="${testId}"] [role="combobox"]`)
        ?.getAttribute('aria-label') ?? null
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeadlineDashboard, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: AdministrativeDocumentService,
          useValue: {
            listDeadlines: vi
              .fn()
              .mockReturnValue(of(new ApiResponsePaginated([], new Pagination(1, 50, 0, 0)))),
            listSharingOperations: vi.fn().mockReturnValue(of(new ApiResponse([]))),
            invalidate: vi.fn(),
          },
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

    fixture = TestBed.createComponent(DeadlineDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  // The labels used to be translated once, in ngOnInit: a language switch left
  // the filters - and their aria-labels - in the old language until a reload.
  describe('filter select labels', () => {
    it('should label the status and type options in the current language', () => {
      expect(component.statusOptions().map((o) => o.label)).toEqual(
        component.statusOptions().map((o) => lookup(fr, deadlineStatusLabelKey(o.value))),
      );
      expect(component.typeOptions().map((o) => o.label)).toEqual(
        component.typeOptions().map((o) => lookup(fr, deadlineTypeLabelKey(o.value))),
      );
    });

    it('should translate the options again when the language changes', () => {
      translate.use('en');

      expect(component.statusOptions().map((o) => o.label)).toEqual(
        component.statusOptions().map((o) => lookup(en, deadlineStatusLabelKey(o.value))),
      );
      expect(component.typeOptions().map((o) => o.label)).toEqual(
        component.typeOptions().map((o) => lookup(en, deadlineTypeLabelKey(o.value))),
      );
    });

    it('should name the default status filter in the language now in use', async () => {
      const key = deadlineStatusLabelKey(DeadlineStatus.OPEN);
      expect(ariaLabelOf('deadline-dashboard__select--status')).toBe(lookup(fr, key));

      translate.use('en');
      await fixture.whenStable();

      expect(lookup(en, key)).not.toBe(lookup(fr, key));
      expect(ariaLabelOf('deadline-dashboard__select--status')).toBe(lookup(en, key));
    });
  });
});
