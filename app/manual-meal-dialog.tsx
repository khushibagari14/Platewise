'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { MealProcessing } from './meal-processing';
import { localDate, type ManualMealInput } from '@/lib/manual-meal';

export function ManualMealDialog({
  open,
  onOpenChange,
  onSubmit,
  draft,
  onDraftChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (meal: ManualMealInput) => Promise<void>;
  draft: ManualMealInput;
  onDraftChange: (draft: ManualMealInput) => void;
}) {
  const { description, mealType, date } = draft;
  const setDescription = (value: string) =>
    onDraftChange({ ...draft, description: value });
  const setMealType = (value: string) =>
    onDraftChange({ ...draft, mealType: value });
  const setDate = (value: string) => onDraftChange({ ...draft, date: value });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="manual-meal-dialog" showCloseButton={!busy}>
        <DialogTitle>Add a meal</DialogTitle>
        <DialogDescription>
          No photo needed. Tell us what you ate.
        </DialogDescription>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              await onSubmit({
                description: description.trim(),
                mealType,
                date,
              });
              setDescription('');
              onOpenChange(false);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : 'Could not add your meal. Please retry.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <div className="manual-meal-options">
              <label>
                Meal
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                >
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  aria-label="Meal date"
                  type="date"
                  value={date}
                  max={localDate()}
                  required
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
            <div className="manual-date-shortcuts">
              <button
                type="button"
                aria-pressed={date === localDate()}
                onClick={() => setDate(localDate())}
              >
                Today
              </button>
              <button
                type="button"
                aria-pressed={date === localDate(yesterday)}
                onClick={() => setDate(localDate(yesterday))}
              >
                Yesterday
              </button>
            </div>
            <label className="manual-description">
              What did you eat?
              <textarea
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                placeholder="2 slices of bread, 100 g curd and a cup of tea"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError('');
                }}
              />
            </label>
            <p className="manual-hint">
              Add amounts if you know them. You can adjust the estimate
              afterward.
            </p>
            {error && (
              <p className="manual-error" role="alert">
                {error}
              </p>
            )}
            {!busy && (
              <button
                className="primary-action"
                type="submit"
                disabled={description.trim().length < 3}
              >
                Estimate & save meal
              </button>
            )}
          </fieldset>
          {busy && <MealProcessing />}
        </form>
      </DialogContent>
    </Dialog>
  );
}
