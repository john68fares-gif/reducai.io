// pages/index.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, ArrowRight, Star, Sparkles, LogIn, Loader2,
  Shield, Bot, Plug, Rocket, Quote, Zap
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/lib/supabase-client';

/* =====================  CONFIG  ===================== */
// IMPORTANT: Map your 4 Stripe prices here.
// If a button says "pattern mismatch", you pasted a Payment Link or Product ID.
// These MUST be "price_..." strings EXACTLY.

const PRICE_IDS = {
  monthly: {
    starter: 'price_1SByXAHWdU8X80NMftriHWJW', // $19.29/mo (Starter)
    pro:     'price_1SByXKHWdU8X80NMAw5IlrTc', // $19.75/mo (Pro)
  },
  yearly: {
    starter: 'price_1SByXOHWdU8X80NM4jFrU6Nr', // $131/yr (Starter)
    pro:     'price_1SByXRHWdU8X80NM7UwuAw0B', // $209/yr (Pro)
  }
};

// Stripe publishable key in .env.local -> NEXT_PUBLIC_STRIPE_PK=pk_live_xxx / pk_test_xxx
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK || '');

/* =====================  TOKENS  ===================== */
const Tokens = () => (
  <style jsx global>{`
    :root{
      --bg:#0b0c10;
      --panel:#0e1113;
      --card:#0f1316;
      --text:#e6f1ef;
      --muted:#9fb4ad;
      --brand:#59d9b3;
      --brand-weak:rgba(89,217,179,.18);
      --line:rgba(89,217,179,.20);
      --border:rgba(255,255,255,.08);
      --shadow:0 20px 50px rgba(0,0,0,.35);
      --radius:14px;
    }
    html,body{ background:var(--bg); color:var(--text); }
    /* Font (MovaTiff): place /public/fonts/MovaTiff.woff2 */
    @font-face{
      font-family:'MovaTiff';
      src:url('/fonts/MovaTiff.woff2') format('woff2');
      font-weight: 400 800;
      font-style: normal;
      font-display: swap;
    }
    body{ font-family: MovaTiff, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; }
    .container{ width:100%; max-width:1160px; margin:0 auto; padding:0 20px; }
    .chip{ display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:999px; border:1px solid var(--line); background:color-mix(in oklab, var(--brand) 10%, var(--panel)); }
    .btn{
      display:inline-flex; align-items:center; justify-content:center; gap:10px;
      height:46px; padding:0 18px; border-radius:999px; border:1px solid var(--line);
      background: var(--brand); color:#0b0f0e; /* dark text for brand chip */
      transition: transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease;
      box-shadow: 0 8px 28px rgba(89,217,179,.18), inset 0 0 0 1px rgba(255,255,255,.06);
    }
    .btn.white{ background:#fff; color:#0b0f0e; }
    .btn.green{ background: var(--brand); color: #0b0f0e; }
    .btn.ghost{ background: transparent; color: var(--text); border-color: var(--line); }
    .btn:hover{ transform: translateY(-1px); box-shadow: 0 14px 40px rgba(89,217,179,.28), inset 0 0 0 1px rgba(255,255,255,.08); }
    .btn.block{ width:100%; }
    .btn.inverse{ background: #1a1f21; color:#fff; border-color: var(--line); }
    .btn.primary-solid{ background: var(--brand); color:#fff; } /* white text variant for green buttons */
    /* Cards */
    .card{
      background: radial-gradient(100% 140% at 100% 0%, rgba(89,217,179,.08), transparent 50%), var(--card);
      border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .pricing-card{ position:relative; overflow:hidden; }
    .pricing-card:before{
      content:'';
      position:absolute; inset:-1px;
      background: radial-gradient(120% 60% at 0% 0%, rgba(89,217,179,.20), transparent 60%);
      border-radius: inherit; opacity:.25; pointer-events:none;
    }
    .hero-grid{
      background:
        radial-gradient(500px 260px at 50% 10%, rgba(89,217,179,.12), transparent 60%),
        repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 40px),
        repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 40px),
        #0b0c10;
    }
    a.navlink{ color: var(--text); opacity:.82; transition: opacity .18s ease, transform .18s ease; }
    a.navlink:hover{ opacity:1; transform: translateY(-1px); }
  `}</style>
);

