import { expect, it } from 'vitest';
import {
  localDate,
  manualMealTimestamp,
  suggestedMealType,
} from '@/lib/manual-meal';
it('keeps a backdated meal on the chosen local calendar day', () => {
  expect(localDate(new Date(manualMealTimestamp('2025-01-12')))).toBe(
    '2025-01-12',
  );
});
it('rejects impossible and future dates', () => {
  expect(() => manualMealTimestamp('2025-02-30')).toThrow();
  expect(() => manualMealTimestamp('2099-01-01')).toThrow();
});

it.each([
  [5, 'Breakfast'],
  [10, 'Breakfast'],
  [11, 'Lunch'],
  [15, 'Lunch'],
  [16, 'Snack'],
  [18, 'Dinner'],
  [22, 'Dinner'],
  [23, 'Snack'],
  [2, 'Snack'],
])('suggests the meal for local hour %s', (hour, expected) => {
  expect(suggestedMealType(new Date(2026, 9, 3, Number(hour)))).toBe(expected);
});
