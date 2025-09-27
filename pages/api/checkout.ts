// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { priceId, mode, successPath = '/builder', cancelPath = '/#pricing' } = req.body || {};
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    // Create a Checkout Session (subscription) with $0 trial + card capture
    const session = await stripe.checkout.sessions.create({
      mode: mode === 'payment' ? 'payment' : 'subscription',
      line_items: [{ price: String(priceId), quantity: 1 }],
      allow_promotion_codes: true,
      // Require a payment method up front, but don’t charge until trial ends:
      subscription_data: {
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        // Set one of these on the Price itself, OR uncomment to force 30 days here:
        // trial_period_days: 30,
      },
      // If you want to strictly require a card even with $0 due “today”:
      payment_method_collection: 'always',
      // Optional: Pre-fill metadata for provisioning later
      metadata: { app_plan_price_id: String(priceId) },

      // Where Stripe sends users back
      success_url: `${req.headers.origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${req.headers.origin}${cancelPath}`,
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err: any) {
    console.error('[checkout] error:', err);
    return res.status(500).json({ error: 'Failed to create session' });
  }
}
