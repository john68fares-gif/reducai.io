// components/ui/Sidebar.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket, Phone, Key, HelpCircle, Bot,
  ChevronLeft, ChevronRight, LogIn, LogOut, User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase-client';

/* ---------------- utilities ---------------- */

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const LS_COLLAPSED = 'ui:sidebarCollapsed';
const W_EXPANDED = 260;
const W_COLLAPSED = 72;

/* ---------------- component ---------------- */

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  /* collapse state (persisted) */
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      if (raw != null) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);

  /* expose width to layout via CSS var (so main can use padding-left: var(--sidebar-w)) */
  const widthPx = collapsed ? W_COLLAPSED : W_EXPANDED;
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  /* simple route-loading gate: show an overlay before navigating */
  const [navLoading, setNavLoading] = useState<string | null>(null);
  const go = useCallback(
    (href: string) => {
      if (pathname === href) return;
      setNavLoading(href);
      // small, consistent delay so the overlay is visible then change page
      setTimeout(() => router.push(href), 320);
    },
    [router, pathname]
  );

  /* ---------- auth + account name ---------- */
  const [authLoading, setAuthLoading] = useState<'in' | 'out' | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);

      if (user?.id) {
        // ensure a profile row exists, then read name
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: user.user_metadata?.name || null,
            updated_at: new Date().toISOString(),
          });
          setFullName(user.user_metadata?.name || null);
        } else {
          setFullName(existing.full_name || null);
        }
      } else {
        setFullName(null);
      }

      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUserEmail(u?.email ?? null);
        if (u?.id) {
          supabase
            .from('profiles')
            .select('full_name')
            .eq('id', u.id)
            .maybeSingle()
            .then(({ data }) => setFullName(data?.full_name || null));
        } else {
          setFullName(null);
        }
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const onSignOut = async () => {
    setAuthLoading('out');
    try { await supabase.auth.signOut(); } finally { setAuthLoading(null); }
    go('/auth?mode=signin');
  };
  const onSignIn = () => {
    setAuthLoading('in');
    go('/auth?mode=signin');
  };

  const displayName = useMemo(
    () => fullName || userEmail || 'Not signed in',
    [fullName, userEmail]
  );

  /* dropdown for account */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  /* nav groups
     - Workspace
     - Resources  (Phone Numbers, API Key, Support)  */
  const workspace = [
    { href: '/builder', icon: <Home />, label: 'Build', sub: 'Create AI agent' },
    { href: '/improve', icon: <Hammer />, label: 'Improve', sub: 'Integrate & optimize' },
    { href: '/voice-agent', icon: <Mic />, label: 'Voice Agent', sub: 'Calls & persona' },
    { href: '/launch', icon: <Rocket />, label: 'Launch', sub: 'Deploy to production' },
  ];

  const resources = [
    { href: '/phone-numbers', icon: <Phone />, label: 'Phone Numbers', sub: 'Link provider numbers' },
    { href: '/apikeys', icon: <Key />, label: 'API Key' },
    { href: '/support', icon: <HelpCircle />, label: 'Support', sub: 'Help & FAQ' },
  ];

  return (
    <aside
      className="text-white font-movatif"
      style={{
        width: widthPx,
        background: 'linear-gradient(180deg, rgba(10,12,13,0.98), rgba(9,11,12,0.98))',
        borderRight: '1px solid rgba(0,255,194,0.08)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.25)',
        minHeight: '100vh',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div
          className="border-b px-4 py-5 flex items-center gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#00ffc2', boxShadow: '0 0 10px rgba(0,255,194,0.35)' }}
          >
            <Bot className="w-5 h-5 text-black" />
          </div>
          <AnimatedText collapsed={collapsed}>
            <div className="leading-tight">
              <div className="text-[17px] font-semibold tracking-wide">
                reduc<span style={{ color: '#00ffc2' }}>ai.io</span>
              </div>
              <div className="text-[11px] text-white/55">Builder Workspace</div>
            </div>
          </AnimatedText>
        </div>

        {/* Workspace */}
        <Section>
          <NavList>
            {workspace.map((i) => (
              <Item
                key={i.href}
                collapsed={collapsed}
                href={i.href}
                label={i.label}
                sub={i.sub}
                icon={i.icon}
                active={pathname?.startsWith(i.href)}
                onNavigate={() => go(i.href)}
              />
            ))}
          </NavList>
        </Section>

        <div className="my-3 border-t border-white/10" />

        {/* Resources (only the 3 requested) */}
        <Section>
          <NavList>
            {resources.map((i) => (
              <Item
                key={i.href}
                collapsed={collapsed}
                href={i.href}
                label={i.label}
                sub={i.sub}
                icon={i.icon}
                active={pathname === i.href || pathname?.startsWith(i.href)}
                onNavigate={() => go(i.href)}
              />
            ))}
          </NavList>
        </Section>

        {/* Account */}
        <div className="mt-auto px-4 pb-5">
          <div
            ref={menuRef}
            className="rounded-2xl flex items-center justify-between px-4 py-3 relative transition-all duration-700 ease-in-out"
            style={{
              background: 'rgba(15,18,20,0.88)',
              border: '1px solid rgba(0,255,194,0.14)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35), 0 12px 28px rgba(0,0,0,0.35)',
            }}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-3 shrink-0 w-full text-left"
              title="Account"
            >
              <div className="w-8 h-8 rounded-full bg-[#08c] flex items-center justify-center shadow-[0_0_8px_rgba(0,136,204,0.35)]">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              <AnimatedText collapsed={collapsed}>
                <div className="leading-tight">
                  <div className="text-sm font-semibold truncate max-w-[160px]">{displayName}</div>
                  <div className="text-[11px] text-white/55">{userEmail ? 'Account' : 'Please sign in'}</div>
                </div>
              </AnimatedText>
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-2 bottom-[64px] min-w-[220px] z-[55] overflow-hidden rounded-xl"
                  style={{
                    background: 'rgba(17,20,22,0.98)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.55), inset 0 0 18px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    {userEmail && <div className="text-xs text-white/55 truncate">{userEmail}</div>}
                  </div>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      go('/account');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition text-sm"
                  >
                    Account settings
                  </button>

                  {userEmail ? (
                    <button
                      onClick={onSignOut}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition text-sm flex items-center gap-2"
                      disabled={authLoading === 'out'}
                    >
                      {authLoading === 'out' ? (
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      Sign out
                    </button>
                  ) : (
                    <button
                      onClick={onSignIn}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition text-sm flex items-center gap-2"
                      disabled={authLoading === 'in'}
                    >
                      {authLoading === 'in' ? (
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                      Sign in
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(16,19,21,0.95)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.45), 0 0 10px rgba(0,255,194,0.06)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4 text-white/80" /> : <ChevronLeft className="w-4 h-4 text-white/80" />}
        </button>
      </div>

      {/* route loading overlay */}
      <AnimatePresence>
        {navLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, rgba(10,12,13,0.65), rgba(9,11,12,0.65))',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
              <span className="text-white/80 text-sm">Loading…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

/* ---------- small building blocks ---------- */

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4">
      <div className="mb-2.5 h-4" />
      {children}
    </div>
  );
}

function NavList({ children }: { children: React.ReactNode }) {
  return <nav className="space-y-2.5">{children}</nav>;
}

function Item({
  href,
  label,
  sub,
  icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  active?: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const body = (
    <button
      onClick={onNavigate}
      className={cn(
        'group rounded-xl flex items-center h-12 transition-all duration-200 w-full',
        collapsed ? 'justify-center' : 'px-3',
        active ? 'translate-x-[0px]' : 'hover:translate-x-[1px]'
      )}
      style={{
        border: `1px solid ${active ? 'rgba(0,255,194,0.28)' : 'rgba(255,255,255,0.06)'}`,
        background: active ? 'rgba(0,255,194,0.06)' : 'rgba(15,18,20,0.55)',
        boxShadow: active
          ? '0 0 12px rgba(0,255,194,0.16) inset, 0 6px 18px rgba(0,0,0,0.22)'
          : 'inset 0 0 10px rgba(0,0,0,0.28)',
      }}
      title={collapsed ? label : undefined}
    >
      {/* Icon wrapper */}
      <div className={cn('flex items-center justify-center', collapsed ? 'w-8 h-8 mx-auto' : 'w-8 h-8 mr-3')}>
        <div className="w-5 h-5 flex items-center justify-center text-white/90">{icon}</div>
      </div>

      {/* Text + Sub */}
      <AnimatedText collapsed={collapsed}>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white/95">{label}</div>
          {sub && <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">{sub}</div>}
        </div>
      </AnimatedText>
    </button>
  );

  // Provide a Link wrapper for middle-click/open-in-new-tab support (when expanded)
  return collapsed ? (
    <div className="block">{body}</div>
  ) : (
    <Link href={href} className="block" onClick={(e) => e.preventDefault()}>
      {body}
    </Link>
  );
}

function AnimatedText({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'overflow-hidden transition-[max-width,opacity,transform] duration-700 ease-in-out',
        collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0'
      )}
    >
      <div className="transition-opacity duration-700 ease-in-out">{children}</div>
    </div>
  );
}
