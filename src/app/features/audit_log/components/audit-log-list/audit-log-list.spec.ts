import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule, TranslateService, TranslationObject } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import en from '../../../../../assets/i18n/en.json';
import fr from '../../../../../assets/i18n/fr.json';
import { AuditLogList } from './audit-log-list';
import { ApiResponsePaginated, Pagination } from '../../../../core/dtos/api.response';
import { AUDIT_ACTIONS } from '../../../../shared/constants/audit-actions';
import { AuditLogService } from '../../../../shared/services/audit-log.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';

/** The string a dotted i18n key points at in a locale bundle. */
function lookup(bundle: unknown, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle);
  if (typeof value !== 'string') throw new Error(`no string at ${key}`);
  return value;
}

const MEMBER_CREATED = 'crm.member.created';

describe('AuditLogList', () => {
  let component: AuditLogList;
  let fixture: ComponentFixture<AuditLogList>;
  let translate: TranslateService;
  let auditLogServiceSpy: {
    getAuditLogList: ReturnType<typeof vi.fn>;
    exportAuditLogCsv: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  function actionAriaLabel(): string | null {
    return (
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-testid="audit-log-list__select--action"] [role="combobox"]')
        ?.getAttribute('aria-label') ?? null
    );
  }

  beforeEach(async () => {
    errorHandlerSpy = { handleError: vi.fn() };
    auditLogServiceSpy = {
      getAuditLogList: vi
        .fn()
        .mockReturnValue(of(new ApiResponsePaginated([], new Pagination(1, 10, 0, 1)))),
      exportAuditLogCsv: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogList, TranslateModule.forRoot()],
      providers: [
        { provide: AuditLogService, useValue: auditLogServiceSpy },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    })
      .overrideComponent(AuditLogList, {
        set: {
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    translate = TestBed.inject(TranslateService);
    // Cast: the PRIMENG block carries a number (`firstDayOfWeek`), which the
    // strict TranslationObject type does not admit. The strings are what matter.
    translate.setTranslation('fr', fr as unknown as TranslationObject);
    translate.setTranslation('en', en as unknown as TranslationObject);
    translate.use('fr');

    fixture = TestBed.createComponent(AuditLogList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
  it("should show the server's message when the audit log cannot be loaded", () => {
    const message = 'Only an administrator can read the audit log';
    auditLogServiceSpy.getAuditLogList.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403, error: { data: message, error_code: 50004 } }),
      ),
    );

    component.loadAuditLogs();

    expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    expect(component.loading()).toBe(false);
  });

  // PrimeNG copies an option's label into the select's aria-label and filters
  // on it, so a key there is what a screen reader announces and what typing
  // has to match.
  describe('action select labels', () => {
    it('should offer one option per audit action, in order', () => {
      expect(component.actionOptions().map((option) => option.value)).toEqual([...AUDIT_ACTIONS]);
    });

    it('should label every option with its translation, never the i18n key', () => {
      const untranslated = component
        .actionOptions()
        .filter((option) => option.label.startsWith('AUDIT.'))
        .map((option) => option.value);

      expect(untranslated).toEqual([]);
      expect(component.actionOptions().find((o) => o.value === MEMBER_CREATED)?.label).toBe(
        lookup(fr, `AUDIT.ACTIONS.${MEMBER_CREATED}`),
      );
    });

    it('should give the selected action a translated aria-label that follows the language', async () => {
      component.actionFilter.set(MEMBER_CREATED);
      await fixture.whenStable();
      expect(actionAriaLabel()).toBe(lookup(fr, `AUDIT.ACTIONS.${MEMBER_CREATED}`));

      translate.use('en');
      await fixture.whenStable();
      expect(actionAriaLabel()).toBe(lookup(en, `AUDIT.ACTIONS.${MEMBER_CREATED}`));
    });

    it('should find an action by the words the reader sees', async () => {
      const select = fixture.debugElement.query(By.directive(Select)).componentInstance as Select;

      // The `filterValue` input applies its value a macrotask later.
      select.filterValue = lookup(fr, `AUDIT.ACTIONS.${MEMBER_CREATED}`);
      await new Promise((resolve) => setTimeout(resolve));

      const found = (select.visibleOptions() as { value: string }[]).map((o) => o.value);
      expect(found).toContain(MEMBER_CREATED);
      expect(found.length).toBeLessThan(AUDIT_ACTIONS.length);
    });
  });
});
