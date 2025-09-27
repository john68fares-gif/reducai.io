// pages/post-auth.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

type Status = 'exchanging' | 'checking' | 'redirecting' | 'error';

const Tokens = () => (
  <style jsx global>{`
    :root{
      --bg:#0a0c0e; --bg-2:#0b1013; --bg-3:#0c1216;
      --nav-grad: linear-gradient(90deg, rgba(10,12,14,.92) 0%, rgba(12,18,16,.92) 40%, rgba(20,36,31,.92) 100%);
      --section-1: radial-gradient(1100px 660px at 50% -10%, rgba(89,217,179,.18), transparent 60%), #0a0c0e;
      --panel:#0f1417; --card:#11181b; --text:#e9f4f1; --muted:#9eb7af;
      --brand:#59d9b3; --line:rgba(89,217,179,.22); --border:rgba(255,255,255,.08);
      --radius:22px; --shadow:0 26px 64px rgba(0,0,0,.42);
    }
    @font-face{
      font-family:'MovaTiff';
      src:url('/fonts/MovaTiff.woff2') format('woff2');
      font-weight: 400 900; font-style: normal; font-display: swap;
    }
    html,body{ background:var(--bg); color:var(--text); }
    body{ font-family: MovaTiff, Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

    .btn{
      position:relative; display:inline-flex; align-items:center; justify-content:center; gap:10px;
      height:48px; padding:0 22px; border-radius:9999px;
      background: var(--brand); color:#fff; border:1px solid var(--line);
      box-shadow:0 16px 44px rgba(89,217,179,.32), inset 0 0 0 1px rgba(255,255,255,.08);
      transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
    }
    .btn:hover{ transform: scale(1.04); box-shadow: 0 24px 64px rgba(89,217,179,.38), inset 0 0 0 1px rgba(255,255,255,.10); }

    .card{
      background:
        radial-gradient(120% 100% at 0% 0%, rgba(89,217,179,.16), transparent 55%),
        var(--card);
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow: 0 0 0 1px rgba(89,217,179,.25) inset, 0 18px 60px rgba(89,217,179,.18);
    }

    /* full-section grid */
    .hero-grid{
      position:absolute; inset:0; pointer-events:none; z-index:0;
      opacity:.34;
      background:
        linear-gradient(to right, rgba(89,217,179,.28) 1px, transparent 1px) 0 0/28px 28px,
        linear-gradient(to bottom, rgba(89,217,179,.28) 1px, transparent 1px) 0 0/28px 28px;
      filter: drop-shadow(0 0 24px rgba(89,217,179,.18));
    }
  `}</style>
);

export default function PostAuth() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('exchanging');
  const [msg, setMsg] = useState('Completing sign-in…');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hasCode = params.has('code') || params.has('access_token');

        // If URL has an auth code/token -> do the PKCE exchange.
        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        } else {
          // No code in URL. If we already have a session, continue; otherwise send home to start OAuth.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setStatus('error');
            setMsg('invalid request: both auth code and code verifier should be non-empty');
            return;
          }
        }

        // Now decide where to go.
        setStatus('checking');
        setMsg('Checking your account…');

        const resp = await fetch('/api/user-status', { credentials: 'include' });
        if (!resp.ok) {
          setStatus('redirecting');
          setMsg('Loading your dashboard…');
          router.replace('/builder');
          return;
        }

        const data = await resp.json() as {
          hasAccount: boolean;
          hasSubscription: boolean;
          paymentLink?: string | null;
        };

        if (data.hasAccount || data.hasSubscription) {
          setStatus('redirecting');
          setMsg('Welcome back! Loading your dashboard…');
          router.replace('/builder');
          return;
        }

        const paymentLink = data.paymentLink || process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || '';
        if (paymentLink) {
          setStatus('redirecting');
          setMsg('Almost done — opening payment…');
          window.location.replace(paymentLink);
          return;
        }

        setStatus('redirecting');
        setMsg('Choose a plan to continue…');
        router.replace('/pricing');
      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMsg(e?.message || 'Sign-in failed. Please try again.');
      }
    })();
  }, [router]);

  return (
    <>
      <Head><title>Welcome • ReducAI</title></Head>
      <Tokens />

      <section style={{ minHeight:'100vh', display:'grid', placeItems:'center', position:'relative', background:'var(--section-1)' }}>
        <div className="hero-grid" />

        <div className="card relative z-[1] w-[92%] max-w-[560px] p-8 text-center">
          <h1 style={{ fontSize:'38px', fontWeight:900, letterSpacing:'-.02em' }}>
            Welcome to <span style={{ color:'var(--brand)' }}>ReducAI</span>
          </h1>
          <p className="mt-3" style={{ color:'var(--muted)' }}>{msg}</p>

          {status !== 'error' ? (
            <div className="mt-6 inline-flex items-center gap-3" aria-live="polite">
              <span className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor:'color-mix(in oklab, var(--text) 40%, transparent)', borderTopColor:'var(--brand)' }} />
              <span style={{ color:'var(--muted)' }}>
                {status === 'exchanging' && 'Finishing sign-in…'}
                {status === 'checking' && 'Verifying your subscription…'}
                {status === 'redirecting' && 'Redirecting…'}
              </span>
            </div>
          ) : (
            <div className="mt-7 flex items-center justify-center gap-3">
              <button className="btn" onClick={() => router.replace('/')}>Back to homepage</button>
              <button className="btn" onClick={() => router.replace('/pricing')}>See pricing</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
