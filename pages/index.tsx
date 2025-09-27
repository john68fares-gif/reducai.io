// pages/index.tsx
'use client';

import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  ArrowRight, CheckCircle2, Zap, Shield, Wand2, HeadphonesIcon, ChevronRight
} from 'lucide-react';

const ACCENT = '#59d9b3';

function useStripe() {
  const [stripe, setStripe] = useState<ReturnType<typeof loadStripe> | null>(null);
  useEffect(() => {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    setStripe(loadStripe(pk));
  }, []);
  return stripe;
}

export default function Home() {
  const stripePromise = useStripe();
  const [billingCycle, setBillingCycle] = useState<'month'|'year'>('month');
  const [busy, setBusy] = useState<string>('');

  const price = useMemo(() => ({
    starter: billingCycle === 'month'
      ? process.env.NEXT_PUBLIC_PRICE_STARTER_MONTHLY || ''
      : process.env.NEXT_PUBLIC_PRICE_STARTER_YEARLY || '',
    pro: billingCycle === 'month'
      ? process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY || ''
      : process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY || '',
  }), [billingCycle]);

  async function startCheckout(tier: 'starter' | 'pro') {
    try {
      setBusy(tier);
      const pid = price[tier];
      if (!pid) throw new Error('Missing Price ID env variable');

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          priceId: pid,
          mode: 'subscription',
        })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Checkout failed');
      }
      const { sessionId, publishableKey } = await res.json();

      // Ensure stripe instance (use key from server for safety)
      const stripe = await loadStripe(publishableKey);
      if (!stripe) throw new Error('Stripe not loaded');

      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw error;
    } catch (err:any) {
      // Surface the real console error so you can see exactly which var is missing
      console.error('[checkout]', err);
      alert('Could not start checkout. Check Stripe keys + Price IDs (open console).');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <Head>
        <title>ReduxAI — Build AI voice agents</title>
        <meta name="description" content="Build AI agents and connect them to real-world channels." />
      </Head>

      {/* Tokens */}
      <style jsx global>{`
        :root {
          --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214; --text:#e6f1ef; --muted:#9fb4ad;
          --brand:${ACCENT}; --brand-weak:rgba(89,217,179,.18);
          --border:rgba(255,255,255,.10);
          --radius:12px; --ease:cubic-bezier(.22,.61,.36,1);
          --shadow:0 20px 50px rgba(0,0,0,.45);
        }
        :root:not([data-theme="dark"]) {
          --bg:#f7faf9; --panel:#ffffff; --card:#f6faf9; --text:#0f172a; --muted:#64748b;
          --border:rgba(15,23,42,.12);
          --shadow:0 14px 36px rgba(2,6,12,.10);
        }
        html,body,#__next{height:100%}
        body{background:var(--bg); color:var(--text);}
        .grid-bg{
          position:relative; isolation:isolate;
          background:
            radial-gradient(800px 400px at 50% -10%, var(--brand-weak), transparent 60%),
            linear-gradient(180deg, rgba(0,0,0,.08), transparent 30%),
            var(--bg);
        }
        .grid-bg::after{
          content:''; position:absolute; inset:0; opacity:.2; z-index:0;
          background:
            radial-gradient(300px 300px at 20% 10%, rgba(89,217,179,.10), transparent 60%),
            radial-gradient(300px 300px at 80% 0%, rgba(89,217,179,.10), transparent 60%),
            repeating-linear-gradient(90deg, transparent 0 48px, rgba(255,255,255,.06) 48px 49px),
            repeating-linear-gradient(0deg, transparent 0 48px, rgba(255,255,255,.06) 48px 49px);
          mask: radial-gradient(100% 60% at 50% 0%, #000 40%, transparent 100%);
        }
        .card{
          background:var(--card); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow);
        }
        .glow{
          box-shadow: 0 0 0 1px color-mix(in oklab, var(--brand) 30%, var(--border)),
                      0 12px 40px color-mix(in oklab, var(--brand) 25%, transparent);
        }
        .pill{border:1px solid color-mix(in oklab, var(--brand) 30%, var(--border)); background:color-mix(in oklab, var(--brand) 8%, var(--panel));}
        .muted{color:var(--muted)}
        .btn{
          display:inline-flex; align-items:center; justify-content:center; gap:.5rem; font-weight:600;
          height:44px; padding:0 18px; border-radius:10px; border:1px solid var(--border);
          background:color-mix(in oklab, var(--brand) 8%, var(--panel)); color:var(--text);
          transition: transform .15s var(--ease), box-shadow .2s var(--ease), background .2s var(--ease);
        }
        .btn:hover{ transform:translateY(-1px); box-shadow:0 10px 30px rgba(0,0,0,.25) }
        .btn-cta{ background: var(--brand); color:#07231b; border-color: color-mix(in oklab, var(--brand) 60%, var(--border)); }
        .btn-cta:hover{ box-shadow: 0 18px 48px color-mix(in oklab, var(--brand) 40%, transparent) }
        .h1{font-size: clamp(2.4rem, 6vw, 4.25rem); line-height:1.1; letter-spacing:-.02em; font-weight:800}
        .h2{font-size: clamp(1.6rem, 3.4vw, 2.6rem); line-height:1.12; letter-spacing:-.01em; font-weight:800}
        .h3{font-size: 1.125rem; font-weight:700}
        .k{font-size: 14px; font-weight:700; letter-spacing:.14em; color:var(--muted)}
        .list li{display:flex; align-items:flex-start; gap:.5rem; margin: .35rem 0}
        .list svg{color: var(--brand)}
        .switch{
          display:inline-flex; align-items:center; gap:10px; padding:6px; border-radius:999px; border:1px solid var(--border);
          background: var(--panel);
        }
        .switch button{
          height:34px; min-width:120px; padding:0 14px; border-radius:999px; border:1px solid var(--border);
          background: transparent; color: var(--text); font-weight:600;
        }
        .switch button[data-active="true"]{
          border-color: color-mix(in oklab, var(--brand) 40%, var(--border));
          background: color-mix(in oklab, var(--brand) 12%, var(--panel));
          box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--brand) 24%, transparent);
        }
      `}</style>

      {/* NAV */}
      <header className="grid-bg">
        <div className="mx-auto max-w-[1200px] px-5 py-5 flex items-center justify-between relative z-[1]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg grid place-items-center" style={{background:'color-mix(in oklab, var(--brand) 20%, var(--card))', border:'1px solid var(--border)'}}>
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="font-semibold">ReduxAI</div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm muted">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <a className="btn" href="/login">Sign in</a>
            <a className="btn btn-cta" href="/signup">Get started <ArrowRight className="w-4 h-4"/></a>
          </div>
        </div>

        {/* HERO */}
        <section className="mx-auto max-w-[1200px] px-5 pb-20 pt-10 relative z-[1]">
          <div className="pill inline-flex items-center gap-2 px-3 h-8 rounded-full text-xs muted">
            <Shield className="w-3.5 h-3.5"/> Secure by design
          </div>

          <h1 className="h1 mt-4">
            Build <span style={{color:ACCENT}}>AI Agents</span><br/> and launch them fast
          </h1>
          <p className="muted mt-3 max-w-[640px]">
            Connect data, pick a voice, and deploy. Beautiful rails, low-latency calls, and a clean billing flow.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a className="btn btn-cta" href="/app">Start building <ArrowRight className="w-4 h-4"/></a>
            <a className="btn" href="#pricing">See pricing</a>
          </div>

          {/* hero cards */}
          <div className="grid md:grid-cols-3 gap-4 mt-12">
            <div className="card p-5">
              <div className="h3 flex items-center gap-2"><Zap className="w-4 h-4" style={{color:ACCENT}}/> No fiddly setup</div>
              <p className="muted mt-2">Connect data & pick a voice. We handle the rest.</p>
            </div>
            <div className="card p-5">
              <div className="h3 flex items-center gap-2"><HeadphonesIcon className="w-4 h-4" style={{color:ACCENT}}/> Great call quality</div>
              <p className="muted mt-2">Low-latency, natural speech with smart pauses.</p>
            </div>
            <div className="card p-5">
              <div className="h3 flex items-center gap-2"><Shield className="w-4 h-4" style={{color:ACCENT}}/> Secure & private</div>
              <p className="muted mt-2">Auth-gated app and safe storage by design.</p>
            </div>
          </div>
        </section>
      </header>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-[1200px] px-5 py-20">
        <div className="k mb-2">FEATURES</div>
        <h2 className="h2">Setup agents in <span style={{color:ACCENT}}>4 steps</span></h2>
        <div className="grid lg:grid-cols-2 gap-6 mt-8">
          {[
            {title:'Prompt Agent', desc:'Create detailed instructions with the AI Prompter in minutes.'},
            {title:'Demo Agent', desc:'Share your Agent with clients and teammates in a live demo.'},
            {title:'Connect Agent', desc:'Add integrations (Web widget, Instagram, Messenger, SMS).'},
            {title:'Deploy Agent', desc:'Launch to the real world and track conversations in one place.'},
          ].map((s, i)=>(
            <div key={i} className="card p-6 glow">
              <div className="k">STEP {i+1}</div>
              <div className="h3 mt-2">{s.title}</div>
              <p className="muted mt-2">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-[1200px] px-5 py-20">
        <div className="k mb-2">PRICING</div>
        <h2 className="h2">Build agents with <span style={{color:ACCENT}}>confidence</span></h2>

        <div className="mt-6">
          <div className="switch">
            <button data-active={billingCycle==='month'} onClick={()=>setBillingCycle('month')}>Monthly</button>
            <button data-active={billingCycle==='year'} onClick={()=>setBillingCycle('year')}>Annual <span className="muted">(save ~40%)</span></button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-10">
          {/* Starter */}
          <div className="card p-6 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"
                 style={{background:'radial-gradient(60% 80% at 50% 0%, rgba(89,217,179,.10), transparent)'}}/>
            <div className="h3">Starter</div>
            <div className="mt-2 text-3xl font-extrabold">
              {billingCycle==='month' ? '€19/mo' : '€142/yr'}
            </div>
            <ul className="list mt-4 muted">
              <li><CheckCircle2 className="w-4 h-4"/><span>1 assistant</span></li>
              <li><CheckCircle2 className="w-4 h-4"/><span>Real-time voice</span></li>
              <li><CheckCircle2 className="w-4 h-4"/><span>Basic analytics</span></li>
              <li><CheckCircle2 className="w-4 h-4"/><span>Email support</span></li>
            </ul>
            <button
              disabled={busy==='starter'}
              onClick={()=>startCheckout('starter')}
              className="btn btn-cta w-full mt-6"
            >
              {busy==='starter' ? 'Starting checkout…' : 'Start free trial'}
              <ChevronRight className="w-4 h-4"/>
            </button>
            <div className="mt-3 text-xs muted">Card required for a €0 authorization. First charge after the trial unless you cancel.</div>
          </div>

          {/* Pro */}
          <div className="card p-6 glow relative overflow-hidden" style={{borderColor:'color-mix(in oklab, var(--brand) 40%, var(--border))'}}>
            <div className="absolute inset-0 pointer-events-none"
                 style={{background:'radial-gradient(60% 80% at 50% 0%, rgba(89,217,179,.14), transparent)'}}/>
            <div className="h3 flex items-center gap-2">
              Pro <span className="pill text-xs px-2 py-1 rounded-full">Most popular</span>
            </div>
            <div className="mt-2 text-3xl font-extrabold">
              {billingCycle==='month' ? '€39/mo' : '€462/yr'}
            </div>
            <ul className="list mt-4 muted">
              <li><CheckCircle2 className="w-4 h-4"/><span>Up to 5 assistants</span></li>
              <li><CheckCircle2 className="w-4 h-4"/><span>Advanced analytics</span></li>
              <li><CheckCircle2 className="w-4 h-4"/><span>Priority routing</span></li>
              <li><CheckCircle2 className="w-4 h-4"/><span>Priority support</span></li>
            </ul>
            <button
              disabled={busy==='pro'}
              onClick={()=>startCheckout('pro')}
              className="btn btn-cta w-full mt-6"
            >
              {busy==='pro' ? 'Starting checkout…' : 'Start free trial'}
              <ChevronRight className="w-4 h-4"/>
            </button>
            <div className="mt-3 text-xs muted">UI prices are labels; actual amount/interval comes from your Stripe Price.</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-10 border-t" style={{borderColor:'var(--border)'}}>
        <div className="mx-auto max-w-[1200px] px-5 py-10 grid md:grid-cols-4 gap-8 muted">
          <div>
            <div className="h3">ReduxAI</div>
            <p className="mt-2 text-sm">Build and launch AI agents that perform real-world tasks.</p>
          </div>
          <div>
            <div className="k mb-2">PRODUCT</div>
            <ul className="space-y-2 text-sm">
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </div>
          <div>
            <div className="k mb-2">COMPANY</div>
            <ul className="space-y-2 text-sm">
              <li><a href="/privacy">Privacy</a></li>
              <li><a href="/terms">Terms</a></li>
            </ul>
          </div>
          <div>
            <div className="k mb-2">SUPPORT</div>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:support@reducai.com">support@reducai.com</a></li>
            </ul>
          </div>
        </div>
        <div className="px-5 pb-10 text-center text-xs muted">© {new Date().getFullYear()} ReduxAI — All rights reserved.</div>
      </footer>
    </>
  );
}
