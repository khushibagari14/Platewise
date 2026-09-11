import { auth, clerkClient } from '@clerk/nextjs/server';
import DodoPayments from 'dodopayments';

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: 'Please sign in to upgrade.' },
      { status: 401 },
    );
  }

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID;

  if (!apiKey || !productId) {
    return Response.json(
      { error: 'Premium checkout is not configured yet.' },
      { status: 503 },
    );
  }

  try {
    const user = await (await clerkClient()).users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress;

    if (!email) {
      return Response.json(
        { error: 'Add an email address to your profile before upgrading.' },
        { status: 400 },
      );
    }

    const client = new DodoPayments({
      bearerToken: apiKey,
      environment:
        process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode'
          ? 'live_mode'
          : 'test_mode',
    });
    const configuredReturnUrl = process.env.DODO_PAYMENTS_RETURN_URL;
    const origin = new URL(request.url).origin;
    const returnUrl = configuredReturnUrl || `${origin}/checkout/success`;

    const session = await client.checkoutSessions.create(
      {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email,
          name: user.fullName || user.firstName || 'Platewise member',
        },
        billing_currency: 'INR',
        metadata: {
          clerkUserId: userId,
          plan: 'platewise_premium_monthly',
        },
        return_url: returnUrl,
        cancel_url: `${origin}/profile`,
        customization: { theme: 'light', show_order_details: true },
        feature_flags: {
          allow_currency_selection: false,
          redirect_immediately: true,
        },
      },
      {
        idempotencyKey: crypto.randomUUID(),
        timeout: 15_000,
      },
    );

    if (!session.checkout_url) {
      throw new Error('Dodo did not return a checkout URL.');
    }

    return Response.json({ checkoutUrl: session.checkout_url });
  } catch {
    return Response.json(
      { error: 'Checkout is unavailable right now. Please try again.' },
      { status: 502 },
    );
  }
}
