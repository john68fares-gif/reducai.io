// /pages/index.tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import {
  ArrowRight, Check, Sparkles, Mic, Phone, Zap, Shield, MessageSquare,
  Globe, Cpu, Headphones, Play, Wand2, Lock
} from 'lucide-react';

const ACCENT = '#6af7d1';
const ACCENT_DARK = '#45dcb5';

export default function Home() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // If logged-in → /builder
  useEffect(() => {
    let sub: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setAuthed(true);
        router.replace('/builder');
        return;
      }
      // Listen for sign-in that returns to this page
      sub = supabase.auth.onAuthStateChange((_e, sess) => {
        if (sess) {
          setAuthed(true);
          router.replace('/builder');
        }
      }) as any;
    })();
    return () => { sub?.data?.subscription?.unsubscribe?.(); };
  }, [router]);

  const openAuth = () => setAuthOpen(true);

  return (
    <>
      <Head>
        <title>Reduc.ai — Build a voice agent in minutes</title>
        <meta name="description" content="Ship a production-ready voice agent in minutes. Natural, fast, and integrated with your stack." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen" style={{ background: 'var(--bg, #0b0c10)', color: 'var(--text, #e6f1ef)' }}>
        {/* NAV */}
        <nav className="w-full">
          <div className="mx-auto max-w-7xl px-5 py-4 flex items-center gap-3">
            <Logo />
            <span className="ml-2 text-sm opacity-70">Ship voice that sells.</span>
            <span className="ml-auto" />
            <a href="#features" className="text-sm opacity-80 hover:opacity-100 transition">Features</a>
            <a href="#how" className="text-sm opacity-80 hover:opacity-100 transition ml-5">How it works</a>
            <a href="#faq" className="text-sm opacity-80 hover:opacity-100 transition ml-5">FAQ</a>
            <button
              onClick={openAuth}
              className="ml-6 h-10 px-4 rounded-[10px] font-semibold"
              style={{ background: ACCENT, color: '#0b0c10', boxShadow: '0 10px 22px rgba(106,247,209,.25)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = ACCENT_DARK)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = ACCENT)}
            >
              {authed ? 'Go to Builder' : 'Sign in / Sign up'}
            </button>
          </div>
        </nav>

        {/* HERO */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[22%] -left-[28%] w-[76%] h-[76%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(106,247,209,.20) 0%, transparent 70%)',
              filter: 'blur(42px)'
            }}
          />
          <div className="mx-auto max-w-7xl px-5 pt-16 pb-20 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
                   style={{ borderColor:'rgba(255,255,255,.14)', background:'rgba(255,255,255,.04)' }}>
                <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                Launch a voice agent in minutes
              </div>
              <h1 className="mt-4 text-4xl md:text-6xl font-semibold leading-[1.05]">
                Build a <span style={{ color: ACCENT }}>natural-sounding</span> voice agent
                <br className="hidden md:block" /> your users actually enjoy.
              </h1>
              <p className="mt-4 text-base md:text-lg opacity-80 max-w-2xl">
                Reduc.ai gives you realtime voice, smart call flow, and tool integrations —
                without the yak-shaving. Ship a production agent today, not next quarter.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={openAuth}
                  className="h-12 px-6 rounded-[14px] font-semibold inline-flex items-center gap-2"
                  style={{ background: ACCENT, color: '#0b0c10', boxShadow: '0 12px 30px rgba(106,247,209,.28)' }}
                  onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = ACCENT_DARK)}
                  onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = ACCENT)}
                >
                  Try free <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#how"
                  className="h-12 px-5 rounded-[14px] font-semibold inline-flex items-center gap-2"
                  style={{ border:'1px solid rgba(255,255,255,.16)' }}
                >
                  See how it works
                </a>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 max-w-md text-sm opacity-80">
                <Pill icon={<Zap className="w-4 h-4" />} text="Low latency" />
                <Pill icon={<Headphones className="w-4 h-4" />} text="Realtime turn-taking" />
                <Pill icon={<Shield className="w-4 h-4" />} text="Safe by default" />
              </div>
            </div>

            <HeroCard />
          </div>
        </section>

        {/* TRUST / LOGOS (placeholder) */}
        <section className="py-8 opacity-80">
          <div className="mx-auto max-w-7xl px-5 grid grid-cols-2 md:grid-cols-5 gap-6 place-items-center">
            {['Acme','Globex','Umbrella','Stark','Hooli'].map((n,i)=>(
              <div key={i} className="text-sm tracking-wide uppercase opacity-60">{n}</div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="py-12">
          <div className="mx-auto max-w-7xl px-5">
            <h2 className="text-2xl md:text-3xl font-semibold">Everything you need to ship voice</h2>
            <p className="mt-2 opacity-80">Fast setup, flexible prompts, real tools, real outcomes.</p>

            <div className="mt-8 grid md:grid-cols-3 gap-6">
              <Card
                icon={<Mic className="w-5 h-5" style={{ color: ACCENT }} />}
                title="Natural conversation"
                body="Streaming ASR + neural TTS + barge-in. Your agent sounds human and never waits on long turns."
              />
              <Card
                icon={<Wand2 className="w-5 h-5" style={{ color: ACCENT }} />}
                title="Prompt, not plumbing"
                body="Describe your business and goals; we compile a production-ready system prompt with fallbacks."
              />
              <Card
                icon={<MessageSquare className="w-5 h-5" style={{ color: ACCENT }} />}
                title="Tools & actions"
                body="Connect calendars, CRMs, or your own APIs to let the agent actually do things, not just chat."
              />
              <Card
                icon={<Phone className="w-5 h-5" style={{ color: ACCENT }} />}
                title="Web & phone"
                body="Drop-in web widget and phone numbers. One agent, all channels."
              />
              <Card
                icon={<Cpu className="w-5 h-5" style={{ color: ACCENT }} />}
                title="Model-flexible"
                body="Use GPT-4o / Realtime or your preferred stack. Swap without rewrites."
              />
              <Card
                icon={<Globe className="w-5 h-5" style={{ color: ACCENT }} />}
                title="Multi-lingual"
                body="Serve customers in their language. The agent auto-detects and adapts."
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="py-14">
          <div className="mx-auto max-w-7xl px-5">
            <h2 className="text-2xl md:text-3xl font-semibold">From zero to live calls in 3 steps</h2>
            <div className="mt-6 grid md:grid-cols-3 gap-6">
              <Step n={1} title="Describe your business"
                    body="Paste your site or write a short blurb. We generate a clean, structured system prompt." />
              <Step n={2} title="Connect tools"
                    body="Add your API key, calendar, or custom endpoints. The agent can now take action." />
              <Step n={3} title="Go live"
                    body="Embed the web call button, or attach a phone number. Start taking calls immediately." />
            </div>

            <div className="mt-8">
              <button
                onClick={openAuth}
                className="h-12 px-6 rounded-[14px] font-semibold inline-flex items-center gap-2"
                style={{ background: ACCENT, color: '#0b0c10', boxShadow: '0 12px 30px rgba(106,247,209,.28)' }}
                onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = ACCENT_DARK)}
                onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = ACCENT)}
              >
                Start free <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-14">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-2xl md:text-3xl font-semibold">FAQ</h2>
            <ul className="mt-6 space-y-5">
              <Faq q="Do I need to bring my own API key?"
                   a="Yes. Your usage is billed directly by your LLM provider. We never store your secret in the browser; we reference an id and resolve server-side." />
              <Faq q="Can I port my prompt from elsewhere?"
                   a="Totally. Paste it as-is or let the builder re-shape it into our structured format (with error handling and fallbacks)." />
              <Faq q="Does it work on the phone?"
                   a="Yes—web calls and phone numbers use the same agent and prompt. Activate a number and you’re live." />
            </ul>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-10 border-t" style={{ borderColor:'rgba(255,255,255,.08)' }}>
          <div className="mx-auto max-w-7xl px-5 flex items-center gap-4">
            <Logo />
            <span className="opacity-70 text-sm">© {new Date().getFullYear()} Reduc.ai. All rights reserved.</span>
            <span className="ml-auto opacity-70 text-sm">Made for teams who ship.</span>
          </div>
        </footer>
      </main>

      {/* SIGN IN / UP OVERLAY (no separate page) */}
      {authOpen && <AuthOverlay onClose={()=>setAuthOpen(false)} />}
    </>
  );
}

