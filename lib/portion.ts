export function portionAmount(portion: string): {
  amount: number;
  unit: string;
} {
  const measured = portion.match(
    /(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(kg|grams?|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|oz)\b/i,
  );
  const match =
    measured ??
    portion.match(
      /(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(kg|grams?|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|cups?|bowls?|pieces?|slices?|servings?|tbsp|tsp|oz)\b/i,
    );
  if (!match || Number(match[1]) <= 0) return { amount: 1, unit: 'servings' };
  const raw = match[2].toLowerCase();
  const unit = /^g(?:ram)?s?$/.test(raw)
    ? 'g'
    : raw.startsWith('millilit')
      ? 'ml'
      : raw.startsWith('lit')
        ? 'l'
        : raw;
  return { amount: Number(match[1]), unit };
}
