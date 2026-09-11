'use client';

import { Check, LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';

type BillingCardProps = {
  isPremium: boolean;
  status?: string;
};

export function BillingCard({ isPremium, status }: BillingCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Checkout is unavailable right now.');
      }

      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Checkout is unavailable right now.',
      );
      setIsLoading(false);
    }
  }

  return (
    <section className="billing-card" aria-labelledby="billing-title">
      <div className="billing-card-copy">
        <span className="billing-kicker">
          <Sparkles size={15} aria-hidden="true" />
          {isPremium ? 'PREMIUM ACTIVE' : 'PLATEWISE PREMIUM'}
        </span>
        <h2 id="billing-title">
          {isPremium
            ? 'Your premium plan is active'
            : 'Get more from every meal'}
        </h2>
        <p>
          {isPremium
            ? 'You have access to Platewise premium features.'
            : 'Unlock premium features and additional functionality beyond the free plan.'}
        </p>
        {!isPremium && (
          <ul>
            <li>
              <Check size={16} aria-hidden="true" /> Premium Platewise features
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> Cancel through your billing
              account
            </li>
          </ul>
        )}
      </div>

      <div className="billing-card-action">
        {isPremium ? (
          <span className="plan-status">₹99 / month</span>
        ) : (
          <>
            <div className="plan-price">
              <strong>₹99</strong>
              <span>/ month</span>
            </div>
            <button type="button" onClick={startCheckout} disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
              ) : null}
              {isLoading ? 'Opening checkout…' : 'Upgrade securely'}
            </button>
          </>
        )}
      </div>

      {status && !isPremium ? (
        <p className="billing-status">
          Plan status: {status.replaceAll('_', ' ')}
        </p>
      ) : null}
      {error ? (
        <p className="billing-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
