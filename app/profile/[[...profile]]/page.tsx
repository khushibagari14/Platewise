import { auth } from '@clerk/nextjs/server';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountProfile } from '../../account-profile';

export default async function ProfilePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect_url=/profile');
  }

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

        <section className="profile-card" aria-label="Profile settings">
          <AccountProfile />
        </section>
      </div>
    </main>
  );
}
