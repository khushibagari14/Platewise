import type { Nutrients } from '@/lib/nutrition';

const metrics = [
  { key: 'sugar', label: 'Total sugars', unit: 'g' },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
] as const;

export function ExtraNutrients({ totals }: { totals: Nutrients }) {
  return (
    <section
      className="extra-nutrients"
      aria-label="Additional estimated nutrients"
    >
      <p>
        More nutrients <span>Estimated</span>
      </p>
      <dl>
        {metrics.map(({ key, label, unit }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {totals[key] === undefined ? (
                <span className="nutrient-unknown">Not estimated</span>
              ) : (
                <>
                  {new Intl.NumberFormat('en', {
                    maximumFractionDigits: key === 'sodium' ? 0 : 1,
                  }).format(totals[key]!)}{' '}
                  <span>{unit}</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <small>
        Sugars include natural sugars. Salt and recipe details affect these
        estimates.
      </small>
    </section>
  );
}
