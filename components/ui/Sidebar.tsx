// components/ui/Sidebar.tsx
'use client';

import { useEffect, useMemo, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket, Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight, ChevronDown, User as UserIcon, Bot,
  Sun, Moon, Search, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ───────────────── Widths (UX best practice) ───────────────── */
const W_EXPANDED_MIN = 240;
const W_EXPANDED_MAX = 300;
const W_EXPANDED     = 260;
const W_COLLAPSED    = 64;
const LS_COLLAPSED   = 'ui:sidebarCollapsed';
const LS_WIDTH       = 'ui:sidebarWidth';
const LS_THEME       = 'ui:theme';

/* Brand (match account.tsx / AssistantRail) */
const BRAND       = '#59d9b3';
const GREEN_LINE  = 'rgba(89,217,179,.20)';

type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
  // optional children for expandable sub-items
  children?: Array<{ id: string; href: string; label: string }>;
};

const NAV: NavItem[] = [
  {
    id: 'create',
    href: '/builder',
    label: 'Create',
    sub: 'Design your agent',
    icon: <Home />,
    group: 'workspace',
    children: [
      { id: 'flows', href: '/builder/flows', label: 'Flows' },
      { id: 'prompts', href: '/builder/prompts', label: 'Prompts' },
    ],
  },
  { id: 'tuning', href: '/improve',     label: 'Tuning',       sub: 'Integrate & optimize', icon: <Hammer />, group: 'workspace' },
  { id: 'voice',  href: '/voice-agent', label: 'Voice Studio', sub: 'Calls & persona',      icon: <Mic />,    group: 'workspace' },
  { id: 'launch', href: '/launch',      label: 'Launchpad',    sub: 'Go live',              icon: <Rocket />, group: 'workspace' },

  { id: 'numbers', href: '/phone-numbers', label: 'Numbers',   sub: 'Twilio & BYO',         icon: <Phone />,  group: 'resources' },
  { id: 'keys',    href: '/apikeys',       label: 'API Keys',  sub: 'Models & access',      icon: <Key />,    group: 'resources' },
  { id: 'help',    href: '/support',       label: 'Help',      sub: 'Guides & FAQ',         icon: <HelpCircle />, group: 'resources' },
];

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

