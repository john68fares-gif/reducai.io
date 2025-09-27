// pages/index.tsx
'use client';

import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowRight, Sparkles, Shield, Rocket, Play, CheckCircle2, Mail, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

// If you created components/ui/Overlay.tsx from earlier, import it:
// import { OverlayShell, OverlayHeader } from '@/components/ui/Overlay';

// Minimal local copies so this page is self-contained:
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const GREEN = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

function OverlayShell({
  open, onClose, children, maxWidth = 560
}:{ open:boolean; onClose?:()=>void; children:React.ReactNode; maxWidth?:number; }) {
  if (typeof document === 'undefined' || !open) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div
        key="bg"
        className="fixed inset-0 z-[100000]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
      />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center px-4">
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: .18, ease: 'easeOut' }}
          className="w-full overflow-hidden"
          style={{
            maxWidth,
            background:'var(--panel)',
            color:'var(--text)',
            border:`1px solid ${GREEN_LINE}`,
            borderRadius: 12,
            boxShadow:'0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset'
          }}
        >
          {children}
        </motion.div>
      </div>
    </AnimatePresence>, document.body
  );
}

function OverlayHeader({ title, icon, subtitle }:{
  title:string; icon?:React.ReactNode; subtitle?:string;
}) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{
        background:'linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)',
        borderBottom:`1px solid ${GREEN_LINE}`
      }}
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="grid place-items-center" style={{ width:40, height:40, borderRadius:10, background:'var(--brand-weak)' }}>
            <span style={{ color: GREEN, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }}>{icon}</span>
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          {subtitle ? <div className="text-xs" style={{ color:'var(--text-muted)' }}>{subtitle}</div> : null}
        </div>
      </div>
      <span style={{ width:20, height:20 }} />
    </div>
  );
}

/* ───────────────── Tokens copied from your overlay look ───────────────── */
const Tokens = () => (
  <style jsx global>{`
    /* Dark default */
    :root {
      --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214;
      --text:#e6f1ef; --text-muted:#9fb4ad;
      --brand:${GREEN}; --brand-weak:rgba(89,217,179,.22);
      --border:rgba(255,255,255,.10);
      --radius:14px;
    }
    :root:not([data-theme="dark"]) {
      --bg:#f7faf9; --panel:#ffffff; --card:#f4f7f6;
      --text:#0f172a; --text-muted:#64748b;
      --brand:${GREEN}; --brand-weak:rgba(89,217,179,.18);
      --border:rgba(15,23,42,.12);
    }
    body { background:var(--bg); color:var(--text); }
    .x-card {
      background: var(--panel);
      border: 1px solid ${GREEN_LINE};
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset;
    }
    .x-btn {
      height: 48px; border-radius: 999px; padding: 0 18px;
      font-weight: 600; letter-spacing: .01em;
    }
    .x-btn--primary {
      background: var(--brand); color: #fff; border: 1px solid ${GREEN_LINE};
    }
    .x-btn--ghost {
      background: transparent; color: var(--text);
      border: 1px solid var(--border);
    }
    .x-bullet { display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--text-muted); }
  `}</style>
);

/* ───────────────── Auth Overlay (magic link + Google) ───────────────── */
function AuthOverlay({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const [email,setEmail] = useState('');
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);

  async function withEmail() {
    if (!email) return;
    setBusy(true);
    try {
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      });
      setSent(true);
    } finally { setBusy(false); }
  }

  async function withGoogle() {
    setBusy(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      });
    } finally { setBusy(false); }
  }

  return (
    <OverlayShell open={open} onClose={onClose} maxWidth={520}>
      <OverlayHeader title="Welcome back" subtitle="Choose your preferred sign-in" icon={<LogIn className="w-5 h-5" />} />
      <div className="px-6 py-6">
        {!sent ? (
          <>
            <label className="block text-xs mb-2" style={{ color:'var(--text-muted)' }}>Email address</label>
            <input
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-[48px] px-3"
              style={{ background:'var(--panel)', border:`1px solid var(--border)`, color:'var(--text)', borderRadius:'12px' }}
            />
            <div className="mt-3 grid gap-2">
              <button onClick={withEmail} disabled={busy} className="x-btn x-btn--primary">
                {busy ? 'Sending…' : <>Continue with Email <ArrowRight className="inline-block w-4 h-4 ml-1" /></>}
              </button>
              <button onClick={withGoogle} disabled={busy} className="x-btn x-btn--ghost">
                <svg width="18" height="18" viewBox="0 0 48 48" className="mr-1 inline-block" style={{ verticalAlign:'-3px' }}>
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.5 6.2 28.9 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.7 0 19.5-8 19.5-20 0-1.3-.1-2.2-.3-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.9C14.7 16.2 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.5 6.2 28.9 4 24 4 15.5 4 8.3 9.1 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.2C29.3 36 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C8.2 39 15.6 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.3 3.7-4.8 6-9.3 6-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C8.2 39 15.6 44 24 44c10.7 0 19.5-8 19.5-20 0-1.3-.1-2.2-.3-3.5z"/>
                </svg>
                Continue with Google
              </button>
            </div>
          </>
        ) : (
          <div className="x-card p-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} />
              Magic link sent to <b>{email}</b>. Check your inbox.
            </div>
          </div>
        )}
      </div>
    </OverlayShell>
  );
}

