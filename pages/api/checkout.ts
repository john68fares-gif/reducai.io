// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

function getOrigin(req: NextApiRequest) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { priceId, planName, fromPath } = req.body as {
      priceId: string; planName?: string; fromPath?: string;
    };
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    const origin = getOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 21, // or 30
        metadata: { plan_name: planName || 'unknown' },
      },
      allow_promotion_codes: true,
      client_reference_id: '', // optionally your user id
      metadata: { from_path: fromPath || '/' },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error('checkout error', err);
    return res.status(500).json({ error: 'Checkout session failed' });
  }
}
