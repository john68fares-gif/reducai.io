// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { priceId, mode = 'subscription' } = req.body as { priceId: string; mode?: 'subscription' | 'payment' };
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    const origin =
      (req.headers.origin as string) ||
      (process.env.NEXT_PUBLIC_SITE_URL as string) ||
      'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      // If you want a trial, uncomment:
      // subscription_data: { trial_period_days: 7 },
      automatic_tax: { enabled: false },
    });

    return res.status(200).json({
      sessionId: session.id,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err: any) {
    console.error('[checkout] error', err);
    return res.status(500).json({ error: err?.message || 'Stripe error' });
  }
}
