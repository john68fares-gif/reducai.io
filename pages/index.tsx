// pages/index.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Bot, Quote, Star, CheckCircle2, Zap, ArrowRight, X, Loader2, LogIn
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/lib/supabase-client';

/* ───────────────────────── Config ───────────────────────── */
const PRICE_IDS = {
  monthly: {
    starter: 'price_1SByXAHWdU8X80NMftriHWJW', // $19
    pro:     'price_1SByXKHWdU8X80NMAw5IlrTc', // $29
  },
  yearly: {
    starter: 'price_1SByXOHWdU8X80NM4jFrU6Nr', // $131
    pro:     'price_1SByXRHWdU8X80NM7UwuAw0B', // $209
  }
};
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK || '');
const PENDING_KEY = 'checkout:pending';

/* ───────────────────────── Theme Tokens ───────────────────────── */
const Tokens = () => (
  <style jsx global>{`
    :root{
      --bg:#0a0c0e;
      --bg-2:#0b1013;
      --bg-3:#0c1216;

      --nav-grad: linear-gradient(90deg, rgba(10,12,14,.92) 0%, rgba(12,18,16,.92) 40%, rgba(20,36,31,.92) 100%);
      --section-1:
        radial-gradient(1000px 600px at 50% -10%, rgba(89,217,179,.14), transparent 60%),
        #0a0c0e;
      --section-2:
        radial-gradient(960px 600px at 15% 10%, rgba(89,217,179,.10), transparent 60%),
        #0b1013;
      --section-3:
        radial-gradient(960px 600px at 85% 12%, rgba(89,217,179,.10), transparent 60%),
        #0c1216;

      --panel:#0f1417;
      --card:#11181b;
      --text:#e9f4f1;
      --muted:#9eb7af;

      --brand:#59d9b3;           /* same green for text accents & buttons */
      --line:rgba(89,217,179,.22);
      --border:rgba(255,255,255,.08);

      --radius:22px;
      --shadow:0 26px 64px rgba(0,0,0,.42);
    }

    /* MovaTiff font */
    @font-face{
      font-family:'MovaTiff';
      src:url('/fonts/MovaTiff.woff2') format('woff2');
      font-weight: 400 900;
      font-style: normal;
      font-display: swap;
    }

    html,body{ background:var(--bg); color:var(--text); }
    body{ font-family: MovaTiff, Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .container{ width:100%; max-width:1160px; margin:0 auto; padding:0 20px; }
    a{ text-decoration:none; color:inherit; }

    /* Buttons */
    .btn{
      position:relative;
      display:inline-flex; align-items:center; justify-content:center; gap:10px;
      height:48px; padding:0 22px; border-radius:9999px;
      background: var(--brand); color:#fff; border:1px solid var(--line);
      box-shadow:0 16px 44px rgba(89,217,179,.32), inset 0 0 0 1px rgba(255,255,255,.08);
      transform: translateZ(0);
      transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
      overflow:hidden;
    }
    .btn:hover{ transform: scale(1.04); box-shadow: 0 24px 64px rgba(89,217,179,.38), inset 0 0 0 1px rgba(255,255,255,.10); }
    .btn:active{ transform: scale(0.985); }
    .btn.ghost{ background: transparent; color: var(--text); border-color: var(--line); }
    .btn.block{ width:100%; }
    .btn::after{
      content:''; position:absolute; inset:auto; width:0; height:0; border-radius:9999px; background:rgba(255,255,255,.35);
      transform:translate(-50%,-50%); opacity:0; pointer-events:none;
    }
    .btn[data-clicked="true"]::after{ animation:ripple .5s ease; }
    @keyframes ripple { 0%{ width:0; height:0; opacity:.45; } 100%{ width:240px; height:240px; opacity:0; } }

    /* Cards */
    .card{
      background:
        radial-gradient(120% 100% at 0% 0%, rgba(89,217,179,.14), transparent 55%),
        var(--card);
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
    }
    .glow{
      box-shadow:
        0 0 0 1px rgba(89,217,179,.25) inset,
        0 18px 60px rgba(89,217,179,.18);
    }

    /* Navbar links */
    .navlink{ opacity:.85; transition: opacity .18s ease, transform .18s ease; }
    .navlink:hover{ opacity:1; transform: translateY(-1px); }

    /* Monthly/Yearly toggle — text ALWAYS white */
    .toggle{ display:inline-flex; gap:10px; padding:8px; border:1px solid var(--line); border-radius:999px; background:#0f1517; }
    .toggle .opt{
      padding:8px 14px; border-radius:999px; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease;
      color:#fff;                /* <- always white */
      background:transparent;
      opacity:.82;
    }
    .toggle .opt:hover{ opacity:1; transform: translateY(-1px); }
    .toggle .opt.active{
      color:#fff;                /* <- stay white when active too */
      background:var(--brand);
      box-shadow: 0 10px 30px rgba(89,217,179,.35);
      opacity:1;
      position:relative;
    }
    .toggle .opt.active::after{
      content:''; position:absolute; inset:-2px; border-radius:999px;
      box-shadow:0 0 0 0 rgba(89,217,179,.0);
      animation: optPulse .32s ease;
    }
    @keyframes optPulse{ 0%{ box-shadow:0 0 0 0 rgba(89,217,179,.45); } 100%{ box-shadow:0 0 0 16px rgba(89,217,179,0); } }

    /* HERO grid background behind headline */
    .hero-wrap{
      position:relative;
      isolation:isolate;
    }
    .hero-grid{
      position:absolute;
      inset:0;
      mask-image: radial-gradient(60% 60% at 50% 40%, rgba(0,0,0,.9), transparent 70%);
      pointer-events:none;
      opacity:.22;
      z-index:0;
      background:
        linear-gradient(to right, rgba(89,217,179,.2) 1px, transparent 1px) 0 0/36px 36px,
        linear-gradient(to bottom, rgba(89,217,179,.2) 1px, transparent 1px) 0 0/36px 36px;
      filter: drop-shadow(0 0 20px rgba(89,217,179,.15));
    }
    .hero-content{ position:relative; z-index:1; }
  `}</style>
);

