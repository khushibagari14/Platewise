import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HistoryDayPicker } from '@/app/history-day-picker';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 3, 12));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('opens today with future navigation disabled and moves to the previous day', () => {
  const change = vi.fn();
  render(<HistoryDayPicker date="2026-10-03" onChange={change} />);
  expect(
    (screen.getByRole('button', { name: 'Next day' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
  expect(change).toHaveBeenCalledWith('2026-10-02');
});
it('moves smoothly across month boundaries and supports direct date changes', () => {
  const change = vi.fn();
  render(<HistoryDayPicker date="2026-09-30" onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
  expect(change).toHaveBeenCalledWith('2026-10-01');
  fireEvent.change(screen.getByLabelText('History date'), {
    target: { value: '2026-08-12' },
  });
  expect(change).toHaveBeenCalledWith('2026-08-12');
  change.mockClear();
  fireEvent.change(screen.getByLabelText('History date'), {
    target: { value: '2099-01-01' },
  });
  expect(change).not.toHaveBeenCalled();
});

