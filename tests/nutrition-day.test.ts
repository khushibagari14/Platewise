import { expect, it } from 'vitest';
import { nutritionDay, nextNutritionDay } from '@/lib/nutrition-day';

it('counts meals before 3 am toward the previous day', () => {
  expect(nutritionDay(new Date(2026, 9, 8, 0))).toBe('2026-10-07');
  expect(nutritionDay(new Date(2026, 9, 8, 2, 59, 59))).toBe('2026-10-07');
  expect(nutritionDay(new Date(2026, 9, 8, 3))).toBe('2026-10-08');
  expect(nutritionDay(new Date(2026, 9, 8, 6))).toBe('2026-10-08');
});

it('handles month and year boundaries', () => {
  expect(nutritionDay(new Date(2027, 0, 1, 2))).toBe('2026-12-31');
});

it('schedules the next reset at 3 am instead of midnight', () => {
  expect(nextNutritionDay(new Date(2026, 9, 8, 1))).toEqual(new Date(2026, 9, 8, 3));
  expect(nextNutritionDay(new Date(2026, 9, 8, 3))).toEqual(new Date(2026, 9, 9, 3));
});
