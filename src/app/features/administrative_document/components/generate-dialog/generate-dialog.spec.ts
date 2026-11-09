import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { GenerateIn, PrefillWarning } from '../../../../shared/dtos/administrative-document.dtos';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { GenerateDialog, GenerateDialogData } from './generate-dialog';

describe('GenerateDialog (review before rendering)', () => {
  let fixture: ComponentFixture<GenerateDialog>;
  let generateDocument: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  const byTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  async function create(data: GenerateDialogData, warnings: PrefillWarning[] = []): Promise<void> {
    generateDocument = vi.fn().mockReturnValue(of(new ApiResponse({ document_id: 21 })));
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [GenerateDialog, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: AdministrativeDocumentService,
          useValue: {
            prefillDocument: vi.fn().mockReturnValue(
              of(
                new ApiResponse({
                  data: { representative_name: null, sharing_within_building: false },
                  warnings,
                }),
              ),
            ),
            generateDocument,
          },
        },
        { provide: DynamicDialogRef, useValue: { close } },
        { provide: DynamicDialogConfig, useValue: { data } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GenerateDialog);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('says a generated piece renders as a stamped draft', async () => {
    await create({ documentId: 21, title: 'Annex 6' });

    expect(byTestId('generate-dialog__message--stage')?.textContent).toContain(
      'ADMINISTRATIVE_DOCUMENT.DIALOGS.GENERATE.DRAFT_NOTICE',
    );
    expect(byTestId('generate-dialog__checkbox--upgrade')).toBeNull();
  });

  it('says a collected piece renders the form a participant signs', async () => {
    await create({ documentId: 21, title: 'Annex 8', toSign: true });

    expect(byTestId('generate-dialog__message--stage')?.textContent).toContain(
      'ADMINISTRATIVE_DOCUMENT.DIALOGS.GENERATE.TO_SIGN_NOTICE',
    );
  });

  it('shows a box of the form as a checkbox, not as the word "false"', async () => {
    await create({ documentId: 21, title: 'Form' });

    const box = byTestId('generate-dialog__field--sharing_within_building');
    expect(box?.tagName.toLowerCase()).toBe('p-checkbox');
    expect(byTestId('generate-dialog__field--representative_name')?.tagName.toLowerCase()).toBe(
      'input',
    );
  });

  it('upgrades the form only when asked', async () => {
    await create({ documentId: 21, title: 'Form', upgradeAvailable: true });
    const component = fixture.componentInstance;

    component.submit();
    component.upgradeTemplate = true;
    component.submit();

    const bodies = generateDocument.mock.calls.map((call) => call[1] as GenerateIn);
    expect(bodies.map((body) => body.upgrade_template)).toEqual([false, true]);
    expect(byTestId('generate-dialog__checkbox--upgrade')).not.toBeNull();
  });

  describe('a piece the CRM cannot fill', () => {
    const noIteration: PrefillWarning = {
      code: 'key.no_iteration',
      subject_type: 'key',
      subject_id: '2',
      params: { key: 'Key 2' },
      blocking: true,
    };
    const advisory: PrefillWarning = {
      code: 'community.field_missing',
      subject_type: 'community',
      subject_id: null,
      params: { field: 'community_vat_number' },
    };

    it('shows the blocker as an error, with a link to the key', async () => {
      await create({ documentId: 21, title: 'Key' }, [noIteration, advisory]);

      const blockers = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="generate-dialog__blocker"]',
      );
      expect(blockers).toHaveLength(1);
      expect(blockers[0].textContent).toContain(
        'ADMINISTRATIVE_DOCUMENT.PREFILL.WARNINGS.CODES.key.no_iteration',
      );
      expect(
        blockers[0].querySelector('[data-testid="generate-dialog__link--key"]'),
      ).not.toBeNull();
      // The advisory still shows, as a warning, and only it is counted.
      expect(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          '[data-testid="generate-dialog__warning"]',
        ),
      ).toHaveLength(1);
      expect(fixture.componentInstance.warningCount()).toBe(1);
    });

    it('does not let it be generated', async () => {
      await create({ documentId: 21, title: 'Key' }, [noIteration]);

      fixture.componentInstance.submit();

      expect(generateDocument).not.toHaveBeenCalled();
      const submit = byTestId('generate-dialog__btn--submit')?.querySelector('button');
      expect(submit?.disabled).toBe(true);
      expect(byTestId('generate-dialog__btn--reload')).not.toBeNull();
    });

    it('lets a piece with only warnings be generated', async () => {
      await create({ documentId: 21, title: 'Form' }, [advisory]);

      fixture.componentInstance.submit();

      expect(generateDocument).toHaveBeenCalledTimes(1);
    });
  });
});
