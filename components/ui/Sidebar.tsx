'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid as CreateIcon,
  Wrench as TuningIcon,
  Mic,
  Rocket,
  Phone,
  Key,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* Sizes & persistence */
const W_EXPANDED = 260;
const W_COLLAPSED = 72;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

const DARK_GREEN = '#10b981';       // same darker green you liked on buttons
const NEUTRAL_ICON = 'rgba(255,255,255,.85)';

function brandMark() {
  return (
    <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
         style={{ background: 'var(--brand,#00ffc2)', boxShadow: '0 0 10px rgba(0,255,194,.35)' }}>
      {/* simple logo dot */}
      <div className="w-3 h-3 rounded-full bg-black/85" />
    </div>
  );
}

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

export default function Sidebar() {
  const pathname = usePathname();

  /* collapse state (persist + set CSS var to kill ghost space) */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    // drives layout column in _app.tsx
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  /* auth snippet for avatar */
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  /* groups */
  const top = useMemo(() => ([
    { href: '/builder',     label: 'Create',      sub: 'Design your agent',  icon: <CreateIcon />  },
    { href: '/improve',     label: 'Tuning',      sub: 'Integrate & optimize', icon: <TuningIcon /> },
    { href: '/voice-agent', label: 'Voice Studio',sub: 'Calls & persona',    icon: <Mic />         },
    { href: '/launch',      label: 'Launchpad',   sub: 'Go live',            icon: <Rocket />      },
  ]), []);

  const bottom = useMemo(() => ([
    { href: '/phone-numbers', label: 'Numbers', sub: 'Twilio & BYO', icon: <Phone /> },
    { href: '/apikeys',       label: 'API Keys', sub: 'Models & access', icon: <Key /> },
    { href: '/support',       label: 'Help',   sub: 'Guides & FAQ', icon: <HelpCircle /> },
  ]), []);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  /* Item renderer
     - Expanded: no pill/box, just icon + labels, ample spacing
     - Collapsed: single rounded pill with subtle bg/border (ONE box only)
  */
  function Item({
    href, label, sub, icon, tint = 'green',
  }: { href: string; label: string; sub?: string; icon: React.ReactNode; tint?: 'green'|'neutral' }) {
    const active = isActive(href);

    if (collapsed) {
      return (
        <Link href={href} className="block">
          <div
            className="group w-12 h-12 mx-auto mb-2 rounded-xl grid place-items-center transition-transform"
            title={label}
            style={{
              background: active ? 'rgba(16,185,129,.22)' : 'rgba(15,18,20,.85)',
              border: `1px solid ${active ? 'rgba(16,185,129,.45)' : 'rgba(255,255,255,.08)'}`,
              boxShadow: active ? '0 0 14px rgba(16,185,129,.22) inset, 0 6px 18px rgba(0,0,0,.35)'
                                : 'inset 0 0 10px rgba(0,0,0,.28)',
            }}
          >
            <div style={{ color: tint === 'green' ? DARK_GREEN : NEUTRAL_ICON }}>
              {icon}
            </div>
          </div>
        </Link>
      );
    }

    return (
      <Link href={href} className="block">
        <div
          className="h-12 flex items-center gap-3 px-1 rounded-lg"
          style={{ transition: 'color var(--dur-quick) var(--ease), transform var(--dur-quick) var(--ease)' }}
        >
          <div className="w-5 h-5 grid place-items-center"
               style={{ color: tint === 'green' ? DARK_GREEN : 'var(--sidebar-muted)' }}>
            {icon}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold"
                 style={{ color: active ? 'var(--sidebar-text)' : 'var(--sidebar-text)' }}>
              {label}
            </div>
            {sub && (
              <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>
                {sub}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        background: 'var(--sidebar-bg)',
        borderRight: `1px solid var(--sidebar-border)`,
        transition: 'width var(--dur) var(--ease)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,.35)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Brand header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            {brandMark()}
            {!collapsed && (
              <div className="leading-tight">
                <div className="text-[17px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>
                  reduc<span style={{ color: 'var(--brand)' }}>ai.io</span>
                </div>
                <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>
                  Builder Workspace
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          {/* WORKSPACE label */}
          {!collapsed && (
            <div className="px-1 text-[11px] mb-2 tracking-[.14em]"
                 style={{ color: 'var(--sidebar-muted)' }}>
              WORKSPACE
            </div>
          )}
          <nav className={collapsed ? 'grid gap-2' : 'grid gap-1.5'}>
            {top.map((i) => (
              <Item key={i.href} {...i} tint="green" />
            ))}
          </nav>

          {/* divider spacing */}
          <div className="my-3" />

          {/* RESOURCES label */}
          {!collapsed && (
            <div className="px-1 text-[11px] mb-2 tracking-[.14em]"
                 style={{ color: 'var(--sidebar-muted)' }}>
              RESOURCES
            </div>
          )}
          <nav className={collapsed ? 'grid gap-2' : 'grid gap-1.5'}>
            {bottom.map((i) => (
              <Item key={i.href} {...i} tint="neutral" />
            ))}
          </nav>
        </div>

        {/* Account (always visible) */}
        <div className="px-3 pb-4">
          <Link href="/account" title="Account" className="block">
            <div
              className="w-full flex items-center gap-3 rounded-2xl"
              style={{
                background: collapsed ? 'transparent' : 'rgba(15,18,20,.85)',
                border: collapsed ? '0' : '1px solid rgba(255,255,255,.08)',
                padding: collapsed ? 6 : 12,
              }}
            >
              <div className="w-8 h-8 rounded-full grid place-items-center"
                   style={{ background: 'color-mix(in oklab, var(--brand) 65%, #0b0c10)', boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
                <UserIcon className="w-4 h-4 text-black/80" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
                    {getDisplayName(userName, userEmail)}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
                    {userEmail || 'Signed in'}
                  </div>
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 -translate-y-1/2 rounded-full p-1.5"
          style={{
            border: '1px solid var(--sidebar-border)',
            background: 'var(--sidebar-bg)',
            boxShadow: '0 6px 16px rgba(0,0,0,.35)',
            transition: 'transform var(--dur) var(--ease), opacity var(--dur-quick) var(--ease)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
            : <ChevronLeft  className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />}
        </button>
      </div>
    </aside>
  );
}