/* ───────────────────────── Components ───────────────────────── */

function Logo() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg grid place-items-center" style={{ background:'rgba(106,247,209,.15)' }}>
        <Play className="w-4 h-4" style={{ color: ACCENT }} />
      </div>
      <b>Reduc.ai</b>
    </div>
  );
}

function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span style={{ color: ACCENT }}>{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[16px] p-5"
         style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.10)', boxShadow:'0 20px 40px rgba(0,0,0,.18)' }}>
      <div className="w-9 h-9 rounded-lg grid place-items-center mb-2" style={{ background:'rgba(106,247,209,.12)' }}>
        {icon}
      </div>
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-1 opacity-80 text-sm">{body}</p>
      <ul className="mt-3 space-y-1 text-sm opacity-80">
        {[0,1,2].map(i=>(
          <li key={i} className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: ACCENT }} />
            <span>Production-ready out of the box</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-[16px] p-5"
         style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.10)' }}>
      <div className="text-xs opacity-70">Step {n}</div>
      <div className="text-lg font-semibold mt-1">{title}</div>
      <p className="opacity-80 text-sm mt-1">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <li className="rounded-[16px] p-5"
        style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.10)' }}>
      <div className="font-semibold">{q}</div>
      <p className="opacity-80 mt-1 text-sm">{a}</p>
    </li>
  );
}

