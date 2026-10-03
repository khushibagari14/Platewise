import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { TodaySummary } from '@/app/today-summary';
import { meal } from './fixtures';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('counts only today and recalculates when portions change or meals are removed', () => {
  const today = {
    ...meal,
    createdAt: new Date().toISOString(),
    items: [{ ...meal.items[0], quantity: 1.5 }],
  };
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = {
    ...meal,
    id: 'yesterday',
    createdAt: yesterdayDate.toISOString(),
  };
  const view = render(
    <TodaySummary meals={[today, yesterday]} loading={false} />,
  );
  expect(screen.getByText('1 meal logged')).toBeTruthy();
  expect(view.container.querySelector('.today-calories dd')!.textContent).toBe(
    '300',
  );
  expect(view.container.querySelector('.today-protein dd')!.textContent).toBe(
    '6 g',
  );
  view.rerender(
    <TodaySummary
      meals={[
        { ...today, items: [{ ...meal.items[0], quantity: 2 }] },
        yesterday,
      ]}
      loading={false}
    />,
  );
  expect(view.container.querySelector('.today-calories dd')!.textContent).toBe(
    '400',
  );
  view.rerender(<TodaySummary meals={[yesterday]} loading={false} />);
  expect(view.container.querySelector('.today-calories dd')!.textContent).toBe(
    '0',
  );
  expect(screen.getByText('0 meals logged')).toBeTruthy();
});
it('does not show misleading zero totals while account history loads', () => {
  const view = render(<TodaySummary meals={[]} loading />);
  expect(view.container.querySelector('.today-calories dd')!.textContent).toBe(
    '—',
  );
  expect(screen.getByText('Loading your meals…')).toBeTruthy();
});
it('switches to the new local day at midnight without reloading', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 59));
  const view = render(
    <TodaySummary
      meals={[{ ...meal, createdAt: new Date().toISOString() }]}
      loading={false}
    />,
  );
  expect(screen.getByText('1 meal logged')).toBeTruthy();
  await act(() => vi.advanceTimersByTime(1200));
  expect(screen.getByText('0 meals logged')).toBeTruthy();
  expect(view.container.querySelector('.today-calories dd')!.textContent).toBe(
    '0',
  );
});
