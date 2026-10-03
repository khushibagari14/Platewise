'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localDate } from '@/lib/manual-meal';

export function HistoryDayPicker({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const today = localDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  function move(days: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    const value = localDate(next);
    if (value <= today) onChange(value);
  }
  return (
    <section className="history-day-picker" aria-label="Choose history day">
      <div className="history-date-row">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <label>
          <span className="visually-hidden">History date</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(event) => {
              if (event.target.value && event.target.value <= today)
                onChange(event.target.value);
            }}
          />
        </label>
        <button
          type="button"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => move(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="history-day-shortcuts">
        <button
          type="button"
          aria-pressed={date === today}
          onClick={() => onChange(today)}
        >
          Today
        </button>
        <button
          type="button"
          aria-pressed={date === localDate(yesterday)}
          onClick={() => onChange(localDate(yesterday))}
        >
          Yesterday
        </button>
      </div>
    </section>
  );
}
