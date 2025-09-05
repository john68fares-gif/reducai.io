'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Sun,
  Moon,
  LogOut,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
} from 'lucide-react';

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <Head>
        <title>Account • Reduc AI</title>
      </Head>
      <div
        className="min-h-screen"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <main className="w-full max-w-[880px] mx-auto px-6 pt-10 pb-24">
          {/* header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-semibold">Account Settings</h1>
            <Link
              href="/"
              className="opacity-70 hover:opacity-100 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              Back to dashboard
            </Link>
          </div>

          {/* profile card */}
          <section
            className="rounded-lg p-6 mb-8"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                }}
              >
                <UserIcon style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <div className="font-medium">
                  {loading ? 'Loading…' : user?.email || 'Anonymous'}
                </div>
                <div
                  className="text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {user ? 'Logged in' : 'Guest session'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                <span>{user?.email || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                <span>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : '-'}
                </span>
              </div>
            </div>
          </section>

          {/* preferences */}
          <section
            className="rounded-lg p-6 mb-8"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 className="font-semibold mb-4">Appearance</h2>
            <div className="flex gap-3">
              <button
                onClick={() => document.documentElement.setAttribute('data-theme', 'light')}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                <Sun className="w-4 h-4" /> Light
              </button>
              <button
                onClick={() => document.documentElement.setAttribute('data-theme', 'dark')}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                <Moon className="w-4 h-4" /> Dark
              </button>
            </div>
          </section>

          {/* security */}
          <section
            className="rounded-lg p-6 mb-8"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 className="font-semibold mb-4">Security</h2>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                Password protected
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                2FA not enabled
              </div>
            </div>
          </section>

          {/* billing */}
          <section
            className="rounded-lg p-6"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 className="font-semibold mb-4">Billing</h2>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                Subscription: Free
              </div>
              <Link
                href="/account/pricing"
                className="text-sm underline hover:opacity-80"
                style={{ color: 'var(--brand)' }}
              >
                Upgrade to Pro →
              </Link>
            </div>
          </section>

          {/* logout */}
          <div className="mt-10">
            <button
              onClick={async () => await supabase.auth.signOut()}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
