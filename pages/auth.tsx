// /pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

type Mode = 'signin' | 'signup';

const ACCENT = '#21e8c7';
const BG = '#0b0c10';

export default function AuthPage() {
  const router = useRouter();
  const queryMode = (router.query.mode === 'signup' ? 'signup' : 'signin') as Mode;
  const from = useMemo(
    () => (typeof router.query.from === 'string' ? router.query.from : '/builder'),
    [router.query.from]
  );

  const [mode, setMode] = useState<Mode>(queryMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // signup-only
  const [username, setUsername] = useState('');
  const [heardAbout, setHeardAbout] = useState('');

  // UX
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'contacting' | 'finalizing'>('idle');
  const [msg, setMsg] = useState<string | null>(typeof router.query.msg === 'string' ? router.query.msg : null);
  const [err, setErr] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    setMode(queryMode);
    setErr(null);
    setMsg(null);
    setVerifySent(false);
    setPhase('idle');
  }, [queryMode]);

  // If already signed in, bounce to "from"
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace(from || '/builder');
        return;
      }
      unsub = supabase.auth.onAuthStateChange((_e, sess) => {
        if (sess) router.replace(from || '/builder');
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, [from, router]);

  const switchMode = (m: Mode) => {
    router.replace({ pathname: '/auth', query: { mode: m, from } }, undefined, { shallow: true });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!email || !password) {
      setErr('Please fill your email and password.');
      return;
    }
    if (mode === 'signup' && (!username || username.trim().length < 3)) {
      setErr('Choose a username (3+ characters).');
      return;
    }

    try {
      setBusy(true);
      setPhase('checking');
      await delay(250);

      if (mode === 'signin') {
        setPhase('contacting');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setPhase('finalizing');
        localStorage.setItem('postAuthRedirect', from);
        await delay(350);
        router.replace(from);
      } else {
        setPhase('contacting');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: username,
              preferred_username: username,
              user_name: username,
              heard_about: heardAbout || 'unspecified',
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?from=${encodeURIComponent(from)}`,
          },
        });
        if (error) throw error;

        setPhase('finalizing');
        await delay(350);

        if (!data.session) {
          setVerifySent(true);
          setMsg('Account created! Verify your email, then sign in.');
          return;
        }
        localStorage.setItem('postAuthRedirect', `${from}?onboard=1&mode=signup`);
        router.replace(`${from}?onboard=1&mode=signup`);
      }
    } catch (e: any) {
      const m = (e?.message || '').toLowerCase();
      if (m.includes('invalid login credentials')) setErr('Wrong email or password.');
      else if (m.includes('email not confirmed')) setErr('Email not verified yet. Check your inbox.');
      else if (m.includes('already registered')) setErr('This email is already registered. Try signing in.');
      else setErr(e?.message || 'Something went wrong.');
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      setErr(null);
      setBusy(true);
      setPhase('contacting');
      localStorage.setItem(
        'postAuthRedirect',
        mode === 'signup' ? `${from}?onboard=1&mode=signup` : from
      );
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?from=${encodeURIComponent(from)}`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message || 'Could not open Google right now.');
      setBusy(false);
      setPhase('idle');
    }
  }

  return (
    <>
      <Head>
        <title>{mode === 'signup' ? 'Sign up' : 'Sign in'} · Reduc.ai</title>
      </Head>

      <main className="page">
        <div className="glow glow1" />
        <div className="glow glow2" />

        <div className="wrap">
          {/* LEFT — Auth card */}
          <section className="card auth appear">
            <div className="tabs">
              <button
                className={`tab ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => switchMode('signin')}
                disabled={busy}
              >
                Sign in
              </button>
              <button
                className={`tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => switchMode('signup')}
                disabled={busy}
              >
                Sign up
              </button>
            </div>

            {verifySent ? (
              <div className="verify">
                <h2>Check your email</h2>
                <p>We sent a verification link to <b>{email}</b>. After verifying, come back here to sign in.</p>
                <button className="ghost" onClick={() => setVerifySent(false)}>Use a different email</button>
              </div>
            ) : (
              <form className="form" onSubmit={handleSubmit}>
                {mode === 'signup' && (
                  <div className="row">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="input"
                    />
                    <select
                      value={heardAbout}
                      onChange={(e) => setHeardAbout(e.target.value)}
                      className="input"
                    >
                      <option value="">Where did you hear about us?</option>
                      <option value="twitter">Twitter / X</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                      <option value="friend">Friend / Colleague</option>
                      <option value="search">Google Search</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="input"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Create a password' : 'Password'}
                  className="input"
                />

                <button type="submit" className="primary" disabled={busy}>
                  {busy
                    ? phase === 'checking'
                      ? 'Checking…'
                      : phase === 'contacting'
                        ? (mode === 'signup' ? 'Creating your account…' : 'Signing you in…')
                        : 'Finalizing…'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Sign in'}
                </button>

                <div className="or">
                  <div className="line" />
                  <span>or</span>
                  <div className="line" />
                </div>

                <button type="button" className="google" onClick={handleGoogle} disabled={busy}>
                  <GoogleG />
                  Continue with Google
                </button>

                {(msg || err) && (
                  <div className="notice">
                    {msg && <div className="msg">{msg}</div>}
                    {err && <div className="err">{err}</div>}
                  </div>
                )}

                <div className="foot">You must {mode === 'signup' ? 'sign up' : 'sign in'} to continue.</div>
              </form>
            )}
          </section>

          {/* RIGHT — Welcome / trust */}
          <aside className="card welcome appear">
            <div className="welcomeHead">
              <div className="spark">✦</div>
              <h2>Welcome to Reduc.ai</h2>
            </div>
            <p className="p">
              Build and manage AI agents with clean onboarding and secure sessions.
            </p>
            <ul className="list">
              <li>● Email + password or Google</li>
              <li>● Secure sessions with Supabase Auth</li>
              <li>● You control your data</li>
            </ul>
          </aside>
        </div>
      </main>

      <style jsx>{`
        :global(html, body) { margin: 0; }
        .page {
          min-height: 100vh;
          background: ${BG};
          color: #fff;
          position: relative;
          overflow: hidden;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
        }
        .glow {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
          filter: blur(24px);
        }
        .glow1 { width: 740px; height: 740px; left: -180px; top: -160px; background: radial-gradient(circle, rgba(33,232,199,0.13), transparent 60%); }
        .glow2 { width: 660px; height: 660px; right: -200px; bottom: -180px; background: radial-gradient(circle, rgba(33,232,199,0.08), transparent 65%); }

        .wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 56px 24px;
          display: grid;
          gap: 24px;
          grid-template-columns: 1.2fr 0.8fr; /* shifted left */
          align-items: start;
        }

        .card {
          background: rgba(14,16,18,0.96);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px; /* outer less rounded per your note */
          box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 22px rgba(33,232,199,0.10);
          padding: 22px;
        }

        .appear { animation: fadeInUp 420ms ease-out both; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        /* AUTH */
        .auth { max-width: 640px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 18px; }
        .tab {
          flex: 1; padding: 10px 12px; border-radius: 14px;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.92);
          border: 1px solid rgba(255,255,255,0.08);
          font-weight: 700; cursor: pointer; transition: transform .08s ease, box-shadow .2s ease, background .2s ease;
        }
        .tab.active { background: ${ACCENT}; color: ${BG}; box-shadow: 0 0 8px rgba(33,232,199,0.18); }
        .tab:active { transform: scale(0.995); }

        .form { display: flex; flex-direction: column; gap: 10px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .input {
          width: 100%;
          border-radius: 14px; background: #0f1213;
          border: 1px solid #173a32; color: #fff;
          padding: 12px 14px; outline: none;
        }
        .input:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 2px rgba(33,232,199,0.08) inset; }

        .primary {
          border: 0; border-radius: 14px; padding: 12px 16px;
          background: ${ACCENT}; color: ${BG}; font-weight: 800; cursor: pointer;
          box-shadow: 0 0 8px rgba(33,232,199,0.16);
          transition: transform .08s ease, filter .2s ease, box-shadow .2s ease;
        }
        .primary:active { transform: scale(0.995); }
        .primary:disabled { opacity: .7; cursor: not-allowed; }

        .or { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.5); font-size: 12px; margin: 10px 0; }
        .line { height: 1px; background: rgba(255,255,255,0.10); flex: 1; }

        .google {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px 16px; border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.18); background: rgba(16,19,20,0.88);
          color: #fff; cursor: pointer; transition: transform .08s ease, box-shadow .2s ease;
        }
        .google:active { transform: scale(0.995); }
        .google:disabled { opacity: .7; cursor: not-allowed; }

        .notice {
          margin-top: 10px; border: 1px solid rgba(255,255,255,0.18);
          background: rgba(16,19,20,0.88); border-radius: 12px; padding: 10px;
          font-size: 14px;
        }
        .msg { color: rgba(255,255,255,0.92); }
        .err { color: #ff9aa3; }

        .foot { margin-top: 4px; font-size: 12px; color: rgba(255,255,255,0.55); }

        .verify h2 { margin: 0 0 6px; font-size: 18px; }
        .ghost {
          border: 1px solid rgba(255,255,255,0.2); background: rgba(16,19,20,0.88);
          color: #fff; padding: 8px 12px; border-radius: 10px; cursor: pointer;
        }

        /* WELCOME */
        .welcome .welcomeHead { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .welcome h2 { margin: 0; font-size: 20px; font-weight: 700; }
        .spark { color: ${ACCENT}; font-size: 18px; }
        .p { opacity: .82; margin: 0 0 12px; }
        .list { list-style: none; padding: 0; margin: 0; opacity: .9; display: grid; gap: 8px; }
        .list li { position: relative; padding-left: 0; }

        /* Responsive */
        @media (max-width: 980px) {
          .wrap { grid-template-columns: 1fr; }
          .auth { order: 1; }
          .welcome { order: 2; }
          .row { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="#4285F4" d="M255.88 133.5c0-10.9-.9-18.8-2.9-27.1H130.5v49.1h71.9c-1.5 12.3-9.6 30.9-27.6 43.4l-.3 2.1 40.1 31 2.8.3c25.8-23.8 38.4-58.8 38.4-98.9z"/>
      <path fill="#34A853" d="M130.5 261.1c36.7 0 67.5-12.1 89.9-32.8l-42.9-33.2c-11.5 8-27.1 13.6-47 13.6-35.9 0-66.3-23.8-77.2-56.6l-2 .2-42 32.5-.5 2c22.2 44.1 67.7 74.3 121.7 74.3z"/>
      <path fill="#FBBC05" d="M53.3 151.9c-2.9-8.3-4.6-17.2-4.6-26.4s1.7-18.1 4.6-26.4l-.1-1.8L10.7 64.3l-1.3.6C3.5 80.2 0 97.2 0 115.5s3.5 35.3 9.4 50.6l43.9-34.2z"/>
      <path fill="#EA4335" d="M130.5 50.5c25.5 0 42.7 11 52.6 20.2l38.4-37.5C198 12.1 167.2 0 130.5 0 76.5 0 31 30.2 9.4 64.9l43.9 34.2c10.9-32.8 41.3-48.6 77.2-48.6z"/>
    </svg>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
