// pages/index.tsx
import Head from 'next/head';
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { motion } from 'framer-motion';
import {
  CheckCircle2, ArrowRight, Shield, Wand2, Mic, Zap, CreditCard,
} from 'lucide-react';

const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

// Stripe (client) — keep stripe-js in package.json
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

type BillingCycle = 'monthly' | 'annual';

// Your Stripe Prices
const PRICE_IDS = {
  starter: { monthly: 'price_1SByXOHWdU8X80NM4jFrU6Nr', annual: 'price_1SByXAHWdU8X80NMftriHWJW' },
  pro:     { monthly: 'price_1SByXKHWdU8X80NMAw5IlrTc', annual: 'price_1SByXRHWdU8X80NM7UwuAw0B' },
};

export default function Home() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState<string>('');

  async function beginCheckout(priceId: string, planName: string) {
    // Safety: prevent double clicks
    if (loading) return;
    try {
      setLoading(priceId);

      // call our API to create a Checkout Session
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          priceId,
          planName,
          // where to go back to in case of cancel/success
          successPath: '/builder',
          cancelPath: '/#pricing',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Checkout API failed:', text);
        alert('Could not start checkout. Check Stripe keys + price IDs (see console).');
        return;
      }

      const { sessionId } = await res.json();
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      alert('Could not start checkout. Please try again.');
    } finally {
      setLoading('');
    }
  }

  const monthly = cycle === 'monthly';

  return (
    <>
      <Head>
        <title>ReduxAI — Build voice agents in minutes</title>
        <meta name="description" content="Overlay-clean landing. Paywall-first flow with Stripe checkout." />
      </Head>

      {/* Overlay tokens (same vibe as AssistantRail modals) */}
      <style jsx global>{`
        .va-landing{
          --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214;
          --text:#e6f1ef; --text-muted:#9fb4ad;
          --brand:${CTA}; --brand-weak:rgba(89,217,179,.20);
          --border:rgba(255,255,255,.10); --border-weak:rgba(255,255,255,.10);
          --shadow-card:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset;
          --radius:16px; --ease:cubic-bezier(.22,.61,.36,1);
        }
        :root:not([data-theme="dark"]) .va-landing{
          --bg:#f7faf9; --panel:#ffffff; --card:#f4f7f6;
          --text:#0f172a; --text-muted:#64748b;
          --brand:${CTA}; --brand-weak:rgba(89,217,179,.16);
          --border:rgba(15,23,42,.12); --border-weak:rgba(15,23,42,.12);
          --shadow-card:0 10px 24px rgba(2,6,12,.06), 0 0 0 1px rgba(15,23,42,.06) inset;
        }
        .btn{ height:44px; padding:0 18px; border-radius:999px; display:inline-flex; align-items:center; gap:8px;
              font-weight:600; letter-spacing:.1px; border:1px solid transparent;
              transition:transform .15s var(--ease), box-shadow .15s var(--ease); }
        .btn:hover{ transform:translateY(-1px); }
        .btn-primary{ background:var(--brand); color:#fff; }
        .btn-secondary{ background:var(--panel); border-color:var(--border); color:var(--text); }
        .pill{ display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:999px;
               background:color-mix(in oklab, var(--brand) 12%, var(--panel)); border:1px solid ${GREEN_LINE}; font-size:12px; color:var(--text); }
        .card{ border-radius:var(--radius); border:1px solid var(--border-weak); background:var(--panel); box-shadow:var(--shadow-card); }
        .section{ padding:72px 0; }
        /* clickable sanity: ensure nothing overlays pricing buttons */
        #pricing{ position:relative; z-index:0; }
      `}</style>

      <div className="va-landing" style={{ background:'var(--bg)', color:'var(--text)' }}>
        {/* NAV — minimal */}
        <header className="w-full" style={{ borderBottom:`1px solid ${GREEN_LINE}` }}>
          <nav className="mx-auto max-w-[1160px] px-5 lg:px-6 h-[66px] flex items-center justify-between">
            <div className="flex items-center gap-10">
              <div className="text-base font-semibold" style={{ letterSpacing: '.2px' }}>
                ReduxAI<span style={{ color: CTA }}>.</span>com
              </div>
              <a href="#pricing" className="text-sm" style={{ color:'var(--text-muted)' }}>Pricing</a>
              <a href="#features" className="text-sm" style={{ color:'var(--text-muted)' }}>Features</a>
            </div>
            <div className="flex items-center gap-8">
              <a className="btn btn-primary" href="#pricing">Get started <ArrowRight className="w-4 h-4" /></a>
            </div>
          </nav>
        </header>

        {/* HERO — “Welcome inside ReduxAI.com” */}
        <section className="section">
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="pill mb-3">
                <Wand2 className="w-4 h-4" />
                Welcome to <b>ReduxAI.com</b>
              </div>
              <h1 className="text-[36px] md:text-[42px] leading-[1.12] font-semibold" style={{ letterSpacing: '.2px' }}>
                Build & launch AI voice agents — in minutes.
              </h1>
              <p className="mt-3 text-[15px]" style={{ color:'var(--text-muted)' }}>
                Clean, rounded, overlay-first UI. Pick a plan, verify your card with a $0 auth, charge after the trial.
              </p>

              <div className="mt-6 flex flex-wrap gap-10 items-center">
                <a className="btn btn-primary" href="#pricing">Choose a plan</a>
                <div className="flex items-center gap-2 text-sm" style={{ color:'var(--text-muted)' }}>
                  <Shield className="w-4 h-4" /> Secure Stripe checkout
                </div>
              </div>

              <div className="mt-6 flex gap-6 text-sm" style={{ color:'var(--text-muted)' }}>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: CTA }} /> Real-time voice</div>
                <div className="flex items-center gap-2"><Mic className="w-4 h-4" style={{ color: CTA }} /> Call routing</div>
                <div className="flex items-center gap-2"><Zap className="w-4 h-4" style={{ color: CTA }} /> Fast setup</div>
              </div>
            </div>

            {/* Preview card with mint glow (like overlays) */}
            <div className="card p-6">
              <div className="text-sm mb-2" style={{ color:'var(--text-muted)' }}>Preview</div>
              <div className="rounded-[14px]" style={{
                border:`1px solid ${GREEN_LINE}`,
                background:`linear-gradient(180deg, color-mix(in oklab, var(--brand) 12%, transparent), transparent 60%)`
              }}>
                <div className="p-5">
                  <div className="text-[15px] font-medium">“Hi! I’m your AI receptionist. How can I help?”</div>
                  <div className="mt-2 text-sm" style={{ color:'var(--text-muted)' }}>Natural voice. Smart handoffs. Business-aware.</div>
                </div>
              </div>
              <div className="mt-4 text-xs" style={{ color:'var(--text-muted)' }}>
                Configure the real assistant after checkout.
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="section" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon:<Wand2 className="w-5 h-5" />, title:'No fiddly setup', desc:'Connect data & pick a voice. We handle the rest.' },
                { icon:<Mic className="w-5 h-5" />, title:'Great call quality', desc:'Low-latency, natural speech, smart pauses.' },
                { icon:<Shield className="w-5 h-5" />, title:'Secure & private', desc:'Auth-gated app and safe storage by design.' },
              ].map((f,i)=>(
                <div key={i} className="card p-5">
                  <div className="w-10 h-10 rounded-[12px] grid place-items-center mb-3"
                       style={{ background:'var(--brand-weak)', border:`1px solid ${GREEN_LINE}` }}>
                    {f.icon}
                  </div>
                  <div className="text-[16px] font-semibold">{f.title}</div>
                  <div className="mt-1 text-[14px]" style={{ color:'var(--text-muted)' }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING (overlay spacing/sectioning) */}
        <section id="pricing" className="section" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="pill"><CreditCard className="w-4 h-4" /> Pricing</div>
                <h2 className="text-[28px] md:text-[32px] font-semibold mt-2">Simple plans, free trial included</h2>
                <div className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>
                  Card required for a $0 verification. You’ll be charged after the trial unless you cancel.
                </div>
              </div>

              {/* cycle toggle */}
              <div className="card p-1 flex items-center gap-1">
                <button
                  className="btn"
                  style={{
                    height:36, padding:'0 14px', borderRadius:999,
                    background: monthly ? 'var(--brand)' : 'var(--panel)',
                    color: monthly ? '#fff' : 'var(--text)',
                    border: `1px solid ${monthly ? 'transparent' : 'var(--border)'}`
                  }}
                  onClick={()=>setCycle('monthly')}
                >
                  Monthly
                </button>
                <button
                  className="btn"
                  style={{
                    height:36, padding:'0 14px', borderRadius:999,
                    background: !monthly ? 'var(--brand)' : 'var(--panel)',
                    color: !monthly ? '#fff' : 'var(--text)',
                    border: `1px solid ${!monthly ? 'transparent' : 'var(--border)'}`
                  }}
                  onClick={()=>setCycle('annual')}
                >
                  Annual <span className="ml-1 text-xs" style={{ opacity:.9 }}>(save ~40%)</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <PlanCard
                title="Starter"
                priceLabel={monthly ? '€19/mo' : '€11/mo (billed yearly)'}
                blurb="Everything you need to launch a single voice agent."
                features={['1 assistant','Real-time voice','Basic analytics','Email support']}
                loading={loading === PRICE_IDS.starter[cycle]}
                onSelect={() => beginCheckout(PRICE_IDS.starter[cycle], 'Starter')}
              />
              <PlanCard
                title="Pro"
                highlight
                priceLabel={monthly ? '€39/mo' : '€23/mo (billed yearly)'}
                blurb="Scale to multiple assistants and teams."
                features={['Up to 5 assistants','Advanced analytics','Priority routing','Priority support']}
                loading={loading === PRICE_IDS.pro[cycle]}
                onSelect={() => beginCheckout(PRICE_IDS.pro[cycle], 'Pro')}
              />
            </div>

            <div className="mt-5 text-xs" style={{ color:'var(--text-muted)' }}>
              UI prices are labels; the actual amount/interval is defined by your Stripe Price.
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="section" style={{ borderTop:`1px solid ${GREEN_LINE}`, paddingTop: 40 }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 text-sm" style={{ color:'var(--text-muted)' }}>
            © {new Date().getFullYear()} ReduxAI — All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
}

function PlanCard({
  title, blurb, priceLabel, features, onSelect, highlight, loading
}:{
  title:string; blurb:string; priceLabel:string; features:string[]; onSelect:()=>void; highlight?:boolean; loading?:boolean;
}) {
  return (
    <motion.div
      className="card p-5"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        outline: highlight ? `2px solid ${CTA}` : 'none',
        boxShadow: highlight ? '0 0 0 1px rgba(89,217,179,.18), var(--shadow-card)' : 'var(--shadow-card)',
        borderRadius: 16
      }}
    >
      <div className="text-sm mb-1" style={{ color:'var(--text-muted)' }}>{title}</div>
      <div className="text-[24px] font-semibold">{priceLabel}</div>
      <div className="text-sm mt-1 mb-3" style={{ color:'var(--text-muted)' }}>{blurb}</div>

      <ul className="text-sm space-y-2 mb-5">
        {features.map((f,i)=>(
          <li key={i} className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: CTA }} /> {f}
          </li>
        ))}
      </ul>

      <button className="btn btn-primary w-full" onClick={onSelect} disabled={loading}>
        {loading ? 'Starting checkout…' : 'Start free trial'}
      </button>
    </motion.div>
  );
}
