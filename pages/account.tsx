// pages/account.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
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
  ArrowDownToDot,
  ShieldCheck,
  Loader2,
  LockKeyhole,
  ShieldAlert,
} from 'lucide-react';

const UI = {
  cardBg: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.20)',
  cardShadow:
    '0 10px 30px rgba(0,0,0,0.45), inset 0 0 22px rgba(0,0,0,0.35), 0 0 18px rgba(0,255,194,0.06)',
  hoverShadow:
    '0 14px 40px rgba(0,0,0,0.55), inset 0 0 26px rgba(0,0,0,0.40), 0 0 22px rgba(0,255,194,0.10)',
};

type ThemeMode = 'dark' | 'light';
type PlanTier = 'Free' | 'Pro';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AccountPage() {
  // bootstrap loader
  const [booting, setBooting] = useState(true);

  // user state
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userCreated, setUserCreated] = useState<string | null>(null);
  const [userUpdated, setUserUpdated] = useState<string | null>(null);

  // auth providers
  const [providers, setProviders] = useState<string[]>([]);
  const hasEmailPassword = providers.includes('email');
  const hasGoogle = providers.includes('google');

  // plan + usage (client placeholder; wire to backend when ready)
  const [plan, setPlan] = useState<PlanTier>('Free');
  const [usage, setUsage] = useState<{ requests: number; limit: number }>({ requests: 0, limit: 10000 });

  // theme
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [savingTheme, setSavingTheme] = useState(false);
  const [saveMsg, setSaveMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  // password flows
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<'idle' | 'sent' | 'err'>('idle');

  const [createPwLoading, setCreatePwLoading] = useState(false);
  const [createPwMsg, setCreatePwMsg] = useState<'idle' | 'ok' | 'err'>('idle');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  // fetch user
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserCreated(user?.created_at ?? null);
      setUserUpdated(user?.updated_at ?? null);

      // identities → providers
      const ids = (user as any)?.identities || [];
      const provs = Array.from(new Set(ids.map((i: any) => i?.provider).filter(Boolean)));
      setProviders(provs);

      const p = (user?.user_metadata as any)?.plan_tier as PlanTier | undefined;
      if (p && (p === 'Free' || p === 'Pro')) setPlan(p);

      const u = (user?.user_metadata as any)?.requests_used as number | undefined;
      setUsage({ requests: typeof u === 'number' ? u : 0, limit: 10000 });

      setLoading(false);

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

        const pt = (u2?.user_metadata as any)?.plan_tier as PlanTier | undefined;
        if (pt && (pt === 'Free' || pt === 'Pro')) setPlan(pt);
      });
    })();

    // a tiny delay for the pre-page loader polish
    const t = setTimeout(() => setBooting(false), 550);

    return () => {
      unsub?.data?.subscription?.unsubscribe?.();
      clearTimeout(t);
    };
  }, []);

  // theme init
  useEffect(() => {
    try {
      const ls = (localStorage.getItem('ui:theme') as ThemeMode) || 'dark';
      setTheme(ls === 'light' ? 'light' : 'dark');
      document.documentElement.dataset.theme = ls === 'light' ? 'light' : 'dark';
    } catch {}
  }, []);

  // ensure workspace is per-user (simple local guard)
  useEffect(() => {
    try {
      const currentOwner = localStorage.getItem('workspace:owner');
      if (userId && currentOwner && currentOwner !== userId) {
        localStorage.clear();
      }
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
      setTimeout(() => setSaveMsg('idle'), 2000);
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

  const createPassword = async () => {
    if (!pw1 || pw1 !== pw2) {
      setCreatePwMsg('err');
      setTimeout(() => setCreatePwMsg('idle'), 2500);
      return;
    }
    setCreatePwLoading(true);
    setCreatePwMsg('idle');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      // Setting a password enables email+password login in addition to Google
      setCreatePwMsg('ok');
    } catch {
      setCreatePwMsg('err');
    } finally {
      setCreatePwLoading(false);
      setTimeout(() => setCreatePwMsg('idle'), 3000);
    }
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
  };

  // scroll to pricing
  const pricingRef = useRef<HTMLDivElement | null>(null);
  const scrollToPricing = () => pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // strength estimate (very light client-side)
  const pwStrength = useMemo(() => {
    let s = 0;
    if (pw1.length >= 8) s++;
    if (/[A-Z]/.test(pw1)) s++;
    if (/[0-9]/.test(pw1)) s++;
    if (/[^A-Za-z0-9]/.test(pw1)) s++;
    return s; // 0..4
  }, [pw1]);

  return (
    <>
      <Head><title>Account • Reduc AI</title></Head>

      {/* ------- INITIAL LOADER OVERLAY ------- */}
      <AnimatePresence>
        {(booting || loading) && (
          <motion.div
            key="boot"
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background:
                'radial-gradient(1200px 600px at 50% -10%, rgba(0,255,194,0.10), transparent 60%), #0b0c10',
              backdropFilter: 'blur(2px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 py-5 rounded-2xl border"
              style={{
                border: '1px solid rgba(106,247,209,0.25)',
                background: 'rgba(13,15,17,0.92)',
                boxShadow: UI.cardShadow,
              }}
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <div className="text-sm">Loading your account…</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------- PAGE ------- */}
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <main className="w-full max-w-[820px] mx-auto px-6 pt-10 pb-28">
          <motion.h1
            className="text-2xl md:text-3xl font-semibold mb-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            Account
          </motion.h1>

          <div className="grid grid-cols-1 gap-7">
            {/* Profile */}
            <Card>
              <div className="flex items-center gap-4 mb-5">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,255,194,0.22)' }}
                >
                  <UserIcon className="w-6 h-6 text-black/80" />
                </motion.div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate">
                    {loading ? <span className="inline-block h-5 w-40 bg-white/10 rounded animate-pulse" /> : displayName}
                  </div>
                  <div className="text-white/70 text-sm truncate">
                    {loading ? <span className="inline-block h-4 w-56 bg-white/5 rounded animate-pulse" /> : (userEmail || '—')}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm text-white/85">
                <InfoRow icon={<Mail className="w-4 h-4 text-white/70" />} label="Email" value={userEmail || '—'} />
                <InfoRow icon={<Calendar className="w-4 h-4 text-white/70" />} label="Created" value={fmtDate(userCreated || undefined)} />
                <InfoRow icon={<Calendar className="w-4 h-4 text-white/70" />} label="Updated" value={fmtDate(userUpdated || undefined)} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={signOut}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px]"
                  style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </motion.button>

                <div className="inline-flex items-center gap-2 text-xs text-white/70">
                  <ShieldCheck className="w-4 h-4" />
                  Your workspace is private. After sign-in, everything starts from zero in your own space.
                </div>
              </div>
            </Card>

            {/* Appearance */}
            <Card title="Appearance">
              <div className="grid grid-cols-2 gap-4">
                <ThemeTile label="Dark"  active={theme === 'dark'}  icon={<Moon className="w-4 h-4" />} onClick={() => setTheme('dark')} />
                <ThemeTile label="Light" active={theme === 'light'} icon={<Sun  className="w-4 h-4" />} onClick={() => setTheme('light')} />
              </div>

              <div className="mt-6 flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={saveTheme}
                  disabled={savingTheme}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                  style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                >
                  {savingTheme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save theme
                </motion.button>

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
            <Card title="Account & Security">
              <div className="grid gap-4">
                {/* Sign-in methods */}
                <div
                  className="rounded-[12px] p-4"
                  style={{ background: 'rgba(15,18,20,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="text-sm font-semibold mb-2">Sign-in methods</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                    {hasEmailPassword ? (
                      <Badge>email & password</Badge>
                    ) : (
                      <BadgeMuted>email & password (not set)</BadgeMuted>
                    )}
                    {hasGoogle && <Badge>google</Badge>}
                  </div>
                </div>

                {/* If Google-only → Create password */}
                {!hasEmailPassword && (
                  <div
                    className="rounded-[12px] p-4"
                    style={{ background: 'rgba(0,255,194,0.06)', border: '1px solid rgba(0,255,194,0.25)', boxShadow: '0 0 18px rgba(0,255,194,0.10) inset' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <LockKeyhole className="w-4 h-4" />
                      <div className="text-sm font-semibold">Create a password</div>
                    </div>
                    <p className="text-xs text-white/80 mb-3">
                      You currently sign in with Google. Add a password so you can also sign in with email + password.
                    </p>

                    <div className="grid gap-3">
                      <input
                        type="password"
                        className="w-full rounded-[10px] px-3 py-2 bg-black/20 border border-white/10 outline-none"
                        placeholder="New password"
                        value={pw1}
                        onChange={(e) => setPw1(e.target.value)}
                      />
                      <input
                        type="password"
                        className="w-full rounded-[10px] px-3 py-2 bg-black/20 border border-white/10 outline-none"
                        placeholder="Confirm password"
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                      />
                      {/* strength */}
                      <div className="h-1 w-full bg-white/10 rounded overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${(pwStrength / 4) * 100}%`,
                            background: 'linear-gradient(90deg,#40f3c9,#7bf7d8)',
                            transition: 'width 220ms ease',
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={createPassword}
                          disabled={createPwLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                          style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                        >
                          {createPwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          Create password
                        </motion.button>

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
                  </div>
                )}

                {/* If email+password present → Change password via reset link */}
                {hasEmailPassword && (
                  <div
                    className="rounded-[12px] p-4"
                    style={{ background: 'rgba(15,18,20,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <LockKeyhole className="w-4 h-4" />
                      <div className="text-sm font-semibold">Change password</div>
                    </div>
                    <p className="text-xs text-white/80 mb-3">
                      We’ll send a secure link to your email to update your password.
                    </p>

                    <div className="flex items-center gap-3">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={sendReset}
                        disabled={!userEmail || resetLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                        style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                      >
                        {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        Send reset link
                      </motion.button>

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
                  </div>
                )}
              </div>
            </Card>

            {/* Plan & Billing */}
            <Card>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,194,0.15)' }}>
                  <Crown className="w-5 h-5 text-[#00ffc2]" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Plan & Billing</div>
                  <div className="text-white/70 text-sm">Current plan: <span className="font-semibold">{plan}</span></div>
                </div>
              </div>

              <div className="text-white/60 text-xs mb-5">
                Usage: {usage.requests.toLocaleString()} / {usage.limit.toLocaleString()} requests
              </div>

              <div className="text-white/70 text-xs mb-5 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Each account has its own private workspace. On Free you can create demos only; upgrade to Pro for full power.
              </div>

              <div className="flex flex-wrap gap-3">
                {plan !== 'Pro' && (
                  <motion.a
                    whileTap={{ scale: 0.98 }}
                    href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border font-semibold transition hover:translate-y-[-1px]"
                    style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(0,255,194,0.06)', boxShadow: '0 0 18px rgba(0,255,194,0.06)' }}
                  >
                    <Zap className="w-4 h-4" />
                    Upgrade to Pro (€19.99/mo)
                  </motion.a>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={scrollToPricing}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border transition hover:translate-y-[-1px]"
                  style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                >
                  <ArrowDownToDot className="w-4 h-4" />
                  View pricing
                </motion.button>
              </div>
            </Card>

            {/* Pricing (vertical list) */}
            <div ref={pricingRef} />
            <Card title="Pricing">
              <div className="space-y-4">
                <PlanRow
                  title="Free"
                  subtitle="Demo only — create and test demos with restricted features"
                  price="€0"
                  period="/ forever"
                  icon={<Crown className="w-5 h-5" />}
                  features={[
                    'Build & preview demo chatbots',
                    'Limited request quota',
                    'Basic templates',
                  ]}
                  ctaLabel="Demo only"
                  ctaDisabled
                />
                <PlanRow
                  title="Pro"
                  subtitle="Everything you need to launch"
                  price="€19.99"
                  period="/ month"
                  icon={<Zap className="w-5 h-5" />}
                  features={[
                    'Full builder features unlocked',
                    'Higher request limits',
                    'Priority worker queue',
                    'Email support',
                  ]}
                  ctaLabel={plan === 'Pro' ? 'You’re on Pro' : 'Subscribe to Pro'}
                  ctaHref={plan === 'Pro' ? undefined : 'https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00'}
                />
              </div>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}

/* -------------------- small building blocks -------------------- */

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      whileHover={{ y: -2 }}
      className="rounded-[16px] p-6 transition-shadow"
      style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = UI.hoverShadow)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = UI.cardShadow)}
    >
      {title && <h2 className="text-lg font-semibold mb-5">{title}</h2>}
      {children}
    </motion.section>
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
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="rounded-[14px] p-4 text-left transition-all hover:translate-y-[-1px]"
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

function PlanRow({
  title, subtitle, price, period, icon, features, ctaLabel, ctaHref, ctaDisabled,
}: {
  title: string; subtitle: string; price: string; period: string;
  icon: React.ReactNode; features: string[]; ctaLabel: string; ctaHref?: string; ctaDisabled?: boolean;
}) {
  return (
    <div
      className="rounded-[14px] p-5"
      style={{
        background: 'rgba(15,18,20,0.55)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.30)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/20 border border-white/10">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="text-base font-semibold">{title}</div>
            <div className="text-white/60 text-sm">{subtitle}</div>
          </div>
          <div className="mt-1 text-lg font-semibold">
            {price} <span className="text-white/60 text-sm font-normal">{period}</span>
          </div>

          <ul className="mt-3 text-white/85 text-sm space-y-1.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 text-[#57f0c6]" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-4">
            {ctaHref && !ctaDisabled ? (
              <motion.a
                whileTap={{ scale: 0.98 }}
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border font-semibold transition hover:translate-y-[-1px]"
                style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(0,255,194,0.06)' }}
              >
                {title === 'Pro' ? <Zap className="w-4 h-4" /> : null}
                {ctaLabel}
              </motion.a>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border opacity-70 cursor-not-allowed"
                style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
              >
                {ctaLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
    <span className="px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wide text-white/60"
      style={{ borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)' }}>
      {children}
    </span>
  );
}
