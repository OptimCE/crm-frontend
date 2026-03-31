import { MapNumberStringPipe } from './map-number-string-pipe';

describe('MapNumberStringPipe', () => {
  let pipe: MapNumberStringPipe;

  beforeEach(() => {
    pipe = new MapNumberStringPipe();
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    const map = ['zero', 'one', 'two', 'three'];

    it('should return the string at the given index', () => {
      expect(pipe.transform(0, map)).toBe('zero');
      expect(pipe.transform(1, map)).toBe('one');
      expect(pipe.transform(3, map)).toBe('three');
    });

    it('should return a middle element correctly', () => {
      expect(pipe.transform(2, map)).toBe('two');
    });

    it('should return undefined for an out-of-bounds index', () => {
      expect(pipe.transform(10, map)).toBeUndefined();
    });

    it('should return undefined for a negative index', () => {
      expect(pipe.transform(-1, map)).toBeUndefined();
    });

    it('should return undefined when map is empty', () => {
      expect(pipe.transform(0, [])).toBeUndefined();
    });
  });
});