/* ripple helper */
const useClickedRipple = () =>
  (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.dataset.clicked = 'true';
    setTimeout(()=>{ delete el.dataset.clicked; }, 520);
  };

/* ───────────────────────── Auth Modal ───────────────────────── */
function AuthModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');

  const startGoogle = async ()=>{
    try{
      setBusy(true); setErr('');
      await supabase.auth.signInWithOAuth({
        provider:'google',
        options:{ redirectTo: `${window.location.origin}/` }
      });
    }catch(e:any){
      setErr(e?.message || 'Sign-in failed');
      setBusy(false);
    }
  };

  if (typeof document === 'undefined' || !open) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[1000]" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }} onClick={onClose} />
      <motion.div className="fixed inset-0 z-[1001] flex items-center justify-center px-4"
        initial={{opacity:0,y:10,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:.98}}>
        <div className="card w-full max-w-[520px] overflow-hidden" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="inline-grid place-items-center w-9 h-9 rounded-full" style={{ background:'rgba(89,217,179,.18)', border:'1px solid var(--line)' }}>
                <LogIn className="w-5 h-5" style={{ color:'var(--brand)' }} />
              </div>
              <div className="text-lg font-semibold">Sign in to continue</div>
            </div>
            <button onClick={onClose} aria-label="Close" className="navlink"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5">
            <div className="text-sm mb-4" style={{ color:'var(--muted)' }}>
              You’ll go to Google, we’ll bring you back, then Stripe Checkout opens automatically.
            </div>
            <button className="btn block" onClick={startGoogle} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{busy ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
            {err ? <div className="mt-3 text-sm" style={{ color:'salmon' }}>{err}</div> : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>, document.body
  );
}

