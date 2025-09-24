// pages/account.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User as UserIcon, Mail, Calendar, Sun, Moon, Save, LogOut, KeyRound,
  CheckCircle2, AlertCircle, Crown, Zap, ShieldCheck, Loader2, LockKeyhole,
  ShieldAlert, ChevronRight, Palette, Shield, CreditCard, Box
} from 'lucide-react';

/** ─────────────────── Theme tokens (no hardcoded colors) ─────────────────── */
const UI = {
  brand: 'var(--brand)',
  brandWeak: 'var(--brand-weak)',
  bg: 'var(--bg)',
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',
  cardBg: 'var(--panel)',
  cardBorder: '1px solid var(--border)',
  cardShadow: 'var(--shadow-soft)',
  subBg: 'var(--card)',
  subBorder: '1px solid var(--border)',
  subShadow: 'var(--shadow-card)',
  rightEdgeShadow: '14px 0 28px rgba(0,0,0,.08)',
};

type ThemeMode = 'dark' | 'light';
type PlanTier = 'Free' | 'Pro';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

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
  const [userUpdated, setUserUpdated] = useState<string | null>(null);

  // Providers
  const [providers, setProviders] = useState<string[]>([]);
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false);
  const hasEmailPassword = providers.includes('email') || passwordEnabled;
  const hasGoogle = providers.includes('google');

  // Plan + usage (placeholder)
  const [plan, setPlan] = useState<PlanTier>('Free');
  const [usage, setUsage] = useState({ requests: 0, limit: 10000 });

  // Theme
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [savingTheme, setSavingTheme] = useState(false);
  const [saveMsg, setSaveMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  // Password flows
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<'idle' | 'sent' | 'err'>('idle');
  const [createPwLoading, setCreatePwLoading] = useState(false);
  const [createPwMsg, setCreatePwMsg] = useState<'idle' | 'ok' | 'err'>('idle');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  const pwStrength = useMemo(() => {
    let s = 0;
    if (pw1.length >= 8) s++;
    if (/[A-Z]/.test(pw1)) s++;
    if (/[0-9]/.test(pw1)) s++;
    if (/[^A-Za-z0-9]/.test(pw1)) s++;
    return s;
  }, [pw1]);

  /** ─────────────────── Auth boot: redirect if not signed in ───────────────────
   * - Keeps this page fully client-side.
   * - If there's no session, we push to /login and stop.
   */
  useEffect(() => {
    let sub: { data?: { subscription?: { unsubscribe?: () => void } } } | null = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setAuthChecked(true);
        setBooting(false);
        setLoading(false);
        router.replace('/login');
        return;
      }

      const u = session.user;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
      setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
      setUserCreated(u?.created_at ?? null);
      setUserUpdated(u?.updated_at ?? null);

      // Provider list (defensive: identities may be undefined)
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
        if (!u2) {
          router.replace('/login');
          return;
        }
        setUserId(u2?.id ?? null);
        setUserEmail(u2?.email ?? null);
        setUserName((u2?.user_metadata as any)?.full_name ?? u2?.user_metadata?.name ?? null);
        setUserCreated(u2?.created_at ?? null);
        setUserUpdated(u2?.updated_at ?? null);

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

  /** Theme init + owner guard (client-only) */
  useEffect(() => {
    try {
      const ls = (localStorage.getItem('ui:theme') as ThemeMode) || 'dark';
      setTheme(ls === 'light' ? 'light' : 'dark');
      document.documentElement.dataset.theme = ls === 'light' ? 'light' : 'dark';
    } catch {}
    try {
      const owner = localStorage.getItem('workspace:owner');
      if (userId && owner && owner !== userId) localStorage.clear();
      if (userId) localStorage.setItem('workspace:owner', userId);
    } catch {}
  }, [userId]);

  const displayName = useMemo(() => {
    if (userName && userName.trim()) return userName.trim();
    if (userEmail && userEmail.includes('@')) return userEmail.split('@')[0];
    return 'Account';
  }, [userName, userEmail]);

  const saveTheme = async () => {
    setSavingTheme(true);
    setSaveMsg('idle');
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('ui:theme', theme);
      const { error } = await supabase.auth.updateUser({ data: { ui_theme: theme } });
      if (error) throw error;
      setSaveMsg('ok');
    } catch {
      setSaveMsg('err');
    } finally {
      setSavingTheme(false);
      setTimeout(() => setSaveMsg('idle'), 1800);
    }
  };

  const sendReset = async () => {
    if (!userEmail) return;
    setResetLoading(true);
    setResetMsg('idle');
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
      setTimeout(() => setResetMsg('idle'), 3200);
    }
  };

  const refreshProviders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const ids = ((user as any)?.identities || []) as Array<{ provider?: string }>;
    const provs = Array.from(new Set(ids.map(i => i?.provider).filter(Boolean))) as string[];
    setProviders(provs);
    const pwdMeta = (user?.user_metadata as any)?.password_enabled;
    setPasswordEnabled(Boolean(pwdMeta));
  };

  const createPassword = async () => {
    if (!pw1 || pw1 !== pw2) {
      setCreatePwMsg('err'); setTimeout(() => setCreatePwMsg('idle'), 2000);
      return;
    }
    setCreatePwLoading(true); setCreatePwMsg('idle');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { password_enabled: true } });
      setPasswordEnabled(true);
      await refreshProviders();
      setCreatePwMsg('ok'); setPw1(''); setPw2('');
    } catch {
      setCreatePwMsg('err');
    } finally {
      setCreatePwLoading(false);
      setTimeout(() => setCreatePwMsg('idle'), 2800);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch {}
  };

  // If we already checked auth and redirected, render nothing to avoid flashing
  if (authChecked && !userId) {
    return null;
  }

  return (
    <>
      <Head><title>Account • Reduc AI</title></Head>

      {/* Loader */}
      <AnimatePresence>
        {(booting || loading) && (
          <motion.div
            key="boot"
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              background:
                'radial-gradient(1000px 500px at 50% -10%, var(--brand-weak), transparent 60%), var(--bg)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 py-5 rounded-2xl border"
              style={{ border: '1px solid var(--border)', background: UI.cardBg, boxShadow: UI.cardShadow }}
            >
              <div className="flex items-center gap-3" style={{ color: 'var(--text)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
                <div className="text-sm">Loading your settings…</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page */}
      <div className="min-h-screen" style={{ background: UI.bg, color: UI.text }}>
        <main className="w-full max-w-[1100px] mx-auto px-6 pt-10 pb-24 grid grid-cols-1 md:grid-cols-[260px,1fr] gap-8">

          {/* Left nav */}
          <aside className="md:sticky md:top-10 h-fit">
            <div className="text-xl font-semibold mb-4">Settings</div>
            <nav className="space-y-2">
              <SettingsLink icon={<UserIcon className="w-4 h-4" />} label="Profile" href="#profile" />
              <SettingsLink icon={<CreditCard className="w-4 h-4" />} label="Plan & Billing" href="#billing" />
            </nav>
          </aside>

          {/* Right content */}
          <section className="space-y-10">

            {/* Profile */}
            <div id="profile" className="scroll-mt-16">
              <Header icon={<UserIcon className="w-5 h-5" />} title="Profile" subtitle="Manage your account info, theme, and security" />

              <Card>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full grid place-items-center"
                         style={{ background: 'color-mix(in oklab, var(--brand) 25%, transparent)' }}>
                      <UserIcon className="w-6 h-6" style={{ color: 'var(--text)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">
                        {loading ? <span className="inline-block h-5 w-40 rounded skeleton" /> : displayName}
                      </div>
                      <div className="text-sm truncate" style={{ color: UI.textMuted }}>
                        {loading ? <span className="inline-block h-4 w-56 rounded skeleton" /> : (userEmail || '—')}
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 text-sm" style={{ color: 'var(--text)' }}>
                    <InfoRow icon={<Mail className="w-4 h-4" />}     label="Email"   value={userEmail || '—'} />
                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Created" value={fmtDate(userCreated || undefined)} />
                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Updated" value={fmtDate(userUpdated || undefined)} />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={signOut}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px]"
                      style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>

                    <div className="inline-flex items-center gap-2 text-xs" style={{ color: UI.textMuted }}>
                      <ShieldCheck className="w-4 h-4" />
                      Your workspace is private. After sign-in, everything starts from zero in your own space.
                    </div>
                  </div>
                </motion.div>
              </Card>

              {/* Appearance */}
              <SubHeader icon={<Palette className="w-4 h-4" />} title="Appearance" subtitle="Customize how the app looks" />
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ThemeTile label="Dark"  active={theme === 'dark'}  icon={<Moon className="w-4 h-4" />} onClick={() => setTheme('dark')} />
                  <ThemeTile label="Light" active={theme === 'light'} icon={<Sun  className="w-4 h-4" />} onClick={() => setTheme('light')} />
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={saveTheme}
                    disabled={savingTheme}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                  >
                    {savingTheme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save theme
                  </button>

                  <AnimatePresence mode="popLayout">
                    {saveMsg === 'ok' && (
                      <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1" style={{ color: 'color-mix(in oklab, var(--brand) 75%, var(--text))' }}>
                        <CheckCircle2 className="w-4 h-4" /> Saved
                      </motion.span>
                    )}
                    {saveMsg === 'err' && (
                      <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1" style={{ color: 'crimson' }}>
                        <AlertCircle className="w-4 h-4" /> Failed
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Card>

              {/* Account & Security */}
              <SubHeader icon={<Shield className="w-4 h-4" />} title="Account & Security" subtitle="Sign-in methods and password" />
              <Card>
                <div className="grid gap-4">
                  {/* Sign-in methods */}
                  <Band>
                    <div className="text-sm font-semibold mb-2">Sign-in methods</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
                      {hasEmailPassword ? (
                        <Badge>EMAIL &amp; PASSWORD</Badge>
                      ) : (
                        <BadgeMuted>
                          EMAIL &amp; PASSWORD <span className="ml-1 px-1 rounded" style={{ background: 'color-mix(in oklab, var(--brand) 60%, transparent)', color: 'var(--text)' }}>NOT SET</span>
                        </BadgeMuted>
                      )}
                      {hasGoogle && <Badge>GOOGLE</Badge>}
                    </div>
                  </Band>

                  {/* Create password */}
                  {!hasEmailPassword && (
                    <Band accent>
                      <div className="flex items-center gap-2 mb-2">
                        <LockKeyhole className="w-4 h-4" />
                        <div className="text-sm font-semibold">Create a password</div>
                      </div>
                      <p className="text-xs mb-3" style={{ color: UI.textMuted }}>
                        Add a password so you can also sign in with email + password.
                      </p>

                      <div className="grid gap-3">
                        <input
                          type="password"
                          className="w-full rounded-[10px] px-3 py-2 border outline-none"
                          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                          placeholder="New password"
                          value={pw1}
                          onChange={(e) => setPw1(e.target.value)}
                        />
                        <input
                          type="password"
                          className="w-full rounded-[10px] px-3 py-2 border outline-none"
                          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                          placeholder="Confirm password"
                          value={pw2}
                          onChange={(e) => setPw2(e.target.value)}
                        />
                        <div className="h-1 w-full rounded overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full" style={{ width: `${(pwStrength / 4) * 100}%`, background: 'linear-gradient(90deg, var(--brand), color-mix(in oklab, var(--brand) 50%, white))', transition: 'width 220ms var(--ease)' }} />
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={createPassword}
                            disabled={createPwLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                          >
                            {createPwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                            Create password
                          </button>

                          <AnimatePresence>
                            {createPwMsg === 'ok' && (
                              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1" style={{ color: 'color-mix(in oklab, var(--brand) 75%, var(--text))' }}>
                                <CheckCircle2 className="w-4 h-4" /> Saved
                              </motion.span>
                            )}
                            {createPwMsg === 'err' && (
                              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1" style={{ color: 'crimson' }}>
                                <ShieldAlert className="w-4 h-4" /> Check passwords
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </Band>
                  )}

                  {/* Change password */}
                  {hasEmailPassword && (
                    <Band>
                      <div className="flex items-center gap-2 mb-1">
                        <LockKeyhole className="w-4 h-4" />
                        <div className="text-sm font-semibold">Change password</div>
                      </div>
                      <p className="text-xs mb-3" style={{ color: UI.textMuted }}>
                        We’ll send a secure link to your email to update your password.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={sendReset}
                          disabled={!userEmail || resetLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                        >
                          {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          Send reset link
                        </button>

                        <AnimatePresence>
                          {resetMsg === 'sent' && (
                            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1" style={{ color: 'color-mix(in oklab, var(--brand) 75%, var(--text))' }}>
                              <CheckCircle2 className="w-4 h-4" /> Sent
                            </motion.span>
                          )}
                          {resetMsg === 'err' && (
                            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1" style={{ color: 'crimson' }}>
                              <AlertCircle className="w-4 h-4" /> Failed
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </Band>
                  )}
                </div>
              </Card>
            </div>

            {/* Plan & Billing */}
            <div id="billing" className="scroll-mt-16">
              <Header icon={<Box className="w-5 h-5" />} title="Current Plan" subtitle="Your current subscription plan" />
              <Card>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl grid place-items-center"
                         style={{ background: 'color-mix(in oklab, var(--brand) 18%, transparent)' }}>
                      <Crown className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Plan & Billing</div>
                      <div className="text-sm" style={{ color: UI.textMuted }}>
                        Current plan: <span className="font-semibold" style={{ color: 'var(--text)' }}>{plan}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs mb-4" style={{ color: UI.textMuted }}>
                    Usage: {usage.requests.toLocaleString()} / {usage.limit.toLocaleString()} requests
                  </div>

                  <div className="text-xs mb-6 flex items-center gap-2" style={{ color: UI.textMuted }}>
                    <ShieldCheck className="w-4 h-4" /> Free is demo-only. Upgrade to Pro for full features.
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/account/pricing"
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border hover:translate-y-[-1px]"
                      style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                    >
                      View pricing <ChevronRight className="w-4 h-4" />
                    </Link>

                    {plan !== 'Pro' && (
                      <a
                        href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border font-semibold hover:translate-y-[-1px]"
                        style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--brand) 8%, var(--card))', color: 'var(--text)' }}
                      >
                        <Zap className="w-4 h-4" /> Upgrade to Pro (€19.99/mo)
                      </a>
                    )}
                  </div>
                </motion.div>
              </Card>
            </div>

          </section>
        </main>
      </div>

      <style jsx>{`
        main { box-shadow: ${UI.rightEdgeShadow}; }
        .skeleton {
          background: linear-gradient(90deg, var(--card) 25%, var(--panel) 37%, var(--card) 63%);
          background-size: 200% 100%;
          animation: shimmer 1.2s linear infinite;
          display: inline-block;
        }
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
      `}</style>
    </>
  );
}

/* ---------------- UI bits ---------------- */

function Header({ icon, title, subtitle }:{ icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border"
              style={{ borderColor:'var(--border)', background:'var(--card)' }}>
          {icon}
        </span>
        <span>{title}</span>
      </div>
      {subtitle && <div className="text-sm ml-10 -mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
    </div>
  );
}

function SubHeader({ icon, title, subtitle }:{ icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mt-8 mb-3">
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border"
              style={{ borderColor:'var(--border)', background:'var(--card)' }}>
          {icon}
        </span>
        <span>{title}</span>
      </div>
      {subtitle && <div className="text-xs ml-8 mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-[18px] p-6"
      style={{ background: UI.cardBg, border: UI.cardBorder, boxShadow: UI.cardShadow }}
    >
      {children}
    </motion.section>
  );
}

function Band({ children, accent = false }:{ children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className="rounded-[12px] p-4"
      style={{
        background: accent ? 'color-mix(in oklab, var(--brand) 6%, var(--card))' : UI.subBg,
        border: accent ? `1px solid color-mix(in oklab, var(--brand) 35%, var(--border))` : UI.subBorder,
        boxShadow: UI.subShadow,
        color: 'var(--text)',
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className="w-28 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="truncate" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function ThemeTile({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode; }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="rounded-[14px] p-4 text-left transition-all"
      style={{
        background: active ? 'color-mix(in oklab, var(--brand) 8%, var(--card))' : 'var(--card)',
        border: `1px solid ${active ? 'color-mix(in oklab, var(--brand) 30%, var(--border))' : 'var(--border)'}`,
        boxShadow: active ? 'inset 0 0 14px color-mix(in oklab, var(--brand) 14%, transparent), var(--shadow-card)' : 'var(--shadow-card)',
        color: 'var(--text)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[10px] grid place-items-center" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
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
      className="w-full flex items-center justify-between rounded-[12px] px-3 py-2 border hover:translate-y-[-1px] transition"
      style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
    >
      <span className="flex items-center gap-2 text-sm">{icon}{label}</span>
      <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
    </a>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wide"
      style={{ borderColor: 'color-mix(in oklab, var(--brand) 35%, var(--border))', background: 'color-mix(in oklab, var(--brand) 8%, var(--card))', color: 'var(--text)' }}>
      {children}
    </span>
  );
}
function BadgeMuted({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wide"
      style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text-muted)' }}>
      {children}
    </span>
  );
}
