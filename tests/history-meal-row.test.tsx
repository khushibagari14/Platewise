import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { HistoryMealRow } from '@/app/history-meal-row';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});
it('opens confirmation on the first tap in dark mode and lets the user cancel', async () => {
  document.documentElement.setAttribute('data-theme', 'dark');
  const remove = vi.fn();
  render(
    <HistoryMealRow title="Lunch" onRemove={remove}>
      <button>View lunch</button>
    </HistoryMealRow>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Lunch from history' }),
  );
  expect(await screen.findByRole('dialog')).toBeTruthy();
  expect(
    screen.getByText(/Are you sure you want to remove this from the history/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'View lunch' })).toBeTruthy();
});
it('animates before deleting once and makes the exiting row noninteractive', async () => {
  const remove = vi.fn();
  const view = render(
    <HistoryMealRow title="Lunch" onRemove={remove}>
      <button>View lunch</button>
    </HistoryMealRow>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Lunch from history' }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, remove' }));
  expect(remove).not.toHaveBeenCalled();
  expect(
    view.container.querySelector('[data-removing]')?.hasAttribute('inert'),
  ).toBe(true);
  await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
});
it('completes a confirmed removal once if history closes mid-transition', async () => {
  const remove = vi.fn();
  const view = render(
    <HistoryMealRow title="Lunch" onRemove={remove}>
      <button>View lunch</button>
    </HistoryMealRow>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Lunch from history' }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, remove' }));
  view.unmount();
  await new Promise((resolve) => setTimeout(resolve, 320));
  expect(remove).toHaveBeenCalledTimes(1);
});
