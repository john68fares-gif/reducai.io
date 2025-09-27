// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket, Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight, User as UserIcon, Bot, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* Widths */
const W_EXPANDED = 260;
const W_COLLAPSED = 64;
const LS_COLLAPSED = 'ui:sidebarCollapsed';
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
};

const NAV: NavItem[] = [
  { id: 'create', href: '/builder',      label: 'Create',       sub: 'Design your agent',     icon: <Home />,   group: 'workspace' },
  { id: 'tuning', href: '/improve',      label: 'Tuning',       sub: 'Integrate & optimize',  icon: <Hammer />, group: 'workspace' },
  { id: 'voice',  href: '/voice-agent',  label: 'Voice Studio', sub: 'Calls & persona',       icon: <Mic />,    group: 'workspace' },
  { id: 'launch', href: '/launch',       label: 'Launchpad',    sub: 'Go live',               icon: <Rocket />, group: 'workspace' },

  { id: 'numbers', href: '/phone-numbers', label: 'Numbers',    sub: 'Twilio & BYO',          icon: <Phone />,  group: 'resources' },
  { id: 'keys',    href: '/apikeys',       label: 'API Keys',    sub: 'Models & access',       icon: <Key />,    group: 'resources' },
  { id: 'help',    href: '/support',       label: 'Help',        sub: 'Guides & FAQ',          icon: <HelpCircle />, group: 'resources' },
];

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

export default function Sidebar() {
  const pathname = usePathname();

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

  const isActive = (href: string) => {
    const p = pathname || '';
    if (href === '/launch') return p === '/launch';
    return p.startsWith(href);
  };

  const renderIcon = (node: JSX.Element) =>
    cloneElement(node, { className: 'w-[18px] h-[18px] shrink-0', strokeWidth: 2 });

  const Item = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);

    return (
      <Link href={item.href} className="block group">
        <div
          className="relative flex items-center h-10 rounded-[8px] pr-2 transition-transform"
          style={{
            paddingLeft: collapsed ? 6 : 8,
            gap: collapsed ? 0 : 8,
            // hover = same soft card shadow / gentle lift as account.tsx
            boxShadow: 'none',
          }}
        >
          {/* Icon tile — match “Create overlay” vibe (CTA + soft glow) */}
          <div
            className="w-9 h-9 rounded-[8px] grid place-items-center transition-transform"
            style={{
              background: 'var(--panel)',
              border: `1px solid ${GREEN_LINE}`,
              color: CTA,
              filter: 'drop-shadow(0 0 8px rgba(89,217,179,.30))',
              boxShadow: active
                ? `inset 0 0 0 1px ${GREEN_LINE}, 0 8px 20px rgba(0,0,0,.16)`
                : 'inset 0 0 0 1px rgba(0,0,0,0)',
            }}
            title={collapsed ? item.label : undefined}
          >
            {renderIcon(item.icon)}
          </div>

          {/* Labels */}
          <div
            className="overflow-hidden"
            style={{
              maxWidth: collapsed ? 0 : 220,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              transition: 'all .28s var(--ease)',
              lineHeight: 1.1,
            }}
          >
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
              {item.label}
            </div>
            {item.sub && (
              <div className="text-[11px] mt-[2px]" style={{ color: 'var(--text-muted)' }}>
                {item.sub}
              </div>
            )}
          </div>

          {/* Active accent — subtle, no bottom lines */}
          {!collapsed && active && (
            <span
              aria-hidden
              className="ml-auto rounded-full"
              style={{ width: 8, height: 8, background: CTA }}
            />
          )}
        </div>

        {/* Card-like hover background with shadow (no separators) */}
        <style jsx>{`
          a.block.group > div:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-card);
            background: color-mix(in oklab, var(--brand) 4%, var(--panel));
            border: 1px solid ${GREEN_LINE};
          }
          a.block.group > div {
            border: 1px solid transparent;
          }
        `}</style>
      </Link>
    );
  };

  const GroupTag = ({ children }:{ children:React.ReactNode }) => (
    !collapsed ? (
      <div
        className="inline-flex items-center h-6 px-2 rounded-full border text-[10px] font-semibold tracking-[.14em] mb-2"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--panel)' }}
      >
        {children}
      </div>
    ) : null
  );

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 va-scope"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width 320ms var(--ease)',
        background: `linear-gradient(90deg, var(--panel) 0%, color-mix(in oklab, var(--panel) 97%, white 3%) 50%, var(--panel) 100%)`,
        color: 'var(--text)',
        borderRight: `1px solid ${GREEN_LINE}`,
        boxShadow: 'var(--shadow-card)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="px-3 pt-4 pb-3" style={{ borderBottom: `1px solid ${GREEN_LINE}` }}>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-[8px] grid place-items-center shrink-0"
              style={{ background: CTA, boxShadow: '0 0 10px rgba(89,217,179,.35)' }}
            >
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div
              className="overflow-hidden"
              style={{
                maxWidth: collapsed ? 0 : 200,
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                transition: 'all .32s var(--ease)',
              }}
            >
              <div className="text-[16px] font-semibold">
                reduc<span style={{ color: CTA }}>ai.io</span>
              </div>
            </div>
          </div>
        </div>

        {/* Groups (no search, no dividers) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          {!collapsed && <GroupTag>WORKSPACE</GroupTag>}
          <nav className="space-y-[8px]">
            {NAV.filter(n => n.group === 'workspace').map(item => (
              <Item key={item.id} item={item} />
            ))}
          </nav>

          <div style={{ height: 12 }} />

          {!collapsed && <GroupTag>RESOURCES</GroupTag>}
          <nav className="space-y-[8px]">
            {NAV.filter(n => n.group === 'resources').map(item => (
              <Item key={item.id} item={item} />
            ))}
          </nav>
        </div>

        {/* Bottom: Weekly updates + Account (no mode switch) */}
        <div className="px-3 pb-3" style={{ borderTop: `1px solid ${GREEN_LINE}` }}>
          {!collapsed && (
            <Link
              href="/updates"
              className="mb-2 block rounded-[8px] px-3 py-2"
              style={{
                background: 'color-mix(in oklab, var(--brand) 8%, var(--panel))',
                border: `1px solid ${GREEN_LINE}`, color: 'var(--text)',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4" style={{ color: CTA }} />
                Weekly Updates
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Catch up on this week’s changes
              </div>
            </Link>
          )}

          <Link
            href="/account"
            className="w-full rounded-[8px] px-3 py-3 flex items-center gap-3 text-left"
            style={{ background: 'var(--panel)', border: `1px solid ${GREEN_LINE}`, color: 'var(--text)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: CTA, boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
              <UserIcon className="w-4 h-4 text-black/80" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {userEmail || ''}
                </div>
              </div>
            )}
            {!collapsed && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Account</span>
            )}
          </Link>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: `1px solid ${GREEN_LINE}`,
            background: 'var(--panel)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--text)' }} />
                     : <ChevronLeft  className="w-4 h-4" style={{ color: 'var(--text)' }} />}
        </button>
      </div>

      {/* Inherit tokens from account.tsx (.va-scope). Nothing extra needed here. */}
    </aside>
  );
}
