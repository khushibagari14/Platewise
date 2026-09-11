import { UserProfile } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clerkClient } from '@clerk/nextjs/server';
import { BillingCard } from '../billing-card';

export default async function ProfilePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect_url=/profile');
  }

  const user = await (await clerkClient()).users.getUser(userId);
  const billing = user.publicMetadata.billing as
    | { premium?: boolean; status?: string }
    | undefined;

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <Link className="profile-back" href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Platewise
        </Link>

        <header className="profile-heading">
          <span>YOUR ACCOUNT</span>
          <h1>Profile</h1>
          <p>Add a profile photo or update your current one anytime.</p>
        </header>

        <BillingCard
          isPremium={billing?.premium === true}
          status={billing?.status}
        />

        <section className="profile-card" aria-label="Profile settings">
          <UserProfile routing="path" path="/profile" />
        </section>
      </div>
    </main>
  );
}
