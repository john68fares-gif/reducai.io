// /pages/index.tsx
import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import {
  Menu as MenuIcon, X, ArrowRight, CheckCircle2, Loader2, Mail, Globe, Shield, Zap,
} from 'lucide-react';

/** --- Design Tokens (dark-first) --- */
const Tokens = () => (
  <style jsx global>{`
    :root {
      --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214; --text:#e6f1ef; --muted:#9fb4ad;
      --brand:#59d9b3; --brand-weak:rgba(89,217,179,.16);
      --border:rgba(255,255,255,.10);
      --radius:12px; --ease:cubic-bezier(.22,.61,.36,1);
      --shadow:0 30px 80px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.06) inset;
      --shadow-soft:0 18px 48px rgba(0,0,0,.22);
      --max:1160px;
    }
    body { background: var(--bg); color: var(--text); }
    .container { width:100%; max-width: var(--max); margin: 0 auto; padding: 0 20px; }
    .btn { height:44px; padding:0 16px; border-radius:10px; display:inline-flex; align-items:center; gap:10px; font-weight:700; border:1px solid transparent; }
    .btn-primary { background: var(--brand); color:#fff; box-shadow: 0 10px 24px rgba(89,217,179,.35); }
    .btn-primary:hover { filter: brightness(1.02); transform: translateY(-1px); transition: all .15s var(--ease); }
    .btn-ghost { background: transparent; border-color: var(--border); color: var(--text); }
    .card { background: var(--panel); border:1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
    .pill { border-radius:999px; padding:6px 10px; border:1px solid color-mix(in oklab, var(--brand) 40%, var(--border)); background: color-mix(in oklab, var(--brand) 8%, var(--panel)); font-size:12px; color: var(--text); }
    .muted { color: var(--muted); }
    .section { padding: 96px 0; }
    .hero { padding: 120px 0 80px; position: relative; overflow: clip; }
    .hero::before{
      content:''; position:absolute; inset:-20% -10% auto -10%; height: 560px;
      background: radial-gradient(700px 350px at 0% 0%, var(--brand-weak), transparent 60%);
      pointer-events:none; filter: blur(0.5px);
    }
    .grid-2 { display:grid; grid-template-columns: 1fr; gap: 28px; }
    @media (min-width: 980px){ .grid-2 { grid-template-columns: 1.2fr 1fr; } }
    .logo-dot { width:14px; height:14px; border-radius:4px; background: var(--brand); display:inline-block; box-shadow: 0 0 0 3px rgba(89,217,179,.15); }
    nav a { color: var(--muted); text-decoration:none; }
    nav a:hover { color: var(--text); }
    .feature { display:flex; align-items:flex-start; gap:12px; }
    .hr { height:1px; background: var(--border); border:0; }
    .pricing-card { position:relative; overflow:hidden; }
    .pricing-card .badge { position:absolute; right:12px; top:12px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(8,10,12,.72); display:grid; place-items:center; z-index:10000; }
    .modal { width:100%; max-width: 520px; border-radius:14px; background:linear-gradient(180deg, #0d1012, #0c0f10); border:1px solid rgba(89,217,179,.18); box-shadow: var(--shadow-soft); }
    .input { height:44px; border-radius:10px; background: var(--panel); border:1px solid var(--border); color: var(--text); padding: 0 12px; outline:none; width:100%; }
    .otp { letter-spacing: .28em; text-align:center; }
  `}</style>
);

