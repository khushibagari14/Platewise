import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MealProcessing } from '@/app/meal-processing';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('shows honest waiting feedback and updates after a longer request', async () => {
  vi.useFakeTimers();
  const view = render(<MealProcessing />);
  expect(screen.getByRole('status').textContent).toContain('Estimating');
  expect(screen.queryByText(/\d+%/)).toBeNull();
  await act(() => vi.advanceTimersByTime(20_000));
  expect(screen.getByRole('status').textContent).toContain('Still working');
  expect(screen.getByText(/Keep this screen open/)).toBeTruthy();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it('cleans up the delayed update when analysis finishes early', () => {
  vi.useFakeTimers();
  const view = render(<MealProcessing />);
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
