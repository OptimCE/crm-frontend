import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { NewMemberType } from './new-member-type';
import { MemberType } from '../../../../../../shared/types/member.types';

describe('NewMemberType', () => {
  let component: NewMemberType;
  let fixture: ComponentFixture<NewMemberType>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMemberType, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NewMemberType);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default typeClient to -1', () => {
    expect(component.typeClient()).toBe(-1);
  });

  it('should expose MemberType enum for template', () => {
    expect(component['MemberType']).toBe(MemberType);
  });

  // --- submit ---

  describe('submit', () => {
    it('should emit formSubmitted when typeClient is INDIVIDUAL', () => {
      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.typeClient.set(MemberType.INDIVIDUAL);
      component.submit();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit formSubmitted when typeClient is COMPANY', () => {
      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.typeClient.set(MemberType.COMPANY);
      component.submit();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT emit formSubmitted when typeClient is -1', () => {
      const emitSpy = vi.fn();
      component.formSubmitted.subscribe(emitSpy);

      component.submit();

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // --- typeClient model ---

  describe('typeClient model', () => {
    it('should update when set to INDIVIDUAL', () => {
      component.typeClient.set(MemberType.INDIVIDUAL);
      expect(component.typeClient()).toBe(MemberType.INDIVIDUAL);
    });

    it('should update when set to COMPANY', () => {
      component.typeClient.set(MemberType.COMPANY);
      expect(component.typeClient()).toBe(MemberType.COMPANY);
    });
  });

  // --- template rendering ---

  describe('template', () => {
    it('should render two radio button containers', () => {
      fixture.detectChanges();
      const radioContainers = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[role="button"]',
      );
      expect(radioContainers.length).toBe(2);
    });

    it('should render the submit button', () => {
      fixture.detectChanges();
      const button = (fixture.nativeElement as HTMLElement).querySelector('p-button');
      expect(button).toBeTruthy();
    });
  });
});
