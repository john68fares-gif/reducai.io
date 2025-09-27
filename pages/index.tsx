'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, LogIn, ShieldCheck, Loader2, CreditCard } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   ENV (client-safe)
   Set these in `.env`:
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   Optional Payment Links (preferred for zero backend errors):
   NEXT_PUBLIC_PL_STARTER_MONTH=https://buy.stripe.com/...
   NEXT_PUBLIC_PL_PRO_MONTH=https://buy.stripe.com/...
   NEXT_PUBLIC_PL_STARTER_YEAR=https://buy.stripe.com/...
   NEXT_PUBLIC_PL_PRO_YEAR=https://buy.stripe.com/...
   ────────────────────────────────────────────────────────────── */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/** Your LIVE price IDs (you provided these) */
const PRICE = {
  STARTER_MONTH: 'price_1SByXAHWdU8X80NMftriHWJW',
  PRO_MONTH:     'price_1SByXKHWdU8X80NMAw5IlrTc',
  STARTER_YEAR:  'price_1SByXOHWdU8X80NM4jFrU6Nr',
  PRO_YEAR:      'price_1SByXRHWdU8X80NM7UwuAw0B',
} as const;

/** Optional payment-link URLs (if present we’ll prefer them) */
const PL = {
  STARTER_MONTH: process.env.NEXT_PUBLIC_PL_STARTER_MONTH || '',
  PRO_MONTH:     process.env.NEXT_PUBLIC_PL_PRO_MONTH || '',
  STARTER_YEAR:  process.env.NEXT_PUBLIC_PL_STARTER_YEAR || '',
  PRO_YEAR:      process.env.NEXT_PUBLIC_PL_PRO_YEAR || '',
};

type Billing = 'month'|'year';
type TierKey = 'starter'|'pro';

export default function Page() {
  return (
    <>
      <SiteHeader />
      <Hero />
      <Steps />
      <Pricing />
      <FAQ />
      <SiteFooter />

      {/* —— Global styles (AssistantRail look) —— */}
      <style jsx global>{`
        /* Font: Movatif — put your file at /public/fonts/Movatif.woff2 */
        @font-face{
          font-family: "Movatif";
          src: url("/fonts/Movatif.woff2") format("woff2");
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }

        :root{
          --bg: #0b0f0e;
          --panel: #0f1413;
          --text: #ecfdf5;
          --text-dim: color-mix(in oklab, var(--text) 72%, black 28%);
          --muted: #8aa39d;
          --line: rgba(89,217,179,.20);
          --cta: #59d9b3;
          --brand-weak: #0f2c25;
          --radius-sm: 8px; --radius-md: 10px; --radius-lg: 14px;
        }

        html, body { background: var(--bg); color: var(--text); font-family: "Movatif", ui-sans-serif, system-ui; }
        .container { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
        .section { padding: 96px 0; position: relative; }

        /* rail-like gradient + faint grid */
        .bg-rail {
          background:
            radial-gradient(1300px 700px at 50% -20%, rgba(89,217,179,.10), transparent 70%),
            linear-gradient(90deg,var(--panel) 0%, color-mix(in oklab,var(--panel) 97%, white 3%) 50%, var(--panel) 100%),
            repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,.04) 29px, transparent 30px),
            repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255,255,255,.04) 29px, transparent 30px);
        }

        .softline{ height:1px; background: var(--line); }

        .btn {
          display:inline-flex; align-items:center; justify-content:center; gap:.6rem;
          height:48px; padding:0 18px; border-radius: var(--radius-md); font-weight: 800;
          color:#0b0f0e; background: var(--cta); border:1px solid var(--line);
          box-shadow: 0 12px 40px rgba(89,217,179,.22), 0 1px 0 rgba(255,255,255,.06) inset;
          transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .btn:active{ transform: translateY(1px); }
        .btn.secondary {
          background: #121615; color: #fff; border-color: rgba(255,255,255,.08);
          box-shadow: 0 10px 28px rgba(0,0,0,.45);
        }
        .btn.block { width: 100%; }
        .btn.small { height:40px; padding:0 14px; border-radius: 9px; }

        .cardish {
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          background: linear-gradient(180deg, rgba(255,255,255,.02), transparent 60%);
        }

        h1.big {
          font-weight: 900; letter-spacing: -0.02em; line-height: 1.04;
          font-size: clamp(40px, 6.2vw, 78px);
        }
        h2.title {
          font-weight: 900; letter-spacing: -0.02em; line-height: 1.06;
          font-size: clamp(28px, 4.4vw, 54px);
        }
        .lead { color: var(--text-dim); font-size: clamp(16px, 1.6vw, 18px); }
        .badge {
          display:inline-grid; place-items:center; height:28px; padding:0 10px; font-size:12px;
          border-radius:999px; color:#0b0f0e; background:#bff2e3; font-weight:900; letter-spacing:.08em;
        }

        header.sticky { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(8px); }
        a { text-decoration: none; }
      `}</style>
    </>
  );
}

