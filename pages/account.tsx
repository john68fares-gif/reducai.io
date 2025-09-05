// pages/account.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';

const UI = {
  cardBg: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  cardShadow: 'inset 0 0 18px rgba(0,0,0,0.28), 0 0 12px rgba(106,247,209,0.06)',
};

type ThemeMode = 'dark' | 'light';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AccountPage() {
  // user state
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userCreated, setUserCreated] = useState<string | null>(null);
  const [userUpdated, setUserUpdated] = useState<string | null>(null);

  // theme
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [savingTheme, setSavingTheme] = useState(false);
  const [saveMsg, setSaveMsg] = useState<'idle' | 'ok' | 'err'>('idle');

  // password reset
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<'idle' | 'sent' | 'err'>('idle');

  // fetch user
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserCreated(user?.created_at ?? null);
      setUserUpdated(user?.updated_at ?? null);
      setLoading(false);

      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
        setUserCreated(u?.created_at ?? null);
        setUserUpdated(u?.updated_at ?? null);
        setLoading(false);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  // load theme from localStorage / DOM
  useEffect(() => {
    try {
      const ls = (localStorage.getItem('ui:theme') as ThemeMode) || 'dark';
      setTheme(ls === 'light' ? 'light' : 'dark');
      document.documentElement.dataset.theme = ls === 'light' ? 'light' : 'dark';
    } catch {}
  }, []);

  const displayName = useMemo(() => {
    if (userName && userName.trim()) return userName.trim();
    if (userEmail && userEmail.includes('@')) return userEmail.split('@')[0];
    return 'Account';
  }, [userName, userEmail]);

  const saveTheme = async () => {
    setSavingTheme(true);
    setSaveMsg('idle');
    try {
      // apply + persist
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('ui:theme', theme);
      // optional: store in user metadata (safe no-op if not allowed)
      const { error } = await supabase.auth.updateUser({
        data: { ui_theme: theme },
      });
      if (error) {
        // not fatal for UX; just show local success anyway
        setSaveMsg('ok');
      } else {
        setSaveMsg('ok');
      }
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
      setTimeout(() => setResetMsg('idle'), 3000);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // middleware will redirect unauthenticated users automatically
    } catch {}
  };

  return (
    <>
      <Head>
        <title>Account • Reduc AI</title>
      </Head>

      <div className="min-h-screen text-white" style={{ background: '#0b0c10' }}>
        <main className="w-full max-w-[1640px] mx-auto px-6 2xl:px-12 pt-10 pb-28">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl md:text-3xl font-semibold">Account</h1>
          </div>

          {/* GRID */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-7">
            {/* Profile card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="rounded-[16px] p-6"
              style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
            >
              <div className="flex items-center gap-4 mb-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,255,194,0.22)' }}
                >
                  <UserIcon className="w-6 h-6 text-black/80" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate">
                    {loading ? (
                      <span className="inline-block h-5 w-40 bg-white/10 rounded animate-pulse" />
                    ) : (
                      displayName
                    )}
                  </div>
                  <div className="text-white/70 text-sm truncate">
                    {loading ? (
                      <span className="inline-block h-4 w-56 bg-white/5 rounded animate-pulse" />
                    ) : (
                      userEmail || '—'
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm text-white/85">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-white/70" />
                  <span className="text-white/60 w-28 shrink-0">Email</span>
                  <span className="truncate">{userEmail || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/70" />
                  <span className="text-white/60 w-28 shrink-0">Created</span>
                  <span>{fmtDate(userCreated || undefined)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/70" />
                  <span className="text-white/60 w-28 shrink-0">Updated</span>
                  <span>{fmtDate(userUpdated || undefined)}</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px]"
                  style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </motion.section>

            {/* Theme card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.05 }}
              className="rounded-[16px] p-6"
              style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Appearance</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ThemeTile
                  label="Dark"
                  active={theme === 'dark'}
                  icon={<Moon className="w-4 h-4" />}
                  onClick={() => setTheme('dark')}
                />
                <ThemeTile
                  label="Light"
                  active={theme === 'light'}
                  icon={<Sun className="w-4 h-4" />}
                  onClick={() => setTheme('light')}
                />
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={saveTheme}
                  disabled={savingTheme}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                  style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                >
                  <Save className="w-4 h-4" />
                  Save theme
                </button>

                <AnimatePresence mode="popLayout">
                  {saveMsg === 'ok' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="inline-flex items-center gap-1 text-[#57f0c6]"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Saved
                    </motion.span>
                  )}
                  {saveMsg === 'err' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="inline-flex items-center gap-1 text-[#ff9db1]"
                    >
                      <AlertCircle className="w-4 h-4" /> Failed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>

            {/* Security card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.1 }}
              className="rounded-[16px] p-6"
              style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Security</h2>
              </div>

              <p className="text-white/80 text-sm leading-6">
                To change your password, we’ll send a verification link to your email.
              </p>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={sendReset}
                  disabled={!userEmail || resetLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:translate-y-[-1px] disabled:opacity-60"
                  style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
                >
                  <KeyRound className="w-4 h-4" />
                  Send reset email
                </button>

                <AnimatePresence>
                  {resetMsg === 'sent' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="inline-flex items-center gap-1 text-[#57f0c6]"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Sent
                    </motion.span>
                  )}
                  {resetMsg === 'err' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="inline-flex items-center gap-1 text-[#ff9db1]"
                    >
                      <AlertCircle className="w-4 h-4" /> Failed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          </div>
        </main>
      </div>
    </>
  );
}

/* -------------------------- subcomponents -------------------------- */

function ThemeTile({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[14px] p-4 text-left transition-all hover:translate-y-[-1px]"
      style={{
        background: active ? 'rgba(0,255,194,0.06)' : 'rgba(15,18,20,0.55)',
        border: `1px solid ${active ? 'rgba(0,255,194,0.28)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: active
          ? '0 0 12px rgba(0,255,194,0.16) inset, 0 0 8px rgba(0,255,194,0.04)'
          : 'inset 0 0 10px rgba(0,0,0,0.28)',
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
    </button>
  );
}
