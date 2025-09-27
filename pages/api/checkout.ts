// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''; // optional, else we’ll build from req

const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    if (!stripeSecret) return res.status(500).send('STRIPE_SECRET_KEY missing');

    const { priceId, planName, successPath = '/builder', cancelPath = '/' } = req.body || {};
    if (!priceId) return res.status(400).send('Missing priceId');

    // figure out URL origin (for local & vercel)
    const origin =
      siteUrl ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

    // Create a subscription checkout with trial AND require card up-front
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30, // charge after ~1 month
      },
      payment_method_collection: 'always', // capture card now
      allow_promotion_codes: false,
      // If you want to restrict to test cards only in dev, add payment_method_types
      // payment_method_types: ['card'],

      success_url: `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cancelPath}`,

      metadata: planName ? { planName } : undefined,
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err: any) {
    console.error('Stripe error', err);
    return res.status(500).send(err?.message || 'Stripe error');
  }
}
