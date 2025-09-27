// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Use the latest API version your Stripe SDK supports
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!STRIPE_SECRET_KEY || !STRIPE_SECRET_KEY.startsWith('sk_')) {
      return res.status(500).json({
        error: 'stripe_secret_missing',
        hint: 'Set STRIPE_SECRET_KEY (sk_live_… or sk_test_…) in your environment.',
      });
    }

    const {
      priceId,
      mode = 'subscription',
      successPath = '/builder',
      cancelPath = '/#pricing',
      trialDays,
      customerEmail,
    } = (req.body ?? {}) as {
      priceId?: string;
      mode?: 'subscription' | 'payment';
      successPath?: string;
      cancelPath?: string;
      trialDays?: number | null;
      customerEmail?: string | null;
    };

    if (!priceId || !priceId.startsWith('price_')) {
      return res.status(400).json({
        error: 'invalid_price',
        hint: 'Send a valid price_… ID from the SAME Stripe mode as your sk_ key.',
      });
    }

    // Verify price exists in this environment (prevents silent test/live mismatches)
    await stripe.prices.retrieve(priceId);

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      customer_email: customerEmail || undefined,
      // If your Price doesn’t include a trial, you can inject one here:
      subscription_data:
        mode === 'subscription' && trialDays ? { trial_period_days: trialDays } : undefined,
      success_url: `${SITE_URL}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${cancelPath}`,
      metadata: { app: 'reducai' },
    });

    if (!session?.url) return res.status(500).json({ error: 'no_checkout_url' });
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('[checkout]', err?.type, err?.code, err?.message);
    return res.status(400).json({
      error: 'checkout_failed',
      type: err?.type,
      code: err?.code,
      message: err?.message,
    });
  }
}
