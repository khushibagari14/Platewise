'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export function MealProcessing() {
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setTakingLonger(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="meal-processing">
      <div className="processing-orbit" aria-hidden="true">
        <Sparkles size={23} strokeWidth={1.4} />
        <span />
      </div>
      <output className="processing-status">
        {takingLonger
          ? 'Still working on your meal estimate…'
          : 'Estimating your meal’s nutrients…'}
      </output>
      <p>
        {takingLonger
          ? 'Detailed meals can take a little longer. Keep this screen open.'
          : 'We’re checking foods and portions. Your results will appear here.'}
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
