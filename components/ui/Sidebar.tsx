// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  Key, HelpCircle,
  ChevronLeft, ChevronRight,
  User as UserIcon, Bot,
  ShoppingBag, Brain, Grid2X2, PlayCircle, LifeBuoy
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ---------- Sizes & storage ---------- */
const W_EXPANDED = 220;     // narrower
const W_COLLAPSED = 64;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

/* ---------- Palette ---------- */
const GREEN = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.22)';
const BLUE_BASE = '#0b1013';
const BLUE_SIDE = '#0f1519';
const TEXT = 'rgba(236,242,247,.92)';
const MUTED = 'rgba(176,196,210,.60)';

/* Subtle banded BG: dark middle → slight lighter edges */
function bandedSidebarBg(steps = 17, cap = 0.06) {
  const parts: string[] = [];
  const center = Math.ceil(steps / 2);
  const bw = 100 / steps;
  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);
    const lighten = Math.min((cap / (center - 1)) * dist, cap);
    const col = `color-mix(in oklab,
      ${BLUE_BASE} ${100 - lighten * 100}%,
      color-mix(in oklab, ${BLUE_SIDE} 85%, ${GREEN} 15%) ${lighten * 100}%
    )`;
    parts.push(`${col} ${(i - 1) * bw}%, ${col} ${i * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

/* ---------- Types & nav ---------- */
type NavItem = {
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
  id: string;
};

const NAV: NavItem[] = [
  { id: 'build',   href: '/builder',      label: 'Build',   sub: 'Create AI agent',      icon: <Home />,   group: 'workspace' },
  { id: 'improve', href: '/improve',      label: 'Improve', sub: 'Integrate and Improve',icon: <Hammer />, group: 'workspace' },
  { id: 'demo',    href: '/demo',         label: 'Demo',    sub: 'Showcase to clients',  icon: <Mic />,    group: 'workspace' },
  { id: 'launch',  href: '/launch',       label: 'Launch',  sub: 'Deploy to production', icon: <Rocket />, group: 'workspace' },

  { id: 'market',  href: '/marketplace',  label: 'Marketplace',  icon: <ShoppingBag />, group: 'resources' },
  { id: 'mentor',  href: '/ai-mentor',    label: 'AI Mentor',    icon: <Brain />,       group: 'resources' },
  { id: 'keys',    href: '/apikeys',      label: 'API Key',      icon: <Key />,         group: 'resources' },
  { id: 'bulk',    href: '/bulk-tester',  label: 'Bulk Tester',  icon: <Grid2X2 />,     group: 'resources' },
  { id: 'videos',  href: '/videos',       label: 'Video Guides', icon: <PlayCircle />,  group: 'resources' },
  { id: 'support', href: '/support',      label: 'Support',      icon: <LifeBuoy />,    group: 'resources' },
];

/* Icon plate — smaller & less rounded */
function IconPlate({
  children,
  invert = false,  // resources = white icons on darker plate
  active = false
}: { children: React.ReactNode; invert?: boolean; active?: boolean }) {
  const radius = 10;
  return (
    <div
      className="grid place-items-center shrink-0"
      style={{
        width: 36, height: 36,
        borderRadius: radius,
        background: invert ? 'rgba(255,255,255,.06)' : 'rgba(89,217,179,.09)',
        border: `1px solid ${invert ? 'rgba(255,255,255,.12)' : GREEN_LINE}`,
        boxShadow: active
          ? '0 0 0 1px rgba(0,255,194,.08), 0 8px 18px rgba(0,0,0,.22)'
          : 'inset 0 0 10px rgba(0,0,0,.14)',
        color: invert ? '#ffffff' : '#12a989'
      }}
    >
      {children}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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

  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [veil, setVeil] = useState(false); // loading overlay for Account

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

  const pathnameActive = (item: NavItem) =>
    item.href === '/launch' ? (pathname || '') === '/launch' : (pathname || '').startsWith(item.href);

  const isWorkspace = (id: string) => NAV.find(n => n.id === id)?.group === 'workspace';

  const renderIcon = (node: JSX.Element, invert?: boolean) =>
    cloneElement(node, { className: 'w-[16px] h-[16px] shrink-0', strokeWidth: 2, style: { color: invert ? '#fff' : undefined } });

  const Item = ({ item, active }: { item: NavItem; active: boolean }) => {
    const workspace = isWorkspace(item.id);
    return (
      <Link href={item.href} className="block group">
        <div
          className="relative flex items-center h-[42px] rounded-[10px] pr-2"
          style={{
            transition: 'gap 320ms cubic-bezier(0.16,1,0.3,1), padding 320ms cubic-bezier(0.16,1,0.3,1)',
            paddingLeft: collapsed ? 0 : 10,
            gap: collapsed ? 0 : 10,
          }}
        >
          <IconPlate active={active} invert={!workspace}>
            {renderIcon(item.icon, !workspace)}
          </IconPlate>

          <div
            className="overflow-hidden"
            style={{
              transition: 'max-width 320ms cubic-bezier(0.16,1,0.3,1), opacity 320ms, transform 320ms',
              maxWidth: collapsed ? 0 : 180,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              lineHeight: 1.1,
            }}
          >
            <div className="text-[13px] font-semibold" style={{ color: TEXT }}>{item.label}</div>
            {workspace && item.sub && (
              <div className="text-[11px]" style={{ color: MUTED, marginTop: 3 }}>{item.sub}</div>
            )}
          </div>

          {!collapsed && active && (
            <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: GREEN }} />
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen z-50 font-movatif"
        style={{
          width: collapsed ? W_COLLAPSED : W_EXPANDED,
          transition: 'width 380ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'width',
          background: bandedSidebarBg(),
          color: TEXT,
          borderRight: '1px solid rgba(255,255,255,.08)',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)',
        }}
        aria-label="Primary"
      >
        <div className="relative h-full flex flex-col">
          {/* Brand (longer header row) */}
          <div className="px-3 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                style={{ background: GREEN, boxShadow: '0 0 12px rgba(0,255,194,.32)' }}
              >
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div
                className="overflow-hidden"
                style={{
                  transition: 'max-width 380ms cubic-bezier(0.16,1,0.3,1), opacity 380ms, transform 380ms',
                  maxWidth: collapsed ? 0 : 200,
                  opacity: collapsed ? 0 : 1,
                  transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                }}
              >
                <div className="text-[18px] font-semibold tracking-wide" style={{ color: TEXT }}>
                  reduc<span style={{ color: GREEN }}>ai</span>.io
                </div>
              </div>
            </div>
          </div>

          {/* Workspace */}
          <div className="px-3">
            {!collapsed && <div className="text-[11px] font-semibold tracking-[.14em] mb-2" style={{ color: MUTED }}>WORKSPACE</div>}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'workspace').map(item => (
                <Item key={item.id} item={item} active={pathnameActive(item)} />
              ))}
            </nav>
          </div>

          {/* Divider between groups */}
          <div className="my-3 mx-3" style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />

          {/* Resources */}
          <div className="px-3">
            {!collapsed && <div className="text-[11px] font-semibold tracking-[.14em] mb-2" style={{ color: MUTED }}>RESOURCES</div>}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'resources').map(item => (
                <Item key={item.id} item={item} active={pathnameActive(item)} />
              ))}
            </nav>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Account (cleaner) */}
          <div className="px-3 pb-4">
            {/* custom button to show a loading veil then route */}
            <button
              onClick={() => {
                setVeil(true);
                // brief delay to let veil render; then navigate
                setTimeout(() => router.push('/account'), 120);
              }}
              className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
              style={{
                background: 'rgba(15,18,20,.88)',
                border: '1px solid rgba(255,255,255,.10)',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,.18)',
                color: TEXT
              }}
            >
              <div
                className="w-9 h-9 rounded-full grid place-items-center"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #1ff4c3 0%, #13b995 60%, #0d8d76 100%)',
                  boxShadow: '0 0 10px rgba(31,244,195,.25)'
                }}
              >
                <UserIcon className="w-4 h-4 text-black/85" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: MUTED }}>
                  {userEmail || 'View account'}
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
              border: `1px solid ${GREEN_LINE}`,
              background: 'rgba(89,217,179,.10)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.18), 0 0 10px rgba(0,255,194,0.10)',
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" style={{ color: GREEN }} />
              : <ChevronLeft  className="w-4 h-4" style={{ color: GREEN }} />}
          </button>
        </div>
      </aside>

      {/* Loading veil for Account */}
      {veil && (
        <div
          className="fixed inset-0 z-[99999] grid place-items-center"
          style={{ background: 'rgba(6,8,10,.62)', backdropFilter: 'blur(6px)' }}
        >
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(15,18,20,.92)', border: `1px solid ${GREEN_LINE}`, color: TEXT }}>
            Loading account…
          </div>
        </div>
      )}
    </>
  );
}
