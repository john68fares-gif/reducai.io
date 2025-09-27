'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, ShieldCheck, CreditCard, LogIn } from 'lucide-react';

/* ─────────────────────────── Brand tokens (AssistantRail look) ─────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

const R_SM = 6, R_MD = 8, R_LG = 10;

/* ─────────────────────────── Env & clients ─────────────────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/** Payment Links (preferred: no backend mismatch). If provided, we’ll go here. */
const PL = {
  STARTER_MONTH: process.env.NEXT_PUBLIC_PL_STARTER_MONTH || '', // e.g. https://buy.stripe.com/...
  PRO_MONTH:     process.env.NEXT_PUBLIC_PL_PRO_MONTH     || '',
  STARTER_YEAR:  process.env.NEXT_PUBLIC_PL_STARTER_YEAR  || '',
  PRO_YEAR:      process.env.NEXT_PUBLIC_PL_PRO_YEAR      || '',
};

/** Your LIVE price IDs (fallback if you don’t use payment links) */
const PRICE = {
  STARTER_MONTH: 'price_1SByXAHWdU8X80NMftriHWJW',
  PRO_MONTH:     'price_1SByXKHWdU8X80NMAw5IlrTc',
  STARTER_YEAR:  'price_1SByXOHWdU8X80NM4jFrU6Nr',
  PRO_YEAR:      'price_1SByXRHWdU8X80NM7UwuAw0B',
} as const;

/* ─────────────────────────── Page ─────────────────────────── */
type Billing = 'month'|'year';
type TierKey = 'starter'|'pro';

export default function Landing() {
  return (
    <>
      <Header />
      <Hero />
      <Steps />
      <Pricing />
      <FAQ />
      <Footer />

      {/* Global Styles (tokens + Movatif font) */}
      <style jsx global>{`
        @font-face{
          font-family:"Movatif";
          src:url("/fonts/Movatif.woff2") format("woff2");
          font-weight:100 900; font-style:normal; font-display:swap;
        }
        :root{
          --bg:#0b0f0e; --panel:#0f1413; --text:#ecfdf5; --text-dim:color-mix(in oklab, var(--text) 72%, black 28%);
          --line:${GREEN_LINE}; --cta:${CTA}; --brand-weak:#0f2c25;
          --r-sm:${R_SM}px; --r-md:${R_MD}px; --r-lg:${R_LG}px;
        }
        html,body{background:var(--bg);color:var(--text);font-family:"Movatif",ui-sans-serif,system-ui;}
        a{text-decoration:none;color:inherit}
        .container{max-width:1120px;margin:0 auto;padding:0 20px}
        .section{padding:96px 0;position:relative}
        .bg-rail{
          background:
            radial-gradient(1200px 680px at 50% -20%, rgba(89,217,179,.10), transparent 70%),
            linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%),
            repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,.04) 29px, transparent 30px),
            repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255,255,255,.04) 29px, transparent 30px);
        }
        .btn{
          display:inline-flex;align-items:center;justify-content:center;gap:.6rem;
          height:48px;padding:0 18px;border-radius:var(--r-md);font-weight:900;
          color:#0b0f0e;background:var(--cta);border:1px solid var(--line);
          box-shadow:0 12px 40px rgba(89,217,179,.22), inset 0 1px 0 rgba(255,255,255,.06);
          transition:transform .15s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .btn:active{transform:translateY(1px)}
        .btn.secondary{background:#121615;color:#fff;border-color:rgba(255,255,255,.08);box-shadow:0 10px 28px rgba(0,0,0,.45)}
        .btn.small{height:40px;padding:0 14px;border-radius:9px}
        .btn.block{width:100%}
        .cardish{border:1px solid var(--line);border-radius:var(--r-lg);background:linear-gradient(180deg, rgba(255,255,255,.02), transparent 60%);}
        .badge{display:inline-grid;place-items:center;height:28px;padding:0 10px;font-size:12px;border-radius:999px;color:#0b0f0e;background:#bff2e3;font-weight:900;letter-spacing:.08em;}
        h1.big{font-weight:900;letter-spacing:-.02em;line-height:1.04;font-size:clamp(40px,6.2vw,78px)}
        h2.title{font-weight:900;letter-spacing:-.02em;line-height:1.06;font-size:clamp(28px,4.4vw,54px)}
        .lead{color:var(--text-dim);font-size:clamp(16px,1.6vw,18px)}
        .softline{height:1px;background:var(--line)}
      `}</style>
    </>
  );
}

