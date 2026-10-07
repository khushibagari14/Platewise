import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ExtraNutrients } from '@/app/extra-nutrients';
afterEach(cleanup);
const totals = { calories: 100, protein: 3, carbs: 15, fat: 2, fiber: 1 };
it('shows units and keeps decimal estimates', () => {
  render(
    <ExtraNutrients
      totals={{ ...totals, sugar: 2.5, saturatedFat: 0.5, sodium: 120 }}
    />,
  );
  expect(screen.getByText('Total sugars')).toBeTruthy();
  expect(screen.getByText('2.5')).toBeTruthy();
  expect(screen.getByText('120')).toBeTruthy();
  expect(screen.getByText('mg')).toBeTruthy();
});
it('does not represent unavailable old meal data as zero', () => {
  render(<ExtraNutrients totals={totals} />);
  expect(screen.getAllByText('Not estimated')).toHaveLength(3);
});
