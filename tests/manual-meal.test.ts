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

it('uses the actual addition time instead of noon for today', () => {
  const addedAt = new Date(2026, 9, 8, 19, 43, 27, 125);
  expect(manualMealTimestamp(localDate(addedAt), addedAt)).toBe(addedAt.toISOString());
});

it('keeps the selected past date with the actual addition time', () => {
  const addedAt = new Date(2026, 9, 8, 19, 43, 27, 125);
  const saved = new Date(manualMealTimestamp('2026-10-07', addedAt));
  expect(localDate(saved)).toBe('2026-10-07');
  expect([saved.getHours(), saved.getMinutes(), saved.getSeconds()]).toEqual([19, 43, 27]);
});

it('sorts a newly added manual meal above earlier meals on that day', () => {
  const earlier = new Date(2026, 9, 8, 17, 10);
  const addedAt = new Date(2026, 9, 8, 19, 43);
  const timestamps = [earlier.toISOString(), manualMealTimestamp(localDate(addedAt), addedAt)];
  expect(timestamps.sort((a, b) => b.localeCompare(a))[0]).toBe(addedAt.toISOString());
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