/* =====================  UTIL  ===================== */
const ease = { duration: .22, ease: 'easeOut' };

function SectionTitle({ kicker, title, accent }: { kicker?: string; title: string; accent?: string }) {
  const [a,b] = useMemo(()=>{
    if(!accent) return [title,null];
    const idx = title.indexOf(accent);
    if(idx<0) return [title,null];
    return [title.slice(0,idx), title.slice(idx)];
  },[title,accent]);
  return (
    <div className="text-center mb-8">
      {kicker ? (
        <div className="chip mx-auto mb-4" style={{ color:'#cdeee6', borderColor:'var(--line)' }}>{kicker}</div>
      ) : null}
      <h2 style={{ fontSize: '48px', lineHeight: 1.05, letterSpacing: '-.02em', fontWeight: 800 }}>
        {a}{b ? <span style={{ color: 'var(--brand)' }}>{b}</span> : null}
      </h2>
    </div>
  );
}

/* =====================  MODALS  ===================== */
function Modal({ open, onClose, children }:{ open:boolean; onClose:()=>void; children:React.ReactNode }){
  if (typeof document === 'undefined' || !open) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1000]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
      />
      <motion.div
        className="fixed inset-0 z-[1001] flex items-center justify-center px-4"
        initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }}
        transition={ease}
      >
        <div className="card w-full max-w-[520px] overflow-hidden" onClick={(e)=>e.stopPropagation()}>
          {children}
        </div>
      </motion.div>
    </AnimatePresence>, document.body
  );
}

function AuthGate({
  open, onClose, onAuthed
}:{ open:boolean; onClose:()=>void; onAuthed:(uid:string)=>void }){
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState('');
  const signIn = async ()=>{
    try{
      setBusy(true); setErr('');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider:'google',
        options:{ redirectTo: `${window.location.origin}/auth/callback` }
      });
      if (error) throw error;
      // We won't reach here on redirect, but keep for popup fallback.
      const uid = data?.user?.id || '';
      if(uid) onAuthed(uid);
    }catch(e:any){
      setErr(e?.message || 'Google sign-in failed');
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={busy?()=>{}:onClose}>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <LogIn className="w-5 h-5" style={{ color:'var(--brand)' }} />
          <div className="text-lg font-semibold">Sign in to continue</div>
        </div>
        <div className="text-sm mb-4" style={{ color:'var(--muted)' }}>
          Use Google to create your account. We’ll start checkout right after.
        </div>
        <button disabled={busy} onClick={signIn} className="btn primary-solid block">
          {busy ? (<><Loader2 className="w-4 h-4 animate-spin"/><span>Connecting…</span></>) : (<><LogIn className="w-4 h-4"/><span>Continue with Google</span></>)}
        </button>
        {err ? <div className="mt-3 text-sm" style={{ color:'salmon' }}>{err}</div> : null}
      </div>
    </Modal>
  );
}

