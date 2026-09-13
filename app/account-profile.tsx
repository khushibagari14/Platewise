'use client';

import { UserProfile } from '@clerk/nextjs';
import { CreditCard } from 'lucide-react';
import { SubscriptionDetails } from './subscription-details';

export function AccountProfile() {
  return (
    <UserProfile routing="hash">
      <UserProfile.Page label="account" />
      <UserProfile.Page
        label="Subscription"
        labelIcon={<CreditCard size={16} aria-hidden="true" />}
        url="subscription"
      >
        <SubscriptionDetails />
      </UserProfile.Page>
      <UserProfile.Page label="security" />
    </UserProfile>
  );
}
