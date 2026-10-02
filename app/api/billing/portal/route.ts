import { auth, clerkClient } from '@clerk/nextjs/server';
import DodoPayments from 'dodopayments';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json(
      { error: 'Please sign in to manage your subscription.' },
      { status: 401 },
    );

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey)
    return Response.json(
      { error: 'Billing is not configured yet.' },
      { status: 503 },
    );

  try {
    const user = await (await clerkClient()).users.getUser(userId);
    const customerId = user.privateMetadata.dodoCustomerId;
    if (typeof customerId !== 'string' || !customerId) {
      return Response.json(
        { error: 'No paid subscription was found for this account.' },
        { status: 404 },
      );
    }
    const client = new DodoPayments({
      bearerToken: apiKey,
      environment:
        process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode'
          ? 'live_mode'
          : 'test_mode',
    });
    const session = await client.customers.customerPortal.create(customerId, {
      send_email: false,
      return_url: new URL(request.url).origin,
    });
    return Response.json({ portalUrl: session.link });
  } catch {
    return Response.json(
      { error: 'Billing is unavailable right now. Please try again.' },
      { status: 502 },
    );
  }
}
