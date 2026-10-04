import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeToggle } from '@/app/theme-toggle';
afterEach(() => { cleanup(); localStorage.clear(); delete document.documentElement.dataset.theme; });
it('switches theme and remembers the explicit choice', () => {
 document.documentElement.dataset.theme = 'light';
 render(<ThemeToggle />);
 fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
 expect(document.documentElement.dataset.theme).toBe('dark');
 expect(localStorage.getItem('platewise:theme')).toBe('dark');
 fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
 expect(document.documentElement.dataset.theme).toBe('light');
 expect(localStorage.getItem('platewise:theme')).toBe('light');
});
