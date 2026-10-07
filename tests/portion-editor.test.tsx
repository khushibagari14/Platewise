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

it('edits the count instead of grams for two rotis and restores saved counts', () => {
  const change = vi.fn();
  const roti = { ...item, name: 'Roti', portion: '2 rotis (80 g)' };
  const view = render(<PortionEditor item={roti} onChange={change} />);
  expect(
    (screen.getByLabelText('Quantity of Roti') as HTMLInputElement).value,
  ).toBe('2');
  expect(screen.queryByLabelText('Amount of Roti')).toBeNull();
  fireEvent.click(screen.getByLabelText('Increase quantity of Roti'));
  expect(change).toHaveBeenCalledWith(1.5);
  view.rerender(
    <PortionEditor item={{ ...roti, quantity: 1.5 }} onChange={change} />,
  );
  expect(
    (screen.getByLabelText('Quantity of Roti') as HTMLInputElement).value,
  ).toBe('3');
  fireEvent.change(screen.getByLabelText('Quantity of Roti'), {
    target: { value: '4' },
  });
  fireEvent.blur(screen.getByLabelText('Quantity of Roti'));
  expect(change).toHaveBeenCalledWith(2);
});
it('shows only a gram amount for dal', () => {
  render(
    <PortionEditor
      item={{ ...item, name: 'Dal', portion: '1 bowl (200 g)' }}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('Amount of Dal')).toBeTruthy();
  expect(screen.queryByLabelText('Increase quantity of Dal')).toBeNull();
  expect(screen.queryByLabelText('Quantity of Dal')).toBeNull();
});

it('increments a typed count without replacing it with the old saved count', () => {
  const change = vi.fn();
  render(
    <PortionEditor
      item={{ ...item, name: 'Roti', portion: '2 rotis (80 g)' }}
      onChange={change}
    />,
  );
  fireEvent.change(screen.getByLabelText('Quantity of Roti'), {
    target: { value: '4' },
  });
  fireEvent.click(screen.getByLabelText('Increase quantity of Roti'));
  expect(change).toHaveBeenCalledWith(2.5);
});
