import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { GenerateIn } from '../../../../shared/dtos/administrative-document.dtos';
import { AdministrativeDocumentService } from '../../../../shared/services/administrative-document.service';
import { GenerateDialog, GenerateDialogData } from './generate-dialog';

describe('GenerateDialog (review before rendering)', () => {
  let fixture: ComponentFixture<GenerateDialog>;
  let generateDocument: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  const byTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  async function create(data: GenerateDialogData): Promise<void> {
    generateDocument = vi.fn().mockReturnValue(of(new ApiResponse({ document_id: 21 })));
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [GenerateDialog, TranslateModule.forRoot()],
      providers: [
        {
          provide: AdministrativeDocumentService,
          useValue: {
            prefillDocument: vi.fn().mockReturnValue(
              of(
                new ApiResponse({
                  data: { representative_name: null, sharing_within_building: false },
                  warnings: [],
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
});
