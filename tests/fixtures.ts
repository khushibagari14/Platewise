import type { SavedMeal } from '@/lib/nutrition';
export const meal: SavedMeal = {
  id: 'meal-1',
  createdAt: '2026-10-02T10:00:00.000Z',
  title: 'Lunch',
  thumbnail: 'data:image/jpeg;base64,YQ==',
  confidence: 'medium',
  notes: [],
  items: [
    {
      id: 'item-1',
      name: 'Rice',
      portion: 'One bowl',
      quantity: 1,
      calories: 200,
      protein: 4,
      carbs: 45,
      fat: 1,
      fiber: 2,
    },
  ],
};
export const profile = {
  gender: 'female' as const,
  age: 28,
  height: 165,
  weight: 60,
  activity: 'moderate' as const,
  goal: 'maintain' as const,
};
