// pages/index.tsx
'use client';

import { useMemo, useState } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import {
  Sparkles, Wand2, CheckCircle2, PhoneCall, Mic, Gauge, Shield,
  Rocket, Layers, PlugZap, Workflow, CreditCard, ChevronRight, Loader2
} from 'lucide-react';

/* ───────────────── Tokens (re-using your overlay vibe) ───────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const R_SM = 6;
const R_MD = 8;
const R_LG = 10;

const Tokens = () => (
  <style jsx global>{`
    .lp-scope{
      --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214; --text:#e6f1ef; --text-muted:#9fb4ad;
      --brand:${CTA}; --brand-weak:rgba(89,217,179,.12);
      --border:rgba(255,255,255,.12);
      --shadow-card:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset;
    }
    :root:not([data-theme="dark"]) .lp-scope{
      --bg:#f7faf9; --panel:#fff; --card:#f4f7f6; --text:#0f172a; --text-muted:#64748b;
      --border:rgba(15,23,42,.12);
      --shadow-card:0 10px 24px rgba(2,6,12,.06), 0 0 0 1px rgba(15,23,42,.06) inset;
    }
    .va-card{
      border-radius:${R_MD}px;
      border:1px solid ${GREEN_LINE};
      background:var(--panel);
      box-shadow:var(--shadow-card);
    }
    .va-ghost{
      border-radius:${R_MD}px;
      border:1px solid ${GREEN_LINE};
      background:linear-gradient(180deg, color-mix(in oklab, var(--panel) 92%, black) 0%, var(--panel) 100%);
      box-shadow:var(--shadow-card);
    }
    .muted{ color: var(--text-muted); }
    .pill{ display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; border:1px solid ${GREEN_LINE}; background:var(--panel); }
    .btn{ height:44px; border-radius:${R_MD}px; font-weight:600; }
    .btn-cta{ background:${CTA}; color:#0a1210; border:1px solid color-mix(in oklab, ${CTA} 40%, black); }
    .btn-ghost{ background:var(--panel); color:var(--text); border:1px solid ${GREEN_LINE}; }
    .row{ position:relative; }
    .row::after{
      content:''; position:absolute; inset:0; border-radius:${R_MD}px; background:${CTA};
      mix-blend-mode:screen; opacity:0; transition:opacity .18s ease;
    }
    .row:hover::after{ opacity:.18; }
  `}</style>
);

/* ───────────────── Stripe Price IDs (YOURS) ─────────────────
   If any mapping is swapped, just move the IDs below.
---------------------------------------------------------------- */
const PRICE = {
  STARTER_MONTHLY: 'price_1SByXAHWdU8X80NMftriHWJW',
  PRO_MONTHLY:     'price_1SByXKHWdU8X80NMAw5IlrTc',
  STARTER_ANNUAL:  'price_1SByXOHWdU8X80NM4jFrU6Nr',
  PRO_ANNUAL:      'price_1SByXRHWdU8X80NM7UwuAw0B',
} as const;

/* ───────────────── Helpers ───────────────── */
async function beginCheckout(priceId: string) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, mode: 'subscription' }),
  });
  if (!res.ok) throw new Error(await res.text());
  const { sessionId, publishableKey } = await res.json();
  const stripe = await loadStripe(publishableKey);
  const { error } = await stripe!.redirectToCheckout({ sessionId });
  if (error) throw error;
}

