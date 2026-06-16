import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TimeAgoPipe } from './time-ago-pipe';

describe('TimeAgoPipe', () => {
  let pipe: TimeAgoPipe;
  let translateService: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [TimeAgoPipe],
    });

    pipe = TestBed.inject(TimeAgoPipe);
    translateService = TestBed.inject(TranslateService);
    vi.spyOn(translateService, 'getCurrentLang').mockReturnValue('en');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return an empty string for null/undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should return an empty string for an invalid date', () => {
    expect(pipe.transform('not-a-date')).toBe('');
  });

  it('should return the localized "just now" string for sub-minute deltas', () => {
    const spy = vi.spyOn(translateService, 'instant').mockReturnValue('Just now');
    const result = pipe.transform(new Date());
    expect(spy).toHaveBeenCalledWith('NOTIFICATIONS.JUST_NOW');
    expect(result).toBe('Just now');
  });

  it('should format a timestamp from two hours ago in hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(pipe.transform(twoHoursAgo)).toMatch(/hour/);
  });

  it('should format a timestamp from three days ago in days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(pipe.transform(threeDaysAgo)).toMatch(/day/);
  });
});