/* =====================  MAIN PAGE  ===================== */
export default function Home(){
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [period, setPeriod] = useState<'monthly'|'yearly'>('monthly');
  const [busyPrice, setBusyPrice] = useState<string>('');
  const [stripeErr, setStripeErr] = useState('');

  /* boot auth (if already signed) */
  useEffect(()=>{ (async()=>{
    setChecking(true);
    const { data:{ session } } = await supabase.auth.getSession();
    setAuthed(Boolean(session?.user?.id));
    setChecking(false);
  })(); },[]);

  const startCheckout = async (tier:'starter'|'pro')=>{
    setStripeErr('');
    const price = PRICE_IDS[period][tier];
    if (!price || !/^price_[a-zA-Z0-9]+$/.test(price)) {
      setStripeErr('Could not start checkout. Check Stripe keys + Price IDs (open console).');
      console.error('Bad Stripe price ID', price);
      return;
    }
    // Require auth → if not authed, open Google modal
    if (!authed) { setAuthOpen(true); return; }

    const stripe = await stripePromise;
    if(!stripe){ setStripeErr('Stripe not initialised (check NEXT_PUBLIC_STRIPE_PK).'); return; }

    try{
      setBusyPrice(`${period}:${tier}`);
      const { error } = await stripe.redirectToCheckout({
        mode: 'subscription',
        lineItems: [{ price, quantity: 1 }],
        successUrl: `${window.location.origin}/account?upgraded=1`,
        cancelUrl: `${window.location.origin}/#pricing`,
      });
      if (error) throw error;
    }catch(e:any){
      console.error(e);
      setStripeErr(e?.message || 'Stripe checkout failed.');
    }finally{
      setBusyPrice('');
    }
  };

  const onAuthed = ()=>{ setAuthed(true); setAuthOpen(false); /* re-trigger click by user again */ };

  return (
    <>
      <Head>
        <title>ReduxAI — Build voice agents</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>
      <Tokens />

      {/* NAV */}
      <header style={{ position:'sticky', top:0, zIndex:50, backdropFilter:'blur(8px)' }}>
        <div className="container" style={{ padding:'14px 20px' }}>
          <div className="flex items-center justify-between">
            <a href="#" className="flex items-center gap-3">
              <div className="inline-grid place-items-center w-9 h-9 rounded-full" style={{ background:'rgba(89,217,179,.18)', border:'1px solid var(--line)' }}>
                <Bot className="w-5 h-5" style={{ color:'var(--brand)' }} />
              </div>
              <div className="text-[18px] font-semibold">ReduxAI</div>
            </a>
            <nav className="hidden md:flex items-center gap-8">
              <a className="navlink" href="#integrations">Integrations</a>
              <a className="navlink" href="#how">How it works</a>
              <a className="navlink" href="#pricing">Pricing</a>
            </nav>
            <div className="flex items-center gap-3">
              <a href="#pricing" className="btn primary-solid" style={{ height:40 }}>
                <Sparkles className="w-4 h-4"/><span>Sign in</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero-grid">
        <div className="container" style={{ padding:'80px 20px 60px' }}>
          <div className="text-center">
            <h1 style={{ fontSize:'74px', lineHeight:1.02, letterSpacing:'-.02em', fontWeight:800 }}>
              Build <span style={{ color:'var(--brand)' }}>AI Agents</span><br/>
              and <span style={{ color:'var(--brand)' }}>find businesses</span> that need them
            </h1>
            <p className="mt-5" style={{ color:'var(--muted)' }}>
              An AI Agent Platform, built to perform real-world tasks
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <a href="#pricing" className="btn primary-solid"><Zap className="w-4 h-4"/><span>Start building</span><ArrowRight className="w-4 h-4"/></a>
              <a href="#how" className="btn inverse">How it works</a>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (4 steps) */}
      <section id="how" className="container" style={{ padding:'80px 20px' }}>
        <SectionTitle kicker="Platform Features" title="Setup agents in 4 steps" accent="4 steps" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2"><span className="chip">1</span><b>Prompt Agent</b></div>
            <p style={{ color:'var(--muted)' }}>Create detailed instructions with the AI Prompter in minutes.</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2"><span className="chip">2</span><b>Demo Agent</b></div>
            <p style={{ color:'var(--muted)' }}>Share your Agent with clients and teammates in a demo.</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2"><span className="chip">3</span><b>Connect Agent</b></div>
            <p style={{ color:'var(--muted)' }}>Add integrations (web widget, DMs, Messenger, SMS) in one place.</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2"><span className="chip">4</span><b>Deploy Agent</b></div>
            <p style={{ color:'var(--muted)' }}>Deploy to the real world and track conversations from a single hub.</p>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="container" style={{ padding:'20px 20px 60px' }}>
        <SectionTitle kicker="Reviews" title="Hear From Our Users" accent="Users" />
        <div className="grid md:grid-cols-3 gap-6">
          {[`"Low cost, easy to use!"`,`"10/10 would recommend — solid software."`,`"Signed up immediately; excited to see what's next!"`].map((t,i)=>(
            <div key={i} className="card p-6">
              <Quote className="w-5 h-5 mb-3" style={{ color:'var(--brand)' }}/>
              <div style={{ color:'var(--muted)' }}>{t}</div>
              <div className="mt-4 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 opacity-80">
                  <div className="w-7 h-7 rounded-full grid place-items-center" style={{ background:'rgba(89,217,179,.18)' }}>{['D','T','A'][i]}</div>
                  <span>{['David L.','Tyler Valle','Aaron Perry'][i]}</span>
                </div>
                <div className="flex gap-1 opacity-90">{Array.from({length:5}).map((_,k)=><Star key={k} className="w-4 h-4" style={{ color:'var(--brand)' }}/>)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="container" style={{ padding:'40px 20px 100px' }}>
        <SectionTitle title="Build agents with confidence" accent="confidence" />
        <div className="flex items-center justify-center gap-2 mb-8">
          <button onClick={()=>setPeriod('monthly')} className={`chip ${period==='monthly'?'':'opacity-70'}`}>Monthly</button>
          <button onClick={()=>setPeriod('yearly')}  className={`chip ${period==='yearly'?'':'opacity-70'}`}>Yearly • save</button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Starter */}
          <div className="card pricing-card p-6">
            <div className="text-xl font-semibold mb-2">Starter</div>
            <div className="text-[44px] font-extrabold mb-1">
              {period==='monthly' ? '$19.29' : '$131.00'}
              <span className="text-sm font-semibold opacity-70">/{period==='monthly'?'month':'year'}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm" style={{ color:'var(--muted)' }}>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>1 assistant</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Real-time voice</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Basic analytics</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Email support</li>
            </ul>
            <button
              className="btn primary-solid block mt-6"
              onClick={()=>startCheckout('starter')}
            >
              {busyPrice==='monthly:starter' || busyPrice==='yearly:starter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>Subscribe</span>
            </button>
          </div>

          {/* Pro */}
          <div className="card pricing-card p-6">
            <div className="flex items-center justify-between">
              <div className="text-xl font-semibold">Pro</div>
              <div className="chip" style={{ background:'rgba(89,217,179,.22)' }}>Most Popular</div>
            </div>
            <div className="text-[44px] font-extrabold mb-1">
              {period==='monthly' ? '$19.75' : '$209.00'}
              <span className="text-sm font-semibold opacity-70">/{period==='monthly'?'month':'year'}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm" style={{ color:'var(--muted)' }}>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Unlimited clients</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Access to Marketplace</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Unlimited AI builds</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Advanced prompt testing</li>
            </ul>
            <button
              className="btn primary-solid block mt-6"
              onClick={()=>startCheckout('pro')}
            >
              {busyPrice==='monthly:pro' || busyPrice==='yearly:pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>Subscribe</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {stripeErr && (
            <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        className="mt-4 text-sm" style={{ color:'salmon', textAlign:'center' }}>
              {stripeErr}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* FOOTER */}
      <footer className="container" style={{ padding:'40px 20px 80px', opacity:.9 }}>
        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-grid place-items-center w-9 h-9 rounded-full" style={{ background:'rgba(89,217,179,.18)', border:'1px solid var(--line)' }}>
                <Bot className="w-5 h-5" style={{ color:'var(--brand)' }} />
              </div>
              <b>ReduxAI</b>
            </div>
            <div style={{ color:'var(--muted)' }}>Build and launch voice agents faster.</div>
          </div>
          <div><b>Product</b><div className="mt-2 text-sm opacity-80">How it works</div><div className="text-sm opacity-80">Pricing</div></div>
          <div><b>Support</b><div className="mt-2 text-sm opacity-80">support@reduxai.com</div></div>
          <div><b>Legal</b><div className="mt-2 text-sm opacity-80">Terms</div><div className="text-sm opacity-80">Privacy</div></div>
        </div>
        <div className="mt-8 text-xs" style={{ color:'var(--muted)' }}>© {new Date().getFullYear()} ReduxAI. All rights reserved.</div>
      </footer>

      {/* Auth modal */}
      <AuthGate open={authOpen} onClose={()=>setAuthOpen(false)} onAuthed={onAuthed}/>
    </>
  );
}
