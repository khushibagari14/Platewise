import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: 'analysis_test',
  }),
  useClerk: () => ({ openSignUp: vi.fn(), openSignIn: vi.fn() }),
  Show: () => null,
  SignInButton: () => null,
  SignUpButton: () => null,
  UserButton: () => null,
}));
import Home from '@/app/page';
import { meal } from './fixtures';
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('platewise:tour:v1', '1');
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
    cb(new Blob(['image'], { type: 'image/jpeg' })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    meal.thumbnail,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('keeps processing feedback visible until the estimate arrives, then shows results', async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/analyze-meal')
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      if (url.startsWith('data:'))
        return Promise.resolve(new Response(new Blob(['image'])));
      return Promise.resolve(
        init?.method === 'POST'
          ? Response.json({ saved: true })
          : Response.json({ meals: [] }),
      );
    }),
  );
  const view = render(<Home />);
  fireEvent.change(view.container.querySelector('input[type=file]')!, {
    target: {
      files: [new File(['image'], 'meal.jpg', { type: 'image/jpeg' })],
    },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Analyze meal' }));
  await waitFor(() =>
    expect(screen.getByText('Estimating your meal’s nutrients…')).toBeTruthy(),
  );
  expect(screen.queryByRole('button', { name: 'Analyze meal' })).toBeNull();
  expect(view.container.querySelector('.scan-sweep')).toBeTruthy();
  finish(Response.json(meal));
  await waitFor(() =>
    expect(screen.getByText('Your meal estimate')).toBeTruthy(),
  );
  expect(view.container.querySelector('.meal-processing')).toBeNull();
  expect(screen.getByRole('button', { name: 'Scan another' })).toBeTruthy();
});

it('retains a meal and retry queue when deployment storage is not configured', async () => {
  const configurationError = 'Account storage is not configured on this site.';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/analyze-meal')
        return Promise.resolve(Response.json(meal));
      if (url.startsWith('data:'))
        return Promise.resolve(new Response(new Blob(['image'])));
      if (init?.method === 'POST')
        return Promise.resolve(
          Response.json({ error: configurationError }, { status: 503 }),
        );
      return Promise.resolve(Response.json({ meals: [] }));
    }),
  );
  const view = render(<Home />);
  fireEvent.change(view.container.querySelector('input[type=file]')!, {
    target: {
      files: [new File(['image'], 'meal.jpg', { type: 'image/jpeg' })],
    },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Analyze meal' }));
  await waitFor(() =>
    expect(
      screen.getByText('Saved on this device. Account sync needs attention.'),
    ).toBeTruthy(),
  );
  expect(screen.getByText(configurationError)).toBeTruthy();
  expect(
    localStorage.getItem('platewise:recent-meals:analysis_test'),
  ).toContain(meal.title);
  expect(
    JSON.parse(localStorage.getItem('platewise:meal-sync:analysis_test')!),
  ).toHaveLength(1);
  expect(
    screen.queryByText('Saved to your account · available across devices'),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Retry sync' })).toBeTruthy();
});