/* ───────────────────────── NAVBAR ───────────────────────── */
function SiteHeader(){
  return (
    <header className="bg-rail sticky">
      <div className="container h-[68px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div style={{width:34,height:34,borderRadius:10,background:'var(--cta)'}} />
          <strong className="text-[18px]">ReduxAI</strong>
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-sm" style={{color:'var(--text-dim)'}}>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <a href="#pricing" className="btn small secondary">Sign in</a>
        </nav>
      </div>
      <div className="softline" />
    </header>
  );
}

/* ───────────────────────── HERO ───────────────────────── */
function Hero(){
  return (
    <section className="section bg-rail">
      <div className="container text-center">
        <div className="badge mb-6">Welcome to <b style={{marginLeft:6}}>ReduxAI</b></div>
        <h1 className="big">
          Build <span style={{color:'var(--cta)'}}>AI Voice Agents</span>
          <br/> that businesses keep
        </h1>
        <p className="lead mt-5">
          Design, test, and deploy production-grade voice agents—fast.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <a href="#pricing" className="btn">
            Get started <ArrowRight size={18}/>
          </a>
          <a href="#how" className="btn secondary">
            See the flow
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 4 STEPS ───────────────────────── */
function Steps(){
  const steps = [
    { n: '1', title: 'Prompt Agent', copy: 'Write clean, testable instructions.' },
    { n: '2', title: 'Demo Agent', copy: 'Share a live preview link for feedback.' },
    { n: '3', title: 'Connect Agent', copy: 'Phone, web widget, SMS, socials.' },
    { n: '4', title: 'Deploy Agent', copy: 'Go live and track conversations.' },
  ];
  return (
    <section id="how" className="section">
      <div className="container">
        <h2 className="title text-center">Setup agents in <span style={{color:'var(--cta)'}}>4 steps</span></h2>
        <p className="lead text-center mt-3">Simple building blocks. Zero fiddly setup.</p>

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

/* ───────────────────────── PRICING (with sign-in overlay) ───────────────────────── */
function Pricing(){
  const [billing, setBilling] = useState<Billing>('month');
  const [overlay, setOverlay] = useState<{open:boolean; tier?:TierKey; priceId?:string; link?:string}>({open:false});
  const [busyTier, setBusyTier] = useState<TierKey|''>('');
  const [userEmail, setUserEmail] = useState<string|undefined>(undefined);

  // pricing labels you asked for
  const tiers = useMemo(()=>([
    {
      key: 'starter' as const,
      title: 'Starter',
      desc: 'Everything you need to launch a single voice agent.',
      bullets: ['1 assistant','Real-time voice','Basic analytics','Email support'],
      month: { price: 19.29, priceId: PRICE.STARTER_MONTH, link: PL.STARTER_MONTH },
      year:  { price: 131,   priceId: PRICE.STARTER_YEAR,  link: PL.STARTER_YEAR  },
    },
    {
      key: 'pro' as const,
      title: 'Pro',
      desc: 'Scale to multiple assistants and teams.',
      bullets: ['Up to 5 assistants','Advanced analytics','Priority routing','Priority support'],
      month: { price: 19.29, priceId: PRICE.PRO_MONTH,     link: PL.PRO_MONTH     }, // if you want a higher Pro monthly, change here
      year:  { price: 209,   priceId: PRICE.PRO_YEAR,      link: PL.PRO_YEAR      },
      highlight: true,
    },
  ]),[]);

  // get current user quickly (client-side)
  React.useEffect(()=>{ supabase.auth.getUser().then(({data})=> setUserEmail(data.user?.email)); },[]);

  function openCheckout(tier: TierKey){
    const plan = tiers.find(t=>t.key===tier)!;
    const p = billing==='month' ? plan.month : plan.year;

    // If no auth yet, show overlay to Sign-in with Google
    if(!userEmail){
      setOverlay({ open:true, tier, priceId: p.priceId, link: p.link });
      return;
    }

    // Already signed in → jump to Stripe
    goToStripe(tier, p.priceId, p.link);
  }

  async function goToStripe(tier: TierKey, priceId?: string, link?: string){
    try{
      setBusyTier(tier);
      // prefer payment link if provided
      if (link) {
        window.location.href = link;
        return;
      }

      // fallback: create a Checkout Session
      const res = await fetch('/api/stripe/checkout', {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json?.detail || json?.error || 'Failed to create session');

      const { loadStripe } = await import('@stripe/stripe-js');
      const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if(!pk || !pk.startsWith('pk_live_')) throw new Error('Missing or wrong NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (needs pk_live_)');

      const stripe = await loadStripe(pk);
      const { error } = await stripe!.redirectToCheckout({ sessionId: json.id });
      if (error) throw error;
    } catch(e:any){
      console.error(e);
      alert(`Could not start checkout. Check Stripe keys + Price IDs (open console).\n\n${e?.message||e}`);
    } finally{
      setBusyTier('');
    }
  }

  async function signInGoogleThenStripe(){
    try{
      // Google OAuth popup
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href, skipBrowserRedirect:true }
      });
      if (error) throw error;
      // Supabase opens a new window; once the popup finishes the session is stored.
      // Poll for session quickly:
      const t0 = Date.now();
      const poll = async ()=>{
        const { data: u } = await supabase.auth.getUser();
        if(u.user?.email){ setUserEmail(u.user.email); return true; }
        if(Date.now()-t0 > 20000) return false;
        await new Promise(r=>setTimeout(r, 600));
        return poll();
      };
      const ok = await poll();
      if(!ok) throw new Error('Google sign-in timed out');

      // Continue to Stripe
      if(overlay.tier) await goToStripe(overlay.tier, overlay.priceId, overlay.link);
      setOverlay({open:false});
    }catch(e:any){
      console.error(e);
      alert(`Google sign-in failed: ${e?.message||e}`);
    }
  }

  return (
    <section id="pricing" className="section bg-rail">
      <div className="container">
        <h2 className="title text-center">Simple plans, <span style={{color:'var(--cta)'}}>free trial</span> included</h2>
        <p className="lead text-center mt-3">We verify your card with a €0 authorization. First charge after the trial unless you cancel.</p>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="badge" style={{background:'#123229', color:'#bff2e3'}}>Billing</div>
          <div className="flex gap-2">
            <button onClick={()=>setBilling('month')} className="btn small secondary" style={{background: billing==='month' ? 'var(--cta)' : '#121615', color: billing==='month' ? '#0b0f0e' : '#fff'}}>Monthly</button>
            <button onClick={()=>setBilling('year')}  className="btn small secondary" style={{background: billing==='year' ? 'var(--cta)' : '#121615',  color: billing==='year' ? '#0b0f0e' : '#fff'}}>Annual</button>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          {tiers.map(t=>{
            const p = billing==='month' ? t.month : t.year;
            const busy = busyTier === t.key;
            return (
              <div key={t.key} className="p-6 cardish">
                {t.highlight && <div className="badge mb-4">Most Popular</div>}
                <div className="text-2xl font-extrabold">{t.title}</div>
                <div className="mt-1" style={{color:'var(--text-dim)'}}>{t.desc}</div>

                <div className="mt-6 flex items-baseline gap-2">
                  <div className="text-5xl font-black">${p.price}</div>
                  <div className="text-sm" style={{color:'var(--text-dim)'}}>{billing==='month'?'month':'year'}</div>
                </div>

                <ul className="mt-6 space-y-2 text-[15px]">
                  {t.bullets.map(b=>(<li key={b} className="flex items-center gap-2">✓ {b}</li>))}
                </ul>

                <button
                  className="btn block mt-8 disabled:opacity-50"
                  disabled={busy}
                  onClick={()=>openCheckout(t.key)}
                >
                  {busy ? (<><Loader2 className="animate-spin" size={18}/> Starting checkout…</>) : (<><CreditCard size={18}/> Start free trial</>)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sign-in overlay */}
      {overlay.open && (
        <div className="fixed inset-0 z-[1000]" style={{background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)'}}>
          <div className="w-full h-full grid place-items-center p-4">
            <div className="w-full max-w-[520px] overflow-hidden cardish" style={{borderRadius:12}}>
              <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--line)'}}>
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center" style={{width:40,height:40,borderRadius:12, background:'var(--brand-weak)'}}>
                    <ShieldCheck style={{color:'var(--cta)'}} size={18}/>
                  </div>
                  <div>
                    <div className="font-extrabold">Sign in to continue</div>
                    <div className="text-xs" style={{color:'var(--text-dim)'}}>Use Google — then we’ll launch Stripe.</div>
                  </div>
                </div>
                <button className="btn small secondary" onClick={()=>setOverlay({open:false})}>Close</button>
              </div>

              <div className="px-6 py-6">
                <button className="btn block" onClick={signInGoogleThenStripe}>
                  <LogIn size={18}/> Continue with Google
                </button>
                <p className="text-xs mt-3 text-center" style={{color:'var(--text-dim)'}}>
                  You’ll be redirected back here and then to Stripe.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */
function FAQ(){
  return (
    <section id="faq" className="section">
      <div className="container">
        <h2 className="title text-center">Frequently asked</h2>
        <div className="mt-10 grid md:grid-cols-2 gap-8">
          <div className="p-6 cardish">
            <div className="font-bold">Do you offer a free trial?</div>
            <p className="mt-2" style={{color:'var(--text-dim)'}}>Yes—card is verified with €0 hold. Cancel any time during the trial.</p>
          </div>
          <div className="p-6 cardish">
            <div className="font-bold">Can I change plans later?</div>
            <p className="mt-2" style={{color:'var(--text-dim)'}}>Upgrades/downgrades are prorated automatically.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FOOTER ───────────────────────── */
function SiteFooter(){
  return (
    <footer className="section pt-12">
      <div className="softline mb-8" />
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
