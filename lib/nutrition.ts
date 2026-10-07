export type Nutrients = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;
};
export type MealItem = Nutrients & {
  id: string;
  name: string;
  portion: string;
  quantity: number;
};
export type MealAnalysis = {
  title: string;
  items: MealItem[];
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
};
export type SavedMeal = MealAnalysis & {
  id: string;
  createdAt: string;
  thumbnail: string;
};
export const nutrientKeys = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
] as const;
export function totalMeal(items: MealItem[]): Nutrients {
  const total = items.reduce<Nutrients>(
    (total, item) => {
      nutrientKeys.forEach((key) => {
        total[key] += item[key] * item.quantity;
      });
      return total;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
  for (const key of ['sugar', 'saturatedFat', 'sodium'] as const) {
    if (
      items.length &&
      items.every(
        (item) => typeof item[key] === 'number' && Number.isFinite(item[key]),
      )
    )
      total[key] = items.reduce(
        (sum, item) => sum + item[key]! * item.quantity,
        0,
      );
  }
  return total;
}
