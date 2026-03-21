import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { UserDTO } from '../../../../../../../shared/dtos/user.dtos';
import { BankingInfoComponent } from './banking-info.component';

function buildUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: 1,
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    iban: null,
    ...overrides,
  } as UserDTO;
}

function queryEl(
  fixture: ComponentFixture<BankingInfoComponent>,
  selector: string,
): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector(selector);
}

function queryText(fixture: ComponentFixture<BankingInfoComponent>, selector: string): string {
  return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? '';
}

describe('BankingInfoComponent', () => {
  let component: BankingInfoComponent;
  let fixture: ComponentFixture<BankingInfoComponent>;
  let clipboardSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BankingInfoComponent, TranslateModule.forRoot()],
    }).compileComponents();

    clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardSpy,
      },
    });
  });

  function createComponent(user?: UserDTO | null): void {
    fixture = TestBed.createComponent(BankingInfoComponent);
    component = fixture.componentInstance;
    if (user !== undefined) {
      fixture.componentRef.setInput('user', user);
    }
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should display placeholder when user is null', () => {
    createComponent(null);
    expect(queryText(fixture, '.field-empty')).toBe('--');
    expect(queryEl(fixture, 'p-button')).toBeNull();
  });

  it('should display placeholder when user has no iban', () => {
    createComponent(buildUser({ iban: null }));
    expect(queryText(fixture, '.field-empty')).toBe('--');
    expect(queryEl(fixture, 'p-button')).toBeNull();
  });

  it('should display IBAN when user has iban', () => {
    createComponent(buildUser({ iban: 'BE71 0961 2345 6769' }));
    expect(queryText(fixture, '.font-mono')).toBe('BE71 0961 2345 6769');
  });

  it('should show copy button when iban exists', () => {
    createComponent(buildUser({ iban: 'BE71 0961 2345 6769' }));
    expect(queryEl(fixture, 'p-button')).not.toBeNull();
  });

  it('should not show copy button when iban is missing', () => {
    createComponent(buildUser({ iban: null }));
    expect(queryEl(fixture, 'p-button')).toBeNull();
  });

  it('should call navigator.clipboard.writeText when copyIban is called', () => {
    createComponent(buildUser({ iban: 'BE71 0961 2345 6769' }));
    component.copyIban();
    expect(clipboardSpy).toHaveBeenCalledWith('BE71 0961 2345 6769');
  });

  it('should not call clipboard when user has no iban', () => {
    createComponent(buildUser({ iban: null }));
    component.copyIban();
    expect(clipboardSpy).not.toHaveBeenCalled();
  });

  it('should display placeholder when no user input is provided', () => {
    createComponent();
    expect(queryText(fixture, '.field-empty')).toBe('--');
  });
});
