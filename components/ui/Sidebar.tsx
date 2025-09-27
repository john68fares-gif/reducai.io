// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight,
  User as UserIcon, Bot,
  ShoppingBag, Brain, Grid2X2, PlayCircle, LifeBuoy, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ---------- Dimensions & storage ---------- */
const W_EXPANDED = 260;
const W_COLLAPSED = 68;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

/* ---------- Brand palette (blue-green) ---------- */
const GREEN = '#59d9b3';
const GREEN_DEEP = '#12a989';
const BLUE_BASE = '#0b1013';    // darker, bluish canvas
const BLUE_SIDE = '#0f1519';    // slightly lighter edges for bands
const PLATE_DARK = 'rgba(255,255,255,.06)';   // icon plate bg (dark)
const PLATE_BORDER = 'rgba(255,255,255,.12)';
const TEXT = 'rgba(236,242,247,.92)';
const MUTED = 'rgba(176,196,210,.58)';

/* Build the subtle vertical “banded lines” bg:
   center darker → edges up to ~6.5% lighter, blue-tinted, very low contrast */
function bandedSidebarBg(steps = 17, cap = 0.065) {
  const parts: string[] = [];
  const center = Math.ceil(steps / 2);
  const bw = 100 / steps;
  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);
    const lighten = Math.min((cap / (center - 1)) * dist, cap);
    // mix BLUE_BASE toward BLUE_SIDE with a dash of GREEN so it matches the app
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
  { id: 'create',  href: '/builder',      label: 'Build',        sub: 'Create AI agent',      icon: <Home />,   group: 'workspace' },
  { id: 'improve', href: '/improve',      label: 'Improve',      sub: 'Integrate and Improve',icon: <Hammer />, group: 'workspace' },
  { id: 'demo',    href: '/demo',         label: 'Demo',         sub: 'Showcase to clients',  icon: <Mic />,    group: 'workspace' },
  { id: 'launch',  href: '/launch',       label: 'Launch',       sub: 'Deploy to production', icon: <Rocket />, group: 'workspace' },

  // RESOURCES
  { id: 'market',  href: '/marketplace',  label: 'Marketplace',  icon: <ShoppingBag />, group: 'resources' },
  { id: 'mentor',  href: '/ai-mentor',    label: 'AI Mentor',    icon: <Brain />,       group: 'resources' },
  { id: 'keys',    href: '/apikeys',      label: 'API Key',      icon: <Key />,         group: 'resources' },
  { id: 'bulk',    href: '/bulk-tester',  label: 'Bulk Tester',  icon: <Grid2X2 />,     group: 'resources' },
  { id: 'videos',  href: '/videos',       label: 'Video Guides', icon: <PlayCircle />,  group: 'resources' },
  { id: 'support', href: '/support',      label: 'Support',      icon: <LifeBuoy />,    group: 'resources' },
  { id: 'aff',     href: '/affiliates',   label: 'Affiliate Program', icon: <Users />,  group: 'resources' },
];