/** --- Sign-in Modal (Email OTP or Google) --- */
function SignInModal({
  open, onClose, defaultEmail = '', postLoginPath = '/builder',
}: { open: boolean; onClose: () => void; defaultEmail?: string; postLoginPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [stage, setStage] = useState<'method'|'code'|'sending'|'verifying'>('method');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(()=>{ if(!open){ setStage('method'); setEmail(defaultEmail); setCode(''); setError(''); } }, [open, defaultEmail]);

  const sendOtp = async () => {
    try {
      if (!email || !email.includes('@')) { setError('Enter a valid email.'); return; }
      setError(''); setStage('sending');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
      setStage('code');
    } catch (e:any) {
      setStage('method'); setError(e?.message || 'Could not send code.');
    }
  };

  const verifyOtp = async () => {
    try {
      if (!email || !code) return;
      setError(''); setStage('verifying');
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
      if (error) throw error;
      if (data?.session) { onClose(); router.replace(postLoginPath); }
      else throw new Error('Invalid code.');
    } catch (e:any) {
      setStage('code'); setError(e?.message || 'Invalid code, try again.');
    }
  };

  const loginGoogle = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/auth/callback` },
      });
      // OAuth will redirect; no further action here.
    } catch (e:any) {
      setError(e?.message || 'Google sign-in failed.');
    }
  };

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} aria-modal aria-label="Sign in">
      <div className="modal card" onClick={(e)=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:'16px 18px', borderBottom:'1px solid rgba(89,217,179,.18)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:18 }}>Welcome Back</div>
          <button onClick={onClose} className="btn btn-ghost" style={{ height:34, padding:'0 10px' }} aria-label="Close"><X className="w-4 h-4"/></button>
        </div>

        {/* Body */}
        <div style={{ padding:18 }}>
          {stage === 'method' && (
            <>
              <label className="muted" style={{ fontSize:12 }}>Email Address</label>
              <input className="input" placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <button className="btn btn-primary" style={{ width:'100%', marginTop:12 }}
                onClick={sendOtp}>
                <Mail className="w-4 h-4" /> Continue with Email
              </button>

              <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:8, marginTop:14 }}>
                <span className="hr" />
                <span className="muted" style={{ fontSize:12 }}>or continue with</span>
                <span className="hr" />
              </div>

              <button className="btn btn-ghost" style={{ width:'100%', marginTop:12, background:'#fff', color:'#222', borderColor:'rgba(0,0,0,.12)' }}
                onClick={loginGoogle}>
                <img alt="" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18}/>
                Continue with Google
              </button>
            </>
          )}

          {stage === 'sending' && (
            <div style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 0' }}>
              <Loader2 className="w-4 h-4 animate-spin"/><div>Sending code to <b>{email}</b>…</div>
            </div>
          )}

          {stage === 'code' && (
            <>
              <div className="muted" style={{ fontSize:14, marginBottom:6 }}>
                We emailed a 6-digit code to <b style={{ color:'#fff' }}>{email}</b>.
              </div>
              <input
                className="input otp"
                placeholder="••••••"
                maxLength={6}
                value={code}
                onChange={(e)=>setCode(e.target.value.replace(/[^0-9]/g,''))}
              />
              <button className="btn btn-primary" style={{ width:'100%', marginTop:12 }} onClick={verifyOtp}>
                {stage === 'verifying' ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4" />}
                Verify & Continue
              </button>
              <button className="btn btn-ghost" style={{ width:'100%', marginTop:8 }} onClick={()=>setStage('method')}>
                Use a different email
              </button>
            </>
          )}

          {!!error && <div style={{ marginTop:10, color:'#ff6b6b', fontSize:12 }}>{error}</div>}

          <div className="muted" style={{ fontSize:12, marginTop:14 }}>
            By signing in you agree to our Terms of Service & Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}

/** --- Page --- */
export default function Home() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthed(Boolean(session));
    })();
  }, []);

  const goPricing = () => router.push('/pricing'); // trial/plan flows page
  const goBuilderIfAuthed = () => authed ? router.push('/builder') : setModalOpen(true);

  return (
    <>
      <Head>
        <title>Reduc.ai — Ship voice that sells</title>
        <meta name="description" content="Build a natural-sounding voice agent your users actually enjoy." />
      </Head>
      <Tokens />

      {/* Nav */}
      <header style={{ position:'sticky', top:0, zIndex:50, borderBottom:'1px solid var(--border)', background:'rgba(11,12,16,.78)', backdropFilter:'blur(6px)' }}>
        <div className="container" style={{ display:'flex', alignItems:'center', height:66, gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, fontWeight:800 }}>
            <span className="logo-dot" aria-hidden />
            <span>Reduc.ai</span>
          </div>
          <nav style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:18, fontSize:14 }}>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <button className="btn btn-primary" onClick={()=>setModalOpen(true)}>Sign in / Sign up</button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container grid-2" style={{ alignItems:'center' }}>
          <div>
            <div className="pill" style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <Zap className="w-4 h-4" /> Launch a voice agent in minutes
            </div>
            <h1 style={{ fontSize:48, lineHeight:1.05, margin:'8px 0 16px', fontWeight:800 }}>
              Build a <span style={{ color:'var(--brand)' }}>natural-sounding</span> voice agent your users actually enjoy.
            </h1>
            <p className="muted" style={{ maxWidth:640 }}>
              Reduc.ai gives you realtime voice, smart call flow, and tool integrations—without the yak-shaving.
              Ship a production agent today, not next quarter.
            </p>

            <div style={{ display:'flex', gap:12, marginTop:16, flexWrap:'wrap' }}>
              <button className="btn btn-primary" onClick={goPricing}>
                Try free <ArrowRight className="w-4 h-4" />
              </button>
              <button className="btn btn-ghost" onClick={goBuilderIfAuthed}>
                See how it works
              </button>
            </div>

            <div style={{ display:'flex', gap:18, marginTop:18, flexWrap:'wrap' }}>
              <span className="muted" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <Shield className="w-4 h-4" /> Safe by default
              </span>
              <span className="muted" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <Globe className="w-4 h-4" /> Realtime turn-taking
              </span>
            </div>
          </div>

          <div className="card" style={{ padding:16 }}>
            <div className="muted" style={{ fontSize:12, marginBottom:8 }}>Live demo preview</div>
            <div className="card" style={{ padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div className="pill" style={{ background:'rgba(89,217,179,.12)' }}>Riley (Scheduling)</div>
                <span className="muted" style={{ fontSize:12, marginLeft:'auto' }}>Uses your own key</span>
              </div>
              <div className="card" style={{ padding:14 }}>
                “Hi! I can help you book, reschedule, or answer questions. What can I do for you today?”
              </div>
              <div className="muted" style={{ fontSize:12, marginTop:8 }}>
                Barge-in • Filler word control • Micro-pauses • Phone filtering
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos spacer */}
      <section className="section" style={{ paddingTop:24 }}>
        <div className="container" style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:18, opacity:.8 }}>
          <div className="muted" style={{ textAlign:'center' }}>ACME</div>
          <div className="muted" style={{ textAlign:'center' }}>GLOBEX</div>
          <div className="muted" style={{ textAlign:'center' }}>UMBRELLA</div>
          <div className="muted" style={{ textAlign:'center' }}>STARK</div>
          <div className="muted" style={{ textAlign:'center' }}>HOOLI</div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="section">
        <div className="container">
          <h2 style={{ fontSize:32, fontWeight:800, marginBottom:8 }}>Everything you need</h2>
          <p className="muted" style={{ marginBottom:24 }}>Production voice, tool calls, analytics, and guardrails.</p>

          <div className="grid-2" style={{ gridTemplateColumns:'repeat(2,1fr)' as any }}>
            {[
              ['Realtime, human-like voice', 'Natural back-and-forth with micro-pauses and barge-in.'],
              ['Smart call flow', 'Guide users toward booking, purchase, or escalation.'],
              ['Tool integrations', 'Connect to calendars, CRMs, and your APIs.'],
              ['Safe by default', 'Policies and fallbacks prevent awkward outcomes.'],
            ].map(([t, s], i)=>(
              <div key={i} className="card" style={{ padding:18 }}>
                <div className="feature">
                  <CheckCircle2 className="w-5 h-5" style={{ color:'var(--brand)' }}/>
                  <div>
                    <div style={{ fontWeight:700, marginBottom:4 }}>{t}</div>
                    <div className="muted">{s}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="section">
        <div className="container grid-2">
          <div>
            <h2 style={{ fontSize:32, fontWeight:800, marginBottom:8 }}>How it works</h2>
            <ol className="muted" style={{ lineHeight:1.7 }}>
              <li><b>Pick a template</b> (Scheduling, Support, Sales).</li>
              <li><b>Paste your business facts</b> or import your website.</li>
              <li><b>Connect tools</b> (calendars, webhooks).</li>
              <li><b>Click “Publish”</b> and share the number or embed the widget.</li>
            </ol>
            <div style={{ marginTop:16 }}>
              <button className="btn btn-primary" onClick={()=>setModalOpen(true)}>
                Get started free
              </button>
            </div>
          </div>
          <div className="card" style={{ padding:18 }}>
            <div className="muted" style={{ fontSize:12, marginBottom:6 }}>Sample flow</div>
            <img alt="" src="https://dummyimage.com/680x420/0f1214/59d9b3.png&text=Flow+Builder" style={{ width:'100%', borderRadius:10, border:'1px solid var(--border)' }}/>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section">
        <div className="container">
          <h2 style={{ fontSize:32, fontWeight:800, marginBottom:8 }}>FAQ</h2>
          <div className="grid-2" style={{ gridTemplateColumns:'repeat(2,1fr)' as any }}>
            {[
              ['Is there a free trial?', 'Yes. Start on the Starter plan with a 3-week free trial.'],
              ['Can I use Google to sign in?', 'Yes, one click with Google or use a code sent to your email.'],
              ['Can it call my APIs?', 'Yep. Use webhooks or connect common tools.'],
              ['Is my data safe?', 'Sessions are secured with Supabase Auth and stored in your region.'],
            ].map(([q, a], i)=>(
              <div key={i} className="card" style={{ padding:18 }}>
                <div style={{ fontWeight:700, marginBottom:6 }}>{q}</div>
                <div className="muted">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid var(--border)' }}>
        <div className="container" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 0' }}>
          <div className="muted">© {new Date().getFullYear()} Reduc.ai</div>
          <div className="muted" style={{ display:'flex', gap:14 }}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <SignInModal open={modalOpen} onClose={()=>setModalOpen(false)} />
    </>
  );
}
