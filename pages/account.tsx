// pages/account.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
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

type ThemeMode = 'light' | 'dark';
type PlanTier = 'Free' | 'Pro';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function AccountPage() {
  // Theme state
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [savingTheme, setSavingTheme] = useState(false);
  const [saveMsg, setSaveMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  // User state
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userCreated, setUserCreated] = useState<string | null>(null);

  // Plan
  const [plan, setPlan] = useState<PlanTier>('Free');
  const [usage, setUsage] = useState({ requests: 0, limit: 10000 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName(
        (user?.user_metadata as any)?.full_name ??
          user?.user_metadata?.name ??
          null
      );
      setUserCreated(user?.created_at ?? null);

      const p = (user?.user_metadata as any)?.plan_tier as PlanTier | undefined;
      if (p) setPlan(p);

      const u = (user?.user_metadata as any)?.requests_used;
      setUsage({ requests: typeof u === 'number' ? u : 0, limit: 10000 });

      setLoading(false);
    })();

    // init theme from localStorage
    const stored = localStorage.getItem('ui:theme') as ThemeMode | null;
    if (stored === 'dark') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const displayName = useMemo(() => {
    if (userName && userName.trim()) return userName.trim();
    if (userEmail && userEmail.includes('@')) return userEmail.split('@')[0];
    return 'Account';
  }, [userName, userEmail]);

  const toggleTheme = async (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem('ui:theme', mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      setSavingTheme(true);
      const { error } = await supabase.auth.updateUser({
        data: { ui_theme: mode },
      });
      if (error) throw error;
      setSaveMsg('ok');
    } catch {
      setSaveMsg('err');
    } finally {
      setSavingTheme(false);
      setTimeout(() => setSaveMsg('idle'), 2000);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <Head>
        <title>Account • Reduc AI</title>
      </Head>

      <div className="min-h-screen bg-white text-black dark:bg-[#0b0c10] dark:text-white transition-colors">
        <main className="w-full max-w-[1100px] mx-auto px-6 pt-10 pb-24 grid grid-cols-1 md:grid-cols-[260px,1fr] gap-8">
          {/* Sidebar */}
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

          {/* Content */}
          <section className="space-y-10">
            {/* Profile */}
            <div id="profile">
              <Header
                icon={<UserIcon className="w-5 h-5" />}
                title="Profile"
                subtitle="Manage your account info and theme"
              />
              <Card>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{displayName}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {userEmail || '—'}
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <InfoRow
                    icon={<Mail className="w-4 h-4" />}
                    label="Email"
                    value={userEmail || '—'}
                  />
                  <InfoRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="Created"
                    value={fmtDate(userCreated || undefined)}
                  />
                </div>
                <div className="mt-6">
                  <button
                    onClick={signOut}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0d0f11] hover:translate-y-[-1px] transition"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </Card>

              {/* Appearance */}
              <SubHeader
                icon={<Palette className="w-4 h-4" />}
                title="Appearance"
                subtitle="Choose light or dark mode"
              />
              <Card>
                <div className="grid grid-cols-2 gap-4">
                  <ThemeTile
                    label="Light"
                    active={theme === 'light'}
                    icon={<Sun className="w-4 h-4" />}
                    onClick={() => toggleTheme('light')}
                  />
                  <ThemeTile
                    label="Dark"
                    active={theme === 'dark'}
                    icon={<Moon className="w-4 h-4" />}
                    onClick={() => toggleTheme('dark')}
                  />
                </div>
                <div className="mt-4">
                  <AnimatePresence>
                    {saveMsg === 'ok' && (
                      <motion.span className="text-sm text-green-500">
                        <CheckCircle2 className="inline w-4 h-4" /> Theme saved
                      </motion.span>
                    )}
                    {saveMsg === 'err' && (
                      <motion.span className="text-sm text-red-500">
                        <AlertCircle className="inline w-4 h-4" /> Failed to save
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </div>

            {/* Plan & Billing */}
            <div id="billing">
              <Header
                icon={<Box className="w-5 h-5" />}
                title="Plan & Billing"
                subtitle="Your subscription and usage"
              />
              <Card>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                    <Crown className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <div className="font-semibold">Current Plan</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {plan}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Usage: {usage.requests.toLocaleString()} / {usage.limit.toLocaleString()} requests
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/account/pricing"
                    className="px-5 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0d0f11] hover:translate-y-[-1px] transition"
                  >
                    View pricing
                  </Link>
                  {plan !== 'Pro' && (
                    <a
                      href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2 rounded-md border bg-green-400 text-black font-semibold hover:bg-green-300 transition"
                    >
                      <Zap className="inline w-4 h-4" /> Upgrade to Pro (€19.99/mo)
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

/* --- building blocks --- */

function Header({ icon, title, subtitle }:{ icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-gray-200 dark:bg-gray-700">
          {icon}
        </span>
        {title}
      </div>
      {subtitle && <div className="text-sm text-gray-500 dark:text-gray-400 ml-10">{subtitle}</div>}
    </div>
  );
}

function SubHeader({ icon, title, subtitle }:{ icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mt-8 mb-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-200 dark:bg-gray-700">
          {icon}
        </span>
        {title}
      </div>
      {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 ml-8">{subtitle}</div>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0d0f11] shadow-sm transition">
      {children}
    </section>
  );
}

function InfoRow({ icon, label, value }:{ icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className="w-24 text-gray-500 dark:text-gray-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ThemeTile({ label, active, icon, onClick }:{ label: string; active: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border transition ${
        active
          ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0d0f11]'
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {icon} {label}
      </div>
    </button>
  );
}

function SettingsLink({ icon, label, href }:{ icon: React.ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0d0f11] hover:translate-y-[-1px] transition text-sm"
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </a>
  );
}
