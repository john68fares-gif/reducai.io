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

/* ───────────────── sizes / storage ───────────────── */
const W_EXPANDED = 214;      // narrower
const W_COLLAPSED = 62;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

/* ───────────────── theme ───────────────── */
const CTA        = '#59d9b3';                     // brand mint
const TEXT       = 'rgba(236,242,247,.92)';
const MUTED      = 'rgba(176,196,210,.62)';
const BORDER     = 'rgba(255,255,255,.10)';
const BASE       = '#0a0f12';                     // deep teal/blue center
const PANEL_DARK = '#0b1114';

/* Wider, darker bands; L→R; center darkest, sides +~4% */
function banded(steps = 11, cap = 0.04, base = BASE) {
  const parts: string[] = [];
  const center = Math.ceil(steps / 2);
  const w = 100 / steps;
  for (let i = 1; i <= steps; i++) {
    const d = Math.abs(i - center);
    const light = Math.min((cap / (center - 1)) * d, cap);
    const col = `color-mix(in oklab, ${base} ${100 - light * 100}%, ${CTA} ${light * 100}%)`;
    parts.push(`${col} ${(i - 1) * w}%, ${col} ${i * w}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* thin strip header (for section labels) */
const sectionStrip = () =>
  `linear-gradient(90deg, ${PANEL_DARK} 0%,
                    color-mix(in oklab, ${PANEL_DARK} 97%, white 3%) 50%,
                    ${PANEL_DARK} 100%)`;

/* ───────────────── helpers ───────────────── */
function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

type NavItem = {
  id: 'create'|'tuning'|'voice'|'launch'|'numbers'|'keys'|'help';
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace'|'resources';
};

/* exact names; no Subaccounts */
const NAV: NavItem[] = [
  { id: 'create', href: '/builder',     label: 'Create',       sub: 'Create AI agent',      icon: <Home />,       group: 'workspace' },
  { id: 'tuning', href: '/improve',     label: 'Tuning',       sub: 'Integrate & optimize', icon: <Hammer />,     group: 'workspace' },
  { id: 'voice',  href: '/voice-agent', label: 'Voice Studio', sub: 'Calls & persona',      icon: <Mic />,        group: 'workspace' },
  { id: 'launch', href: '/launch',      label: 'Launchpad',    sub: 'Go live',              icon: <Rocket />,     group: 'workspace' },

  { id: 'numbers', href: '/phone-numbers', label: 'Numbers',   icon: <Phone />,             group: 'resources' },
  { id: 'keys',    href: '/apikeys',       label: 'API Keys',  icon: <Key />,               group: 'resources' },
  { id: 'help',    href: '/support',       label: 'Help',      icon: <HelpCircle />,        group: 'resources' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  // user + loading veil for account
  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [veil, setVeil] = useState(false);

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

  // icon sizing: smaller
  const renderIcon = (node: JSX.Element) =>
    cloneElement(node, { className: 'w-[14px] h-[14px] shrink-0', strokeWidth: 2 });

  const Item = ({ item, active, whiteIcon = false }: { item: NavItem; active: boolean; whiteIcon?: boolean }) => (
    <Link href={item.href} className="block group">
      <div
        className="relative flex items-center h-[40px] rounded-[9px] pr-2"
        style={{
          transition: 'gap 300ms cubic-bezier(0.16,1,0.3,1), padding 300ms cubic-bezier(0.16,1,0.3,1)',
          paddingLeft: collapsed ? 0 : 10,
          gap: collapsed ? 0 : 10,
        }}
      >
        {/* plate: dark, not grey; workspace = mint tint, resources = deep plate w/ white icon */}
        <div
          className="w-8.5 h-8.5 rounded-[9px] grid place-items-center"
          style={{
            background: whiteIcon
              ? 'rgba(255,255,255,.08)'
              : 'color-mix(in oklab, #12191d 86%, #59d9b3 14%)',
            border: `1px solid ${whiteIcon ? 'rgba(255,255,255,.14)' : 'rgba(89,217,179,.24)'}`,
            boxShadow: active
              ? '0 0 0 1px rgba(0,255,194,.10), 0 8px 18px rgba(0,0,0,.22)'
              : 'inset 0 0 10px rgba(0,0,0,.14)',
            color: whiteIcon ? '#fff' : (active ? CTA : TEXT),
          }}
          title={collapsed ? item.label : undefined}
        >
          {renderIcon(item.icon)}
        </div>

        <div
          className="overflow-hidden"
          style={{
            transition: 'max-width 300ms cubic-bezier(0.16,1,0.3,1), opacity 300ms, transform 300ms',
            maxWidth: collapsed ? 0 : 168,
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
            lineHeight: 1.1,
          }}
        >
          <div className="text-[13px] font-semibold" style={{ color: TEXT }}>
            {item.label}
          </div>
          {item.sub && (
            <div className="text-[11px]" style={{ color: MUTED, marginTop: 3 }}>
              {item.sub}
            </div>
          )}
        </div>

        {!collapsed && active && (
          <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: CTA }} />
        )}
      </div>
    </Link>
  );

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen z-50 font-movatif"
        style={{
          width: collapsed ? W_COLLAPSED : W_EXPANDED,
          transition: 'width 360ms cubic-bezier(0.16,1,0.3,1)',
          background: banded(),                 // ← lines L→R, wider/darker
          color: TEXT,
          borderRight: `1px solid ${BORDER}`,
          boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)',
        }}
        aria-label="Primary"
      >
        <div className="relative h-full flex flex-col">
          {/* brand row */}
          <div className="px-3 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                style={{ background: CTA, boxShadow: '0 0 12px rgba(0,255,194,.32)' }}
              >
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div
                className="overflow-hidden"
                style={{
                  transition: 'max-width 360ms cubic-bezier(0.16,1,0.3,1), opacity 360ms, transform 360ms',
                  maxWidth: collapsed ? 0 : 200,
                  opacity: collapsed ? 0 : 1,
                  transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                }}
              >
                <div className="text-[18px] font-semibold tracking-wide">
                  reduc<span style={{ color: CTA }}>ai</span>.io
                </div>
              </div>
            </div>
          </div>

          {/* separator line under brand */}
          <div aria-hidden className="mx-3" style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />

          {/* WORKSPACE */}
          <div className="px-3 mt-2">
            {!collapsed && (
              <div className="px-2 py-1 rounded-[8px] mb-2"
                   style={{ background: sectionStrip(), border: `1px solid rgba(89,217,179,.18)` }}>
                <div className="text-[11px] font-semibold tracking-[.14em]" style={{ color: MUTED }}>
                  WORKSPACE
                </div>
              </div>
            )}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'workspace').map(item => (
                <Item key={item.id} item={item} active={pathnameActive(item)} />
              ))}
            </nav>
          </div>

          {/* push resources down */}
          <div className="flex-1" />

          {/* RESOURCES pinned near bottom */}
          <div className="px-3">
            {!collapsed && (
              <div className="px-2 py-1 rounded-[8px] mb-2"
                   style={{ background: sectionStrip(), border: `1px solid rgba(89,217,179,.18)` }}>
                <div className="text-[11px] font-semibold tracking-[.14em]" style={{ color: MUTED }}>
                  RESOURCES
                </div>
              </div>
            )}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'resources').map(item => (
                <Item key={item.id} item={item} active={pathnameActive(item)} whiteIcon />
              ))}
            </nav>
          </div>

          {/* Account (teal gradient, not grey) */}
          <div className="px-3 pb-4 pt-3">
            <button
              onClick={() => {
                setVeil(true);
                setTimeout(() => router.push('/account'), 120);
              }}
              className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
              style={{
                background: 'linear-gradient(180deg, rgba(23,34,37,.95), rgba(11,18,20,.92))',
                border: `1px solid ${BORDER}`,
                boxShadow: 'inset 0 0 10px rgba(0,0,0,.18), 0 6px 18px rgba(0,0,0,.25)',
                color: TEXT
              }}
            >
              <div
                className="w-9 h-9 rounded-full grid place-items-center"
                style={{
                  background: 'radial-gradient(60% 60% at 30% 30%, #1ff4c3 0%, #13b995 55%, #0d8d76 100%)',
                  boxShadow: '0 0 10px rgba(31,244,195,.22), 0 0 0 2px rgba(89,217,179,.14) inset'
                }}
              >
                <UserIcon className="w-4 h-4 text-black/85" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: MUTED }}>
                  {userEmail || 'Open account'}
                </div>
              </div>
              <span className="text-xs" style={{ color: MUTED }}>Open</span>
            </button>
          </div>

          {/* Collapse handle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
            style={{
              border: `1px solid rgba(89,217,179,.26)`,
              background: 'rgba(89,217,179,.10)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.18), 0 0 10px rgba(0,255,194,0.10)',
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" style={{ color: CTA }} />
              : <ChevronLeft  className="w-4 h-4" style={{ color: CTA }} />}
          </button>
        </div>
      </aside>

      {/* loading veil on account open */}
      {veil && (
        <div
          className="fixed inset-0 z-[99999] grid place-items-center"
          style={{ background: 'rgba(6,8,10,.62)', backdropFilter: 'blur(6px)' }}
        >
          <div className="rounded-xl px-4 py-3"
               style={{ background: 'rgba(15,18,20,.92)', border: `1px solid ${BORDER}`, color: TEXT }}>
            Loading account…
          </div>
        </div>
      )}
    </>
  );
}