/* ───────────────── Page ───────────────── */
export default function Home() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <Head><title>Reduc.ai — Voice that sells</title></Head>
      <Tokens />

      {/* NAV — calm, roomy, rounded CTAs */}
      <header className="w-full" style={{ borderBottom:`1px solid ${GREEN_LINE}` }}>
        <div className="mx-auto max-w-[1160px] px-5 lg:px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid place-items-center w-7 h-7 rounded-md" style={{ background:'var(--brand-weak)' }}>
              <Sparkles className="w-4 h-4" style={{ color: GREEN }} />
            </div>
            <div className="text-sm" style={{ color:'var(--text)' }}>Reduc.ai</div>
          </div>
          <div className="flex items-center gap-8">
            <button className="x-btn x-btn--ghost" onClick={()=>router.push('#features')}>Features</button>
            <button className="x-btn x-btn--primary" onClick={()=>setAuthOpen(true)}>Sign in / Sign up</button>
          </div>
        </div>
      </header>

      {/* HERO — “welcome”, lighter weight, big spacing */}
      <main>
        <section
          className="pt-20 pb-16"
          style={{
            background: 'radial-gradient(900px 420px at 0% -10%, var(--brand-weak), transparent 60%), var(--bg)'
          }}
        >
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 grid grid-cols-1 lg:grid-cols-[1.1fr,.9fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 x-card px-3 h-[36px] text-xs mb-5"
                   style={{ borderRadius: 999 }}>
                <Play className="w-3.5 h-3.5" style={{ color: GREEN }} />
                Launch a voice agent in minutes
              </div>

              <h1 className="leading-tight" style={{ fontSize: '44px', fontWeight: 700 }}>
                Welcome to <span style={{ color: GREEN }}>Reduc.ai</span> — a calm way to build
                <br /> a natural-sounding voice agent.
              </h1>

              <p className="mt-4" style={{ color:'var(--text-muted)', fontSize:16, lineHeight:1.6 }}>
                Clean onboarding. Clear pricing. Secure sessions. No clutter — just the pieces you need to ship.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button className="x-btn x-btn--primary" onClick={()=>setAuthOpen(true)}>
                  Try free <ArrowRight className="inline-block w-4 h-4 ml-1" />
                </button>
                <button className="x-btn x-btn--ghost" onClick={()=>router.push('#how')}>
                  See how it works
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-5">
                <span className="x-bullet"><Shield className="w-4 h-4" /> Secure by Supabase Auth</span>
                <span className="x-bullet"><Rocket className="w-4 h-4" /> Realtime & low latency</span>
                <span className="x-bullet"><Mail className="w-4 h-4" /> Magic links or Google</span>
              </div>
            </div>

            {/* Right preview card (quiet) */}
            <div className="x-card p-5">
              <div className="text-sm mb-3" style={{ color:'var(--text-muted)' }}>Live demo preview</div>
              <div className="x-card p-4" style={{ background:'var(--card)' }}>
                “Hi! I can help you book or reschedule. How can I help today?”
              </div>
              <div className="text-xs mt-3" style={{ color:'var(--text-muted)' }}>
                Barge-in • Micro-pauses • Tool integrations
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES — airy spacing, lighter fonts */}
        <section id="features" className="py-18 md:py-24">
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 grid gap-6 md:grid-cols-3">
            {[
              { icon:<Shield className="w-5 h-5"/>, title:'Secure sessions', body:'OAuth or magic link. Your data stays yours.'},
              { icon:<Rocket className="w-5 h-5"/>, title:'Production ready', body:'Realtime voice, smart call flow, tool hooks.'},
              { icon:<Sparkles className="w-5 h-5"/>, title:'Calm UI', body:'Less noise, more signal. Ship faster.'},
            ].map((f,i)=>(
              <div key={i} className="x-card p-5">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-9 h-9 rounded-md" style={{ background:'var(--brand-weak)' }}>
                    <span style={{ color: GREEN }}>{f.icon}</span>
                  </div>
                  <div className="font-semibold">{f.title}</div>
                </div>
                <p className="mt-3 text-sm" style={{ color:'var(--text-muted)' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW — simple, spaced */}
        <section id="how" className="pb-24">
          <div className="mx-auto max-w-[900px] px-5 lg:px-6">
            <div className="x-card p-6 md:p-8">
              <div className="text-lg font-semibold mb-2">How it works</div>
              <ol className="grid gap-3 text-sm" style={{ color:'var(--text-muted)' }}>
                <li>1. Create your account (Google or email link).</li>
                <li>2. Pick the Starter plan (free trial), or skip for now.</li>
                <li>3. Build an agent, hook tools, test live, deploy.</li>
              </ol>
              <div className="mt-4">
                <button className="x-btn x-btn--primary" onClick={()=>setAuthOpen(true)}>
                  Start free <ArrowRight className="inline-block w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="py-10" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
        <div className="mx-auto max-w-[1160px] px-5 lg:px-6 text-sm" style={{ color:'var(--text-muted)' }}>
          © {new Date().getFullYear()} Reduc.ai — Ship voice that sells.
        </div>
      </footer>

      {/* Auth modal */}
      <AuthOverlay open={authOpen} onClose={()=>setAuthOpen(false)} />
    </>
  );
}
