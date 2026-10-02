import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { PanelTransition } from '@/app/panel-transition';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('keeps the panel inert while closing and cancels removal when reopened', async () => {
  vi.useFakeTimers();
  const view = render(
    <PanelTransition open>
      <aside>History</aside>
    </PanelTransition>,
  );
  view.rerender(
    <PanelTransition open={false}>
      <aside>History</aside>
    </PanelTransition>,
  );
  expect(view.container.querySelector('[inert]')).toBeTruthy();
  await act(() => vi.advanceTimersByTime(100));
  view.rerender(
    <PanelTransition open>
      <aside>History</aside>
    </PanelTransition>,
  );
  await act(() => vi.advanceTimersByTime(200));
  expect(view.container.querySelector('aside')).toBeTruthy();
  expect(view.container.querySelector('[inert]')).toBeNull();
  view.rerender(
    <PanelTransition open={false}>
      <aside>History</aside>
    </PanelTransition>,
  );
  await act(() => vi.advanceTimersByTime(180));
  expect(view.container.querySelector('aside')).toBeNull();
});
