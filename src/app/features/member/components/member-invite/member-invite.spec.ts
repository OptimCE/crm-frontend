import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { vi } from 'vitest';

import { MemberInvite } from './member-invite';

describe('MemberInvite', () => {
  let component: MemberInvite;
  let fixture: ComponentFixture<MemberInvite>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MemberInvite, TranslateModule.forRoot()],
      providers: [{ provide: DynamicDialogRef, useValue: dialogRefSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberInvite);
    component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty email control on ngOnInit', () => {
    expect(component.form).toBeTruthy();
    expect(component.form.get('email')).toBeTruthy();
    expect(component.form.get('email')?.value).toBe('');
  });

  it('should have email as required', () => {
    const emailControl = component.form.get('email');
    if (emailControl) {
      expect(emailControl.valid).toBe(false);

      emailControl.setValue('test@example.com');
      expect(emailControl.valid).toBe(true);
    } else {
      throw Error('invalid email');
    }
  });

  it('should not close dialog when form is invalid', () => {
    component.inviteMember();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should close dialog with email value when form is valid', () => {
    const email = component.form.get('email');
    if (email) {
      email.setValue('invite@example.com');
      component.inviteMember();
      expect(dialogRefSpy.close).toHaveBeenCalledWith('invite@example.com');
    } else {
      throw Error('invalid email');
    }
  });
});