/* ───────────────── Component ───────────────── */
export default function Sidebar() {
  const pathname = usePathname();

  /* Collapsed + width (with drag resize) */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });
  const [width, setWidth] = useState<number>(() => {
    try { return Number(localStorage.getItem(LS_WIDTH)) || W_EXPANDED; } catch { return W_EXPANDED; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
  }, [collapsed]);
  useEffect(() => {
    const w = collapsed ? W_COLLAPSED : Math.min(Math.max(width, W_EXPANDED_MIN), W_EXPANDED_MAX);
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
    try { localStorage.setItem(LS_WIDTH, String(w)); } catch {}
  }, [collapsed, width]);

  /* Theme (sync with account.tsx) */
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const stored = localStorage.getItem(LS_THEME) as 'dark' | 'light' | null;
      if (stored === 'dark' || stored === 'light') return stored;
      const sys = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      return (sys as 'dark' | 'light');
    } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(LS_THEME, theme); } catch {}
  }, [theme]);

  /* User */
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

  /* Quick search (client-only filter) */
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return NAV;
    return NAV.map(g => ({
      ...g,
      children: g.children?.filter(c => c.label.toLowerCase().includes(s)),
    }))
    .filter(item =>
      item.label.toLowerCase().includes(s) ||
      item.sub?.toLowerCase().includes(s) ||
      (item.children && item.children.length > 0)
    );
  }, [q]);

  /* Expandable sub-items */
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) => setOpenIds(prev => ({ ...prev, [id]: !prev[id] }));

  /* Active logic */
  const isActive = (href: string) => {
    const p = pathname || '';
    if (href === '/launch') return p === '/launch';
    return p.startsWith(href);
  };

  /* Drag to resize */
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging) return;
      const next = Math.min(Math.max(e.clientX, W_EXPANDED_MIN), W_EXPANDED_MAX);
      setWidth(next);
    }
    function onUp() { setDragging(false); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const renderIcon = (node: JSX.Element) =>
    cloneElement(node, { className: 'w-[18px] h-[18px] shrink-0', strokeWidth: 2 });

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

  const Row = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const hasChildren = (item.children?.length || 0) > 0;
    const open = openIds[item.id] ?? active; // auto-open if active

    return (
      <div>
        <button
          className="w-full group relative flex items-center rounded-[8px]"
          onClick={() => hasChildren ? toggleOpen(item.id) : null}
          aria-expanded={hasChildren ? open : undefined}
          aria-controls={hasChildren ? `${item.id}-subs` : undefined}
        >
          <Link
            href={item.href}
            className="flex-1 flex items-center h-10 rounded-[8px] pr-2"
            style={{
              paddingLeft: collapsed ? 6 : 8,
              gap: collapsed ? 0 : 8,
              position: 'relative',
              background: 'transparent',
            }}
          >
            {/* Icon tile */}
            <div
              className="w-9 h-9 rounded-[8px] grid place-items-center"
              style={{
                background: 'var(--panel)',
                border: `1px solid ${GREEN_LINE}`,
                boxShadow: active
                  ? `inset 0 0 0 1px ${GREEN_LINE}, 0 0 0 1px ${GREEN_LINE}, 0 10px 24px rgba(0,0,0,.14)`
                  : 'var(--shadow-card)',
                color: BRAND,
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
                transition: 'all .35s var(--ease)',
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

            {/* Active glow bar */}
            {!collapsed && (
              <span
                aria-hidden
                className="ml-auto h-[2px] rounded-full"
                style={{
                  width: 44,
                  background: active
                    ? 'linear-gradient(90deg, transparent, rgba(89,217,179,.55), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(89,217,179,0), transparent)',
                  transition: 'background .25s var(--ease)',
                }}
              />
            )}
          </Link>

          {/* Chevron for children */}
          {hasChildren && !collapsed && (
            <button
              className="absolute right-2 grid place-items-center w-6 h-6 rounded-[6px]"
              onClick={() => toggleOpen(item.id)}
              aria-label={open ? 'Collapse' : 'Expand'}
              type="button"
              style={{ border: `1px solid ${GREEN_LINE}`, background: 'var(--panel)', color: 'var(--text)' }}
            >
              <ChevronDown
                className="w-4 h-4"
                style={{
                  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform .2s var(--ease)',
                }}
              />
            </button>
          )}
        </button>

        {/* Sub-items */}
        {hasChildren && (
          <div
            id={`${item.id}-subs`}
            style={{
              height: open && !collapsed ? 'auto' : 0,
              overflow: 'hidden',
              transition: 'height .24s var(--ease)',
              marginTop: open && !collapsed ? 6 : 0,
              paddingLeft: collapsed ? 0 : 14,
            }}
            aria-hidden={collapsed ? true : !open}
          >
            {!collapsed && open && (
              <div className="grid gap-1">
                {item.children!.map(c => {
                  const subActive = isActive(c.href);
                  return (
                    <Link
                      key={c.id}
                      href={c.href}
                      className="flex items-center h-8 rounded-[6px] px-2 text-[12px]"
                      style={{
                        border: `1px solid ${subActive ? GREEN_LINE : 'transparent'}`,
                        background: subActive ? 'color-mix(in oklab, var(--brand) 8%, var(--panel))' : 'transparent',
                        color: 'var(--text)',
                        transition: 'all .2s var(--ease)',
                      }}
                    >
                      <span
                        className="inline-block mr-2"
                        style={{
                          width: 6, height: 6, borderRadius: 999,
                          background: subActive ? BRAND : GREEN_LINE,
                        }}
                      />
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* row divider */}
        <div className="h-[2px] rounded-full" style={{
          marginLeft: collapsed ? 10 : 8,
          marginRight: 8,
          background: 'linear-gradient(90deg, transparent, rgba(89,217,179,.10), transparent)',
        }} />
      </div>
    );
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 va-scope"
      style={{
        width: collapsed ? W_COLLAPSED : Math.min(Math.max(width, W_EXPANDED_MIN), W_EXPANDED_MAX),
        transition: dragging ? 'none' : 'width 320ms var(--ease)',
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
              style={{ background: BRAND, boxShadow: '0 0 10px rgba(89,217,179,.35)' }}
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
                reduc<span style={{ color: BRAND }}>ai.io</span>
              </div>
            </div>
          </div>

          {/* Quick search */}
          {!collapsed && (
            <div className="mt-3 relative">
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="Search…"
                className="w-full h-[34px] pl-8 pr-3 text-sm outline-none rounded-[8px]"
                style={{ background: 'var(--panel)', border: `1px solid ${GREEN_LINE}`, color: 'var(--text)' }}
              />
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>

        {/* Groups */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          {!collapsed && <GroupTag>WORKSPACE</GroupTag>}
          <nav className="space-y-[6px]">
            {filtered.filter(n => n.group === 'workspace').map(item => (
              <Row key={item.id} item={item} />
            ))}
          </nav>

          <div style={{ height: 12 }} />

          {!collapsed && <GroupTag>RESOURCES</GroupTag>}
          <nav className="space-y-[6px]">
            {filtered.filter(n => n.group === 'resources').map(item => (
              <Row key={item.id} item={item} />
            ))}
          </nav>
        </div>

        {/* Bottom: updates + account + mode switch */}
        <div className="px-3 pb-3" style={{ borderTop: `1px solid ${GREEN_LINE}` }}>
          {/* Updates slot */}
          {!collapsed && (
            <Link
              href="/changelog"
              className="mb-2 block rounded-[8px] px-3 py-2"
              style={{ background: 'color-mix(in oklab, var(--brand) 8%, var(--panel))', border: `1px solid ${GREEN_LINE}`, color: 'var(--text)' }}
            >
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4" style={{ color: BRAND }} />
                New: Voice agent folders
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>See what’s new this week</div>
            </Link>
          )}

          {/* Account card */}
          <Link
            href="/account"
            className="w-full rounded-[8px] px-3 py-3 flex items-center gap-3 text-left"
            style={{ background: 'var(--panel)', border: `1px solid ${GREEN_LINE}`, color: 'var(--text)' }}
          >
            <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: BRAND, boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
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

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            className="mt-2 w-full h-[36px] rounded-[8px] flex items-center justify-center gap-2"
            style={{ background: 'var(--panel)', border: `1px solid ${GREEN_LINE}`, color: 'var(--text)' }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {!collapsed && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
          </button>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
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

        {/* Resize handle (drag to resize when expanded) */}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={() => setDragging(true)}
            style={{
              position: 'absolute', top: 0, right: 0, width: 6, height: '100%',
              cursor: 'col-resize',
              background: 'transparent',
            }}
          />
        )}
      </div>

      {/* Light/Dark tokens (match account.tsx) */}
      <style jsx>{`
        /* Inherit CSS vars from .va-scope (account/agent tokens).
           Add only what's sidebar-specific here. */
        :global(:root:not([data-theme="dark"])) .fixed.left-0 {
          /* Light tweaks already handled by global tokens from account.tsx */
        }
        :global([data-theme="dark"]) .fixed.left-0 {
          /* Dark tweaks handled by global tokens */
        }
      `}</style>
    </aside>
  );
}
