'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, UsersRound, Flashlight } from 'lucide-react';

/* ------------------------ PRICES (LIVE) ------------------------ */
const PRICE = {
  STARTER_MONTH: 'price_1SByXAHWdU8X80NMftriHWJW',
  PRO_MONTH:     'price_1SByXKHWdU8X80NMAw5IlrTc',
  STARTER_YEAR:  'price_1SByXOHWdU8X80NM4jFrU6Nr',
  PRO_YEAR:      'price_1SByXRHWdU8X80NM7UwuAw0B',
} as const;

/* ------------------------ CHECKOUT ----------------------------- */
async function startCheckout(priceId: string, setBusy?: (b: boolean)=>void){
  try{
    setBusy?.(true);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data?.detail || data?.error || 'Failed to create session');

    const { loadStripe } = await import('@stripe/stripe-js');
    const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
    const { error } = await stripe!.redirectToCheckout({ sessionId: data.id });
    if (error) throw error;
  } catch (e:any){
    console.error(e);
    alert(`Could not start checkout. Check Stripe keys + Price IDs (open console).\n\n${e?.message||e}`);
  } finally{
    setBusy?.(false);
  }
}

/* ------------------------ PAGE ------------------------ */
export default function Page(){
  return (
    <>
      <Navbar />
      <Hero />
      <Steps />
      <Pricing />
      <FAQ />
      <Footer />

      {/* ----- GLOBAL STYLES (rail-like) ----- */}
      <style jsx global>{`
        :root{
          --bg: #0b0f0e;
          --panel: #0f1413;
          --text: #ecfdf5;
          --text-dim: color-mix(in oklab, var(--text) 70%, black 30%);
          --muted: #8aa39d;
          --line: rgba(89,217,179,.20);
          --cta: #59d9b3;
        }
        html,body{ background: var(--bg); color: var(--text); }
        .section{ padding: 96px 0; position: relative; }
        .container{ max-width: 1120px; margin: 0 auto; padding: 0 20px; }

        .bg-grid{
          background:
            radial-gradient(1200px 600px at 50% -20%, rgba(89,217,179,.10), transparent 70%),
            linear-gradient(90deg,var(--panel) 0%, color-mix(in oklab,var(--panel) 97%, white 3%) 50%, var(--panel) 100%),
            repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,.04) 29px, transparent 30px),
            repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255,255,255,.04) 29px, transparent 30px);
        }

        .btn{
          display:inline-flex; align-items:center; justify-content:center; gap:.6rem;
          height:48px; padding:0 18px; border-radius:10px; font-weight:800;
          color:#fff; background: var(--cta); border:1px solid var(--line);
          box-shadow: 0 10px 30px rgba(89,217,179,.22), 0 1px 0 rgba(255,255,255,.06) inset;
          transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .btn:active{ transform: translateY(1px); }
        .btn.secondary{
          background: #111414; color: #fff; border-color: rgba(255,255,255,.08);
          box-shadow: 0 8px 24px rgba(0,0,0,.45);
        }
        .btn.small{ height:40px; padding:0 14px; border-radius:9px; font-weight:700; }

        h1.big{
          font-weight: 900; letter-spacing: -0.02em; line-height: 1.04;
          font-size: clamp(40px, 6.2vw, 80px);
        }
        h2.section-title{
          font-weight: 900; letter-spacing: -0.02em;
          font-size: clamp(28px, 4.2vw, 54px);
        }
        .lead{ color: var(--text-dim); font-size: clamp(16px, 1.6vw, 18px); }
        .soft-line{ height:1px; background: var(--line); }

        .badge{
          display:inline-grid; place-items:center; height:28px; padding:0 10px; font-size:12px;
          border-radius:999px; color:#0b0f0e; background:#bff2e3; font-weight:900; letter-spacing:.08em;
        }
        .kbd{
          border:1px solid rgba(255,255,255,.2); background:#0d1211; padding:.38rem .6rem; border-radius:10px; font-size:12px;
          color:#dbfff3; font-weight:700;
        }

        .cardish{ border:1px solid var(--line); border-radius:12px;
          background: linear-gradient(180deg, rgba(255,255,255,.02), transparent 60%); }

        .pill-toggle{ display:inline-flex; gap:4px; padding:4px; border-radius:999px; border:1px solid var(--line); background:#0d1211; }
        .pill-toggle > button{
          height:32px; padding:0 12px; border-radius:999px; font-weight:800; color:#cfe9e2; border:1px solid transparent;
          background: transparent;
        }
        .pill-toggle > button[data-active="true"]{
          background: #123229; color:#bff2e3; border-color: var(--line);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 6px 18px rgba(89,217,179,.15);
        }

        header.stickyhead{ position:sticky; top:0; z-index:50; backdrop-filter: blur(8px); }
      `}</style>
    </>
  );
}

/* ------------------------ NAVBAR ------------------------ */
function Navbar(){
  return (
    <header className="bg-grid stickyhead">
      <div className="container h-[70px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div style={{width:36,height:36,borderRadius:10,background:'var(--cta)'}} />
          <strong className="text-lg">ReduxAI</strong>
        </Link>

        <nav className="hidden md:flex items-center gap-10 text-sm" style={{color:'var(--text-dim)'}}>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/signin" className="btn small secondary">Sign in</Link>
        </nav>
      </div>
      <div className="soft-line" />
    </header>
  );
}

