import { describe, expect, it } from 'vitest';
import { formatBrusselsWallClockDateTime } from './date.utils';

describe('formatBrusselsWallClockDateTime', () => {
  it('maps UTC instant to Brussels wall-clock for Feb 1 00:00', () => {
    expect(formatBrusselsWallClockDateTime('2025-01-31T23:00:00.000Z')).toBe('01/02/2025 00:00:00');
  });

  it('formats end-of-day Brussels slot', () => {
    expect(formatBrusselsWallClockDateTime('2025-02-28T22:45:00.000Z')).toBe('28/02/2025 23:45:00');
  });

  it('returns invalid input unchanged', () => {
    expect(formatBrusselsWallClockDateTime('not-a-date')).toBe('not-a-date');
  });
});
