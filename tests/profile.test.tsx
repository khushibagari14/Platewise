import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
const account = vi.hoisted(() => ({ isLoaded: true, userId: 'user_a' as string | null }));
vi.mock('@clerk/nextjs', () => ({ useAuth: () => account }));
import { DailyNutritionCalculator } from '@/app/daily-nutrition-calculator';
import { profile } from './fixtures';
const props = { consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, selectedDate: '2026-10-02' };
beforeEach(() => { localStorage.clear(); account.userId = 'user_a'; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('loads account targets from the cloud on a device with no browser data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ profile })));
  render(<DailyNutritionCalculator {...props} />);
  await waitFor(() => expect(screen.getByText('Edit details')).toBeTruthy());
  expect(localStorage.getItem('platewise:nutrition-profile:user_a')).toContain('165');
});

it('keeps unsaved form edits when another cloud refresh completes', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ profile }));
  vi.stubGlobal('fetch', fetcher);
  render(<DailyNutritionCalculator {...props} />);
  await waitFor(() => expect(screen.getByText('Edit details')).toBeTruthy());
  fireEvent.click(screen.getByText('Edit details'));
  const age = screen.getByPlaceholderText('e.g. 28') as HTMLInputElement;
  fireEvent.change(age, { target: { value: '35' } });
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(age.value).toBe('35');
});

it('prefills old local details for explicit saving when there is no cloud profile', async () => {
  localStorage.setItem('platewise:nutrition-profile:user_a', JSON.stringify(profile));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ profile: null })));
  render(<DailyNutritionCalculator {...props} />);
  await waitFor(() => expect((screen.getByPlaceholderText('e.g. 28') as HTMLInputElement).value).toBe('28'));
  expect(screen.getByText('Calculate my daily goal')).toBeTruthy();
});
