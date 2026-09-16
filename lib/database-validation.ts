import type { SavedMeal } from '@/lib/nutrition';

type Profile = {
  gender: 'female' | 'male' | 'other';
  age: number;
  height: number;
  weight: number;
  activity: 'sedentary' | 'light' | 'moderate' | 'very';
  goal: 'lose' | 'maintain' | 'gain';
};

const isNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function validateMeal(value: unknown): SavedMeal | null {
  if (!value || typeof value !== 'object') return null;
  const meal = value as Record<string, unknown>;
  if (
    typeof meal.id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(meal.id) ||
    typeof meal.createdAt !== 'string' ||
    Number.isNaN(Date.parse(meal.createdAt)) ||
    typeof meal.title !== 'string' ||
    meal.title.length > 100 ||
    typeof meal.thumbnail !== 'string' ||
    meal.thumbnail.length > 700_000 ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(meal.thumbnail) ||
    !['high', 'medium', 'low'].includes(String(meal.confidence)) ||
    !Array.isArray(meal.notes) ||
    meal.notes.length > 5 ||
    !meal.notes.every(
      (note) => typeof note === 'string' && note.length <= 250,
    ) ||
    !Array.isArray(meal.items) ||
    meal.items.length > 30 ||
    !meal.items.every((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const item = entry as Record<string, unknown>;
      return (
        typeof item.id === 'string' &&
        item.id.length <= 80 &&
        typeof item.name === 'string' &&
        item.name.length <= 100 &&
        typeof item.portion === 'string' &&
        item.portion.length <= 100 &&
        isNumber(item.quantity) &&
        (item.quantity as number) <= 50 &&
        ['calories', 'protein', 'carbs', 'fat', 'fiber'].every(
          (key) => isNumber(item[key]) && (item[key] as number) <= 100_000,
        )
      );
    })
  )
    return null;
  return meal as SavedMeal;
}

export function validateProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null;
  const profile = value as Record<string, unknown>;
  if (
    !['female', 'male', 'other'].includes(String(profile.gender)) ||
    !isNumber(profile.age) ||
    (profile.age as number) < 14 ||
    (profile.age as number) > 100 ||
    !isNumber(profile.height) ||
    (profile.height as number) < 120 ||
    (profile.height as number) > 230 ||
    !isNumber(profile.weight) ||
    (profile.weight as number) < 30 ||
    (profile.weight as number) > 300 ||
    !['sedentary', 'light', 'moderate', 'very'].includes(
      String(profile.activity),
    ) ||
    !['lose', 'maintain', 'gain'].includes(String(profile.goal))
  )
    return null;
  return profile as Profile;
}
