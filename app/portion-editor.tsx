'use client';
import { useState } from 'react';
import { countablePortion, portionAmount } from '@/lib/portion';
import { Minus, Plus } from 'lucide-react';
import type { MealItem } from '@/lib/nutrition';

export function PortionEditor({
  item,
  onChange,
}: {
  item: MealItem;
  onChange: (quantity: number) => void;
}) {
  const count = countablePortion(item.name, item.portion);
  const base = count ?? portionAmount(item.portion);
  const amount = Math.round(base.amount * item.quantity * 1000) / 1000;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  function adjustCount(delta: number) {
    const current = Number(draft ?? amount);
    if (
      !Number.isFinite(current) ||
      current <= 0 ||
      current > base.amount * 50
    ) {
      commit();
      return;
    }
    setDraft(null);
    setError('');
    onChange(
      Math.min(base.amount * 50, Math.max(0.5, current + delta)) / base.amount,
    );
  }
  function commit() {
    const value = Number(draft ?? amount);
    if (!Number.isFinite(value) || value <= 0 || value > base.amount * 50) {
      setError(
        'Enter a positive amount up to ' +
          base.amount * 50 +
          ' ' +
          base.unit +
          '.',
      );
      return;
    }
    setError('');
    setDraft(null);
    if (value !== amount) onChange(value / base.amount);
  }
  return (
    <div className={'portion-editor' + (count ? ' count-editor' : '')}>
      <div>
        <span className="portion-caption">
          {count ? 'Quantity · ' + base.unit : 'Amount'}
        </span>
        <span className={'portion-field' + (count ? ' count-field' : '')}>
          {count && (
            <button
              type="button"
              aria-label={'Decrease quantity of ' + item.name}
              disabled={amount <= 0.5}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => adjustCount(-1)}
            >
              <Minus size={16} />
            </button>
          )}
          <input
            aria-label={(count ? 'Quantity of ' : 'Amount of ') + item.name}
            type="number"
            inputMode="decimal"
            min="0.001"
            max={base.amount * 50}
            step="any"
            value={draft ?? amount}
            aria-invalid={!!error}
            onChange={(e) => {
              setDraft(e.target.value);
              setError('');
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(null);
                setError('');
              }
            }}
          />
          {count ? (
            <button
              type="button"
              aria-label={'Increase quantity of ' + item.name}
              disabled={amount >= base.amount * 50}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => adjustCount(1)}
            >
              <Plus size={16} />
            </button>
          ) : (
            <span>{base.unit}</span>
          )}
        </span>
      </div>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
