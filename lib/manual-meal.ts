export type ManualMealInput = {
  description: string;
  mealType: string;
  date: string;
};
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function manualMealTimestamp(date: string, addedAt = new Date()) {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day, addedAt.getHours(), addedAt.getMinutes(), addedAt.getSeconds(), addedAt.getMilliseconds());
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    localDate(result) !== date ||
    date > localDate(addedAt)
  )
    throw new Error('Choose today or an earlier date.');
  return result.toISOString();
}
export function manualMealThumbnail() {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#e8eddf';
    context.fillRect(0, 0, 160, 160);
    context.fillStyle = '#213a2a';
    context.font = '28px sans-serif';
    context.textAlign = 'center';
    context.fillText('Meal', 80, 90);
  }
  return canvas.toDataURL('image/jpeg', 0.65);
}

export function suggestedMealType(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 16) return 'Lunch';
  if (hour >= 18 && hour < 23) return 'Dinner';
  return 'Snack';
}
