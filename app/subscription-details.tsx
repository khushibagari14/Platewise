'use client';

import { Check, CreditCard, LoaderCircle, Sparkles } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

type BillingMetadata = {
  premium?: boolean;
  status?: string;
  nextBillingDate?: string | null;
  trialEndsAt?: string | null;
};

export function SubscriptionDetails() {
  const { user } = useUser();
  const [loadingAction, setLoadingAction] = useState<
    'checkout' | 'portal' | null
  >(null);
  const [error, setError] = useState('');
  const [openedAt] = useState(() => Date.now());
  const billing = user?.publicMetadata.billing as BillingMetadata | undefined;
  const isPremium = billing?.premium === true;
  const isTrial = billing?.trialEndsAt
    ? new Date(billing.trialEndsAt).getTime() > openedAt
    : false;
  const status =
    billing?.status?.replaceAll('_', ' ') || (isPremium ? 'active' : 'free');
  const nextBillingDate = billing?.nextBillingDate
    ? new Date(billing.nextBillingDate).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  async function openBilling(action: 'checkout' | 'portal') {
    setLoadingAction(action);
    setError('');
    try {
      const response = await fetch(`/api/billing/${action}`, {
        method: 'POST',
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        portalUrl?: string;
        error?: string;
      };
      const destination =
        action === 'checkout' ? data.checkoutUrl : data.portalUrl;
      if (!response.ok || !destination)
        throw new Error(data.error || 'Billing is unavailable right now.');
      window.location.assign(destination);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Billing is unavailable right now.',
      );
      setLoadingAction(null);
    }
  }

  return (
    <div className="account-subscription-page">
      <header className="account-subscription-heading">
        <span className="account-subscription-icon">
          <CreditCard size={20} aria-hidden="true" />
        </span>
        <div>
          <h2>Subscription details</h2>
          <p>View your plan and manage billing.</p>
        </div>
      </header>

      <section className="account-plan-card" aria-label="Subscription plan">
        <div className="account-plan-topline">
          <span>{isPremium ? 'Your plan' : '7-day free trial'}</span>
          <b className={`account-plan-status ${isPremium ? 'active' : ''}`}>
            {isPremium ? (isTrial ? 'Trial active' : status) : 'Available'}
          </b>
        </div>
        <div className="account-plan-main">
          <div>
            <h3>Platewise Premium</h3>
            <p>
              {isPremium
                ? 'Unlimited scans and premium meal insights.'
                : 'Try every premium feature free for 7 days.'}
            </p>
          </div>
          <div className="account-plan-price">
            <strong>$2</strong>
            <span>per month</span>
          </div>
        </div>
        <dl className="account-billing-facts">
          <div>
            <dt>Today</dt>
            <dd>{isPremium ? (isTrial ? '$0 during trial' : status) : '$0'}</dd>
          </div>
          <div>
            <dt>After 7 days</dt>
            <dd>$2 each month</dd>
          </div>
          <div>
            <dt>{isPremium ? 'Next billing date' : 'Cancel'}</dt>
            <dd>
              {isPremium
                ? nextBillingDate || 'Shown in billing portal'
                : 'Anytime before renewal'}
            </dd>
          </div>
        </dl>
      </section>

      <div className="account-feature-list" aria-label="Plan features">
        {[
          'Unlimited meal scans',
          'Smart meal comparison',
          'Exportable nutrition reports',
        ].map((feature) => (
          <div key={feature}>
            <Check size={17} aria-hidden="true" />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <button
        className="account-billing-action"
        type="button"
        disabled={loadingAction !== null}
        onClick={() => void openBilling(isPremium ? 'portal' : 'checkout')}
      >
        {loadingAction ? (
          <LoaderCircle className="spin" size={18} aria-hidden="true" />
        ) : isPremium ? (
          <CreditCard size={18} aria-hidden="true" />
        ) : (
          <Sparkles size={18} aria-hidden="true" />
        )}
        {loadingAction
          ? 'Opening secure billing…'
          : isPremium
            ? 'Manage or cancel subscription'
            : 'Start 7-day free trial'}
      </button>
      <p className="account-billing-note">
        {isPremium
          ? 'Change or cancel your plan securely in the billing portal.'
          : 'Then $2/month. Cancel anytime before your trial ends.'}
      </p>
      {error ? (
        <p className="account-billing-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
