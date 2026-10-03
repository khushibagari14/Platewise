import { expect, it } from 'vitest';
import { localDate, manualMealTimestamp } from '@/lib/manual-meal';
it('keeps a backdated meal on the chosen local calendar day', () => {
  expect(localDate(new Date(manualMealTimestamp('2025-01-12')))).toBe(
    '2025-01-12',
  );
});
it('rejects impossible and future dates', () => {
  expect(() => manualMealTimestamp('2025-02-30')).toThrow();
  expect(() => manualMealTimestamp('2099-01-01')).toThrow();
});
