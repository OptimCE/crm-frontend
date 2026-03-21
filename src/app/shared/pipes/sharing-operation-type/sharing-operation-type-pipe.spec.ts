import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SharingOperationTypePipe } from './sharing-operation-type-pipe';
import { SharingOperationType } from '../../types/sharing_operation.types';

describe('SharingOperationTypePipe', () => {
  let pipe: SharingOperationTypePipe;
  let translateService: TranslateService;

  const translateMap: Record<string, string> = {
    'SHARING_OPERATION.TYPE.INSIDE_BUILDING': 'Inside Building',
    'SHARING_OPERATION.TYPE.CER': 'CER',
    'SHARING_OPERATION.TYPE.CEC': 'CEC',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [SharingOperationTypePipe],
    });

    translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'instant').mockImplementation((key: string | string[]) => {
      if (Array.isArray(key)) return key.map((k) => translateMap[k] ?? k);
      return translateMap[key] ?? key;
    });

    pipe = TestBed.inject(SharingOperationTypePipe);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return translated name for LOCAL type', () => {
    expect(pipe.transform(SharingOperationType.LOCAL)).toBe('Inside Building');
  });

  it('should return translated name for CER type', () => {
    expect(pipe.transform(SharingOperationType.CER)).toBe('CER');
  });

  it('should return translated name for CEC type', () => {
    expect(pipe.transform(SharingOperationType.CEC)).toBe('CEC');
  });

  it('should return "Unknown" for an unrecognized value', () => {
    expect(pipe.transform(999)).toBe('Unknown');
  });
});
