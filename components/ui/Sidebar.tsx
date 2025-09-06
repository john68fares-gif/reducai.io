'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight,
  User as UserIcon, Bot
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 260;
const W_COLLAPSED = 68;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

// brand greens (match your buttons / panels)
const BRAND = '#10b981';         // button fill
const BRAND_DEEP = '#12a989';    // icon / halo
const BRAND_WEAK = 'rgba(0,255,194,.10)';

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

type NavItem = {
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
  id: string;
};

const NAV: NavItem[] = [
  { id: 'create',  href: '/builder',      label: 'Create',       sub: 'Design your agent',     icon: <Home />,   group: 'workspace' },
  { id: 'tuning',  href: '/improve',      label: 'Tuning',       sub: 'Integrate & optimize',  icon: <Hammer />, group: 'workspace' },
  { id: 'voice',   href: '/voice-agent',  label: 'Voice Studio', sub: 'Calls & persona',       icon: <Mic />,    group: 'workspace' },
  { id: 'launch',  href: '/launch',       label: 'Launchpad',    sub: 'Go live',               icon: <Rocket />, group: 'workspace' },

  { id: 'numbers', href: '/phone-numbers', label: 'Numbers',     sub: 'Twilio & BYO',          icon: <Phone />,  group: 'resources' },
  { id: 'keys',    href: '/apikeys',       label: 'API Keys',     sub: 'Models & access',       icon: <Key />,    group: 'resources' },
  { id: 'help',    href: '/support',       label: 'Help',         sub: 'Guides & FAQ',          icon: <HelpCircle />, group: 'resources' },
];

