// pages/index.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Script from 'next/script'

/** ─────────── ENV (replace) ─────────── */
const SUPABASE_URL = 'SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY'
const STRIPE_PUBLISHABLE_KEY = 'STRIPE_PUBLISHABLE_KEY'

/** Stripe price IDs (you provided) */
const PRICE_IDS = {
  monthly: {
    starter: 'price_1SByXAHWdU8X80NMftriHWJW',
    pro: 'price_1SByXKHWdU8X80NMAw5IlrTc',
  },
  yearly: {
    starter: 'price_1SByXOHWdU8X80NM4jFrU6Nr',
    pro: 'price_1SByXRHWdU8X80NM7UwuAw0B',
  },
} as const

/** Keys */
const PENDING_KEY = 'checkout:pending'

declare global {
  interface Window {
    Stripe: any
    stripe: any
    supabase: any
    Supabase: any
  }
}

export default function Home() {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [authOpen, setAuthOpen] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [stripeErr, setStripeErr] = useState('')
  const [sbReady, setSbReady] = useState(false)
  const supaRef = useRef<any>(null)

  /** boot Supabase once the UMD script is loaded */
  useEffect(() => {
    if (window?.Supabase && !supaRef.current) {
      supaRef.current = window.Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      setSbReady(true)
      // Resume pending checkout after OAuth
      supaRef.current.auth.onAuthStateChange(async (_evt: any, session: any) => {
        if (session?.user) {
          const raw = localStorage.getItem(PENDING_KEY)
          if (raw) {
            try {
              const { p, t } = JSON.parse(raw)
              localStorage.removeItem(PENDING_KEY)
              setPeriod(p)
              beginCheckout(t)
            } catch {}
          }
        }
      })
    }
  }, [typeof window !== 'undefined' && (window as any)?.Supabase])

  function togglePlan(next: 'monthly' | 'yearly') {
    setPeriod(next)
    // little flash is handled in CSS by .active style change
  }

  function ripple(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
    el.classList.add('clicked')
    setTimeout(() => el.classList.remove('clicked'), 520)
  }

  async function beginCheckout(tier: 'starter' | 'pro') {
    setStripeErr('')
    const price = PRICE_IDS[period][tier]
    if (!/^price_[A-Za-z0-9]+$/.test(price)) {
      setStripeErr('Invalid Stripe price ID.'); return
    }
    if (!window?.stripe) window.stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY)
    if (!supaRef.current) { setAuthOpen(true); return }

    const { data: { session } } = await supaRef.current.auth.getSession()
    if (!session?.user) {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ p: period, t: tier }))
      setAuthOpen(true); return
    }
    try {
      const res = await window.stripe.redirectToCheckout({
        mode: 'subscription',
        lineItems: [{ price, quantity: 1 }],
        successUrl: `${location.origin}/account?upgraded=1`,
        cancelUrl: `${location.origin}/#pricing`,
      })
      if (res?.error) setStripeErr(res.error.message || 'Stripe failed.')
    } catch {
      setStripeErr('Stripe failed.')
    }
  }

  async function googleSignIn() {
    setAuthErr('')
    try {
      await supaRef.current.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/` },
      })
    } catch (e: any) {
      setAuthErr(e?.message || 'Sign-in failed')
    }
  }

  return (
    <>
      <Head>
        <title>ReducAI — Build AI Agents</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* UMD libs */}
      <Script src="https://js.stripe.com/v3/" strategy="beforeInteractive" />
      <Script src="https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" strategy="beforeInteractive"
        onLoad={() => { (window as any).Supabase = (window as any).supabase }} />

      {/* NAV */}
      <div className="nav">
        <div className="container nav-row">
          <a className="brand" href="#">
            <span className="logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 4v10l-7 4-7-4V7l7-4Z" stroke="var(--brand)" strokeWidth="1.6"/></svg>
            </span>
            <b>ReducAI</b>
          </a>
          <nav className="navlinks">
            <a href="#how" className="navlink">How it works</a>
            <a href="#reviews" className="navlink">Reviews</a>
            <a href="#pricing" className="navlink">Pricing</a>
          </nav>
          <a className="btn small" href="#pricing">Sign in</a>
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="container hero-inner">
          <h1>
            Build <span className="accent">AI Agents</span><br/>
            and <span className="accent">find businesses</span> that need them
          </h1>
          <p className="muted">An AI Agent Platform, built to perform real-world tasks</p>
          <div className="cta">
            <button className="btn ripple" onPointerDown={ripple} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              {/* zap */}<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7Z" stroke="white" strokeWidth="1.6"/></svg>
              Start building
              {/* arrow */}<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="white" strokeWidth="1.6"/></svg>
            </button>
            <a className="btn ghost ripple" onPointerDown={ripple} href="#how">How it works</a>
          </div>
        </div>
      </section>

      {/* HOW (compact tiles) */}
      <section id="how" className="pad sec2">
        <div className="container tac">
          <h2>Setup agents in <span className="accent">4 steps</span></h2>
          <p className="muted">Built for speed, kept simple</p>
          <div className="tiles">
            {[
              ['Prompt Agent','Create detailed instructions with the AI Prompter.'],
              ['Demo Agent','Share with clients and teammates.'],
              ['Connect Agent','Widget, DMs, Messenger, SMS…'],
              ['Deploy Agent','Go live & track conversations.'],
            ].map(([t,s]) => (
              <div key={t} className="card">
                <div className="title">{t}</div>
                <div className="sub">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" className="pad sec3">
        <div className="container tac">
          <h2>Hear From Our <span className="accent">Users</span></h2>
          <div className="reviews">
            {[
              ['David L.','Got value on day one. The demo agent booked two leads in week one.'],
              ['Tyler V.','Low effort, high polish. The 4-step flow matches how we work.'],
              ['Aaron P.','Support is responsive and features ship fast.'],
              ['Maya R.','Voice quality is solid and integrations saved days.'],
              ['Chris K.','Finally a platform that treats prompt testing seriously.'],
            ].map(([name, text], i) => (
              <div key={i} className="card">
                <div className="rev-text">“{text}”</div>
                <div className="rev-foot">
                  <div className="who"><span className="avatar">{String(name).charAt(0)}</span><b>{name}</b></div>
                  <div className="stars">★★★★★</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="pad sec2">
        <div className="container tac">
          <h2>Build agents with <span className="accent">confidence</span></h2>

          <div className="toggle">
            <button className={`opt ${period==='monthly'?'active':''}`} onClick={() => togglePlan('monthly')}>Monthly</button>
            <button className={`opt ${period==='yearly'?'active':''}`} onClick={() => togglePlan('yearly')}>Yearly</button>
          </div>

          <div className="plans">
            {/* Starter */}
            <div className="card glow">
              <div className="p-title">Starter</div>
              <div className="price">{period==='monthly' ? '$19' : '$131'}<span className="per">{period==='monthly'?'/mo':'/yr'}</span></div>
              <ul className="list">
                <li>Up to <b>3</b> text assistants</li>
                <li>Up to <b>3</b> voice assistants</li>
                <li>Real-time voice</li>
                <li>Basic analytics</li>
              </ul>
              <button className="btn block ripple" onPointerDown={ripple} onClick={() => beginCheckout('starter')}>Subscribe</button>
            </div>

            {/* Pro */}
            <div className="card glow">
              <div className="top">
                <div className="p-title">Pro</div>
                <div className="pill">Most popular</div>
              </div>
              <div className="price">{period==='monthly' ? '$29' : '$209'}<span className="per">{period==='monthly'?'/mo':'/yr'}</span></div>
              <ul className="list">
                <li>Unlimited clients</li>
                <li>Access to Marketplace</li>
                <li>Unlimited AI builds</li>
                <li>Advanced prompt testing</li>
              </ul>
              <button className="btn block ripple" onPointerDown={ripple} onClick={() => beginCheckout('pro')}>Subscribe</button>
            </div>
          </div>

          {!!stripeErr && <div className="err">{stripeErr}</div>}
        </div>
      </section>

      {/* AUTH MODAL */}
      {authOpen && (
        <div className="auth">
          <div className="backdrop" onClick={() => setAuthOpen(false)} />
          <div className="panel card">
            <div className="panel-head">
              <div className="who">
                <span className="logo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="var(--brand)" strokeWidth="1.6"/></svg></span>
                <b>Sign in to continue</b>
              </div>
              <button className="x" onClick={() => setAuthOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="panel-body">
              <div className="muted">We’ll take you to Google, then bring you back and open Stripe automatically.</div>
              <button className="btn block ripple" onPointerDown={ripple} onClick={googleSignIn}>Continue with Google</button>
              {!!authErr && <div className="err">{authErr}</div>}
            </div>
          </div>
        </div>
      )}

      {/* STYLES (single-file) */}
      <style jsx>{`
        @font-face{
          font-family:'MovaTiff';
          src:url('/fonts/MovaTiff.woff2') format('woff2');
          font-weight: 400 900; font-style: normal; font-display: swap;
        }
        :root{
          --bg:#0a0c0e;
          --sec1: radial-gradient(900px 540px at 50% -10%, rgba(89,217,179,.12), transparent 60%), #0a0c0e;
          --sec2: radial-gradient(900px 540px at 10% 10%, rgba(89,217,179,.09), transparent 60%), #0b1013;
          --sec3: radial-gradient(900px 540px at 90% 10%, rgba(89,217,179,.09), transparent 60%), #0c1216;
          --nav: linear-gradient(90deg, rgba(10,12,14,.88) 0%, rgba(12,18,16,.88) 50%, rgba(18,32,29,.88) 100%);
          --panel:#0f1417; --card:#11181b; --text:#e9f4f1; --muted:#9eb7af;
          --brand:#59d9b3; --line:rgba(89,217,179,.22); --border:rgba(255,255,255,.08);
          --radius:16px; --shadow:0 22px 60px rgba(0,0,0,.45);
        }
        html, body { margin:0; background:var(--bg); color:var(--text);
          font-family:MovaTiff, Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        a { color:inherit; text-decoration:none }
        .container { width:100%; max-width:1160px; margin:0 auto; padding:0 20px }
        .tac{ text-align:center }
        .muted{ color:var(--muted) }

        /* nav */
        .nav{ position:sticky; top:0; z-index:40; backdrop-filter:blur(10px); background:var(--nav) }
        .nav-row{ display:flex; align-items:center; justify-content:space-between; padding:14px 0 }
        .brand{ display:flex; align-items:center; gap:10px; font-weight:700; font-size:18px }
        .logo{ display:grid; place-items:center; width:36px; height:36px; border-radius:50%; background:rgba(89,217,179,.18); border:1px solid var(--line) }
        .navlinks{ display:flex; gap:28px }
        .navlink{ opacity:.85; transition:opacity .18s, transform .18s }
        .navlink:hover{ opacity:1; transform:translateY(-1px) }

        /* hero */
        .hero{ min-height:100vh; display:grid; place-items:center; background:var(--sec1) }
        .hero-inner{ text-align:center }
        h1{ font-size:82px; line-height:1.02; letter-spacing:-.02em; margin:0 }
        .accent{ color:var(--brand) }
        .cta{ display:flex; justify-content:center; gap:28px; margin-top:36px }

        /* sections */
        .pad{ padding:80px 0 }
        .sec2{ background:var(--sec2) }
        .sec3{ background:var(--sec3) }

        /* cards & tiles */
        .tiles{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:18px; margin-top:20px }
        .card{ background:radial-gradient(120% 100% at 0% 0%, rgba(89,217,179,.14), transparent 55%), var(--card);
          border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow); padding:18px 20px }
        .glow{ box-shadow:0 0 0 1px rgba(89,217,179,.25) inset, 0 18px 60px rgba(89,217,179,.18) }
        .title{ font-weight:700 }
        .sub{ color:var(--muted); font-size:13px; margin-top:4px }

        /* reviews grid */
        .reviews{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:18px; margin-top:20px }
        .rev-text{ color:var(--muted) }
        .rev-foot{ display:flex; align-items:center; justify-content:space-between; margin-top:14px }
        .who{ display:flex; align-items:center; gap:8px }
        .avatar{ width:28px; height:28px; border-radius:50%; background:rgba(89,217,179,.18); display:grid; place-items:center }
        .stars{ letter-spacing:.1em }

        /* pricing */
        .toggle{ display:inline-flex; gap:10px; padding:8px; border:1px solid var(--line); border-radius:999px; background:#0f1517; margin:18px 0 8px }
        .opt{ padding:8px 14px; border-radius:999px; color:var(--muted); transition:transform .18s, box-shadow .18s, background .18s }
        .opt.active{ background:var(--brand); color:#0b0f0e; box-shadow:0 10px 30px rgba(89,217,179,.35); transform:translateY(-1px) }
        .plans{ display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:24px; margin-top:14px }
        .p-title{ font-size:20px; font-weight:700 }
        .top{ display:flex; align-items:center; justify-content:space-between }
        .pill{ padding:6px 12px; border-radius:999px; background:var(--brand); color:#0b0f0e; border:1px solid var(--line); box-shadow:0 8px 28px rgba(89,217,179,.35) }
        .price{ font-size:44px; font-weight:900; margin-top:4px }
        .per{ font-size:12px; opacity:.7; margin-left:4px }
        .list{ list-style:none; padding:0; margin:16px 0 0 0; color:var(--muted); display:grid; gap:8px }
        .block{ width:100%; margin-top:18px }
        .err{ color:salmon; margin-top:12px }

        /* buttons */
        .btn{
          position:relative; display:inline-flex; align-items:center; gap:10px; justify-content:center;
          height:48px; padding:0 22px; border-radius:9999px; border:1px solid var(--line);
          background:var(--brand); color:#fff; box-shadow:0 12px 34px rgba(89,217,179,.25), inset 0 0 0 1px rgba(255,255,255,.06);
          transition:transform .18s, box-shadow .18s, background .18s; cursor:pointer; user-select:none;
        }
        .btn:hover{ transform:scale(1.035); box-shadow:0 18px 48px rgba(89,217,179,.35), inset 0 0 0 1px rgba(255,255,255,.08) }
        .btn:active{ transform:scale(.985) }
        .btn.ghost{ background:transparent; color:var(--text) }
        .btn.small{ height:40px; padding:0 16px }
        .btn.ripple::after{
          content:''; position:absolute; width:0;height:0; left:var(--x,50%); top:var(--y,50%);
          border-radius:9999px; background:rgba(255,255,255,.35); opacity:0; transform:translate(-50%,-50%);
          pointer-events:none;
        }
        .btn.clicked::after{ animation:ripple .5s ease }
        @keyframes ripple{ 0%{ width:0;height:0;opacity:.45 } 100%{ width:240px;height:240px;opacity:0 } }

        /* auth modal */
        .auth{ position:fixed; inset:0; z-index:60 }
        .backdrop{ position:absolute; inset:0; background:rgba(6,8,10,.62); backdrop-filter:blur(6px) }
        .panel{ position:relative; z-index:1; width:min(520px,92vw); margin:10vh auto; overflow:hidden }
        .panel-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--border) }
        .panel-body{ padding:16px; display:grid; gap:12px }
        .x{ background:transparent; border:0; color:var(--text); cursor:pointer; font-size:18px }
      `}</style>
    </>
  )
}
