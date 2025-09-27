// pages/account.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User as UserIcon, Sun, Moon, LogOut, KeyRound,
  CheckCircle2, AlertCircle, Crown, Zap, Loader2,
  ChevronRight, Palette, Shield, CreditCard, Eye, EyeOff, BadgeCheck, Globe
} from 'lucide-react';

/* ───────────────── Tokens (Dark + Light) ───────────────── */
const Tokens = () => (
  <style jsx global>{`
    /* Default/Dark (matches Voice Agent / Sidebar) */
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214; --text:#e6f1ef; --text-muted:#9fb4ad;
      --brand:#59d9b3; --brand-weak:rgba(89,217,179,.22);
      --border:rgba(255,255,255,.10); --border-weak:rgba(255,255,255,.10);
      --shadow-soft:0 18px 48px rgba(0,0,0,.20);
      --shadow-card:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset;
      --radius-outer:8px; --radius-inner:8px;
      --ease:cubic-bezier(.22,.61,.36,1);
      --control-h:40px;
    }

    /* Light tokens (clean slate version of the same style) */
    :root:not([data-theme="dark"]) .va-scope{
      --bg:#f7faf9;                 /* very light teal-tinted bg */
      --panel:#ffffff;              /* cards/panels are white */
      --card:#f4f7f6;               /* subtle card tint */
      --text:#0f172a;               /* slate-900 */
      --text-muted:#64748b;         /* slate-500/600 */
      --brand:#59d9b3;              /* same brand green */
      --brand-weak:rgba(89,217,179,.18);
      --border:rgba(15,23,42,.12);  /* darker border on light */
      --border-weak:rgba(15,23,42,.12);
      --shadow-soft:0 18px 48px rgba(2,6,12,.06);
      --shadow-card:0 10px 24px rgba(2,6,12,.06), 0 0 0 1px rgba(15,23,42,.06) inset;
      --radius-outer:8px; --radius-inner:8px;
      --ease:cubic-bezier(.22,.61,.36,1);
      --control-h:40px;
    }

    .va-card{
      border-radius:var(--radius-outer);
      border:1px solid var(--border-weak);
      background:var(--panel);
      box-shadow:var(--shadow-card);
      overflow:hidden;
      isolation:isolate;
    }
    .va-head{
      min-height:56px;
      display:grid;
      grid-template-columns:1fr auto;
      align-items:center;
      padding:0 16px;
      border-bottom:1px solid color-mix(in oklab, var(--border) 80%, transparent);
      color:var(--text);
      background:linear-gradient(
        90deg,
        var(--panel) 0%,
        color-mix(in oklab, var(--panel) 97%, white 3%) 50%,
        var(--panel) 100%
      );
    }
    .skeleton {
      background: linear-gradient(90deg, var(--card) 25%, var(--panel) 37%, var(--card) 63%);
      background-size: 200% 100%;
      animation: shimmer 1.2s linear infinite;
      display: inline-block;
    }
    @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }

    input.va-input {
      height: var(--control-h);
      border-radius: 8px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0 12px;
      outline: none;
    }
    .row {
      display: grid;
      grid-template-columns: 140px 1fr auto;
      align-items: center;
      gap: 10px;
    }
    .chip{
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 10px; border-radius:999px;
      background: color-mix(in oklab, var(--brand) 8%, var(--panel));
      border: 1px solid color-mix(in oklab, var(--brand) 35%, var(--border));
      color: var(--text); font-size: 12px;
    }
  `}</style>
);