export default function Sidebar() {
  const pathname = usePathname();

  // collapse (persist)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      return raw ? JSON.parse(raw) : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    // animate the shell width (used by your app shell if you read --sidebar-w)
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

  // helper for active state
  const pathnameActive = (item: NavItem) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch';
    return p.startsWith(item.href);
  };

  // workspace icons in green
  const isWorkspace = (id: string) => NAV.find(n => n.id === id)?.group === 'workspace';

  const Item = ({ item, active }: { item: NavItem; active: boolean }) => {
    const green = isWorkspace(item.id);
    return (
      <Link href={item.href} className="block group">
        <div
          className="nav-row flex items-center h-10 rounded-[12px] pr-2 transition-all"
          style={{
            paddingLeft: collapsed ? 0 : 10,
            gap: collapsed ? 0 : 10,
            // active row gets soft panel-ish bg (like your 30% rectangle feel)
            background: active ? 'var(--row-active-bg)' : 'transparent'
          }}
        >
          <div
            className="w-10 h-10 rounded-[12px] grid place-items-center transition-all"
            style={{
              background: 'var(--sb-icon-bg)',
              border: '1px solid var(--sb-icon-border)',
              boxShadow: active
                ? `0 0 0 1px ${BRAND_WEAK}, 0 8px 18px rgba(0,0,0,.22), 0 0 18px rgba(16,185,129,.25)`
                : 'inset 0 0 10px rgba(0,0,0,.16)',
              color: green ? BRAND_DEEP : 'var(--sidebar-text)',
            }}
            title={collapsed ? item.label : undefined}
          >
            {/* lucide icons take currentColor */}
            <span className="w-5 h-5">{item.icon}</span>
          </div>

          {/* label/sub hidden when collapsed */}
          <div
            className="overflow-hidden transition-[max-width,opacity,transform] duration-360"
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
              <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)', marginTop: 3 }}>
                {item.sub}
              </div>
            )}
          </div>
        </div>

        {/* thin glow underline on hover / active */}
        <div
          className="h-[2px] rounded-full transition-all"
          style={{
            transitionDuration: '360ms',
            marginLeft: collapsed ? 16 : 12,
            marginRight: 12,
            background: active ? 'linear-gradient(90deg, transparent, rgba(16,185,129,.35), transparent)'
                               : 'linear-gradient(90deg, transparent, rgba(16,185,129,.0), transparent)',
          }}
        />
      </Link>
    );
  };

  return (
    <aside
      className="sb-shell fixed left-0 top-0 h-screen z-50 font-movatif"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        // smoother, spring-like curve and no jank
        transition: 'width 380ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'width',

        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        borderRight: '1px solid var(--sidebar-border)',
        // subtle inner well to match your panels
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
              style={{ background: BRAND, boxShadow: '0 0 10px rgba(0,255,194,0.35)' }}
            >
              <Bot className="w-5 h-5 text-black" />
            </div>
            {/* logo text hides when collapsed */}
            <div
              className="overflow-hidden transition-[max-width,opacity,transform]"
              style={{
                transitionDuration: '380ms',
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                maxWidth: collapsed ? 0 : 200,
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              }}
            >
              <div className="text-[17px] font-semibold tracking-wide" style={{ color: 'var(--sidebar-text)' }}>
                reduc<span style={{ color: BRAND }}>ai.io</span>
              </div>
              <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>
                Builder Workspace
              </div>
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
          {/* WORKSPACE tag */}
          {!collapsed && (
            <div className="text-[10px] font-semibold tracking-[.14em] mb-2" style={{ color: 'var(--sidebar-muted)' }}>
              WORKSPACE
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'workspace').map(item => (
              <Item key={item.id} item={item} active={pathnameActive(item)} />
            ))}
          </nav>

          {/* divider spacing */}
          <div style={{ height: 14 }} />

          {/* RESOURCES tag */}
          {!collapsed && (
            <div className="text-[10px] font-semibold tracking-[.14em] mb-2" style={{ color: 'var(--sidebar-muted)' }}>
              RESOURCES
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'resources').map(item => (
              <Item key={item.id} item={item} active={pathnameActive(item)} />
            ))}
          </nav>
        </div>

        {/* Account area */}
        <div className="px-3 pb-4">
          {/* Expanded: full chip (LINKS to /account) */}
          {!collapsed ? (
            <Link
              href="/account"
              className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left transition-colors duration-300"
              style={{
                background: 'var(--acct-bg)',
                border: '1px solid var(--acct-border)',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,.18)',
                color: 'var(--sidebar-text)'
              }}
            >
              <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: BRAND, boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
                <UserIcon className="w-4 h-4 text-black/80" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
                  {userEmail || ''}
                </div>
              </div>
              <span className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>Account</span>
            </Link>
          ) : (
            // Collapsed: a small round icon-link that stays visible and clickable
            <Link
              href="/account"
              className="block mx-auto"
              title="Account"
            >
              <div
                className="w-10 h-10 rounded-full grid place-items-center"
                style={{
                  background: 'var(--sb-icon-bg)',
                  border: '1px solid var(--sb-icon-border)',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,.16)'
                }}
              >
                <UserIcon className="w-5 h-5" style={{ color: 'var(--sidebar-text)' }} />
              </div>
            </Link>
          )}
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid var(--sidebar-border)',
            background: 'var(--acct-bg)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18), 0 0 10px rgba(0,255,194,0.06)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} /> : <ChevronLeft className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />}
        </button>
      </div>

      {/* Theme-scoped tokens just for this sidebar */}
      <style jsx>{`
        /* row hover glow (subtle) */
        .sb-shell .nav-row:hover {
          background: var(--row-hover-bg);
        }

        /* LIGHT MODE (mirrors your global tokens) */
        :global(:root:not([data-theme="dark"])) .sb-shell {
          --sb-icon-bg: var(--card);
          --sb-icon-border: var(--border);
          --acct-bg: var(--card);
          --acct-border: var(--border);
          --row-hover-bg: rgba(0,0,0,.04);
          --row-active-bg: rgba(16,185,129,.10); /* faint green panel */
        }

        /* DARK MODE */
        :global([data-theme="dark"]) .sb-shell {
          --sb-icon-bg: rgba(255,255,255,.06);
          --sb-icon-border: rgba(255,255,255,.10);
          --acct-bg: rgba(15,18,20,.85);
          --acct-border: rgba(0,255,194,.12);
          --row-hover-bg: rgba(255,255,255,.04);
          --row-active-bg: rgba(16,185,129,.18);
        }
      `}</style>
    </aside>
  );
}
