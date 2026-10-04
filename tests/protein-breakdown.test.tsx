import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ProteinBreakdown } from '@/app/protein-breakdown';
import { meal } from './fixtures';
afterEach(cleanup);
it('shows each food contribution and updates the open breakdown after a portion edit', async () => {
 const items = [{ ...meal.items[0], name: 'Naan', protein: 5 }, { ...meal.items[0], id: 'chole', name: 'Chole', protein: 10, quantity: 1.5 }];
 const view = render(<ProteinBreakdown items={items} />);
 fireEvent.click(screen.getByRole('button', { name: 'View protein breakdown' }));
 const dialog = await screen.findByRole('dialog');
 expect(within(dialog).getByText('20 g')).toBeTruthy();
 expect(within(dialog).getByText('5 g')).toBeTruthy();
 expect(within(dialog).getByText('15 g')).toBeTruthy();
 view.rerender(<ProteinBreakdown items={[items[0], { ...items[1], quantity: 2 }]} />);
 expect(within(dialog).getByText('25 g')).toBeTruthy();
 expect(within(dialog).getByText('20 g')).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
});
