import { auth } from '@clerk/nextjs/server';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SubscriptionDetails } from '../subscription-details';

export default async function SubscriptionPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-up?redirect_url=/subscription');
  }

  return (
    <main className="subscription-page">
      <div className="subscription-shell">
        <Link className="profile-back" href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Platewise
        </Link>

        <header className="subscription-page-heading">
          <span>
            <Sparkles size={15} aria-hidden="true" />
            PLATEWISE PREMIUM
          </span>
          <h1>Your account is ready.</h1>
          <p>
            Choose whether to start your free trial now. Your first seven days
            are free, then Premium is $2 per month.
          </p>
        </header>

        <section className="subscription-page-card" aria-label="Subscription">
          <SubscriptionDetails />
        </section>
      </div>
    </main>
  );
}