function HeroCard() {
  return (
    <div className="rounded-[22px] p-5 md:p-6"
         style={{ border:'1px solid rgba(255,255,255,.10)', background:'linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))', boxShadow:'0 28px 70px rgba(0,0,0,.22)' }}>
      <div className="text-sm opacity-80">Live demo preview</div>
      <div className="mt-3 rounded-[14px] p-4 grid gap-3"
           style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background:'rgba(106,247,209,.12)' }}>
            <Mic className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <div className="font-semibold">Riley (Scheduling)</div>
          <span className="ml-auto text-xs opacity-70 inline-flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Uses your own key
          </span>
        </div>
        <div className="rounded-[10px] p-3 text-sm"
             style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)' }}>
          “Hi! I can help you book, reschedule, or answer questions. What can I do for you today?”
        </div>
        <div className="text-xs opacity-70">Barge-in • Filler word control • Micro-pauses • Phone filtering</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Auth Overlay ───────────────────────── */

function AuthOverlay({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const title = mode === 'signin' ? 'Welcome back' : 'Create your account';

  async function signInWithProvider(provider: 'google' | 'github') {
    if (busy) return;
    try {
      setBusy(true);
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: origin }, // return to /, middleware/index will send to /builder on session
      });
      // Supabase will redirect; no-op here.
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    try {
      setBusy(true);
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: origin },
      });
      if (error) throw error;
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 100000, background:'rgba(0,0,0,.72)' }} onClick={busy ? undefined : onClose} />
      <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: 100001 }}>
        <div className="w-full max-w-[620px] rounded-[16px] overflow-hidden"
             style={{ background:'#0d0f11', color:'#e6f1ef', border:'1px solid rgba(255,255,255,.10)', boxShadow:'0 24px 64px rgba(0,0,0,.36)' }}
             role="dialog" aria-modal="true" aria-label="Authentication">
          {/* Header */}
          <div className="px-6 py-5 border-b" style={{ borderColor:'rgba(255,255,255,.10)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background:'rgba(106,247,209,.12)' }}>
                <Wand2 className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <div className="text-lg font-semibold">{title}</div>
              <span className="ml-auto" />
              <button onClick={busy ? undefined : onClose}
                      className="h-9 px-3 rounded-[8px]" style={{ border:'1px solid rgba(255,255,255,.14)' }}>
                Close
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 grid md:grid-cols-2 gap-6">
            <div>
              <button
                disabled={busy}
                onClick={()=>signInWithProvider('google')}
                className="w-full h-11 rounded-[10px] font-semibold"
                style={{ background: ACCENT, color:'#0b0c10' }}
              >
                Continue with Google
              </button>
              <button
                disabled={busy}
                onClick={()=>signInWithProvider('github')}
                className="w-full h-11 rounded-[10px] font-semibold mt-3"
                style={{ background: 'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)' }}
              >
                Continue with GitHub
              </button>

              <div className="text-xs opacity-70 mt-3">
                By continuing you agree to our Terms and Privacy.
              </div>
            </div>

            <div>
              <div className="text-sm opacity-80 mb-2">Or use a magic link</div>
              {sent ? (
                <div className="rounded-[10px] p-3 text-sm"
                     style={{ background:'rgba(106,247,209,.12)', border:'1px solid rgba(106,247,209,.28)', color:'#cbfff1' }}>
                  Check your email for a sign-in link. You can close this window.
                </div>
              ) : (
                <form onSubmit={sendMagicLink} className="grid gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e)=>setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="h-11 px-3 rounded-[10px] bg-transparent outline-none"
                    style={{ border:'1px solid rgba(255,255,255,.14)', color:'#e6f1ef' }}
                  />
                  <button
                    disabled={busy || !email.trim()}
                    className="h-11 rounded-[10px] font-semibold"
                    style={{ background: ACCENT, color:'#0b0c10', opacity: busy || !email.trim() ? .7 : 1 }}
                  >
                    {mode === 'signin' ? 'Send sign-in link' : 'Create account'}
                  </button>
                </form>
              )}

              <div className="mt-3 text-xs opacity-80">
                {mode === 'signin' ? (
                  <>New here? <button onClick={()=>setMode('signup')} className="underline">Create an account</button></>
                ) : (
                  <>Already have an account? <button onClick={()=>setMode('signin')} className="underline">Sign in</button></>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