/* Small helper: overlay-style icon tile */
function IconPlate({
  children,
  active,
  invert = false, // when true (resources), show white icons
}: { children: React.ReactNode; active?: boolean; invert?: boolean }) {
  // active halo mimics overlays; otherwise a subtle inner
  const halo = active
    ? `0 0 0 1px rgba(0,255,194,.10), 0 8px 18px rgba(0,0,0,.22), 0 0 18px rgba(89,217,179,.22)`
    : 'inset 0 0 10px rgba(0,0,0,.16)';

  return (
    <div
      className="w-10 h-10 rounded-[12px] grid place-items-center shrink-0"
      style={{
        background: invert ? 'rgba(255,255,255,.06)' : 'rgba(89,217,179,.08)',
        border: `1px solid ${invert ? 'rgba(255,255,255,.12)' : 'rgba(89,217,179,.24)'}`,
        boxShadow: halo,
        color: invert ? TEXT : GREEN_DEEP,
      }}
    >
      {children}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

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

  // user
  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user} } = await supabase.auth.getUser();
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
    cloneElement(node, {
      className: 'w-[18px] h-[18px] shrink-0',
      strokeWidth: 2,
      style: { color: invert ? '#ffffff' : undefined }
    });

  const Item = ({ item, active }: { item: NavItem; active: boolean }) => {
    const workspace = isWorkspace(item.id);

    return (
      <Link href={item.href} className="block group">
        <div
          className="relative flex items-center h-[44px] rounded-[12px] pr-2"
          style={{
            transition: 'gap 380ms cubic-bezier(0.16,1,0.3,1), padding 380ms cubic-bezier(0.16,1,0.3,1)',
            paddingLeft: collapsed ? 0 : 10,
            gap: collapsed ? 0 : 10,
          }}
        >
          <IconPlate active={active} invert={!workspace}>
            {renderIcon(item.icon, !workspace)}
          </IconPlate>

          {/* labels */}
          <div
            className="overflow-hidden"
            style={{
              transition: 'max-width 380ms cubic-bezier(0.16,1,0.3,1), opacity 380ms cubic-bezier(0.16,1,0.3,1), transform 380ms cubic-bezier(0.16,1,0.3,1)',
              maxWidth: collapsed ? 0 : 200,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              lineHeight: 1.1,
            }}
          >
            <div className="text-[13px] font-semibold" style={{ color: TEXT }}>
              {item.label}
            </div>
            {item.sub && workspace && (
              <div className="text-[11px]" style={{ color: MUTED, marginTop: 3 }}>
                {item.sub}
              </div>
            )}
          </div>

          {!collapsed && active && (
            <span aria-hidden className="ml-auto rounded-full" style={{ width: 8, height: 8, background: GREEN }} />
          )}
        </div>

        {/* thin glow underline on active */}
        <div
          className="h-[2px] rounded-full"
          style={{
            transition: 'background 380ms cubic-bezier(0.16,1,0.3,1), margin 380ms cubic-bezier(0.16,1,0.3,1)',
            marginLeft: collapsed ? 16 : 12,
            marginRight: 12,
            background: active
              ? 'linear-gradient(90deg, transparent, rgba(89,217,179,.35), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(89,217,179,0), transparent)',
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
        transition: 'width 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'width',
        background: bandedSidebarBg(),  // ← blue-green striped bg
        color: TEXT,
        borderRight: '1px solid rgba(255,255,255,.08)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
              style={{ background: GREEN, boxShadow: '0 0 10px rgba(0,255,194,0.35)' }}
            >
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div
              className="overflow-hidden"
              style={{
                transition: 'max-width 420ms cubic-bezier(0.16,1,0.3,1), opacity 420ms cubic-bezier(0.16,1,0.3,1), transform 420ms cubic-bezier(0.16,1,0.3,1)',
                maxWidth: collapsed ? 0 : 200,
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              }}
            >
              <div className="text-[17px] font-semibold tracking-wide" style={{ color: TEXT }}>
                buildmyagent<span style={{ color: GREEN }}>.io</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hairline under header */}
        <div aria-hidden className="pointer-events-none absolute left-0 right-0" style={{ top: '56px', borderTop: '1px solid rgba(255,255,255,.08)' }} />

        {/* Groups */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
          {!collapsed && (
            <div
              className="inline-flex items-center h-6 px-2 rounded-full border text-[10px] font-semibold tracking-[.14em] mb-2"
              style={{ color: MUTED, borderColor: 'rgba(255,255,255,.10)', background: 'rgba(255,255,255,.03)' }}
            >
              WORKSPACE
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'workspace').map(item => (
              <Item key={item.id} item={item} active={pathnameActive(item)} />
            ))}
          </nav>

          <div style={{ height: 14 }} />

          {!collapsed && (
            <div
              className="inline-flex items-center h-6 px-2 rounded-full border text-[10px] font-semibold tracking-[.14em] mb-2"
              style={{ color: MUTED, borderColor: 'rgba(255,255,255,.10)', background: 'rgba(255,255,255,.03)' }}
            >
              RESOURCES
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'resources').map(item => (
              <Item key={item.id} item={item} active={pathnameActive(item)} />
            ))}
          </nav>
        </div>

        {/* Account */}
        <div className="px-3 pb-4">
          {!collapsed ? (
            <Link
              href="/account"
              className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left transition-colors duration-300"
              style={{ background: 'rgba(15,18,20,.85)', border: '1px solid rgba(255,255,255,.10)', boxShadow: 'inset 0 0 10px rgba(0,0,0,.18)', color: TEXT }}
            >
              <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: GREEN, boxShadow: '0 0 8px rgba(0,0,0,.25)' }}>
                <UserIcon className="w-4 h-4 text-black/80" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: MUTED }}>
                  {userEmail || ''}
                </div>
              </div>
              <span className="text-xs" style={{ color: MUTED }}>Account</span>
            </Link>
          ) : (
            <Link
              href="/account"
              title="Account"
              className="block mx-auto rounded-full"
              style={{
                width: 40, height: 40,
                background: PLATE_DARK,
                border: `1px solid ${PLATE_BORDER}`,
                boxShadow: 'inset 0 0 10px rgba(0,0,0,.16)'
              }}
            >
              <div className="w-full h-full grid place-items-center">
                <UserIcon className="w-5 h-5" style={{ color: '#fff' }} />
              </div>
            </Link>
          )}
        </div>

        {/* Collapse handle (green plate + glow) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid rgba(89,217,179,.24)',
            background: 'rgba(89,217,179,.10)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18), 0 0 10px rgba(0,255,194,0.10)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" style={{ color: GREEN }} />
                     : <ChevronLeft  className="w-4 h-4" style={{ color: GREEN }} />}
        </button>
      </div>
    </aside>
  );
}
