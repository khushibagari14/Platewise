import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PortionEditor } from '@/app/portion-editor';
const item = {
  id: 'curd',
  name: 'Curd',
  portion: '100 g',
  quantity: 1,
  calories: 100,
  protein: 10,
  carbs: 20,
  fat: 4,
  fiber: 2,
};
afterEach(cleanup);
it('commits an exact amount on leaving the field', () => {
  const change = vi.fn();
  render(<PortionEditor item={item} onChange={change} />);
  const input = screen.getByLabelText('Amount of Curd');
  fireEvent.change(input, { target: { value: '105' } });
  fireEvent.blur(input);
  expect(change).toHaveBeenCalledWith(1.05);
});
it('keeps invalid amounts from altering nutrients', () => {
  const change = vi.fn();
  render(<PortionEditor item={item} onChange={change} />);
  const input = screen.getByLabelText('Amount of Curd');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.blur(input);
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeTruthy();
});
it('restores the saved amount when reopening history', () => {
  render(
    <PortionEditor item={{ ...item, quantity: 1.05 }} onChange={vi.fn()} />,
  );
  expect(
    (screen.getByLabelText('Amount of Curd') as HTMLInputElement).value,
  ).toBe('105');
});