/* ───────────────── Component ───────────────── */
export default function Landing() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState<string>('');

  const SKUs = useMemo(() => {
    return billing === 'monthly'
      ? [
          { key: 'starter', name: 'Starter', price: '€19/mo', priceId: PRICE.STARTER_MONTHLY, bullets: ['1 assistant', 'Real-time voice', 'Basic analytics', 'Email support'] },
          { key: 'pro',     name: 'Pro',     price: '€39/mo', priceId: PRICE.PRO_MONTHLY,     bullets: ['Up to 5 assistants', 'Advanced analytics', 'Priority routing', 'Priority support'] },
        ]
      : [
          { key: 'starter', name: 'Starter', price: '€136/yr', priceId: PRICE.STARTER_ANNUAL, bullets: ['1 assistant', 'Real-time voice', 'Basic analytics', 'Email support'] },
          { key: 'pro',     name: 'Pro',     price: '€326/yr', priceId: PRICE.PRO_ANNUAL,     bullets: ['Up to 5 assistants', 'Advanced analytics', 'Priority routing', 'Priority support'] },
        ];
  }, [billing]);

  const go = async (skuKey: string, priceId: string) => {
    try {
      setBusy(skuKey);
      await beginCheckout(priceId);
    } catch (e) {
      console.error(e);
      alert('Could not start checkout. Check Stripe keys + Price IDs (open console).');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Head><title>ReduxAI — Build AI voice agents</title></Head>
      <Tokens />
      <div className="lp-scope min-h-screen" style={{ background:'var(--bg)', color:'var(--text)' }}>
        <main className="max-w-[1160px] mx-auto px-5 lg:px-6 pb-24">

          {/* ───── HERO / WELCOME ───── */}
          <section className="pt-16 md:pt-20">
            <div className="pill mb-4">
              <Sparkles className="w-4 h-4" style={{ color: CTA }} />
              <span className="text-sm">Welcome to <b>ReduxAI</b></span>
            </div>

            <div className="va-ghost p-7 md:p-9">
              <div className="flex items-start gap-4">
                <div className="grid place-items-center w-12 h-12 rounded-[10px]" style={{ background:'var(--brand-weak)' }}>
                  <Wand2 className="w-6 h-6" style={{ color: CTA }} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-[40px] leading-tight font-extrabold">
                    Build AI <span style={{ color: CTA }}>Voice Agents</span> that sound natural.
                  </h1>
                  <p className="muted mt-3 text-[15px] max-w-2xl">
                    Connect data, pick a voice, and go live in minutes. Clean UI, low-latency calls, and safe-by-design storage.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="#pricing"
                      className="btn btn-cta inline-grid place-items-center px-5"
                      style={{ borderColor: GREEN_LINE }}
                    >
                      Start free trial <ChevronRight className="w-4 h-4 ml-1" />
                    </a>
                    <a href="#how" className="btn btn-ghost inline-grid place-items-center px-5">
                      See how it works
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ───── HOW IT WORKS (4 steps) ───── */}
          <section id="how" className="mt-10">
            <div className="va-card p-6 md:p-8">
              <h2 className="text-xl font-semibold mb-1">Set up in 4 steps</h2>
              <p className="muted text-sm mb-6">From prompt to production in minutes.</p>

              <div className="grid gap-3">
                {[
                  { icon: Mic,       title:'Create an Assistant',   desc:'Name it, set goals, and pick a natural voice.' },
                  { icon: Layers,    title:'Design Prompts',        desc:'Give it structure and guardrails. Test instantly.' },
                  { icon: PlugZap,   title:'Connect Channels',      desc:'Website widget, SMS, socials—wherever your users are.' },
                  { icon: Rocket,    title:'Deploy & Monitor',      desc:'Track calls, see analytics, and iterate safely.' },
                ].map((s, i) => (
                  <div key={s.title} className="row flex items-start gap-3 p-3 md:p-4 rounded-[8px]">
                    <div className="grid place-items-center w-10 h-10 rounded-[8px]" style={{ background:'var(--brand-weak)' }}>
                      <s.icon className="w-5 h-5" style={{ color: CTA }} />
                    </div>
                    <div>
                      <div className="font-semibold">{i+1}. {s.title}</div>
                      <div className="muted text-sm">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ───── HIGHLIGHTS / FEATURES ───── */}
          <section id="features" className="mt-10">
            <div className="va-card p-6 md:p-8">
              <h2 className="text-xl font-semibold mb-1">Why ReduxAI</h2>
              <p className="muted text-sm mb-6">Everything you need to launch a human-sounding agent.</p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: PhoneCall, title:'Real-time voice', desc:'Low-latency audio with natural pauses.' },
                  { icon: Gauge,     title:'Performance',     desc:'Snappy UX, offline-first data handling.' },
                  { icon: Shield,    title:'Privacy-first',   desc:'Auth-gated app and safe storage by design.' },
                  { icon: Workflow,  title:'Simple flows',    desc:'Opinionated tooling for fast iteration.' },
                  { icon: Layers,    title:'Composable',      desc:'Stack your tools, bring your own models.' },
                  { icon: CreditCard,title:'Billing that fits',desc:'Monthly or annual. Trial included.' },
                ].map((f) => (
                  <div key={f.title} className="row p-4 rounded-[8px]" style={{ border:'1px solid var(--border)', background:'var(--card)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <f.icon className="w-4 h-4" style={{ color: CTA }} />
                      <div className="font-semibold">{f.title}</div>
                    </div>
                    <div className="muted text-sm">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ───── PRICING ───── */}
          <section id="pricing" className="mt-10">
            <div className="va-ghost p-6 md:p-8">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold">Simple plans, free trial included</h2>
                  <div className="muted text-sm">We verify your card with a €0 authorization. First charge after the trial unless you cancel.</div>
                </div>
                <div className="pill">
                  <button
                    onClick={() => setBilling('monthly')}
                    className="px-3 py-1 rounded-[999px] text-sm"
                    style={{ background: billing==='monthly' ? 'color-mix(in oklab, var(--brand) 18%, var(--panel))' : 'transparent' }}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBilling('annual')}
                    className="px-3 py-1 rounded-[999px] text-sm"
                    style={{ background: billing==='annual' ? 'color-mix(in oklab, var(--brand) 18%, var(--panel))' : 'transparent' }}
                  >
                    Annual <span className="muted">(save ~40%)</span>
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-6">
                {SKUs.map((p) => (
                  <motion.div
                    key={p.key}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="va-card p-6"
                    style={{ borderRadius: R_LG, borderColor: GREEN_LINE }}
                  >
                    <div className="text-sm muted mb-1">{p.name}</div>
                    <div className="text-2xl font-extrabold mb-1">{p.price}</div>
                    <ul className="space-y-2 text-sm mb-5">
                      {p.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" style={{ color: CTA }} /> {b}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => go(p.key, p.priceId)}
                      disabled={busy === p.key}
                      className="btn btn-cta w-full inline-flex items-center justify-center gap-2"
                    >
                      {busy === p.key ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {busy === p.key ? 'Starting checkout…' : 'Start free trial'}
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="muted text-[12px] mt-4">
                UI prices are labels; actual amount/interval come from your Stripe Price.
              </div>
            </div>
          </section>

          {/* ───── FAQ ───── */}
          <section className="mt-10">
            <div className="va-card p-6 md:p-8">
              <h2 className="text-xl font-semibold mb-1">Frequently asked</h2>
              <div className="muted text-sm mb-4">Short answers to common questions.</div>

              <div className="grid gap-3">
                {[
                  { q:'Do you offer a free trial?', a:'Yes. We authorize your card for €0 and only charge after the trial unless you cancel.' },
                  { q:'Can I cancel anytime?', a:'Absolutely. Cancel from your account page and you will not be charged next period.' },
                  { q:'Is my data safe?', a:'Yes. Auth-gated app and safe storage by design. You control your keys.' },
                ].map((f) => (
                  <details key={f.q} className="va-card p-4">
                    <summary className="font-semibold cursor-pointer">{f.q}</summary>
                    <div className="muted text-sm mt-2">{f.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ───── FOOTER ───── */}
          <footer className="mt-12 pb-8 muted text-sm">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="va-card p-4">
                <div className="font-semibold mb-1">ReduxAI</div>
                <div>Build voice agents that actually sound human.</div>
              </div>
              <div className="va-card p-4">
                <div className="font-semibold mb-1">Support</div>
                <div>support@reducai.com</div>
              </div>
              <div className="va-card p-4">
                <div className="font-semibold mb-1">Legal</div>
                <div>Terms • Privacy</div>
              </div>
            </div>
            <div className="mt-6 text-center">© {new Date().getFullYear()} ReduxAI — All rights reserved.</div>
          </footer>
        </main>
      </div>
    </>
  );
}
