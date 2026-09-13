'use client';

import {
  ArrowRight,
  Check,
  FileDown,
  Images,
  LoaderCircle,
  ScanSearch,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

type BillingCardProps = { isPremium: boolean; status?: string };

const benefits = [
  {
    icon: Images,
    title: 'Unlimited meal scans',
    detail: 'Keep scanning without the free-plan limit.',
  },
  {
    icon: ScanSearch,
    title: 'Smart meal comparison',
    detail: 'Compare meals and spot nutritional differences.',
  },
  {
    icon: FileDown,
    title: 'Exportable reports',
    detail: 'Save a clear summary of your meal history.',
  },
];

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
      if (!response.ok || !data.checkoutUrl)
        throw new Error(data.error || 'Checkout is unavailable right now.');
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
    <section
      className={`premium-panel ${isPremium ? 'is-active' : ''}`}
      aria-labelledby="billing-title"
    >
      <header className="premium-hero">
        <span className="billing-kicker">
          <Sparkles size={15} aria-hidden="true" />
          {isPremium ? 'PREMIUM ACTIVE' : 'PLATEWISE PREMIUM'}
        </span>
        <h2 id="billing-title">
          {isPremium
            ? 'Your best meal tools are unlocked.'
            : 'Know more from every plate.'}
        </h2>
        <p>
          {isPremium
            ? 'Unlimited scans, comparisons and reports are ready whenever you need them.'
            : 'A simple upgrade for people who want to track meals more often and understand the bigger picture.'}
        </p>
      </header>

      <div className="premium-benefits" aria-label="Premium benefits">
        {benefits.map(({ icon: Icon, title, detail }) => (
          <article key={title}>
            <span className="premium-benefit-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <h3>{title}</h3>
            <p>{detail}</p>
          </article>
        ))}
      </div>

      {!isPremium ? (
        <div className="premium-journey" aria-label="How your upgrade works">
          <div className="premium-journey-title">
            <span>HOW IT WORKS</span>
            <h3>Premium starts right away</h3>
          </div>
          <ol>
            <li>
              <span className="journey-marker">1</span>
              <div>
                <strong>Upgrade securely</strong>
                <p>Complete the ₹1 monthly payment in checkout.</p>
              </div>
            </li>
            <li>
              <span className="journey-marker">2</span>
              <div>
                <strong>Unlock every premium tool</strong>
                <p>Your account updates after payment confirmation.</p>
              </div>
            </li>
          </ol>
        </div>
      ) : null}

      <div className="premium-plan-card">
        <div className="premium-plan-copy">
          <span>{isPremium ? 'YOUR PLAN' : 'ONE SIMPLE PLAN'}</span>
          <h3>Platewise Premium</h3>
          <p>
            {isPremium
              ? 'Active monthly membership'
              : 'Cancel through your billing account.'}
          </p>
        </div>
        <div className="premium-plan-price">
          <strong>₹1</strong>
          <span>per month</span>
        </div>
        {isPremium ? (
          <span className="premium-active-pill">
            <Check size={16} aria-hidden="true" /> Active
          </span>
        ) : (
          <button type="button" onClick={startCheckout} disabled={isLoading}>
            {isLoading ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
            {isLoading ? 'Opening checkout…' : 'Upgrade for ₹1'}
          </button>
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
