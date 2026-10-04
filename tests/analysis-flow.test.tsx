import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
const authState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  userId: 'analysis_test' as string | null,
}));
const authActions = vi.hoisted(() => ({
  openSignUp: vi.fn(),
  openSignIn: vi.fn(),
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => authState,
  useClerk: () => authActions,
  Show: () => null,
  SignInButton: () => null,
  SignUpButton: () => null,
  UserButton: () => null,
}));
import Home from '@/app/page';
import { meal } from './fixtures';
beforeEach(() => {
  authState.isLoaded = true;
  authState.isSignedIn = true;
  authState.userId = 'analysis_test';
  authActions.openSignUp.mockClear();
  authActions.openSignIn.mockClear();
  localStorage.clear();
  localStorage.setItem('platewise:tour:v1', '1');
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
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
      if (url === '/api/analyze-meal') {
        expect((init!.body as FormData).get('photoContext')).toBe(
          'Banana shake with milk',
        );
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
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
  expect(screen.getByText('Today’s intake')).toBeTruthy();
  fireEvent.change(view.container.querySelector('input[type=file]')!, {
    target: {
      files: [new File(['image'], 'meal.jpg', { type: 'image/jpeg' })],
    },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeTruthy(),
  );
  fireEvent.change(screen.getByLabelText('Anything we should know?'), {
    target: { value: 'Banana shake with milk' },
  });
  expect(screen.queryByText('Today’s intake')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Analyze meal' }));
  await waitFor(() =>
    expect(screen.getByText('Estimating your meal’s nutrients…')).toBeTruthy(),
  );
  expect(screen.queryByRole('button', { name: 'Analyze meal' })).toBeNull();
  expect(view.container.querySelector('.scan-sweep')).toBeTruthy();
  expect(screen.queryByText('Today’s intake')).toBeNull();
  finish(Response.json(meal));
  await waitFor(() =>
    expect(screen.getByText('Your meal estimate')).toBeTruthy(),
  );
  expect(view.container.querySelector('.meal-processing')).toBeNull();
  expect(screen.getByRole('button', { name: 'Back to home' })).toBeTruthy();
  expect(screen.queryByText('Today’s intake')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Delete this analysis' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Your meal estimate')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
  expect(screen.getByText('Today’s intake')).toBeTruthy();
  expect(localStorage.getItem('platewise:recent-meals:analysis_test')).toContain(meal.title);
  fireEvent.click(screen.getByLabelText('View recent meals'));
  fireEvent.click(view.container.querySelector('.saved-meal-open')!);
  expect(screen.getByText('Your meal estimate')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Delete this analysis' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, delete' }));
  expect(screen.getByText('Today’s intake')).toBeTruthy();
  expect(screen.queryByText('Your meal estimate')).toBeNull();
  expect(localStorage.getItem('platewise:recent-meals:analysis_test')).toBe('[]');
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

it('replaces rejected meal photos on the next upload, then allows extra angles again', async () => {
  const submittedCounts: number[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/analyze-meal') {
        submittedCounts.push((init!.body as FormData).getAll('images').length);
        return Promise.resolve(
          Response.json(
            {
              code: 'food_not_detected',
              error: 'We could not find food in that photo.',
            },
            { status: 422 },
          ),
        );
      }
      return Promise.resolve(Response.json({ meals: [] }));
    }),
  );
  const view = render(<Home />);
  const upload = (name: string) =>
    fireEvent.change(view.container.querySelector('input[type=file]')!, {
      target: { files: [new File(['image'], name, { type: 'image/jpeg' })] },
    });
  upload('first.jpg');
  await waitFor(() =>
    expect(view.container.querySelectorAll('.review-photo')).toHaveLength(1),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Analyze meal' }));
  await waitFor(() =>
    expect(
      screen.getByText('We could not find food in that photo.'),
    ).toBeTruthy(),
  );
  upload('replacement.jpg');
  await waitFor(() =>
    expect(
      screen.queryByText('We could not find food in that photo.'),
    ).toBeNull(),
  );
  expect(view.container.querySelectorAll('.review-photo')).toHaveLength(1);
  upload('another-angle.jpg');
  await waitFor(() =>
    expect(view.container.querySelectorAll('.review-photo')).toHaveLength(2),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Analyze meal' }));
  await waitFor(() => expect(submittedCounts).toEqual([1, 2]));
});

it('logs a typed breakfast for yesterday with no photo and keeps it editable', async () => {
  let manualDescription = '';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/analyze-meal') {
        const form = init!.body as FormData;
        const description = form.get('description');
        manualDescription = typeof description === 'string' ? description : '';
        expect(form.getAll('images')).toHaveLength(0);
        return Promise.resolve(Response.json(meal));
      }
      return Promise.resolve(
        init?.method === 'POST'
          ? Response.json({ saved: true })
          : Response.json({ meals: [] }),
      );
    }),
  );
  render(<Home />);
  fireEvent.click(screen.getByRole('button', { name: 'Add manually' }));
  fireEvent.change(screen.getByLabelText('What did you eat?'), {
    target: { value: '2 slices of bread and 100 g curd' },
  });
  fireEvent.change(screen.getByLabelText('Meal'), {
    target: { value: 'Breakfast' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Yesterday' }));
  const chosen = (screen.getByLabelText('Meal date') as HTMLInputElement).value;
  fireEvent.click(screen.getByRole('button', { name: 'Estimate & save meal' }));
  await waitFor(() =>
    expect(screen.getByText('Breakfast · Lunch')).toBeTruthy(),
  );
  expect(manualDescription).toContain('100 g curd');
  const saved = JSON.parse(
    localStorage.getItem('platewise:recent-meals:analysis_test')!,
  ) as { createdAt: string }[];
  const date = new Date(saved[0].createdAt);
  expect(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  ).toBe(chosen);
  expect(screen.getByLabelText('Amount of Rice')).toBeTruthy();
});

it('opens sign-up for guest analysis and preserves photos and details through authentication', async () => {
  authState.isSignedIn = false;
  authState.userId = null;
  let analysisRequests = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/analyze-meal') {
        analysisRequests++;
        expect((init!.body as FormData).getAll('images')).toHaveLength(1);
        expect((init!.body as FormData).get('photoContext')).toBe(
          'Banana shake',
        );
        return Promise.resolve(Response.json(meal));
      }
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
      files: [new File(['image'], 'shake.jpg', { type: 'image/jpeg' })],
    },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Analyze meal' })).toBeTruthy(),
  );
  fireEvent.change(screen.getByLabelText('Anything we should know?'), {
    target: { value: 'Banana shake' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze meal' }));
  expect(authActions.openSignUp).toHaveBeenCalledTimes(1);
  expect(authActions.openSignIn).not.toHaveBeenCalled();
  expect(analysisRequests).toBe(0);
  authState.isSignedIn = true;
  authState.userId = 'analysis_test';
  view.rerender(<Home />);
  await waitFor(() =>
    expect(view.container.querySelectorAll('.review-photo')).toHaveLength(1),
  );
  expect(
    (screen.getByLabelText('Anything we should know?') as HTMLTextAreaElement)
      .value,
  ).toBe('Banana shake');
  fireEvent.click(screen.getByRole('button', { name: 'Analyze meal' }));
  await waitFor(() =>
    expect(screen.getByText('Your meal estimate')).toBeTruthy(),
  );
  expect(analysisRequests).toBe(1);
  expect(authActions.openSignUp).toHaveBeenCalledTimes(1);
});


