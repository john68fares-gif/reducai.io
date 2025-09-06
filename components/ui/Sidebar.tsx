'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight,
  Settings as SettingsIcon, LogOut, User as UserIcon, Bot
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 260;
const W_COLLAPSED = 68;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

// brand greens (matches your buttons/panels)
const BRAND = '#10b981';         // button fill
const BRAND_DEEP = '#12a989';    // icon highlight
const BRAND_WEAK = 'rgba(16,185,129,.28)';

type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
};

const NAV: NavItem[] = [
  { id: 'create',  href: '/builder',      label: 'Create',       sub: 'Design your agent',     icon: <Home />,   group: 'workspace' },
  { id: 'tuning',  href: '/improve',      label: 'Tuning',       sub: 'Integrate & optimize',  icon: <Hammer />, group: 'workspace' },
  { id: 'voice',   href: '/voice-agent',  label: 'Voice Studio', sub: 'Calls & persona',       icon: <Mic />,    group: 'workspace' },
  { id: 'launch',  href: '/launch',       label: 'Launchpad',    sub: 'Go live',               icon: <Rocket />, group: 'workspace' },

  { id: 'numbers', href: '/phone-numbers', label: 'Numbers',  sub: 'Twilio & BYO',     icon: <Phone />,      group: 'resources' },
  { id: 'keys',    href: '/apikeys',       label: 'API Keys', sub: 'Models & access',  icon: <Key />,        group: 'resources' },
  { id: 'help',    href: '/support',       label: 'Help',     sub: 'Guides & FAQ',     icon: <HelpCircle />, group: 'resources' },
];

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

export default function Sidebar() {
  const pathname = usePathname();

  // collapse (persist)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  // auth chip info
  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserLoading(false);
      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
        setUserLoading(false);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const onSignOut = async () => { try { await supabase.auth.signOut(); } catch {} };

  const isWorkspace = (id: string) => NAV.find(n => n.id === id)?.group === 'workspace';
  const isActive = (item: NavItem) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch';
    return p.startsWith(item.href);
  };

  const Item = ({ item }: { item: NavItem }) => {
    const active = isActive(item);
    const green = isWorkspace(item.id);

    return (
      <Link href={item.href} className="block sb-item">
        <div
          className="flex items-center h-10 rounded-[12px] pr-2 sb-row"
          style={{ paddingLeft: collapsed ? 0 : 10, gap: collapsed ? 0 : 10 }}
        >
          <div
            className="w-10 h-10 rounded-[12px] grid place-items-center sb-icon"
            title={collapsed ? item.label : undefined}
            style={{
              color: green ? BRAND_DEEP : 'var(--sidebar-icon)',
              background: 'var(--sb-icon-bg)',
              border: '1px solid var(--sb-icon-border)',
              boxShadow: active
                ? `0 0 0 1px ${BRAND_WEAK}, 0 6px 16px rgba(0,0,0,.20), 0 0 16px rgba(16,185,129,.22)`
                : 'inset 0 0 10px rgba(0,0,0,.10)',
            }}
          >
            <span className="w-5 h-5">{item.icon}</span>
          </div>

          {/* labels (hidden when collapsed) */}
          <div
            className="overflow-hidden transition-[max-width,opacity,transform] duration-300"
            style={{
              maxWidth: collapsed ? 0 : 200,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              lineHeight: 1.1,
            }}
          >
            <div className="text-[13px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>
              {item.label}
            </div>
            {item.sub && (
              <div className="text-[11px] mt-[3px]" style={{ color: 'var(--sidebar-muted)' }}>
                {item.sub}
              </div>
            )}
          </div>
        </div>

        {/* subtle “soft rectangle” glow (hover/active) */}
        <div
          className="h-[2px] rounded-full transition-all duration-300 sb-underline"
          style={{
            marginLeft: collapsed ? 16 : 12,
            marginRight: 12,
            background: active
              ? 'linear-gradient(90deg, transparent, rgba(16,185,129,.35), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(16,185,129,0), transparent)',
          }}
        />
      </Link>
    );
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 font-movatif"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width 300ms var(--ease-out)',
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        borderRight: '1px solid var(--sidebar-border)',
        boxShadow: 'inset 0 0 16px rgba(0,0,0,0.20)',
      }}
      aria-label="Primary"
    >
      {/* right-edge separator glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, right: -1, bottom: 0, width: 22, pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(0,0,0,0), var(--sidebar-sep) 40%, rgba(0,0,0,0))',
          filter: 'blur(10px)', opacity: 0.9,
        }}
      />

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                 style={{ background: BRAND, boxShadow: '0 0 10px rgba(0,255,194,0.35)' }}>
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div
              className="overflow-hidden transition-[max-width,opacity,transform] duration-300"
              style={{ maxWidth: collapsed ? 0 : 200, opacity: collapsed ? 0 : 1, transform: collapsed ? 'translateX(-6px)' : 'translateX(0)' }}
            >
              <div className="text-[17px] font-semibold tracking-wide" style={{ color: 'var(--sidebar-text)' }}>
                reduc<span style={{ color: BRAND }}>ai.io</span>
              </div>
              <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Builder Workspace</div>
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-[88px]">
          {!collapsed && (
            <div className="text-[10px] font-semibold tracking-[.14em] mb-2" style={{ color: 'var(--sidebar-muted)' }}>
              WORKSPACE
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'workspace').map(n => <Item key={n.id} item={n} />)}
          </nav>

          <div style={{ height: 14 }} />

          {!collapsed && (
            <div className="text-[10px] font-semibold tracking-[.14em] mb-2" style={{ color: 'var(--sidebar-muted)' }}>
              RESOURCES
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'resources').map(n => <Item key={n.id} item={n} />)}
          </nav>
        </div>

        {/* Account (always visible & safe-area aware) */}
        <div
          className="sb-account"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: `max(12px, env(safe-area-inset-bottom))`,
          }}
        >
          <div className="flex items-center gap-2">
            {!collapsed ? (
              <button
                className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left transition-colors"
                style={{ background: 'var(--acct-bg)', border: '1px solid var(--acct-border)', color: 'var(--sidebar-text)' }}
              >
                <div className="w-8 h-8 rounded-full grid place-items-center"
                     style={{ background: BRAND, boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
                  <UserIcon className="w-4 h-4 text-black/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>{userEmail || ''}</div>
                </div>
              </button>
            ) : (
              <div className="w-10 h-10 rounded-[12px] grid place-items-center"
                   style={{ background: BRAND, boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
                <UserIcon className="w-5 h-5 text-black/80" />
              </div>
            )}

            {/* collapse toggle */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="rounded-full p-1.5"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                border: '1px solid var(--sb-icon-border)',
                background: 'var(--sb-icon-bg)',
                color: 'var(--sidebar-muted)',
                transition: 'background 200ms var(--ease-out), transform 200ms var(--ease-out)'
              }}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Hover/active glow on whole row */}
      <style jsx>{`
        .sb-item:hover .sb-row {
          background: var(--row-hover);
          transition: background 180ms var(--ease-out);
          border-radius: 12px;
        }
      `}</style>
    </aside>
  );
}
