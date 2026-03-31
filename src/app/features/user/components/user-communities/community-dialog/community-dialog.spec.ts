import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';

import { ApiResponse } from '../../../../../core/dtos/api.response';
import { CommunityService } from '../../../../../shared/services/community.service';
import { CommunityDialog } from './community-dialog';

describe('CommunityDialog', () => {
  let component: CommunityDialog;
  let fixture: ComponentFixture<CommunityDialog>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let communityServiceSpy: { createCommunity: ReturnType<typeof vi.fn> };

  function ctrl(name: string) {
    const c = component.form.get(name);
    if (!c) throw new Error(`Control "${name}" not found`);
    return c;
  }

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };
    communityServiceSpy = {
      createCommunity: vi.fn().mockReturnValue(of(new ApiResponse('ok'))),
    };

    await TestBed.configureTestingModule({
      imports: [CommunityDialog, TranslateModule.forRoot()],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: CommunityService, useValue: communityServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty new_name control', () => {
    expect(ctrl('new_name').value).toBe('');
  });

  it('should mark form invalid when new_name is empty', () => {
    expect(component.form.valid).toBe(false);
    expect(ctrl('new_name').hasError('required')).toBe(true);
  });

  it('should mark form valid when new_name has a value', () => {
    ctrl('new_name').setValue('My Community');
    expect(component.form.valid).toBe(true);
  });

  it('should call createCommunity and close dialog on valid submit', () => {
    ctrl('new_name').setValue('My Community');
    component.onSubmit();

    expect(communityServiceSpy.createCommunity).toHaveBeenCalledWith({ name: 'My Community' });
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('should not call createCommunity when form is invalid', () => {
    component.onSubmit();

    expect(communityServiceSpy.createCommunity).not.toHaveBeenCalled();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should not close dialog on createCommunity error', () => {
    communityServiceSpy.createCommunity.mockReturnValue(throwError(() => new Error('fail')));
    ctrl('new_name').setValue('My Community');
    component.onSubmit();

    expect(communityServiceSpy.createCommunity).toHaveBeenCalled();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });
});