/* ------------------------ HERO ------------------------ */
function Hero(){
  return (
    <section className="section bg-grid">
      <div className="container text-center">
        <div className="badge mb-6">Welcome to <b style={{marginLeft:6}}>ReduxAI</b></div>
        <h1 className="big">
          Build <span style={{color:'var(--cta)'}}>AI Voice Agents</span><br/>
          that real businesses use
        </h1>
        <p className="lead mt-5">
          One platform to design, test, and deploy production-grade agents—fast.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/app" className="btn">
            Start building <ArrowRight size={18}/>
          </Link>
          <Link href="/marketplace" className="btn secondary">
            <UsersRound size={18}/> Find clients
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ 4 STEPS ------------------------ */
function Steps(){
  const steps = [
    { n:'1', title:'Prompt Agent', copy:'Create detailed instructions with the AI Prompter in minutes.' },
    { n:'2', title:'Demo Agent', copy:'Share a live demo to collect feedback fast.' },
    { n:'3', title:'Connect Agent', copy:'Add phone, web, SMS or social integrations.' },
    { n:'4', title:'Deploy Agent', copy:'Go live and track conversations in one place.' },
  ];
  return (
    <section id="how" className="section">
      <div className="container">
        <h2 className="section-title text-center">Setup agents in <span style={{color:'var(--cta)'}}>4 steps</span></h2>
        <p className="lead text-center mt-3">From idea to real tasks in under an hour.</p>

        <div className="mt-12 grid md:grid-cols-4 gap-8">
          {steps.map(s => (
            <div key={s.n} className="space-y-3">
              <div className="badge" style={{background:'#15332b', color:'#bff2e3'}}>{s.n}</div>
              <div className="text-xl font-extrabold">{s.title}</div>
              <p style={{color:'var(--text-dim)'}} className="text-[15px]">{s.copy}</p>
              <div className="h-[160px] rounded-xl cardish" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------ PRICING ------------------------ */
function Pricing(){
  const [billing, setBilling] = useState<'month'|'year'>('month');
  const [busy, setBusy] = useState<string>('');

  const tiers = [
    {
      name: 'Starter',
      bullets: ['1 assistant', 'Real-time voice', 'Basic analytics', 'Email support'],
      monthly: { price: 131,  priceId: PRICE.STARTER_MONTH },
      yearly:  { price: 0,    priceId: PRICE.STARTER_YEAR },
    },
    {
      name: 'Pro',
      bullets: ['Up to 5 assistants', 'Advanced analytics', 'Priority routing', 'Priority support'],
      monthly: { price: 209,  priceId: PRICE.PRO_MONTH },
      yearly:  { price: 0,    priceId: PRICE.PRO_YEAR },
      highlight: true,
    },
  ] as const;

  return (
    <section id="pricing" className="section bg-grid">
      <div className="container">
        <h2 className="section-title text-center">Simple plans, <span style={{color:'var(--cta)'}}>free trial</span> included</h2>
        <p className="lead text-center mt-3">We verify your card with a €0 authorization. First charge after the trial unless you cancel.</p>

        <div className="mt-8 flex items-center justify-center">
          <div className="pill-toggle">
            <button data-active={billing==='month'} onClick={()=>setBilling('month')}>Monthly</button>
            <button data-active={billing==='year'}  onClick={()=>setBilling('year')}>
              Annual <span style={{marginLeft:6,color:'var(--cta)'}}>(save ~40%)</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          {tiers.map(t => {
            const plan = billing==='month' ? t.monthly : t.yearly;
            const isBusy = busy === t.name;
            const disabled = !plan.priceId;
            return (
              <div
                key={t.name}
                className="p-6 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,.02), transparent 60%)',
                  border: `1px solid var(--line)`,
                  boxShadow: t.highlight ? '0 30px 120px rgba(89,217,179,.15)' : 'none'
                }}
              >
                {t.highlight && (
                  <div className="badge mb-4" style={{background:'#bff2e3', color:'#0b0f0e'}}>Most Popular</div>
                )}
                <div className="text-2xl font-extrabold">{t.name}</div>
                <div className="mt-2" style={{color:'var(--text-dim)'}}>
                  {t.name==='Starter'
                    ? 'Everything you need to launch a single voice agent.'
                    : 'Scale to multiple assistants and teams.'}
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  {plan.price ? (
                    <>
                      <div className="text-5xl font-black">${plan.price}</div>
                      <div className="text-sm" style={{color:'var(--text-dim)'}}>{billing==='month'?'month':'year'}</div>
                    </>
                  ) : (
                    <div className="text-5xl font-black">—</div>
                  )}
                </div>

                <ul className="mt-6 space-y-2 text-[15px]">
                  {t.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2">
                      <span>✓</span> {b}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={disabled || isBusy}
                  onClick={()=>startCheckout(plan.priceId, (b)=>setBusy(b? t.name : ''))}
                  className="btn w-full mt-8 disabled:opacity-50"
                >
                  <Flashlight size={18}/>
                  {isBusy ? 'Starting checkout…' : (billing==='month' ? 'Start free trial' : 'Subscribe')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------ FAQ ------------------------ */
function FAQ(){
  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title text-center">Frequently asked</h2>
        <div className="mt-10 grid md:grid-cols-2 gap-8">
          <div className="cardish p-6 rounded-xl">
            <div className="font-bold">Do you offer a free trial?</div>
            <p className="mt-2" style={{color:'var(--text-dim)'}}>Yes—card is verified with €0 hold. Cancel any time during the trial.</p>
          </div>
          <div className="cardish p-6 rounded-xl">
            <div className="font-bold">Can I change plans later?</div>
            <p className="mt-2" style={{color:'var(--text-dim)'}}>Upgrades/downgrades are prorated automatically.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ FOOTER ------------------------ */
function Footer(){
  return (
    <footer className="section pt-12">
      <div className="soft-line mb-8" />
      <div className="container text-sm" style={{color:'var(--text-dim)'}}>
        <div className="flex flex-col md:flex-row gap-8 md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} ReduxAI — All rights reserved.</div>
          <div className="flex gap-6">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="mailto:support@reducai.com">support@reducai.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