/* ───────────────────────── Main Page ───────────────────────── */
export default function HomePage(){
  const [authOpen,setAuthOpen] = useState(false);
  const [period,setPeriod] = useState<'monthly'|'yearly'>('monthly');
  const [busy,setBusy] = useState('');
  const [stripeErr,setStripeErr] = useState('');
  const clickRipple = useClickedRipple();

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const sub = supabase.auth.onAuthStateChange(async (_evt, s) => {
        if (s?.user?.id) {
          const raw = localStorage.getItem(PENDING_KEY);
          if (raw) {
            try {
              const { period, tier } = JSON.parse(raw);
              localStorage.removeItem(PENDING_KEY);
              await startCheckout(period, tier);
            } catch {}
          }
        }
      });
      const maybe = (sub as any)?.data?.subscription || (sub as any)?.subscription;
      unsub = () => { try { maybe?.unsubscribe?.(); } catch {} };
    })();
    return () => { try { unsub?.(); } catch {} };
  }, []);

  const startCheckout = async (p:'monthly'|'yearly', tier:'starter'|'pro')=>{
    setStripeErr('');
    const price = PRICE_IDS[p][tier];
    if (!price || !/^price_[A-Za-z0-9]+$/.test(price)) {
      setStripeErr('Stripe price ID is invalid (must start with price_…).');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ period:p, tier }));
      setAuthOpen(true);
      return;
    }
    const stripe = await stripePromise;
    if (!stripe) { setStripeErr('Stripe not initialised. Check NEXT_PUBLIC_STRIPE_PK.'); return; }
    try{
      setBusy(`${p}:${tier}`);
      const { error } = await stripe.redirectToCheckout({
        mode: 'subscription',
        lineItems: [{ price, quantity: 1 }],
        successUrl: `${window.location.origin}/account?upgraded=1`,
        cancelUrl: `${window.location.origin}/#pricing`,
      });
      if (error) throw error;
    }catch(e:any){
      setStripeErr(e?.message || 'Stripe checkout failed.');
    }finally{
      setBusy('');
    }
  };

  return (
    <>
      <Head><title>ReducAI — Build AI Agents</title></Head>
      <Tokens />

      {/* NAVBAR */}
      <div style={{ position:'sticky', top:0, zIndex:50, backdropFilter:'blur(10px)', background: 'var(--nav-grad)' }}>
        <div className="container" style={{ padding:'14px 20px' }}>
          <div className="flex items-center justify-between">
            <a className="flex items-center gap-3" href="#">
              <div className="inline-grid place-items-center w-9 h-9 rounded-full" style={{ background:'rgba(89,217,179,.18)', border:'1px solid var(--line)' }}>
                <Bot className="w-5 h-5" style={{ color:'var(--brand)' }} />
              </div>
              <div className="text-[18px] font-semibold">ReducAI</div>
            </a>
            <nav className="hidden md:flex items-center gap-10">
              <a className="navlink" href="#how">How it works</a>
              <a className="navlink" href="#reviews">Reviews</a>
              <a className="navlink" href="#pricing">Pricing</a>
            </nav>
            <button className="btn" style={{ height:40 }} onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          </div>
        </div>
      </div>

      {/* HERO with grid behind the headline */}
      <section style={{ minHeight:'100vh', padding:'10vh 0', display:'grid', placeItems:'center', background:'var(--section-1)' }}>
        <div className="container hero-wrap">
          <div className="hero-grid" />
          <div className="hero-content text-center">
            <h1 style={{ fontSize:'84px', lineHeight:1.02, letterSpacing:'-.02em', fontWeight:900 }}>
              Build <span style={{ color:'var(--brand)' }}>AI Agents</span><br/>
              for businesses that need them
            </h1>
            <p className="mt-5" style={{ color:'var(--muted)' }}>
              An AI Agent Platform, built to perform real-world tasks — setup to deployment.
            </p>
            <div className="mt-9 flex items-center justify-center gap-12">
              <button className="btn" onClick={e => {clickRipple(e); document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'});}}>
                <Zap className="w-4 h-4" /><span>Start building</span><ArrowRight className="w-4 h-4" />
              </button>
              <a className="btn ghost" href="#how" onMouseDown={clickRipple}>How it works</a>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — larger, product-specific wording */}
      <section id="how" style={{ background:'var(--section-2)' }}>
        <div className="container" style={{ padding:'96px 20px' }}>
          <div className="text-center mb-12">
            <h2 style={{ fontSize:'52px', fontWeight:900, letterSpacing:'-.02em' }}>
              Setup in <span style={{ color:'var(--brand)' }}>4 steps</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { n:'01', h:'Create Voice & Text Agents', d:'Spin up agents with Build My Agent: voice quality + prompt controls.' },
              { n:'02', h:'Test & Demo Fast', d:'Share links, gather feedback, iterate prompts in minutes.' },
              { n:'03', h:'Connect Channels', d:'Widget, WhatsApp/DMs, SMS & more with simple switches.' },
              { n:'04', h:'Deploy & Track', d:'Go live, monitor conversations, improve outcomes.' },
            ].map((s, i) => (
              <div key={i} className="card p-7">
                <div className="text-sm" style={{ color:'var(--muted)' }}>{s.n}</div>
                <div className="mt-1" style={{ fontSize:'22px', fontWeight:800 }}>{s.h}</div>
                <div className="text-sm mt-3 leading-relaxed" style={{ color:'var(--muted)' }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS — all five stars with reasons */}
      <section id="reviews" style={{ background:'var(--section-3)' }}>
        <div className="container" style={{ padding:'96px 20px' }}>
          <div className="text-center mb-10">
            <h2 style={{ fontSize:'52px', fontWeight:900, letterSpacing:'-.02em' }}>
              Hear from <span style={{ color:'var(--brand)' }}>users</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n:'Maya R.',  t:'“Voice agents sound natural and on-brand. Prompts are easy to tune and deploy.”' },
              { n:'David L.', t:'“Built 3 voice + 3 text agents on Starter and closed our first client in a week.”' },
              { n:'Tyler V.', t:'“Auth → Stripe flow works smoothly. Love the hover animations and clean overlays.”' },
              { n:'Chris K.', t:'“Pricing cards glow nicely; more important: the analytics helped us iterate fast.”' },
              { n:'Aaron P.', t:'“Support guided our Google auth URLs. We launched same-day. Totally worth it.”' },
              { n:'Nina S.',  t:'“Sections are clearly separated; UI feels premium. Clients were impressed.”' },
            ].map((r,idx)=>(
              <div key={idx} className="card p-6">
                <Quote className="w-5 h-5 mb-3" style={{ color:'var(--brand)' }} />
                <div style={{ color:'var(--muted)' }}>{r.t}</div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 opacity-90">
                    <div className="w-7 h-7 rounded-full grid place-items-center" style={{ background:'rgba(89,217,179,.18)' }}>
                      {r.n.split(' ').map(s=>s[0]).join('').toUpperCase()}
                    </div>
                    <span>{r.n}</span>
                  </div>
                  <div className="stars">
                    {Array.from({length:5}).map((_,i)=><Star key={i} className="w-4 h-4" style={{ color:'var(--brand)' }}/>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background:'var(--section-2)' }}>
        <div className="container" style={{ padding:'96px 20px 124px' }}>
          <div className="text-center mb-8">
            <h2 style={{ fontSize:'52px', fontWeight:900, letterSpacing:'-.02em' }}>
              Build agents with <span style={{ color:'var(--brand)' }}>confidence</span>
            </h2>
            <div className="mt-6 toggle inline-flex">
              <button className={`opt ${period==='monthly'?'active':''}`} onClick={()=>setPeriod('monthly')}>Monthly</button>
              <button className={`opt ${period==='yearly'?'active':''}`}  onClick={()=>setPeriod('yearly')}>Yearly</button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Starter */}
            <div className="card glow p-6">
              <div className="text-xl font-semibold">Starter</div>
              <div className="text-[44px] font-extrabold mt-1">
                {period==='monthly' ? '$19' : '$131'}
                <span className="text-sm font-semibold opacity-70">/{period==='monthly'?'mo':'yr'}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm" style={{ color:'var(--muted)' }}>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Up to <b style={{ color:'#fff' }}>3</b> text assistants</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Up to <b style={{ color:'#fff' }}>3</b> voice assistants</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Real-time voice</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Basic analytics</li>
              </ul>
              <button
                className="btn block mt-6"
                onMouseDown={clickRipple}
                onClick={()=>startCheckout(period,'starter')}
              >
                {busy===`${period}:starter` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>Subscribe</span>
              </button>
            </div>

            {/* Pro */}
            <div className="card glow p-6" style={{ position:'relative' }}>
              <div className="flex items-center justify-between">
                <div className="text-xl font-semibold">Pro</div>
                <div
                  className="px-3 py-1 rounded-full"
                  style={{
                    background:'var(--brand)',
                    color:'#0b0f0e',
                    border:'1px solid var(--line)',
                    boxShadow:'0 8px 28px rgba(89,217,179,.35)'
                  }}
                >
                  Most popular
                </div>
              </div>
              <div className="text-[44px] font-extrabold mt-1">
                {period==='monthly' ? '$29' : '$209'}
                <span className="text-sm font-semibold opacity-70">/{period==='monthly'?'mo':'yr'}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm" style={{ color:'var(--muted)' }}>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Unlimited clients</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Marketplace access</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Unlimited AI builds</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }}/>Advanced prompt testing</li>
              </ul>
              <button
                className="btn block mt-6"
                onMouseDown={clickRipple}
                onClick={()=>startCheckout(period,'pro')}
              >
                {busy===`${period}:pro` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>Subscribe</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {stripeErr && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                className="mt-5 text-center text-sm" style={{ color:'salmon' }}>
                {stripeErr}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* AUTH OVERLAY */}
      <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} />
    </>
  );
}
