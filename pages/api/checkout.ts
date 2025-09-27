// pages/api/checkout.ts  (use app/api/checkout/route.ts if you're on the App Router)
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const sk = process.env.STRIPE_SECRET_KEY || '';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  if (!sk || !sk.startsWith('sk_')) {
    return res.status(500).json({
      error: 'stripe_secret_missing',
      hint: 'Set STRIPE_SECRET_KEY (sk_live_… or sk_test_…) in your environment.',
    });
  }

  const stripe = new Stripe(sk, { apiVersion: '2024-06-20' });

  try {
    const { priceId, mode = 'subscription', successPath = '/builder', cancelPath = '/#pricing', trialDays } =
      (req.body ?? {}) as { priceId?: string; mode?: 'subscription' | 'payment'; successPath?: string; cancelPath?: string; trialDays?: number };

    if (!priceId || !priceId.startsWith('price_')) {
      return res.status(400).json({
        error: 'invalid_price',
        hint: 'Send a valid Price ID that starts with price_ (not prod_, not a payment link).',
      });
    }

    // Ensure the price exists in THIS Stripe mode (test vs live) and is usable for subscriptions
    const price = await stripe.prices.retrieve(priceId);

    if (mode === 'subscription') {
      if (!price.recurring) {
        return res.status(400).json({
          error: 'price_not_recurring',
          hint: 'The passed price is one-time. Create a recurring price and try again.',
        });
      }
      if (price.active === false) {
        return res.status(400).json({
          error: 'price_inactive',
          hint: 'Activate the price in Stripe or use an active one.',
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: mode === 'subscription' && trialDays ? { trial_period_days: trialDays } : undefined,
      success_url: `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${cancelPath}`,
    });

    if (!session?.url) return res.status(500).json({ error: 'no_checkout_url', hint: 'Stripe created no URL.' });
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    // Common Stripe error → tells you exactly what mismatched
    return res.status(400).json({
      error: 'checkout_failed',
      type: err?.type,
      code: err?.code,
      message: err?.message,
      hint:
        err?.code === 'resource_missing'
          ? 'Price ID not found in this Stripe mode. Verify you used test vs live correctly.'
          : undefined,
    });
  }
}
