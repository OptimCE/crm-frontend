import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

import { MemberAddDocument } from './member-add-document';
import { DocumentService } from '../../../../shared/services/document.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { ApiResponse } from '../../../../core/dtos/api.response';

describe('MemberAddDocument', () => {
  let component: MemberAddDocument;
  let fixture: ComponentFixture<MemberAddDocument>;

  let documentServiceSpy: { uploadDocument: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dialogConfigSpy: { data: { idMember: string } | null };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    documentServiceSpy = { uploadDocument: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    dialogConfigSpy = { data: { idMember: 'member-1' } };
    errorHandlerSpy = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MemberAddDocument, TranslateModule.forRoot()],
      providers: [
        { provide: DocumentService, useValue: documentServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfigSpy },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(MemberAddDocument, {
        set: {
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MemberAddDocument);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // --- Setup & initialization ---

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize formGroup with fileToUpload control', () => {
    expect(component.formGroup).toBeTruthy();
    expect(component.formGroup.get('fileToUpload')).toBeTruthy();
  });

  it('should close dialog with false if no idMember provided', () => {
    dialogConfigSpy.data = null;

    const localFixture = TestBed.createComponent(MemberAddDocument);
    const localComponent = localFixture.componentInstance;
    localComponent.ngOnInit();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });

  // --- File selection (input) ---

  it('should set fileToUpload signal when file selected via input', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const event = { target: { files: [mockFile] } } as unknown as Event;

    component.onFileSelected(event);

    expect(component.fileToUpload()).toBe(mockFile);
  });

  it('should patch form and update validity on file select', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const event = { target: { files: [mockFile] } } as unknown as Event;

    component.onFileSelected(event);

    expect(component.formGroup.get('fileToUpload')?.value).toBe(mockFile);
    expect(component.formGroup.valid).toBe(true);
  });

  it('should not set fileToUpload if input has no files', () => {
    const event = { target: { files: [] } } as unknown as Event;

    component.onFileSelected(event);

    expect(component.fileToUpload()).toBeNull();
  });

  // --- Drag and drop ---

  it('should set dragging to true on dragOver', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as DragEvent;

    component.onDragOver(event);

    expect(component.dragging()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(event.preventDefault).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('should set dragging to false on dragLeave', () => {
    component.dragging.set(true);
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as DragEvent;

    component.onDragLeave(event);

    expect(component.dragging()).toBe(false);
  });

  it('should set fileToUpload and dragging to false on drop', () => {
    const mockFile = new File(['content'], 'dropped.pdf', { type: 'application/pdf' });
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [mockFile] as unknown as FileList },
    } as unknown as DragEvent;

    component.dragging.set(true);
    component.onDrop(event);

    expect(component.dragging()).toBe(false);
    expect(component.fileToUpload()).toBe(mockFile);
    expect(component.formGroup.get('fileToUpload')?.value).toBe(mockFile);
  });

  it('should not set fileToUpload on drop if no files in dataTransfer', () => {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [] as unknown as FileList },
    } as unknown as DragEvent;

    component.onDrop(event);

    expect(component.fileToUpload()).toBeNull();
  });

  // --- Upload ---

  it('should not call documentService if form is invalid', () => {
    component.uploadDocument();

    expect(documentServiceSpy.uploadDocument).not.toHaveBeenCalled();
  });

  it('should call documentService.uploadDocument with FormData on valid submit', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    component.fileToUpload.set(mockFile);
    component.formGroup.patchValue({ fileToUpload: mockFile });

    documentServiceSpy.uploadDocument.mockReturnValue(of({ data: 'ok' }));

    component.uploadDocument();

    expect(documentServiceSpy.uploadDocument).toHaveBeenCalledTimes(1);
    const formData = documentServiceSpy.uploadDocument.mock.calls[0][0] as FormData;
    expect(formData.get('file')).toBe(mockFile);
    expect(formData.get('id_member')).toBe('member-1');
  });

  it('should close dialog with true on successful upload', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    component.fileToUpload.set(mockFile);
    component.formGroup.patchValue({ fileToUpload: mockFile });

    documentServiceSpy.uploadDocument.mockReturnValue(of({ data: 'ok' }));

    component.uploadDocument();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('should call errorHandler when response is falsy', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    component.fileToUpload.set(mockFile);
    component.formGroup.patchValue({ fileToUpload: mockFile });

    documentServiceSpy.uploadDocument.mockReturnValue(of(null));

    component.uploadDocument();

    expect(errorHandlerSpy.handleError).toHaveBeenCalled();
  });

  it('should call errorHandler with data on ApiResponse error', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    component.fileToUpload.set(mockFile);
    component.formGroup.patchValue({ fileToUpload: mockFile });

    documentServiceSpy.uploadDocument.mockReturnValue(
      throwError(() => new ApiResponse('Upload failed')),
    );

    component.uploadDocument();

    expect(errorHandlerSpy.handleError).toHaveBeenCalledWith('Upload failed');
  });

  it('should call errorHandler with null on non-ApiResponse error', () => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    component.fileToUpload.set(mockFile);
    component.formGroup.patchValue({ fileToUpload: mockFile });

    documentServiceSpy.uploadDocument.mockReturnValue(throwError(() => new Error('network error')));

    component.uploadDocument();

    expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
  });
});
