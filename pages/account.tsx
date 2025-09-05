// pages/account.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Sun,
  Moon,
  Save,
  LogOut,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Crown,
  Zap,
  Check,
  ShieldCheck,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  ChevronRight,
  Palette,
  Shield,
  CreditCard,
  Box,
} from 'lucide-react';

const UI = {
  bg: 'var(--bg)',
  fg: 'var(--text)',
  cardBg: 'rgba(13,15,17,0.92)',
  cardBorder: '1px solid rgba(106,247,209,0.22)',
  cardShadow:
    '0 12px 34px rgba(0,0,0,0.5), inset 0 0 26px rgba(0,0,0,0.38), 0 0 18px rgba(0,255,194,0.06)',
  hoverShadow:
    '0 18px 48px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.45), 0 0 28px rgba(0,255,194,0.12)',
};

type ThemeMode = 'dark' | 'light';
type PlanTier = 'Free' | 'Pro';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AccountPage() {
  // Loader
  const [booting, setBooting] = useState(true);

  // User
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userCreated, setUserCreated] = useState<string | null>(null);
  const [userUpdated, setUserUpdated] = useState<string | null>(null);

  // Providers
  const [providers, setProviders] = useState<string[]>([]);
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false); // metadata flag
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

  // Strength meter (lightweight)
  const pwStrength = useMemo(() => {
    let s = 0;
    if (pw1.length >= 8) s++;
    if (/[A-Z]/.test(pw1)) s++;
    if (/[0-9]/.test(pw1)) s++;
    if (/[^A-Za-z0-9]/.test(pw1)) s++;
    return s; // 0..4
  }, [pw1]);

  // Fetch user
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserCreated(user?.created_at ?? null);
      setUserUpdated(user?.updated_at ?? null);

      const ids = (user as any)?.identities || [];
      const provs = Array.from(new Set(ids.map((i: any) => i?.provider).filter(Boolean)));
      setProviders(provs);

      const pwdMeta = (user?.user_metadata as any)?.password_enabled;
      setPasswordEnabled(Boolean(pwdMeta));

      const p = (user?.user_metadata as any)?.plan_tier as PlanTier | undefined;
      if (p && (p === 'Free' || p === 'Pro')) setPlan(p);

      const u = (user?.user_metadata as any)?.requests_used;
      setUsage({ requests: typeof u === 'number' ? u : 0, limit: 10000 });

      setLoading(false);
      setTimeout(() => setBooting(false), 420);

      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u2 = session?.user;
        setUserId(u2?.id ?? null);
        setUserEmail(u2?.email ?? null);
        setUserName((u2?.user_metadata as any)?.full_name ?? u2?.user_metadata?.name ?? null);
        setUserCreated(u2?.created_at ?? null);
        setUserUpdated(u2?.updated_at ?? null);

        const ids2 = (u2 as any)?.identities || [];
        const provs2 = Array.from(new Set(ids2.map((i: any) => i?.provider).filter(Boolean)));
        setProviders(provs2);

        const pwdMeta2 = (u2?.user_metadata as any)?.password_enabled;
        setPasswordEnabled(Boolean(pwdMeta2));

        const pt = (u2?.user_metadata as any)?.plan_tier as PlanTier | undefined;
        if (pt && (pt === 'Free' || pt === 'Pro')) setPlan(pt);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  // Theme init + Per-user workspace guard
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
    const ids = (user as any)?.identities || [];
    const provs = Array.from(new Set(ids.map((i: any) => i?.provider).filter(Boolean)));
    setProviders(provs);
    const pwdMeta = (user?.user_metadata as any)?.password_enabled;
    setPasswordEnabled(Boolean(pwdMeta));
  };

  const createPassword = async () => {
    if (!pw1 || pw1 !== pw2) {
      setCreatePwMsg('err');
      setTimeout(() => setCreatePwMsg('idle'), 2000);
      return;
    }
    setCreatePwLoading(true);
    setCreatePwMsg('idle');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;

      // Persist flag so UI flips instantly even if providers don't refresh yet
      await supabase.auth.updateUser({ data: { password_enabled: true } });
      setPasswordEnabled(true);

      await refreshProviders();
      setCreatePwMsg('ok');
      setPw1(''); setPw2('');
    } catch {
      setCreatePwMsg('err');
    } finally {
      setCreatePwLoading(false);
      setTimeout(() => setCreatePwMsg('idle'), 2800);
    }
  };

  const signOut = async () => { try { await supabase.auth.signOut(); } catch {} };

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
                'radial-gradient(1000px 500px at 50% -10%, rgba(0,255,194,0.10), transparent 60%), #0b0c10',
              backdropFilter: 'blur(2px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 py-5 rounded-2xl border"
              style={{ border: '1px solid rgba(106,247,209,0.25)', background: UI.cardBg, boxShadow: UI.cardShadow }}
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
      <div className="min-h-screen" style={{ background: UI.bg, color: UI.fg }}>
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

              {/* Profile Card */}
              <Card>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,255,194,0.22)' }}>
                      <UserIcon className="w-6 h-6 text-black/80" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">
                        {loading ? <span className="inline-block h-5 w-40 bg-white/10 rounded animate-pulse" /> : displayName}
                      </div>
                      <div className="text-white/70 text-sm truncate">
                        {loading ? <span className="inline-block h-4 w-56 bg-white/5 rounded animate-pulse" /> : (userEmail || '—')}
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 text-sm text-white/85">
                    <InfoRow icon={<Mail className="w-4 h-4 text-white/70" />} label="Email"   value={userEmail || '—'} />
                    <InfoRow icon={<Calendar className="w-4 h-4 text-white/70" />} label="Created" value={fmtDate(userCreated || undefined)} />
                    <InfoRow icon={<Calendar className="w-4 h-4 text-white/70" />} label="Updated" value={fmtDate(userUpdated || undefined)} />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={signOut}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px]"
                      style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>

                    <div className="inline-flex items-center gap-2 text-xs text-white/70">
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
                    style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                  >
                    {savingTheme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save theme
                  </button>

                  <AnimatePresence mode="popLayout">
                    {saveMsg === 'ok' && (
                      <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1 text-[#57f0c6]">
                        <CheckCircle2 className="w-4 h-4" /> Saved
                      </motion.span>
                    )}
                    {saveMsg === 'err' && (
                      <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1 text-[#ff9db1]">
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                      {hasEmailPassword ? (
                        <Badge>EMAIL & PASSWORD</Badge>
                      ) : (
                        <BadgeMuted>
                          EMAIL & PASSWORD <span className="ml-1 px-1 rounded bg-[#0b5cff] text-white">NOT SET</span>
                        </BadgeMuted>
                      )}
                      {hasGoogle && <Badge>GOOGLE</Badge>}
                    </div>
                  </Band>

                  {/* Create password (if Google-only) */}
                  {!hasEmailPassword && (
                    <Band accent>
                      <div className="flex items-center gap-2 mb-2">
                        <LockKeyhole className="w-4 h-4" />
                        <div className="text-sm font-semibold">Create a password</div>
                      </div>
                      <p className="text-xs text-white/80 mb-3">Add a password so you can also sign in with email + password.</p>

                      <div className="grid gap-3">
                        <input type="password" className="w-full rounded-[10px] px-3 py-2 bg-black/20 border border-white/10 outline-none"
                               placeholder="New password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
                        <input type="password" className="w-full rounded-[10px] px-3 py-2 bg-black/20 border border-white/10 outline-none"
                               placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                        <div className="h-1 w-full bg-white/10 rounded overflow-hidden">
                          <div className="h-full" style={{ width: `${(pwStrength / 4) * 100}%`, background: 'linear-gradient(90deg,#40f3c9,#7bf7d8)', transition: 'width 220ms ease' }} />
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={createPassword}
                            disabled={createPwLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                            style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                          >
                            {createPwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                            Create password
                          </button>

                          <AnimatePresence>
                            {createPwMsg === 'ok' && (
                              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1 text-[#57f0c6]">
                                <CheckCircle2 className="w-4 h-4" /> Saved
                              </motion.span>
                            )}
                            {createPwMsg === 'err' && (
                              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1 text-[#ff9db1]">
                                <ShieldAlert className="w-4 h-4" /> Check passwords
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </Band>
                  )}

                  {/* Change password (if email+password exists) */}
                  {hasEmailPassword && (
                    <Band>
                      <div className="flex items-center gap-2 mb-1">
                        <LockKeyhole className="w-4 h-4" />
                        <div className="text-sm font-semibold">Change password</div>
                      </div>
                      <p className="text-xs text-white/80 mb-3">We’ll send a secure link to your email to update your password.</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={sendReset}
                          disabled={!userEmail || resetLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                          style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                        >
                          {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          Send reset link
                        </button>

                        <AnimatePresence>
                          {resetMsg === 'sent' && (
                            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1 text-[#57f0c6]">
                              <CheckCircle2 className="w-4 h-4" /> Sent
                            </motion.span>
                          )}
                          {resetMsg === 'err' && (
                            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1 text-[#ff9db1]">
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
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,194,0.15)' }}>
                      <Crown className="w-5 h-5 text-[#00ffc2]" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold">Plan & Billing</div>
                      <div className="text-white/70 text-sm">Current plan: <span className="font-semibold">{plan}</span></div>
                    </div>
                  </div>

                  <div className="text-white/60 text-xs mb-4">
                    Usage: {usage.requests.toLocaleString()} / {usage.limit.toLocaleString()} requests
                  </div>

                  <div className="text-white/70 text-xs mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Free is demo-only. Upgrade to Pro for full features.
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/account/pricing"
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border hover:translate-y-[-1px]"
                      style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                    >
                      View pricing <ChevronRight className="w-4 h-4" />
                    </Link>

                    {plan !== 'Pro' && (
                      <a
                        href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border font-semibold hover:translate-y-[-1px]"
                        style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(0,255,194,0.06)' }}
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
    </>
  );
}

/* ---------- small building blocks ---------- */

function Header({ icon, title, subtitle }:{ icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-[17px] font-semibold">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border"
              style={{ borderColor:'rgba(106,247,209,0.28)', background:'rgba(0,255,194,0.06)' }}>
          {icon}
        </span>
        <span>{title}</span>
      </div>
      {subtitle && <div className="text-white/60 text-sm ml-10 -mt-1">{subtitle}</div>}
    </div>
  );
}

function SubHeader({ icon, title, subtitle }:{ icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mt-8 mb-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border"
              style={{ borderColor:'rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)' }}>
          {icon}
        </span>
        <span>{title}</span>
      </div>
      {subtitle && <div className="text-white/60 text-xs ml-8 mt-1">{subtitle}</div>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-[16px] p-6"
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
        background: accent ? 'rgba(0,255,194,0.06)' : 'rgba(15,18,20,0.55)',
        border: accent ? '1px solid rgba(0,255,194,0.25)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: accent ? '0 0 18px rgba(0,255,194,0.10) inset' : 'inset 0 0 12px rgba(0,0,0,0.30)',
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
      <span className="text-white/60 w-28 shrink-0">{label}</span>
      <span className="truncate">{value}</span>
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
        background: active ? 'rgba(0,255,194,0.08)' : 'rgba(15,18,20,0.55)',
        border: `1px solid ${active ? 'rgba(0,255,194,0.28)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: active
          ? '0 0 14px rgba(0,255,194,0.18) inset, 0 0 10px rgba(0,255,194,0.05)'
          : 'inset 0 0 12px rgba(0,0,0,0.32)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-black/20 border border-white/10">
          {icon}
        </div>
        <div className="font-semibold">{label}</div>
      </div>
      <div className="text-xs text-white/60 mt-2">
        {label === 'Light' ? 'Bright backgrounds and dark text.' : 'Dim backgrounds and light text.'}
      </div>
    </motion.button>
  );
}

function SettingsLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string; }) {
  return (
    <a
      href={href}
      className="w-full flex items-center justify-between rounded-[12px] px-3 py-2 border text-white/85 hover:translate-y-[-1px] transition"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(15,18,20,0.55)' }}
    >
      <span className="flex items-center gap-2 text-sm">{icon}{label}</span>
      <ChevronRight className="w-4 h-4 text-white/60" />
    </a>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wide"
      style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(0,255,194,0.08)' }}>
      {children}
    </span>
  );
}
function BadgeMuted({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wide text-white/80"
      style={{ borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)' }}>
      {children}
    </span>
  );
}
