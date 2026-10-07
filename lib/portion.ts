/** Only explicit discrete counts; never infer a count from a weight or bowl. */
export function countablePortion(
  name: string,
  portion: string,
): { amount: number; unit: string } | null {
  if (
    /\b(dal|daal|dhal|lentils|rice|curd|yogu?rt|milk|shake|milkshake|smoothie|juice|soup|gravy|sauce|porridge|oats)\b/i.test(
      name,
    )
  )
    return null;
  const words: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    half: 0.5,
  };
  const match = portion.match(
    /\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)\s+(?:(?:small|medium|large|whole|wheat|thin|thick|boiled|fried|bread)\s+){0,3}(rotis?|chapatis?|phulkas?|naans?|parathas?|kulchas?|puris?|pooris?|idlis?|dosas?|bananas?|apples?|oranges?|pears?|mangoes?|grapes?|dates?|strawberr(?:y|ies)|eggs?|biscuits?|cookies?|burgers?|sandwich(?:es)?|dumplings?|pieces?|slices?|\bwhole\b)\b/i,
  );
  if (!match) return null;
  const amount = words[match[1].toLowerCase()] ?? Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const raw = match[2].toLowerCase();
  const unit =
    raw === 'whole'
      ? 'pieces'
      : raw === 'strawberry'
        ? 'strawberries'
        : raw === 'sandwich'
          ? 'sandwiches'
          : raw === 'mango'
            ? 'mangoes'
            : raw === 'slice'
              ? 'slices'
              : raw === 'piece'
                ? 'pieces'
                : raw.endsWith('s')
                  ? raw
                  : raw + 's';
  return { amount, unit };
}

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
