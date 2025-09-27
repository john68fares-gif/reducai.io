// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!STRIPE_SECRET_KEY || !STRIPE_SECRET_KEY.startsWith('sk_')) {
      return res.status(500).json({ error: 'stripe_secret_missing', hint: 'Set STRIPE_SECRET_KEY in Vercel env.' });
    }

    const { priceId, successPath = '/builder', cancelPath = '/#pricing' } =
      (req.body ?? {}) as { priceId?: string; successPath?: string; cancelPath?: string; };

    if (!priceId || !priceId.startsWith('price_')) {
      return res.status(400).json({ error: 'invalid_price', hint: 'Send a valid price_... ID from the SAME Stripe mode as your sk_ key.' });
    }

    // Fail early if Price isn’t visible to this key (mode mismatch / wrong id)
    await stripe.prices.retrieve(priceId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // subscription_data: { trial_period_days: 14 }, // optional if your Prices don’t already have trials
      customer_creation: 'always',
      payment_method_collection: 'always',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      success_url: `${SITE_URL}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${cancelPath}`,
      metadata: { app: 'reducai' },
    });

    if (!session.url) return res.status(500).json({ error: 'no_checkout_url' });
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    // Send useful diagnostics to the client (and console)
    console.error('[checkout]', err?.type, err?.code, err?.message);
    return res.status(400).json({
      error: 'checkout_failed',
      type: err?.type,
      code: err?.code,
      message: err?.message,
    });
  }
}
