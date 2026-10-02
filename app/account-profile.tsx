'use client';

import { UserProfile } from '@clerk/nextjs';

export function AccountProfile() {
  return <UserProfile routing="hash" />;
}
