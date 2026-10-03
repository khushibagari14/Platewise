import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { AppTour } from '@/app/app-tour';
beforeEach(() => localStorage.clear());
afterEach(cleanup);
it('guides a first visitor to account creation and remembers completion', async () => {
  const signUp = vi.fn();
  const view = render(
    <AppTour signedIn={false} onSignIn={vi.fn()} onSignUp={signUp} />,
  );
  await waitFor(() =>
    expect(screen.getByText('Photo or text. Your choice.')).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Fine-tune your portions.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Your meals come with you.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
  expect(signUp).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('platewise:tour:v1')).toBe('1');
  view.unmount();
  render(<AppTour signedIn={false} onSignIn={vi.fn()} onSignUp={signUp} />);
  expect(screen.queryByText('Photo or text. Your choice.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Quick tour' }));
  await waitFor(() =>
    expect(screen.getByText('Photo or text. Your choice.')).toBeTruthy(),
  );
});
it('lets existing users sign in directly and lets visitors skip the tour', async () => {
  const signIn = vi.fn();
  render(<AppTour signedIn={false} onSignIn={signIn} onSignUp={vi.fn()} />);
  await waitFor(() =>
    expect(screen.getByText('Photo or text. Your choice.')).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
  expect(localStorage.getItem('platewise:tour:v1')).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: 'Quick tour' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Already have an account? Sign in' }),
  );
  expect(signIn).toHaveBeenCalledTimes(1);
});
