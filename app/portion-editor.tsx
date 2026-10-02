'use client';
import { useState } from 'react';
import { portionAmount } from '@/lib/portion';
import type { MealItem } from '@/lib/nutrition';

export function PortionEditor({
  item,
  onChange,
}: {
  item: MealItem;
  onChange: (quantity: number) => void;
}) {
  const base = portionAmount(item.portion);
  const amount = Math.round(base.amount * item.quantity * 1000) / 1000;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
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
    <div className="portion-editor">
      <label>
        <span className="portion-caption">Amount</span>
        <span className="portion-field">
          <input
            aria-label={'Amount of ' + item.name}
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
          <span>{base.unit}</span>
        </span>
      </label>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