/* ───────────────── Small helpers ───────────────── */
type ThemeMode = 'dark' | 'light';
type PlanTier = 'Free' | 'Pro';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/* ───────────────── Expandable Section ───────────────── */
function Section({
  title, icon, desc, children, defaultOpen = true
}:{
  title: string; icon?: React.ReactNode; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const innerRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<number>(0);
  const measure = () => { if (innerRef.current) setH(innerRef.current.offsetHeight); };
  useLayoutEffect(() => { measure(); }, [children, open]);

  return (
    <div className="mb-3">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>{title}</div>
      <div className="va-card">
        <button onClick={()=>setOpen(v=>!v)} className="va-head w-full text-left" style={{ color:'var(--text)' }}>
          <span className="min-w-0 flex items-center gap-3">
            {icon ? (
              <span className="inline-grid place-items-center w-7 h-7 rounded-full"
                    style={{ background:'rgba(89,217,179,.12)' }}>
                {icon}
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block font-semibold truncate" style={{ fontSize:'18px' }}>{title}</span>
              {desc ? <span className="block text-xs truncate" style={{ color:'var(--text-muted)' }}>{desc}</span> : null}
            </span>
          </span>
          <span className="justify-self-end">
            <ChevronRight className="w-4 h-4"
              style={{
                color:'var(--text-muted)',
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                transition:'transform 220ms var(--ease)'
              }}
            />
          </span>
        </button>

        <div
          style={{
            height: open ? h : 0,
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'height 260ms var(--ease), opacity 230ms var(--ease), transform 260ms var(--ease)',
            overflow:'hidden'
          }}
          onTransitionEnd={() => { if (open) measure(); }}
        >
          <div ref={innerRef} className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Page ───────────────── */
export default function AccountPage() {
  const router = useRouter();

  // boot & auth
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // User
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userCreated, setUserCreated] = useState<string | null>(null);

  // Providers
  the const [providers, setProviders] = useState<string[]>([]);
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false);
  const hasEmailPassword = providers.includes('email') || passwordEnabled;
  const hasGoogle = providers.includes('google');

  // Plan + usage (kept, but minimal)
  const [plan, setPlan] = useState<PlanTier>('Free');
  const [usage, setUsage] = useState({ requests: 0, limit: 10000 });

  // Theme (instant apply)
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [saveMsg, setSaveMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  // Profile editing
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  // Password flows
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<'idle' | 'sent' | 'err'>('idle');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const pwStrength = useMemo(() => {
    let s = 0;
    if (pw1.length >= 8) s++;
    if (/[A-Z]/.test(pw1)) s++;
    if (/[0-9]/.test(pw1)) s++;
    if (/[^A-Za-z0-9]/.test(pw1)) s++;
    return s;
  }, [pw1]);

  /* Auth boot: redirect if not signed in */
  useEffect(() => {
    let sub: { data?: { subscription?: { unsubscribe?: () => void } } } | null = null;

    (async () => {
      const { data: { session} } = await supabase.auth.getSession();
      if (!session) {
        setAuthChecked(true);
        setBooting(false);
        setLoading(false);
        router.replace('/login');
        return;
      }

      const u = session.user;
      setUserId(u?.id ?? null);
      const fullName = (u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? '';
      setUserName(fullName || null);
      setNameInput(fullName || '');
      setUserEmail(u?.email ?? null);
      setUserCreated(u?.created_at ?? null);

      // Providers
      const ids = ((u as any)?.identities || []) as Array<{ provider?: string }>;
      const provs = Array.from(new Set(ids.map(i => i?.provider).filter(Boolean))) as string[];
      setProviders(provs);
      const pwdMeta = (u?.user_metadata as any)?.password_enabled;
      setPasswordEnabled(Boolean(pwdMeta));

      const pt = (u?.user_metadata as any)?.plan_tier as PlanTier | undefined;
      if (pt && (pt === 'Free' || pt === 'Pro')) setPlan(pt);

      const used = (u?.user_metadata as any)?.requests_used;
      setUsage({ requests: typeof used === 'number' ? used : 0, limit: 10000 });

      setLoading(false);
      setBooting(false);
      setAuthChecked(true);

      // React to session changes
      sub = supabase.auth.onAuthStateChange((_evt, sess) => {
        const u2 = sess?.user;
        if (!u2) { router.replace('/login'); return; }
        setUserId(u2?.id ?? null);
        const fullName2 = (u2?.user_metadata as any)?.full_name ?? u2?.user_metadata?.name ?? '';
        setUserName(fullName2 || null);
        setNameInput(fullName2 || '');
        setUserEmail(u2?.email ?? null);
        setUserCreated(u2?.created_at ?? null);

        const ids2 = ((u2 as any)?.identities || []) as Array<{ provider?: string }>;
        const provs2 = Array.from(new Set(ids2.map(i => i?.provider).filter(Boolean))) as string[];
        setProviders(provs2);
        const pwdMeta2 = (u2?.user_metadata as any)?.password_enabled;
        setPasswordEnabled(Boolean(pwdMeta2));

        const pt2 = (u2?.user_metadata as any)?.plan_tier as PlanTier | undefined;
        if (pt2 && (pt2 === 'Free' || pt2 === 'Pro')) setPlan(pt2);
      });
    })();

    return () => sub?.data?.subscription?.unsubscribe?.();
  }, [router]);

  /* Theme init + workspace guard */
  useEffect(() => {
    try {
      // if not set, try system preference once
      const stored = (localStorage.getItem('ui:theme') as ThemeMode | null);
      const sys = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      const mode: ThemeMode = stored === 'light' || stored === 'dark' ? stored : sys as ThemeMode;
      setTheme(mode);
      document.documentElement.dataset.theme = mode;
    } catch {}
    try {
      const owner = localStorage.getItem('workspace:owner');
      if (userId) {
        if (owner && owner !== userId) localStorage.clear();
        localStorage.setItem('workspace:owner', userId);
      }
    } catch {}
  }, [userId]);

  const displayName = useMemo(() => {
    if (userName && userName.trim()) return userName.trim();
    if (userEmail && userEmail.includes('@')) return userEmail.split('@')[0];
    return 'Account';
  }, [userName, userEmail]);

  /* Instant theme switch */
  const setThemeInstant = async (mode: ThemeMode) => {
    try {
      setTheme(mode);
      document.documentElement.dataset.theme = mode;
      localStorage.setItem('ui:theme', mode);
      const { error } = await supabase.auth.updateUser({ data: { ui_theme: mode } });
      if (error) throw error;
      setSaveMsg('ok');
      // notify other parts (e.g., Sidebar) if they listen
      try { window.dispatchEvent(new Event('theme:change')); } catch {}
    } catch {
      setSaveMsg('err');
    } finally {
      setTimeout(() => setSaveMsg('idle'), 1800);
    }
  };

  /* Save display name */
  const saveName = async () => {
    if (savingName) return;
    setSavingName(true); setNameMsg('idle');
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: nameInput } });
      if (error) throw error;
      setUserName(nameInput);
      setNameMsg('ok');
    } catch {
      setNameMsg('err');
    } finally {
      setSavingName(false);
      setTimeout(()=>setNameMsg('idle'), 1800);
    }
  };

  /* Password helpers */
  const [pwError, setPwError] = useState('');
  const createPassword = async () => {
    if (!pw1 || pw1 !== pw2) { setNameMsg('idle'); setResetMsg('idle'); return setPwError('Passwords don’t match'); }
    if (pwStrength < 3) return setPwError('Use at least 8 chars with numbers & symbols');
    setPwError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { password_enabled: true } });
      setPasswordEnabled(true);
      setPw1(''); setPw2('');
      setProviders(prev => Array.from(new Set([...prev, 'email'])));
    } catch {
      setPwError('Could not set password. Try again.');
    }
  };

  const sendReset = async () => {
    if (!userEmail) return;
    setResetLoading(true); setResetMsg('idle');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) throw error;
      setResetMsg('sent');
    } catch {
      setResetMsg('err');
    } finally {
      setResetLoading(false);
      setTimeout(() => setResetMsg('idle'), 4000);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch {}
  };

  // Prevent flash after redirect
  if (authChecked && !userId) return null;

  return (
    <>
      <Head><title>Account • Reduc AI</title></Head>
      <Tokens />

      {/* Loader */}
      <AnimatePresence>
        {(booting || loading) && (
          <motion.div
            key="boot"
            className="fixed inset-0 z-50 flex items-center justify-center va-scope"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              background:
                'radial-gradient(1000px 500px at 50% -10%, var(--brand-weak), transparent 60%), var(--bg)',
              backdropFilter: 'blur(2px)', color: 'var(--text)'
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 py-5 rounded-[8px] va-card"
              style={{ boxShadow: 'var(--shadow-card)', border:'1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <div className="text-sm">Loading your settings…</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page */}
      <div className="min-h-screen va-scope" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <main className="w-full max-w-[1160px] mx-auto px-5 lg:px-6 pt-10 pb-24 grid grid-cols-1 md:grid-cols-[260px,1fr] gap-8">

          {/* Left nav */}
          <aside className="md:sticky md:top-10 h-fit">
            <div className="text-xl font-semibold mb-4">Settings</div>
            <nav className="space-y-2">
              <SettingsLink icon={<UserIcon className="w-4 h-4" />} label="Profile" href="#profile" />
              <SettingsLink icon={<Shield className="w-4 h-4" />} label="Security" href="#security" />
              <SettingsLink icon={<Palette className="w-4 h-4" />} label="Appearance" href="#appearance" />
              <SettingsLink icon={<CreditCard className="w-4 h-4" />} label="Plan & Billing" href="#billing" />
            </nav>
          </aside>

          {/* Right content */}
          <section className="space-y-6">

            {/* Profile */}
            <div id="profile" className="scroll-mt-16">
              <Section
                title="Profile"
                icon={<UserIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                desc="Your basic account info"
                defaultOpen
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full grid place-items-center"
                       style={{ background: 'color-mix(in oklab, var(--brand) 25%, transparent)' }}>
                    <UserIcon className="w-6 h-6" style={{ color: 'var(--text)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold truncate">
                      {loading ? <span className="inline-block h-5 w-40 rounded skeleton" /> : (displayName)}
                    </div>
                    <div className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                      {loading ? <span className="inline-block h-4 w-56 rounded skeleton" /> : (userEmail || '—')}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="row">
                    <span className="text-sm" style={{ color:'var(--text-muted)' }}>Display name</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="va-input w-full"
                        placeholder="Your name"
                        value={nameInput}
                        onChange={(e)=>setNameInput(e.target.value)}
                        onKeyDown={(e)=> e.key==='Enter' && saveName()}
                      />
                    </div>
                    <div className="justify-self-end">
                      <button
                        onClick={saveName}
                        disabled={savingName}
                        className="inline-flex items-center gap-2 px-3 h-[36px] rounded-[8px] border disabled:opacity-60 hover:translate-y-[-1px] transition"
                        style={{ borderColor:'var(--border)', background:'var(--panel)', color:'var(--text)' }}
                      >
                        {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="row">
                    <span className="text-sm" style={{ color:'var(--text-muted)' }}>Email</span>
                    <span className="text-sm truncate">{userEmail || '—'}</span>
                    <span />
                  </div>

                  <div className="row">
                    <span className="text-sm" style={{ color:'var(--text-muted)' }}>Created</span>
                    <span className="text-sm">{fmtDate(userCreated || undefined)}</span>
                    <span />
                  </div>

                  <AnimatePresence>
                    {nameMsg === 'ok' && (
                      <motion.div initial={{opacity:0, y:4}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-4}}
                                  className="text-sm inline-flex items-center gap-2"
                                  style={{ color: 'color-mix(in oklab, var(--brand) 75%, var(--text))' }}>
                        <CheckCircle2 className="w-4 h-4" /> Name updated
                      </motion.div>
                    )}
                    {nameMsg === 'err' && (
                      <motion.div initial={{opacity:0, y:4}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-4}}
                                  className="text-sm inline-flex items-center gap-2"
                                  style={{ color: 'crimson' }}>
                        <AlertCircle className="w-4 h-4" /> Couldn’t save name
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-4">
                    <button
                      onClick={signOut}
                      className="inline-flex items-center gap-2 px-4 h-[40px] rounded-[8px] border hover:translate-y-[-1px] transition"
                      style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </Section>
            </div>

            {/* Security */}
            <div id="security" className="scroll-mt-16">
              <Section
                title="Account & Security"
                icon={<Shield className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                desc="Sign-in methods and password"
                defaultOpen
              >
                <div className="grid gap-4">

                  {/* How they actually signed in */}
                  <div className="row">
                    <span className="text-sm" style={{ color:'var(--text-muted)' }}>Signed in with</span>
                    <div className="flex flex-wrap items-center gap-6">
                      {hasGoogle && (
                        <span className="chip">
                          <Globe className="w-4 h-4" />
                          Google
                        </span>
                      )}
                      {hasEmailPassword ? (
                        <span className="chip">
                          <KeyRound className="w-4 h-4" />
                          Email & Password
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                          No password set yet
                        </span>
                      )}
                    </div>
                    <span />
                  </div>

                  {/* Password area */}
                  {hasEmailPassword ? (
                    <>
                      <div className="row">
                        <span className="text-sm" style={{ color:'var(--text-muted)' }}>Change password</span>
                        <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                          For security, we can’t display your current password. Use a reset link to change it.
                        </div>
                        <div className="justify-self-end">
                          <button
                            onClick={sendReset}
                            disabled={!userEmail || resetLoading}
                            className="inline-flex items-center gap-2 px-4 h-[36px] rounded-[8px] border hover:translate-y-[-1px] transition disabled:opacity-60"
                            style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                          >
                            {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                            Send reset link
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {resetMsg === 'sent' && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="text-sm inline-flex items-center gap-2"
                            style={{ color: 'color-mix(in oklab, var(--brand) 75%, var(--text))' }}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Reset email sent to <span className="font-semibold">{userEmail}</span>. Check your inbox.
                          </motion.div>
                        )}
                        {resetMsg === 'err' && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="text-sm inline-flex items-center gap-2"
                            style={{ color: 'crimson' }}
                          >
                            <AlertCircle className="w-4 h-4" />
                            Couldn’t send reset link. Try again.
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <>
                      <div className="row">
                        <span className="text-sm" style={{ color:'var(--text-muted)' }}>Create password</span>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type={showPw ? 'text' : 'password'}
                              className="va-input w-full"
                              placeholder="New password"
                              value={pw1}
                              onChange={(e)=>setPw1(e.target.value)}
                            />
                            <button
                              onClick={()=>setShowPw(s=>!s)}
                              className="inline-grid place-items-center w-[40px] h-[40px] rounded-[8px] border"
                              style={{ borderColor:'var(--border)', background:'var(--panel)', color:'var(--text)' }}
                              title={showPw ? 'Hide' : 'Show'}
                            >
                              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <input
                            type={showPw ? 'text' : 'password'}
                            className="va-input w-full"
                            placeholder="Confirm password"
                            value={pw2}
                            onChange={(e)=>setPw2(e.target.value)}
                          />
                          <div className="h-1 w-full rounded overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div className="h-full" style={{
                              width: `${(pwStrength / 4) * 100}%`,
                              background: 'linear-gradient(90deg, var(--brand), color-mix(in oklab, var(--brand) 50%, white))',
                              transition: 'width 220ms var(--ease)'
                            }} />
                          </div>
                          {pwError && <div className="text-xs" style={{ color:'crimson' }}>{pwError}</div>}
                        </div>
                        <div className="justify-self-end">
                          <button
                            onClick={createPassword}
                            className="inline-flex items-center gap-2 px-4 h-[36px] rounded-[8px] border hover:translate-y-[-1px] transition"
                            style={{ borderColor:'var(--border)', background:'var(--panel)', color:'var(--text)' }}
                          >
                            <KeyRound className="w-4 h-4" />
                            Save password
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Section>
            </div>

            {/* Appearance */}
            <div id="appearance" className="scroll-mt-16">
              <Section
                title="Appearance"
                icon={<Palette className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                desc="Switch theme"
                defaultOpen
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ThemeTile label="Dark"  active={theme === 'dark'}  icon={<Moon className="w-4 h-4" />} onClick={() => setThemeInstant('dark')} />
                  <ThemeTile label="Light" active={theme === 'light'} icon={<Sun  className="w-4 h-4" />} onClick={() => setThemeInstant('light')} />
                </div>

                <AnimatePresence mode="popLayout">
                  {saveMsg === 'ok' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="inline-flex items-center gap-1 mt-4"
                      style={{ color: 'color-mix(in oklab, var(--brand) 75%, var(--text))' }}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Saved
                    </motion.span>
                  )}
                  {saveMsg === 'err' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="inline-flex items-center gap-1 mt-4"
                      style={{ color: 'crimson' }}
                    >
                      <AlertCircle className="w-4 h-4" /> Failed
                    </motion.span>
                  )}
                </AnimatePresence>
              </Section>
            </div>

            {/* Plan & Billing */}
            <div id="billing" className="scroll-mt-16">
              <Section
                title="Plan & Billing"
                icon={<CreditCard className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                desc="Your current subscription plan"
                defaultOpen={false}
              >
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg grid place-items-center"
                         style={{ background: 'color-mix(in oklab, var(--brand) 18%, transparent)' }}>
                      <Crown className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Plan & Billing</div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Current plan: <span className="font-semibold" style={{ color: 'var(--text)' }}>{plan}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    Usage: {usage.requests.toLocaleString()} / {usage.limit.toLocaleString()} requests
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/account/pricing"
                      className="inline-flex items-center gap-2 px-5 h-[40px] rounded-[8px] border hover:translate-y-[-1px]"
                      style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                    >
                      View pricing <ChevronRight className="w-4 h-4" />
                    </Link>

                    {plan !== 'Pro' && (
                      <a
                        href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 h-[40px] rounded-[8px] border font-semibold hover:translate-y-[-1px]"
                        style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--brand) 8%, var(--panel))', color: 'var(--text)' }}
                      >
                        <Zap className="w-4 h-4" /> Upgrade to Pro (€19.99/mo)
                      </a>
                    )}
                  </div>
                </motion.div>
              </Section>
            </div>

          </section>
        </main>
      </div>
    </>
  );
}

/* ───────────────── UI atoms ───────────────── */

function ThemeTile({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode; }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="rounded-[8px] p-4 text-left transition-all"
      style={{
        background: active ? 'color-mix(in oklab, var(--brand) 8%, var(--panel))' : 'var(--panel)',
        border: `1px solid ${active ? 'color-mix(in oklab, var(--brand) 30%, var(--border))' : 'var(--border)'}`,
        boxShadow: active ? 'inset 0 0 14px color-mix(in oklab, var(--brand) 14%, transparent), var(--shadow-card)' : 'var(--shadow-card)',
        color: 'var(--text)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[8px] grid place-items-center" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
          {icon}
        </div>
        <div className="font-semibold">{label}</div>
      </div>
      <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        {label === 'Light' ? 'Bright backgrounds and dark text.' : 'Dim backgrounds and light text.'}
      </div>
    </motion.button>
  );
}

function SettingsLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string; }) {
  return (
    <a
      href={href}
      className="w-full flex items-center justify-between rounded-[8px] px-3 h-[40px] border hover:translate-y-[-1px] transition"
      style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
    >
      <span className="flex items-center gap-2 text-sm">{icon}{label}</span>
      <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
    </a>
  );
}
