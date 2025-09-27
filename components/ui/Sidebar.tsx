// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight,
  User as UserIcon, Bot
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ────────────────────────────────────────────────────────────────────────── */
/* Sizing & tokens to mirror AssistantRail vibe */
const W_EXPANDED = 228;   // slimmer
const W_COLLAPSED = 58;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

const CTA        = '#59d9b3';                 // same green
const GREEN_LINE = 'rgba(89,217,179,.20)';    // borders/lines
const R_SM = 6;
const R_MD = 8;
const R_LG = 10;

/* Helpers */
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

/* Same items as your file, but NO subaccounts */
const NAV: NavItem[] = [
  { id: 'create', href: '/builder',      label: 'Create',       sub: 'Design your agent',     icon: <Home />,   group: 'workspace' },
  { id: 'tuning', href: '/improve',      label: 'Tuning',       sub: 'Integrate & optimize',  icon: <Hammer />, group: 'workspace' },
  { id: 'voice',  href: '/voice-agent',  label: 'Voice Studio', sub: 'Calls & persona',       icon: <Mic />,    group: 'workspace' },
  { id: 'launch', href: '/launch',       label: 'Launchpad',    sub: 'Go live',               icon: <Rocket />, group: 'workspace' },

  { id: 'numbers', href: '/phone-numbers', label: 'Numbers',    sub: 'Twilio & BYO',          icon: <Phone />,  group: 'resources' },
  { id: 'keys',    href: '/apikeys',       label: 'API Keys',    sub: 'Models & access',       icon: <Key />,    group: 'resources' },
  { id: 'help',    href: '/support',       label: 'Help',        sub: 'Guides & FAQ',          icon: <HelpCircle />, group: 'resources' },
];

