// pages/index.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, CheckCircle2, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

/* Tokens (same as AssistantRail) */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const R_MD = 8;

export default function Home() {
  const [busy, setBusy] = useState<string>('');

  async function startCheckout(priceId: string, tier: string) {
    try {
      setBusy(tier);
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, mode: 'subscription' }),
      });
      const { sessionId, publishableKey } = await res.json();
      const stripe = await loadStripe(publishableKey);
      await stripe?.redirectToCheckout({ sessionId });
    } catch (err) {
      console.error(err);
      alert('Stripe checkout failed. Check console.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto mt-16 p-8"
        style={{
          background: 'var(--panel)',
          border: `1px solid ${GREEN_LINE}`,
          borderRadius: R_MD,
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="grid place-items-center w-10 h-10"
            style={{ borderRadius: R_MD, background: 'var(--brand-weak)' }}
          >
            <Wand2 style={{ color: CTA }} />
          </div>
          <h1 className="text-2xl font-bold">Welcome to ReducAI</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Build AI voice assistants and launch them instantly.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => startCheckout(process.env.NEXT_PUBLIC_PRICE_STARTER_MONTHLY!, 'starter')}
            disabled={busy === 'starter'}
            className="flex-1 h-[44px] font-semibold"
            style={{
              background: CTA,
              color: '#fff',
              borderRadius: R_MD,
            }}
          >
            {busy === 'starter' ? 'Starting…' : 'Start free trial'}
          </button>
          <a
            href="#features"
            className="flex-1 h-[44px] font-semibold grid place-items-center"
            style={{
              background: 'var(--panel)',
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: R_MD,
            }}
          >
            Learn more
          </a>
        </div>
      </motion.section>

      {/* FEATURES */}
      <section className="max-w-2xl mx-auto mt-10 p-6"
        style={{
          background: 'var(--panel)',
          border: `1px solid ${GREEN_LINE}`,
          borderRadius: R_MD,
        }}
      >
        <h2 className="font-semibold mb-4">Features</h2>
        <ul className="space-y-3 text-sm">
          {['1 assistant', 'Real-time voice', 'Basic analytics', 'Email support'].map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckCircle2 style={{ color: CTA }} className="w-4 h-4" /> {f}
            </li>
          ))}
        </ul>
      </section>

      {/* PRICING */}
      <section className="max-w-2xl mx-auto mt-10 grid gap-6 md:grid-cols-2">
        {[
          { name: 'Starter', price: '€19/mo', id: process.env.NEXT_PUBLIC_PRICE_STARTER_MONTHLY! },
          { name: 'Pro', price: '€39/mo', id: process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY! },
        ].map((p) => (
          <div
            key={p.name}
            className="p-6"
            style={{
              background: 'var(--panel)',
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: R_MD,
            }}
          >
            <h3 className="font-bold">{p.name}</h3>
            <div className="text-2xl mt-2">{p.price}</div>
            <button
              onClick={() => startCheckout(p.id, p.name.toLowerCase())}
              disabled={busy === p.name.toLowerCase()}
              className="w-full h-[44px] font-semibold mt-4"
              style={{
                background: CTA,
                color: '#fff',
                borderRadius: R_MD,
              }}
            >
              {busy === p.name.toLowerCase() ? 'Starting…' : 'Start free trial'}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