/* ───────────────── Header ───────────────── */
function Header(){
  return (
    <header className="bg-rail" style={{position:'sticky', top:0, zIndex:50, backdropFilter:'blur(8px)'}}>
      <div className="container h-[68px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <div style={{width:34,height:34,borderRadius:10,background:CTA}} />
          <strong className="text-[18px]">ReduxAI</strong>
        </a>
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

/* ───────────────── Hero ───────────────── */
function Hero(){
  return (
    <section className="section bg-rail">
      <div className="container text-center">
        <div className="badge mb-6">Welcome to <b style={{marginLeft:6}}>ReduxAI</b></div>
        <h1 className="big">
          Build <span style={{color:CTA}}>AI Voice Agents</span><br/> businesses keep
        </h1>
        <p className="lead mt-5">Clean prompts, rail-style UI, production deploys.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a href="#pricing" className="btn">Get started <ArrowRight size={18}/></a>
          <a href="#how" className="btn secondary">See the flow</a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── Steps (4) ───────────────── */
function Steps(){
  const steps = [
    { n:'1', t:'Prompt Agent', d:'Write clear, testable instructions.' },
    { n:'2', t:'Demo Agent', d:'Share a live preview link.' },
    { n:'3', t:'Connect Agent', d:'Widget, phone, SMS, socials.' },
    { n:'4', t:'Deploy Agent', d:'Go live + track conversations.' },
  ];
  return (
    <section id="how" className="section">
      <div className="container">
        <h2 className="title text-center">Setup agents in <span style={{color:CTA}}>4 steps</span></h2>
        <p className="lead text-center mt-3">Same spacing/shadows as AssistantRail.</p>
        <div className="mt-12 grid md:grid-cols-4 gap-8">
          {steps.map(s=>(
            <div key={s.n} className="space-y-3">
              <div className="badge" style={{background:'#15332b',color:'#bff2e3'}}>{s.n}</div>
              <div className="text-xl font-extrabold">{s.t}</div>
              <p className="text-[15px]" style={{color:'var(--text-dim)'}}>{s.d}</p>
              <div className="h-[160px] rounded-xl cardish" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────── Pricing with Google overlay → Stripe ───────────────── */
function Pricing(){
  const [billing, setBilling] = useState<Billing>('month');
  const [busy, setBusy]       = useState<TierKey|''>('');
  const [overlay, setOverlay] = useState<{open:boolean; tier?:TierKey; priceId?:string; link?:string}>({open:false});
  const [email, setEmail]     = useState<string|undefined>(undefined);

  useEffect(()=>{ supabase.auth.getUser().then(({data})=> setEmail(data.user?.email)); },[]);

  const tiers = useMemo(()=>([
    {
      key:'starter' as const,
      title:'Starter',
      desc:'Everything you need to launch a single voice agent.',
      bullets:['1 assistant','Real-time voice','Basic analytics','Email support'],
      month:{ price:19.29, priceId:PRICE.STARTER_MONTH, link:PL.STARTER_MONTH },
      year: { price:131,   priceId:PRICE.STARTER_YEAR,  link:PL.STARTER_YEAR  },
    },
    {
      key:'pro' as const,
      title:'Pro',
      desc:'Scale to multiple assistants and teams.',
      bullets:['Up to 5 assistants','Advanced analytics','Priority routing','Priority support'],
      month:{ price:19.29, priceId:PRICE.PRO_MONTH,     link:PL.PRO_MONTH     }, // change if you want a higher Pro monthly
      year: { price:209,   priceId:PRICE.PRO_YEAR,      link:PL.PRO_YEAR      },
      highlight:true
    },
  ]),[]);

  function wantCheckout(tier: TierKey){
    const plan = tiers.find(t=>t.key===tier)!;
    const p = billing==='month'? plan.month : plan.year;
    if(!email){ setOverlay({open:true, tier, priceId:p.priceId, link:p.link}); return; }
    goStripe(tier, p.priceId, p.link);
  }

  async function goStripe(tier: TierKey, priceId?: string, link?: string){
    try{
      setBusy(tier);
      if(link){ window.location.href = link; return; }
      // Fallback: create checkout via your server route
      const res = await fetch('/api/stripe/checkout', {
        method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ priceId })
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json?.detail || json?.error || 'Failed to create session');
      const { loadStripe } = await import('@stripe/stripe-js');
      const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if(!pk || !pk.startsWith('pk_live_')) throw new Error('Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (live)');
      const stripe = await loadStripe(pk);
      const { error } = await stripe!.redirectToCheckout({ sessionId: json.id });
      if (error) throw error;
    }catch(e:any){
      console.error(e); alert(`Could not start checkout. Check Stripe keys + Price IDs (open console).\n\n${e?.message||e}`);
    }finally{ setBusy(''); }
  }

  async function signInGoogleThenStripe(){
    try{
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider:'google', options:{ redirectTo: window.location.href, skipBrowserRedirect:true }
      });
      if(error) throw error;

      // Poll for session quickly
      const t0 = Date.now();
      const poll = async ():Promise<boolean> => {
        const { data: u } = await supabase.auth.getUser();
        if(u.user?.email){ setEmail(u.user.email); return true; }
        if(Date.now()-t0>20000) return false;
        await new Promise(r=>setTimeout(r,600));
        return poll();
      };
      const ok = await poll();
      if(!ok) throw new Error('Google sign-in timed out');

      if(overlay.tier) await goStripe(overlay.tier, overlay.priceId, overlay.link);
      setOverlay({open:false});
    }catch(e:any){
      console.error(e); alert(`Google sign-in failed: ${e?.message||e}`);
    }
  }

  return (
    <section id="pricing" className="section bg-rail">
      <div className="container">
        <h2 className="title text-center">Simple plans, <span style={{color:CTA}}>free trial</span> included</h2>
        <p className="lead text-center mt-3">Card is verified with a €0 authorization.</p>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="badge" style={{background:'#123229',color:'#bff2e3'}}>Billing</div>
          <div className="flex gap-2">
            <button onClick={()=>setBilling('month')} className="btn small secondary" style={{background: billing==='month'? CTA : '#121615', color: billing==='month' ? '#0b0f0e' : '#fff'}}>Monthly</button>
            <button onClick={()=>setBilling('year')}  className="btn small secondary" style={{background: billing==='year' ? CTA : '#121615', color: billing==='year'  ? '#0b0f0e' : '#fff'}}>Annual</button>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          {tiers.map(t=>{
            const p = billing==='month' ? t.month : t.year;
            const b = busy===t.key;
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
                  {t.bullets.map(bi=>(<li key={bi}>✓ {bi}</li>))}
                </ul>

                <button
                  className="btn block mt-8 disabled:opacity-50"
                  disabled={b}
                  onClick={()=>wantCheckout(t.key)}
                >
                  {b ? (<><Loader2 className="animate-spin" size={18}/> Starting checkout…</>) : (<><CreditCard size={18}/> Start free trial</>)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* AssistantRail-style Overlay */}
      <AnimatePresence>
        {overlay.open && (
          <ModalShell>
            <ModalHeader icon={<ShieldCheck className="w-5 h-5" />} title="Sign in to continue" subtitle="Use Google — we’ll launch Stripe right after." />
            <div className="px-6 py-6">
              <button className="btn block" onClick={signInGoogleThenStripe}>
                <LogIn size={18}/> Continue with Google
              </button>
              <p className="text-xs mt-3 text-center" style={{color:'var(--text-dim)'}}>You’ll be redirected back here, then to Stripe.</p>
            </div>
            <div className="px-6 pb-6">
              <button className="btn block secondary" onClick={()=>setOverlay({open:false})}>Cancel</button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ───────────────── FAQ ───────────────── */
function FAQ(){
  return (
    <section id="faq" className="section">
      <div className="container">
        <h2 className="title text-center">Frequently asked</h2>
        <div className="mt-10 grid md:grid-cols-2 gap-8">
          <div className="p-6 cardish">
            <div className="font-bold">Do you offer a free trial?</div>
            <p className="mt-2" style={{color:'var(--text-dim)'}}>Yes—first charge after trial unless you cancel.</p>
          </div>
          <div className="p-6 cardish">
            <div className="font-bold">Can I switch plans later?</div>
            <p className="mt-2" style={{color:'var(--text-dim)'}}>Upgrades/downgrades are prorated automatically.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── Footer ───────────────── */
function Footer(){
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

/* ───────────────── AssistantRail-style Modal primitives ───────────────── */
function ModalShell({ children }:{ children:React.ReactNode }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0" style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }} />
      <div className="relative w-full h-full grid place-items-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: .18, ease: 'easeOut' }}
          className="w-full max-w-[560px] overflow-hidden"
          style={{ background:'var(--panel)', color:'var(--text)', border:`1px solid ${GREEN_LINE}`, borderRadius:R_MD, boxShadow:'0 18px 48px rgba(0,0,0,.30)' }}
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
}
function ModalHeader({ icon, title, subtitle }:{
  icon:React.ReactNode; title:string; subtitle?:string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:`1px solid ${GREEN_LINE}`,
      background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`}}>
      <div className="flex items-center gap-3">
        <div className="grid place-items-center" style={{ width: 40, height: 40, borderRadius: R_LG, background:'var(--brand-weak)' }}>
          <span style={{ color: CTA, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold">{title}</div>
          {subtitle && <div className="text-xs" style={{ color:'var(--text-dim)' }}>{subtitle}</div>}
        </div>
      </div>
      <span style={{ width:20, height:20 }} />
    </div>
  );
}
