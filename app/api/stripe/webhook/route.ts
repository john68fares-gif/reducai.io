// /app/api/stripe/webhook/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Helper to upsert row
  const upsert = async (p: {
    user_id: string,
    stripe_customer_id?: string | null,
    stripe_subscription_id?: string | null,
    tier?: 'starter'|'pro' | null,
    status?: string | null,
    current_period_end?: string | null
  }) => {
    await supabase
      .from('subscriptions')
      .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      // you passed user_id in session.metadata.user_id at creation time
      const user_id = s.metadata?.user_id!;
      const subId = s.subscription as string | null;
      const custId = s.customer as string | null;
      const priceId = (s.amount_total && s.mode === 'subscription') ? (s?.metadata?.price_id || null) : null;

      // Derive tier from price_id if you want (starter/pro)
      const tier = priceId?.includes('starter') ? 'starter' : 'pro';

      await upsert({
        user_id,
        stripe_customer_id: custId,
        stripe_subscription_id: subId,
        status: 'active',
        tier: (tier as any) || null,
        current_period_end: null
      });
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      // Recover user id from metadata if you attached it,
      // or map from stripe_customer_id → user_id in your DB.
      const user = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', sub.customer as string)
        .maybeSingle();

      if (user.data?.user_id) {
        await upsert({
          user_id: user.data.user_id,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          status: sub.status, // 'active','past_due','canceled',...
          current_period_end: new Date(sub.current_period_end * 1000).toISOString()
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

// Important for Stripe raw body:
export const config = { api: { bodyParser: false } } as any;
