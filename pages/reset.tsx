// pages/reset.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';

const ACCENT = '#00ffc2';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [saving, setSaving] = useState(false);

  // When opening from email, Supabase sends a "code" param we must exchange for a session
  useEffect(() => {
    const doExchange = async () => {
      setStatus('Verifying link…');
      try {
        const code = typeof router.query.code === 'string' ? router.query.code : null;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        setStatus(null);
        setReady(true);
      } catch (e: any) {
        setErr(e?.message || 'Invalid or expired link.');
        setReady(false);
      }
    };
    if (router.isReady) doExchange();
  }, [router.isReady, router.query.code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!pw1 || pw1.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw1 !== pw2) { setErr('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setStatus('Password updated. Redirecting to sign in…');
      setTimeout(() => router.replace('/auth?mode=signin'), 900);
    } catch (e: any) {
      setErr(e?.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head><title>Reset password — Reduc AI</title></Head>
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background:'#0b0c10', color:'#fff' }}>
        <div
          className="w-full max-w-[520px] p-6 rounded-2xl"
          style={{
            background:'rgba(13,15,17,0.92)',
            border:'2px dashed rgba(106,247,209,0.32)',
            boxShadow:'0 30px 80px rgba(0,0,0,0.50), 0 0 26px rgba(106,247,209,0.18), inset 0 0 18px rgba(0,0,0,0.25)'
          }}
        >
          <h1 className="text-xl font-semibold mb-2">Reset your password</h1>
          {status && <div className="text-sm text-white/80 mb-3">{status}</div>}
          {err && <div className="text-sm mb-3" style={{ color:'#ff9aa2' }}>{err}</div>}

          {!ready ? (
            <div className="text-sm text-white/70">Preparing…</div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={pw1}
                onChange={(e)=>setPw1(e.target.value)}
                className="w-full rounded-xl bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pw2}
                onChange={(e)=>setPw2(e.target.value)}
                className="w-full rounded-xl bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
              />
              <button
                type="submit"
                disabled={saving}
                className="mt-1 py-3 rounded-xl font-semibold transition disabled:opacity-60"
                style={{ background: ACCENT, color:'#000', boxShadow:'0 0 14px rgba(106,247,209,0.28)' }}
              >
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
