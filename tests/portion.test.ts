import { expect, it } from 'vitest';
import { portionAmount } from '@/lib/portion';
import { totalMeal } from '@/lib/nutrition';
it('recognizes weights, volumes, counts and unknown servings', () => {
  expect(portionAmount('Approximately 100 g')).toEqual({
    amount: 100,
    unit: 'g',
  });
  expect(portionAmount('200 grams')).toEqual({ amount: 200, unit: 'g' });
  expect(portionAmount('1 bowl (150 g)')).toEqual({ amount: 150, unit: 'g' });
  expect(portionAmount('250 ml')).toEqual({ amount: 250, unit: 'ml' });
  expect(portionAmount('Estimated serving')).toEqual({
    amount: 1,
    unit: 'servings',
  });
});
it('scales all five nutrients accurately when 100 g becomes 105 g', () => {
  const totals = totalMeal([
    {
      id: 'curd',
      name: 'Curd',
      portion: '100 g',
      quantity: 105 / 100,
      calories: 100,
      protein: 10,
      carbs: 20,
      fat: 4,
      fiber: 2,
    },
  ]);
  expect(totals).toEqual({
    calories: 105,
    protein: 10.5,
    carbs: 21,
    fat: 4.2,
    fiber: 2.1,
  });
});
