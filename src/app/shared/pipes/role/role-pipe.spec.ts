import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RolePipe } from './role-pipe';
import { Role } from '../../../core/dtos/role';

describe('RolePipe', () => {
  let pipe: RolePipe;
  let translateService: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [RolePipe],
    });

    pipe = TestBed.inject(RolePipe);
    translateService = TestBed.inject(TranslateService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return translated string for Role.ADMIN', () => {
    const spy = vi.spyOn(translateService, 'instant').mockReturnValue('Administrator');
    const result = pipe.transform(Role.ADMIN);
    expect(spy).toHaveBeenCalledWith('COMMON.ROLE.ADMIN');
    expect(result).toBe('Administrator');
  });

  it('should return translated string for Role.GESTIONNAIRE', () => {
    const spy = vi.spyOn(translateService, 'instant').mockReturnValue('Manager');
    const result = pipe.transform(Role.GESTIONNAIRE);
    expect(spy).toHaveBeenCalledWith('COMMON.ROLE.MANAGER');
    expect(result).toBe('Manager');
  });

  it('should return translated string for Role.MEMBER', () => {
    const spy = vi.spyOn(translateService, 'instant').mockReturnValue('Member');
    const result = pipe.transform(Role.MEMBER);
    expect(spy).toHaveBeenCalledWith('COMMON.ROLE.MEMBER');
    expect(result).toBe('Member');
  });

  it('should return "/" for an unknown role value', () => {
    const result = pipe.transform('UNKNOWN' as unknown as Role);
    expect(result).toBe('/');
  });
});
