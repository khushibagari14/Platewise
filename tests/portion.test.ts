import { expect, it } from 'vitest';
import { countablePortion, portionAmount } from '@/lib/portion';
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

it.each([
  ['Roti', '2 rotis (80 g)', 2, 'rotis'],
  ['Apple', 'one medium apple (150 g)', 1, 'apples'],
  ['Banana', '1 banana (100 g)', 1, 'bananas'],
  ['Bread', 'Two slices (60 g)', 2, 'slices'],
  ['Chicken nuggets', '4 pieces (100 g)', 4, 'pieces'],
])('recognizes discrete counts for %s', (name, portion, amount, unit) => {
  expect(countablePortion(name as string, portion as string)).toEqual({
    amount,
    unit,
  });
});
it.each([
  ['Dal', '1 bowl (200 g)'],
  ['Dal', '2 pieces'],
  ['Rice', '2 cups'],
  ['Banana shake', '1 banana'],
  ['Curd', '100 g'],
  ['Banana', '100 g'],
])('does not invent a count for %s (%s)', (name, portion) => {
  expect(countablePortion(name, portion)).toBeNull();
});
it('rescales every nutrient when two rotis become three', () => {
  expect(
    totalMeal([
      {
        id: 'roti',
        name: 'Roti',
        portion: '2 rotis (80 g)',
        quantity: 3 / 2,
        calories: 200,
        protein: 6,
        carbs: 40,
        fat: 2,
        fiber: 4,
      },
    ]),
  ).toEqual({ calories: 300, protein: 9, carbs: 60, fat: 3, fiber: 6 });
});

it('scales extra nutrients without adding sugar or saturated fat twice', () => {
  const item = {
    id: 'a',
    name: 'Apple',
    portion: '1 apple (100 g)',
    quantity: 2,
    calories: 50,
    protein: 0.3,
    carbs: 14,
    fat: 0.2,
    fiber: 2,
    sugar: 10,
    saturatedFat: 0.1,
    sodium: 2,
  };
  expect(totalMeal([item])).toMatchObject({
    calories: 100,
    sugar: 20,
    saturatedFat: 0.2,
    sodium: 4,
  });
  expect(
    totalMeal([item, { ...item, id: 'old', sugar: undefined }]).sugar,
  ).toBeUndefined();
});
