// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight, Settings as SettingsIcon,
  LogOut, User as UserIcon, Bot
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 260;
const W_COLLAPSED = 72;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

export default function Sidebar() {
  const pathname = usePathname();

  // collapsed state (persist) + expose --sidebar-w for your layout
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  // user
  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);
  useEffect(() => {
    let sub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserLoading(false);
      sub = supabase.auth.onAuthStateChange((_e, s) => {
        const u = s?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
        setUserLoading(false);
      });
    })();
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);
  useEffect(() => setAcctOpen(false), [pathname]);

  const onSignOut = async () => { try { await supabase.auth.signOut(); } catch {} };

  // routes (only the ones you want)
  const items = useMemo(() => ([
    { href: '/builder',      label: 'Create',     sub: 'Design your agent',     icon: Home,    bucket: 'primary' },
    { href: '/improve',      label: 'Tuning',     sub: 'Integrate & optimize',  icon: Hammer,  bucket: 'primary' },
    { href: '/voice-agent',  label: 'Voice Studio', sub: 'Calls & persona',     icon: Mic,     bucket: 'primary' },
    { href: '/launch',       label: 'Launchpad',  sub: 'Go live',               icon: Rocket,  bucket: 'primary' },

    { href: '/phone-numbers',label: 'Numbers',    sub: 'Twilio & BYO',          icon: Phone,   bucket: 'secondary' },
    { href: '/apikeys',      label: 'API Keys',   sub: 'Models & access',       icon: Key,     bucket: 'secondary' },
    { href: '/support',      label: 'Help',       sub: 'Guides & FAQ',          icon: HelpCircle, bucket: 'secondary' },
  ]), []);

  // helper
  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname?.startsWith(href);

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 transition-[width] duration-300 ease-out"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        // Expanded: full sidebar surface; Collapsed: slim rail with transparent bg (no wide panel look)
        background: collapsed ? 'transparent' : 'var(--sidebar-bg)',
        borderRight: collapsed ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--sidebar-border)',
        boxShadow: collapsed ? 'none' : 'inset 0 0 18px rgba(0,0,0,0.35)',
        color: 'var(--sidebar-text)'
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div
          className={collapsed ? 'px-3 py-4' : 'px-4 py-5'}
          style={{ borderBottom: collapsed ? 'none' : '1px solid var(--sidebar-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
              style={{ background: 'var(--brand)', boxShadow: '0 0 10px rgba(0,255,194,.35)' }}
            >
              <Bot className="w-5 h-5 text-black" />
            </div>
            {!collapsed && (
              <div className="leading-tight min-w-0">
                <div className="text-[17px] font-semibold tracking-wide">
                  reduc<span style={{ color: 'var(--brand)' }}>ai.io</span>
                </div>
                <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Builder Workspace</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <div className={collapsed ? 'px-2 pt-3 pb-2 flex-1 overflow-y-auto' : 'px-4 pt-4 pb-3 flex-1 overflow-y-auto'}>
          {!collapsed ? (
            <nav className="space-y-6">
              <div className="space-y-1">
                {items.filter(i => i.bucket === 'primary').map(({ href, label, sub, icon: I }) => (
                  <Link key={href} href={href} className="block group">
                    <div className="flex items-center h-10">
                      <I
                        className="w-5 h-5 mr-3"
                        style={{ color: isActive(href) ? 'var(--accent-green)' : 'var(--sidebar-muted)' }}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold" style={{ color: isActive(href) ? 'var(--text)' : 'var(--sidebar-text)' }}>
                          {label}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>{sub}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="space-y-1">
                {items.filter(i => i.bucket === 'secondary').map(({ href, label, sub, icon: I }) => (
                  <Link key={href} href={href} className="block group">
                    <div className="flex items-center h-10">
                      <I
                        className="w-5 h-5 mr-3"
                        style={{ color: isActive(href) ? 'var(--accent-green)' : 'var(--sidebar-muted)' }}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold" style={{ color: isActive(href) ? 'var(--text)' : 'var(--sidebar-text)' }}>
                          {label}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>{sub}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </nav>
          ) : (
            // Collapsed rail: ONE box per icon (no double outlines)
            <nav className="grid gap-2">
              {items.map(({ href, icon: I }, idx) => {
                const active = isActive(href);
                const inPrimary = idx < 4;
                return (
                  <Link key={href} href={href} className="block">
                    <div
                      className="w-10 h-10 rounded-xl grid place-items-center mx-auto transition-transform hover:-translate-y-[1px]"
                      style={{
                        background: active ? 'rgba(0,255,194,.10)' : 'rgba(255,255,255,.06)',
                        border: active ? '1px solid rgba(0,255,194,.28)' : '1px solid rgba(255,255,255,.08)',
                        boxShadow: active ? '0 0 10px rgba(0,255,194,.12) inset' : 'inset 0 0 10px rgba(0,0,0,.28)'
                      }}
                      title=""
                    >
                      <I
                        className="w-5 h-5"
                        style={{ color: inPrimary ? 'var(--accent-green)' : 'rgba(255,255,255,.85)' }}
                      />
                    </div>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Account chip (kept minimal, no rectangles when expanded) */}
        <div className={collapsed ? 'px-2 pb-4' : 'px-4 pb-5'}>
          {!collapsed ? (
            <button
              onClick={() => setAcctOpen(v => !v)}
              className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition hover:bg-white/5"
              style={{ border: '1px solid var(--sidebar-border)', background: 'transparent' }}
            >
              <div className="w-8 h-8 rounded-full grid place-items-center"
                   style={{ background: 'var(--brand)', boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
                <UserIcon className="w-4 h-4 text-black/80" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
                  {userLoading ? 'Account' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
                  {userLoading ? 'Loading…' : (userEmail || 'Signed in')}
                </div>
              </div>
              <span className="ml-auto text-xs" style={{ color: 'var(--sidebar-muted)' }}>{acctOpen ? '▲' : '▼'}</span>
            </button>
          ) : (
            <div
              className="w-10 h-10 rounded-xl grid place-items-center mx-auto"
              style={{ border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.06)' }}
              title="Account"
            >
              <UserIcon className="w-5 h-5" style={{ color: 'rgba(255,255,255,.85)' }} />
            </div>
          )}

          {/* Desktop dropdown */}
          <AnimatePresence>
            {!collapsed && acctOpen && (
              <motion.div
                key="acct-dd"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="relative hidden md:block"
              >
                <div
                  className="mt-2 rounded-xl overflow-hidden border"
                  style={{ borderColor: 'var(--sidebar-border)', background: 'var(--sidebar-bg)', boxShadow: '0 12px 24px rgba(0,0,0,.35)' }}
                >
                  <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5">
                    <SettingsIcon className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
                    <span>Settings</span>
                  </Link>
                  <button onClick={onSignOut} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5">
                    <LogOut className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
                    <span>Sign out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 -translate-y-1/2 rounded-full p-1.5 transition hover:bg-white/5"
          style={{ border: '1px solid var(--sidebar-border)', boxShadow: '0 2px 12px rgba(0,0,0,.25)' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
                    : <ChevronLeft className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />}
        </button>
      </div>

      {/* Mobile account sheet */}
      <AnimatePresence>
        {acctOpen && (
          <motion.div
            key="acct-sheet"
            className="md:hidden fixed inset-0 z-[60] flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAcctOpen(false)}
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              initial={{ y: 32 }}
              animate={{ y: 0 }}
              exit={{ y: 32 }}
              transition={{ duration: 0.18 }}
              className="w-full rounded-t-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--sidebar-bg)', borderTop: '1px solid var(--sidebar-border)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <div className="font-semibold" style={{ color: 'var(--sidebar-text)' }}>{getDisplayName(userName, userEmail)}</div>
                <div className="text-sm" style={{ color: 'var(--sidebar-muted)' }}>{userEmail}</div>
              </div>
              <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-5 py-4 text-left" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <SettingsIcon className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
                <span>Settings</span>
              </Link>
              <button onClick={() => { setAcctOpen(false); onSignOut(); }} className="w-full flex items-center gap-2 px-5 py-4 text-left">
                <LogOut className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
                <span>Sign out</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page-scoped vars for icon color & light/dark tweaks */}
      <style jsx global>{`
        :root {
          --accent-green: #0ea473; /* the darker green you liked */
        }
        /* Light mode rail look */
        :root .fixed[left="0"][aria-label="Primary"] {
          /* no-op, uses your tokens */
        }
        /* Dark mode small polishing for the collapsed rail */
        [data-theme="dark"] aside[aria-label="Primary"] {
          /* nothing heavy; we already use your sidebar tokens */
        }
      `}</style>
    </aside>
  );
}