/* ────────────────────────────────────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  /* collapsed state */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      return raw ? JSON.parse(raw) : false;
    } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  /* user */
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

  const pathnameActive = (item: NavItem) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch';
    return p.startsWith(item.href);
  };

  /* Icon rendering (slightly smaller to match overlays) */
  const renderIcon = (node: JSX.Element) =>
    cloneElement(node, { className: 'w-[15px] h-[15px] shrink-0', strokeWidth: 2 });

  /* Overlay-style item (matches AssistantRail’s glow/overlay vibe) */
  const Item = ({ item, active }: { item: NavItem; active: boolean }) => {
    const isWorkspace = item.group === 'workspace';
    return (
      <Link href={item.href} className="block group">
        <div
          className="nav-row relative flex items-center h-[46px] rounded-[10px] pr-2"
          data-active={active ? 'true' : 'false'}
          style={{
            paddingLeft: collapsed ? 0 : 12,
            gap: collapsed ? 0 : 12,
            transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
            color: 'var(--sidebar-text)',
          }}
        >
          {/* square plate like overlay icons */}
          <div
            className="plate grid place-items-center"
            data-kind={isWorkspace ? 'workspace' : 'resources'}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: isWorkspace
                ? 'color-mix(in oklab, #12191d 88%, var(--brand) 12%)'
                : 'rgba(255,255,255,.06)',
              border: isWorkspace ? `1px solid ${GREEN_LINE}` : '1px solid rgba(255,255,255,.12)',
              color: isWorkspace ? CTA : '#fff',
            }}
            title={collapsed ? item.label : undefined}
          >
            {renderIcon(item.icon)}
          </div>

          {/* labels */}
          <div
            className="overflow-hidden"
            style={{
              maxWidth: collapsed ? 0 : 170,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
              lineHeight: 1.05,
            }}
          >
            <div className="text-[13.5px]" style={{ color: 'var(--sidebar-text)', fontWeight: 520 }}>
              {item.label}
            </div>
            {item.sub && isWorkspace && (
              <div className="text-[11.5px] mt-[2px]" style={{ color: 'var(--sidebar-muted)', fontWeight: 440 }}>
                {item.sub}
              </div>
            )}
          </div>

          {/* tiny active dot at far right when expanded */}
          {!collapsed && active && (
            <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: CTA }} />
          )}

          {/* overlay/glow like AssistantRail */}
          <style jsx>{`
            .nav-row::after{
              content:'';
              position:absolute; inset:0;
              border-radius:${R_MD}px;
              background:${CTA};
              opacity:0; pointer-events:none;
              transition:opacity .18s ease, transform .18s ease;
              mix-blend-mode:screen;
            }
            .nav-row::before{
              content:'';
              position:absolute; left:8px; right:8px; top:-6px;
              height:16px; border-radius:${R_MD}px;
              background:radial-gradient(60% 80% at 50% 100%, rgba(89,217,179,.45) 0%, rgba(89,217,179,0) 100%);
              opacity:0; pointer-events:none;
              transition:opacity .18s ease;
              filter:blur(6px);
            }
            .nav-row:hover::after{ opacity:.20; }
            .nav-row[data-active="true"]::after{ opacity:.34; }
            .nav-row:hover::before{ opacity:.75; }
            .nav-row[data-active="true"]::before{ opacity:1; }
            .nav-row:hover{ transform: translateY(-1px); }
          `}</style>
        </div>

        {/* band separator under each item (very subtle, left→right) */}
        <div
          className="h-[2px] rounded-full"
          style={{
            marginLeft: collapsed ? 16 : 12,
            marginRight: 12,
            transition: 'opacity 180ms',
            background: active
              ? 'linear-gradient(90deg, transparent, rgba(89,217,179,.28), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(89,217,179,.0), transparent)',
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
        transition: 'width 320ms cubic-bezier(0.16,1,0.3,1)',
        background:
          // super-subtle horizontal bands using tokens (no bands inside brand/account blocks)
          'linear-gradient(90deg, var(--panel) 0%, color-mix(in oklab, var(--panel) 99.5%, var(--brand) .5%) 50%, var(--panel) 100%)',
        color: 'var(--sidebar-text)',
        borderRight: `1px solid ${GREEN_LINE}`,
        boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* BRAND (filled, centered; no bands here) */}
        <div className="px-3 pt-5 pb-4" style={{ background: 'var(--panel)' }}>
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-10 h-10 rounded-[12px] grid place-items-center shrink-0"
              style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)' }}
            >
              <Bot className="w-5 h-5" style={{ color: '#fff' }} />
            </div>
            {!collapsed && (
              <div className="text-[16px]" style={{ color: 'var(--sidebar-text)', fontWeight: 560 }}>
                Reduc <span style={{ color: CTA, fontWeight: 520 }}>AI</span>
              </div>
            )}
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
          <nav className="space-y-[6px] mt-1">
            {NAV.filter(n => n.group === 'workspace').map(item => (
              <Item key={item.id} item={item} active={pathnameActive(item)} />
            ))}
          </nav>

          {/* Divider (left→right, subtle) */}
          <div className="my-3" style={{ height: 1, background: GREEN_LINE }} />

          {/* RESOURCES (dark plates with white icons, low opacity by default) */}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'resources').map(item => (
              <Item key={item.id} item={item} active={pathnameActive(item)} />
            ))}
          </nav>
        </div>

        {/* Account (teal-ish card; not grey; no bands) */}
        <div className="px-3 pb-4" style={{ background: 'var(--panel)' }}>
          <button
            onClick={() => router.push('/account')}
            className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
            style={{
              background: 'linear-gradient(180deg, rgba(23,34,37,.92), rgba(11,18,20,.9))',
              border: `1px solid ${GREEN_LINE}`,
              boxShadow: 'inset 0 0 8px rgba(0,0,0,.18)',
              color: 'var(--sidebar-text)',
            }}
          >
            <div className="w-8 h-8 rounded-[10px] grid place-items-center" style={{ background: CTA }}>
              <UserIcon className="w-4 h-4 text-black/85" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[13px] truncate" style={{ fontWeight: 560 }}>
                  {userLoading ? 'Account' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
                  {userEmail || 'Open account'}
                </div>
              </div>
            )}
            {!collapsed && (
              <span className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Open</span>
            )}
          </button>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: `1px solid ${GREEN_LINE}`,
            background: 'rgba(89,217,179,.10)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18), 0 0 10px rgba(0,255,194,0.06)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
                     : <ChevronLeft className="w-4 h-4"  style={{ color: 'var(--sidebar-text)' }} />}
        </button>
      </div>

      {/* Light/Dark variable sets (keep in-component to avoid global collisions) */}
      <style jsx>{`
        :global(:root:not([data-theme="dark"])) .fixed.left-0 {
          --sidebar-text: #0f172a;
          --sidebar-muted: #64748b;
          --panel: #ffffff;
          --brand: ${CTA};
        }
        :global([data-theme="dark"]) .fixed.left-0 {
          --sidebar-text: var(--text, rgba(236,242,247,.92));
          --sidebar-muted: var(--text-muted, #9fb4ad);
          --panel: var(--panel, #0d0f11);
          --brand: var(--brand, ${CTA});
        }

        /* Resource plate icon color flips in light automatically because we set white by default;
           tweak for light if you want darker icons there: */
        :global(:root:not([data-theme="dark"])) .fixed.left-0 .plate[data-kind="resources"]{
          color: #0f172a;
          background: rgba(15,23,42,.06);
          border: 1px solid rgba(15,23,42,.12);
        }
      `}</style>
    </aside>
  );
}
