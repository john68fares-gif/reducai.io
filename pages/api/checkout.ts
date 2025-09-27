// /pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { priceId } = req.body as { priceId: string };
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      billing_address_collection: 'auto',
      success_url: `${req.headers.origin}/?checkout=success`,
      cancel_url: `${req.headers.origin}/?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error('checkout error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
