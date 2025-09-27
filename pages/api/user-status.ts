// pages/api/user-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE as string // service key (server only)
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Read the session from the auth cookies
    const accessToken = req.cookies['sb-access-token'];
    let userId: string | null = null;

    if (accessToken) {
      const { data: session } = await supabase.auth.getUser(accessToken);
      userId = session?.user?.id ?? null;
    }

    if (!userId) {
      return res.status(200).json({ hasAccount: false, hasSubscription: false, paymentLink: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || null });
    }

    // Example: check your "profiles" table for an existing row
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, plan_tier, stripe_status')
      .eq('id', userId)
      .maybeSingle();

    const hasAccount = Boolean(profile?.id);

    // Example subscription flag(s) — adjust to your schema/logic
    const hasSubscription =
      Boolean(profile?.stripe_status && ['active', 'trialing', 'past_due'].includes(profile.stripe_status)) ||
      Boolean(profile?.plan_tier && profile.plan_tier !== 'Free');

    return res.status(200).json({
      hasAccount,
      hasSubscription,
      paymentLink: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || null
    });
  } catch (e) {
    return res.status(200).json({
      hasAccount: false,
      hasSubscription: false,
      paymentLink: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || null
    });
  }
}
