// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY!;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2024-06-20',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const { priceId, successPath = '/builder', cancelPath = '/#pricing' } = req.body as {
      priceId?: string;
      successPath?: string;
      cancelPath?: string;
    };

    if (!priceId) return res.status(400).json({ error: 'missing_price' });
    if (!stripeSecret) return res.status(500).json({ error: 'stripe_secret_missing' });

    // IMPORTANT: The priceId MUST come from the same Stripe mode (Live or Test) as STRIPE_SECRET_KEY.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // If your Price already has a trial configured, Stripe will use it automatically.
      // Otherwise you can uncomment the next line to force a 30d trial:
      // subscription_data: { trial_period_days: 30 },

      // Make sure we always create a Customer (so you can map it later).
      customer_creation: 'always',

      // Require a card upfront (Stripe will often place a $0/€0 verification hold automatically).
      payment_method_collection: 'always',
      payment_method_types: ['card'],

      success_url: `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${cancelPath}`,

      allow_promotion_codes: true,
      metadata: {
        app: 'reduxcai',
      },
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err: any) {
    console.error('[checkout] error:', err?.message || err);
    return res.status(400).json({ error: 'checkout_failed', message: err?.message });
  }
}
