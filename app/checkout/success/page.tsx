import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <main className="checkout-result-page">
      <section className="checkout-result-card">
        <span className="checkout-success-icon">
          <CheckCircle2 size={32} aria-hidden="true" />
        </span>
        <span className="billing-kicker">PAYMENT RECEIVED</span>
        <h1>Welcome to Premium</h1>
        <p>
          Your account will update as soon as the payment is confirmed. This
          usually takes only a moment.
        </p>
        <Link href="/profile">View my profile</Link>
      </section>
    </main>
  );
}
