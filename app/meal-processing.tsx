'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

const tips = [
  'You can adjust portions when your estimate is ready.',
  'Sauces and toppings can change the nutritional estimate.',
  'Your results include calories, protein, carbs, fat and fiber.',
];

export function MealProcessing() {
  const [takingLonger, setTakingLonger] = useState(false);
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setTakingLonger(true), 20_000);
    const rotation = window.setInterval(
      () => setTip((value) => (value + 1) % tips.length),
      6_000,
    );
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(rotation);
    };
  }, []);
  return (
    <div className="meal-processing">
      <div className="processing-orbit" aria-hidden="true">
        <Sparkles size={17} strokeWidth={1.4} />
        <span />
      </div>
      <output className="processing-status">
        {takingLonger
          ? 'Still working on your meal estimate…'
          : 'Estimating your meal’s nutrients…'}
      </output>
      <p className="processing-tip" key={takingLonger ? 'longer' : tip}>
        {takingLonger
          ? 'Detailed meals can take a little longer. Keep this screen open.'
          : tips[tip]}
      </p>
      <div className="processing-metrics" aria-hidden="true">
        {['Calories', 'Protein', 'Carbs'].map((label) => (
          <div key={label}>
            <span>{label}</span>
            <i />
          </div>
        ))}
      </div>
    </div>
  );
}
