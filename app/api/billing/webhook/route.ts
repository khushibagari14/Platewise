import { clerkClient } from '@clerk/nextjs/server';
import { Webhooks } from '@dodopayments/nextjs';

async function syncSubscription(data: {
  metadata: Record<string, unknown>;
  customer: { customer_id: string };
  subscription_id: string;
  product_id: string;
  status: string;
  next_billing_date: Date;
}) {
  const userId = data.metadata.clerkUserId;
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID;
  if (
    !productId ||
    data.product_id !== productId ||
    data.metadata.plan !== 'platewise_premium_monthly' ||
    typeof userId !== 'string' ||
    !userId.startsWith('user_')
  ) {
    return;
  }

  const premium = data.status === 'active';
  await (
    await clerkClient()
  ).users.updateUserMetadata(userId, {
    publicMetadata: {
      billing: {
        premium,
        status: data.status,
        nextBillingDate: data.next_billing_date.toISOString(),
      },
    },
    privateMetadata: {
      dodoCustomerId: data.customer.customer_id,
      dodoSubscriptionId: data.subscription_id,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!webhookKey) {
    return Response.json(
      { error: 'Webhook is not configured.' },
      { status: 503 },
    );
  }

  const dodoWebhook = Webhooks({
    webhookKey,
    onSubscriptionActive: async ({ data }) => syncSubscription(data),
    onSubscriptionRenewed: async ({ data }) => syncSubscription(data),
    onSubscriptionUpdated: async ({ data }) => syncSubscription(data),
    onSubscriptionOnHold: async ({ data }) => syncSubscription(data),
    onSubscriptionCancelled: async ({ data }) => syncSubscription(data),
    onSubscriptionExpired: async ({ data }) => syncSubscription(data),
    onSubscriptionFailed: async ({ data }) => syncSubscription(data),
  });

  return dodoWebhook(request as never) as Promise<Response>;
}
