import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { vi } from 'vitest';

import { CommunityInvitation } from './community-invitation';

describe('CommunityInvitation', () => {
  let component: CommunityInvitation;
  let fixture: ComponentFixture<CommunityInvitation>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommunityInvitation, TranslateModule.forRoot()],
      providers: [{ provide: DynamicDialogRef, useValue: dialogRefSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityInvitation);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with email control on ngOnInit', () => {
    expect(component.form).toBeDefined();
    expect(component.form.get('email')).toBeDefined();
  });

  it('should have required and email validators on email control', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const emailControl = component.form.get('email')!;

    emailControl.setValue('');
    expect(emailControl.hasError('required')).toBe(true);

    emailControl.setValue('invalid');
    expect(emailControl.hasError('email')).toBe(true);

    emailControl.setValue('valid@email.com');
    expect(emailControl.valid).toBe(true);
  });

  it('should not close dialog when form is invalid (empty email)', () => {
    component.onSubmit();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should not close dialog when email is invalid format', () => {
    component.form.get('email')?.setValue('not-an-email');
    component.onSubmit();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should close dialog with email when form is valid', () => {
    component.form.get('email')?.setValue('test@example.com');
    component.onSubmit();
    expect(dialogRefSpy.close).toHaveBeenCalledWith('test@example.com');
  });
});
