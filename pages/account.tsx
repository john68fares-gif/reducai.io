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

type ThemeMode = 'dark' | 'light';
type PlanTier = 'Free' | 'Pro';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false);
  const hasEmailPassword = providers.includes('email') || passwordEnabled;
  const hasGoogle = providers.includes('google');

  // Plan + usage
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

  // Strength meter
  const pwStrength = useMemo(() => {
    let s = 0;
    if (pw1.length >= 8) s++;
    if (/[A-Z]/.test(pw1)) s++;
    if (/[0-9]/.test(pw1)) s++;
    if (/[^A-Za-z0-9]/.test(pw1)) s++;
    return s;
  }, [pw1]);

  // Fetch user
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);
      setUserName(
        (user?.user_metadata as any)?.full_name ??
          user?.user_metadata?.name ??
          null
      );
      setUserCreated(user?.created_at ?? null);
      setUserUpdated(user?.updated_at ?? null);

      const ids = (user as any)?.identities || [];
      const provs = Array.from(
        new Set(ids.map((i: any) => i?.provider).filter(Boolean))
      );
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
        setUserName(
          (u2?.user_metadata as any)?.full_name ??
            u2?.user_metadata?.name ??
            null
        );
        setUserCreated(u2?.created_at ?? null);
        setUserUpdated(u2?.updated_at ?? null);

        const ids2 = (u2 as any)?.identities || [];
        const provs2 = Array.from(
          new Set(ids2.map((i: any) => i?.provider).filter(Boolean))
        );
        setProviders(provs2);

        const pwdMeta2 = (u2?.user_metadata as any)?.password_enabled;
        setPasswordEnabled(Boolean(pwdMeta2));

        const pt = (u2?.user_metadata as any)?.plan_tier as PlanTier | undefined;
        if (pt && (pt === 'Free' || pt === 'Pro')) setPlan(pt);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  // Theme init
  useEffect(() => {
    try {
      const ls = (localStorage.getItem('ui:theme') as ThemeMode) || 'dark';
      setTheme(ls === 'light' ? 'light' : 'dark');
      document.documentElement.dataset.theme = ls;
    } catch {}
  }, []);

  const displayName = useMemo(() => {
    if (userName && userName.trim()) return userName.trim();
    if (userEmail && userEmail.includes('@'))
      return userEmail.split('@')[0];
    return 'Account';
  }, [userName, userEmail]);

  const saveTheme = async () => {
    setSavingTheme(true);
    setSaveMsg('idle');
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('ui:theme', theme);
      const { error } = await supabase.auth.updateUser({
        data: { ui_theme: theme },
      });
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
      const { error } = await supabase.auth.resetPasswordForEmail(
        userEmail,
        { redirectTo: `${window.location.origin}/auth/callback` }
      );
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
      setTimeout(() => setCreatePwMsg('idle'), 2000);
      return;
    }
    setCreatePwLoading(true);
    setCreatePwMsg('idle');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { password_enabled: true } });
      setPasswordEnabled(true);
      setCreatePwMsg('ok');
      setPw1('');
      setPw2('');
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
    } catch {}
  };

  return (
    <>
      <Head>
        <title>Account • Reduc AI</title>
      </Head>

      {/* Loader */}
      <AnimatePresence>
        {(booting || loading) && (
          <motion.div
            key="boot"
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: theme === 'dark' ? '#0b0c10' : '#fff',
            }}
          >
            <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page */}
      <div
        className="min-h-screen"
        style={{
          background: theme === 'dark' ? '#0b0c10' : '#fff',
          color: theme === 'dark' ? '#fff' : '#000',
        }}
      >
        <main className="w-full max-w-[1100px] mx-auto px-6 pt-10 pb-24 grid grid-cols-1 md:grid-cols-[260px,1fr] gap-8">
          {/* Left nav */}
          <aside className="md:sticky md:top-10 h-fit">
            <div className="text-xl font-semibold mb-4">Settings</div>
            <nav className="space-y-2">
              <SettingsLink
                icon={<UserIcon className="w-4 h-4" />}
                label="Profile"
                href="#profile"
              />
              <SettingsLink
                icon={<CreditCard className="w-4 h-4" />}
                label="Plan & Billing"
                href="#billing"
              />
            </nav>
          </aside>

          {/* Right content */}
          <section className="space-y-10">
            {/* Profile */}
            <div id="profile">
              {/* Profile details… */}
            </div>

            {/* Plan & Billing */}
            <div id="billing">
              <Header
                icon={<Box className="w-5 h-5" />}
                title="Current Plan"
                subtitle="Your current subscription plan"
              />
              <Card>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--brand-weak)]">
                    <Crown className="w-5 h-5 text-[var(--brand)]" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Plan & Billing</div>
                    <div className="text-sm text-[color:var(--text-muted)]">
                      Current plan: <span className="font-semibold">{plan}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-[color:var(--text-muted)] mb-4">
                  Usage: {usage.requests.toLocaleString()} / {usage.limit.toLocaleString()} requests
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/account/pricing"
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border font-medium"
                    style={{
                      borderColor: 'var(--border)',
                      background: theme === 'dark' ? 'var(--panel)' : '#fff',
                      color: 'var(--text)',
                    }}
                  >
                    View pricing <ChevronRight className="w-4 h-4" />
                  </Link>

                  {plan !== 'Pro' && (
                    <a
                      href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-[10px] border font-semibold"
                      style={{
                        borderColor: 'var(--brand-weak)',
                        background: 'var(--brand-weak)',
                        color: '#000',
                      }}
                    >
                      <Zap className="w-4 h-4" /> Upgrade to Pro (€19.99/mo)
                    </a>
                  )}
                </div>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

/* --- building blocks (unchanged) --- */

function Header({ icon, title, subtitle }:{ icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-[17px] font-semibold">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-[var(--brand-weak)] border-[var(--brand-weak)]">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      {subtitle && (
        <div className="text-sm text-[color:var(--text-muted)] ml-10 -mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="card p-6 rounded-xl shadow"
      style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
    >
      {children}
    </motion.section>
  );
}

function SettingsLink({ icon, label, href }:{ icon: React.ReactNode; label: string; href: string; }) {
  return (
    <a
      href={href}
      className="panel flex items-center justify-between rounded-[12px] px-3 py-2 transition hover:translate-y-[-1px]"
      style={{ color: 'var(--text)' }}
    >
      <span className="flex items-center gap-2 text-sm">
        {icon}{label}
      </span>
      <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)]" />
    </a>
  );
}
