'use client';
import { useEffect, useState } from 'react';
import { localDate } from '@/lib/manual-meal';
import { totalMeal, type SavedMeal } from '@/lib/nutrition';

export function TodaySummary({
  meals,
  loading,
}: {
  meals: SavedMeal[];
  loading: boolean;
}) {
  const [day, setDay] = useState(localDate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      setDay(localDate());
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
    }
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const todayMeals = meals.filter(
    (meal) => localDate(new Date(meal.createdAt)) === day,
  );
  const totals = totalMeal(todayMeals.flatMap((meal) => meal.items));
  const pending = loading && !todayMeals.length;
  return (
    <section
      className="today-summary"
      aria-label="Today's nutrition totals"
      aria-busy={loading}
    >
      <div className="today-summary-heading">
        <h2>Today’s intake</h2>
        <span>
          {pending
            ? 'Loading your meals…'
            : `${todayMeals.length} ${todayMeals.length === 1 ? 'meal' : 'meals'} logged`}
        </span>
      </div>
      <dl className="today-summary-metrics" aria-live="polite">
        {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map(
          (key) => (
            <div key={key} className={'today-' + key}>
              <dt>
                {key === 'calories'
                  ? 'Calories'
                  : key.charAt(0).toUpperCase() + key.slice(1)}
              </dt>
              <dd>
                {pending
                  ? '—'
                  : key === 'calories'
                    ? Math.round(totals[key])
                    : Math.round(totals[key] * 10) / 10}
                {key !== 'calories' && !pending && <span> g</span>}
              </dd>
            </div>
          ),
        )}
      </dl>
      {!pending && !todayMeals.length && (
        <p>Add your first meal to start today’s totals.</p>
      )}
    </section>
  );
}
