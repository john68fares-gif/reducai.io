// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Cpu, Wrench, Presentation, Rocket,
  Store, Brain, Key, Grid2x2, PlayCircle, LifeBuoy, Users,
  ChevronLeft, ChevronRight, Bot as BotIcon, User as UserIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* =======================
   Brand & Theme Tokens
   ======================= */
const BRAND        = '#59d9b3';                       // CTA green
const BRAND_DEEP   = '#3cc2a0';
const PANEL_DARK   = '#0b0f11';                       // rail base (dark)
const PANEL_LIGHT  = '#ffffff';                       // rail base (light)
const TXT_LIGHT    = 'rgba(236,242,247,.92)';
const TXT_DARK     = '#0f172a';
const SEP_GREEN    = 'rgba(89,217,179,.12)';          // faint separators
const ICON_WHITE   = 'rgba(255,255,255,.92)';
const ICON_WEAK    = 'rgba(255,255,255,.72)';

const W_EXPANDED   = 228;                             // narrower
const W_COLLAPSED  = 58;
const LS_COLLAPSED = 'ui:sidebarCollapsed';
const LS_THEME     = 'theme';                         // 'dark' | 'light'

/* ultra-subtle banding for the rail (not used on brand/account rows) */
function railBands(isDark: boolean) {
  const base = isDark ? PANEL_DARK : PANEL_LIGHT;
  const steps = 13, bw = 100 / steps, center = Math.floor(steps / 2);
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const dist = Math.abs(i - center);
    const lift = Math.min(dist * 0.004, 0.008); // ≤ 0.8% at far edges
    const col = `color-mix(in oklab, ${base} ${100 - lift * 100}%, ${BRAND} ${lift * 100}%)`;
    parts.push(`${col} ${i * bw}%, ${col} ${(i + 1) * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* =======================
   Nav Items
   ======================= */
type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
};

// ✱ Names = exactly as you wanted (no renames), no Subaccounts
const NAV: NavItem[] = [
  { id: 'build',   href: '/builder',     label: 'Build',   sub: 'Create AI agent',         icon: <Cpu />,          group: 'workspace' },
  { id: 'improve', href: '/improve',     label: 'Improve', sub: 'Integrate and Improve',   icon: <Wrench />,       group: 'workspace' },
  { id: 'demo',    href: '/demo',        label: 'Demo',    sub: 'Showcase to clients',     icon: <Presentation />, group: 'workspace' },
  { id: 'launch',  href: '/launch',      label: 'Launch',  sub: 'Deploy to production',    icon: <Rocket />,       group: 'workspace' },

  { id: 'market',  href: '/marketplace', label: 'Marketplace',        icon: <Store />,      group: 'resources' },
  { id: 'mentor',  href: '/mentor',      label: 'AI Mentor',          icon: <Brain />,      group: 'resources' },
  { id: 'keys',    href: '/apikeys',     label: 'API Key',            icon: <Key />,        group: 'resources' },
  { id: 'bulk',    href: '/bulk',        label: 'Bulk Tester',        icon: <Grid2x2 />,    group: 'resources' },
  { id: 'videos',  href: '/videos',      label: 'Video Guides',       icon: <PlayCircle />, group: 'resources' },
  { id: 'support', href: '/support',     label: 'Support',            icon: <LifeBuoy />,   group: 'resources' },
  { id: 'aff',     href: '/affiliates',  label: 'Affiliate Program',  icon: <Users />,      group: 'resources' },
];

/* lucide helper: center + consistent size */
const iconize = (node: JSX.Element, size = 15) =>
  cloneElement(node, { className: `w-[${size}px] h-[${size}px] shrink-0`, strokeWidth: 2 });

/* =======================
   Sidebar
   ======================= */
export default function Sidebar() {
  const pathname = usePathname();

  /* collapsed state */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });

  /* theme (syncs with localStorage and an optional window event) */
  const [theme, setTheme] = useState<'dark'|'light'>(() => {
    try { return (localStorage.getItem(LS_THEME) as 'dark'|'light') || 'dark'; } catch { return 'dark'; }
  });
  const isDark = theme === 'dark';

  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  useEffect(() => {
    const onTheme = () => {
      try { setTheme((localStorage.getItem(LS_THEME) as any) || 'dark'); } catch {}
    };
    window.addEventListener('theme:change', onTheme);
    return () => window.removeEventListener('theme:change', onTheme);
  }, []);

  /* user (no “loading” text) */
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName,  setUserName]  = useState<string | null>(null);
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      unsub = supabase.auth.onAuthStateChange((_e, s) => {
        const u = s?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const active = (n: NavItem) => (pathname || '').startsWith(n.href);

  /* Single nav row chip. Top 4 = “overlay” style, resources = darker & white icons */
  function Item({ item }: { item: NavItem }) {
    const a = active(item);
    const isWorkspace = item.group === 'workspace';

    // Plate look
    const plateRadius = 10;                       // less rounded
    const plateSize   = 38;                       // compact
    const plateBg     = isWorkspace
      ? `color-mix(in oklab, ${PANEL_DARK} ${isDark ? 86 : 94}%, ${BRAND} ${isDark ? 14 : 6}%)`
      : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)');
    const plateBorder = isWorkspace ? 'rgba(89,217,179,.20)'
      : (isDark ? 'rgba(255,255,255,.10)' : 'rgba(15,23,42,.12)');
    const iconColor   = isWorkspace ? BRAND_DEEP : (isDark ? ICON_WHITE : TXT_DARK);

    // Hover glow (workspace only)
    const hoverShadow = isWorkspace
      ? '0 16px 26px rgba(0,0,0,.22), 0 0 18px rgba(89,217,179,.18)'
      : 'inset 0 0 10px rgba(0,0,0,.12)';

    return (
      <Link href={item.href} className="block group">
        <div
          className="flex items-center h-[46px] rounded-[12px] pr-2"
          style={{ paddingLeft: collapsed ? 0 : 10, gap: collapsed ? 0 : 10 }}
        >
          <div
            className="grid place-items-center transition-shadow"
            style={{
              width: plateSize, height: plateSize, borderRadius: plateRadius,
              background: plateBg, border: `1px solid ${plateBorder}`,
              boxShadow: a ? (isWorkspace
                ? '0 0 0 1px rgba(89,217,179,.10), 0 14px 28px rgba(0,0,0,.18), 0 0 22px rgba(89,217,179,.22)'
                : 'inset 0 0 10px rgba(0,0,0,.16)')
                : 'inset 0 0 10px rgba(0,0,0,.10)',
              color: iconColor,
            }}
          >
            {iconize(item.icon, 15)}
          </div>

          <div
            className="overflow-hidden"
            style={{
              transition: 'max-width .32s cubic-bezier(.16,1,.3,1), opacity .32s, transform .32s',
              maxWidth: collapsed ? 0 : 170,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)'
            }}
          >
            <div
              className="text-[13.5px] font-medium leading-[1.15] font-movatif"
              style={{ color: isDark ? TXT_LIGHT : TXT_DARK }}
            >
              {item.label}
            </div>
            {item.sub && isWorkspace && (
              <div
                className="text-[11.5px] leading-[1.1] mt-[2px] font-movatif"
                style={{ color: isDark ? 'rgba(236,242,247,.60)' : 'rgba(15,23,42,.62)' }}
              >
                {item.sub}
              </div>
            )}
          </div>

          {/* green dot on the far right for active workspace items (expanded only) */}
          {!collapsed && a && isWorkspace && (
            <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: BRAND }} />
          )}
        </div>

        {/* hover bloom effect (workspace only) */}
        <style jsx>{`
          a.block.group > div:hover > div:first-child{
            box-shadow: ${hoverShadow};
          }
          /* Resources: icons start softer (low opacity), brighten on hover/active */
          a.block.group > div > div:first-child{
            color: ${isWorkspace ? iconColor : (isDark ? 'rgba(255,255,255,.76)' : 'rgba(15,23,42,.78)')};
          }
          a.block.group:hover > div > div:first-child{
            color: ${isWorkspace ? iconColor : (isDark ? 'rgba(255,255,255,.94)' : '#0f172a')};
          }
        `}</style>
      </Link>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 font-movatif"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width .40s cubic-bezier(.16,1,.3,1)',
        background: railBands(isDark),                   // subtle bands on rail
        color: isDark ? TXT_LIGHT : TXT_DARK,
        borderRight: `1px solid ${SEP_GREEN}`,
        boxShadow: 'inset 0 0 18px rgba(0,0,0,.28)'
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">

        {/* ===== Brand row (filled like reducai.com; NO bands here) ===== */}
        <div
          className="px-3 pt-5 pb-4"
          style={{
            background: isDark ? PANEL_DARK : PANEL_LIGHT,
            boxShadow: isDark ? '0 1px 0 rgba(0,0,0,.35)' : '0 1px 0 rgba(15,23,42,.08)'
          }}
        >
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
              style={{
                background: isDark ? 'rgba(255,255,255,.10)' : 'rgba(15,23,42,.08)',
                border: isDark ? '1px solid rgba(255,255,255,.18)' : '1px solid rgba(15,23,42,.16)'
              }}
              title="Reduc AI"
            >
              <BotIcon className="w-5 h-5" style={{ color: '#fff' }} />
            </div>
            {!collapsed && (
              <div
                className="text-[17px] font-medium tracking-wide"
                style={{ color: isDark ? '#fff' : '#0f172a' }}
              >
                Reduc <span style={{ color: BRAND }}>AI</span>
              </div>
            )}
          </div>
        </div>

        {/* Separator (full width, faint) */}
        <div aria-hidden style={{ height: 1, background: SEP_GREEN }} />

        {/* ===== Lists (no section headers; just items) ===== */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Workspace */}
          <div className="px-3 pt-6">
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'workspace').map(n => <Item key={n.id} item={n} />)}
            </nav>
          </div>

          {/* Faint divider between groups */}
          <div aria-hidden className="my-10" style={{ height: 1, background: SEP_GREEN }} />

          {/* Resources (lower opacity, dark plates, white icons) */}
          <div className="px-3 pb-4">
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'resources').map(n => <Item key={n.id} item={n} />)}
            </nav>
          </div>
        </div>

        {/* ===== Account (cleaner, same gradient avatar vibe) ===== */}
        <div className="px-3 pb-4" style={{ background: isDark ? PANEL_DARK : PANEL_LIGHT }}>
          <Link
            href="/account"
            className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left"
            style={{
              background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.04)',
              border: isDark ? '1px solid rgba(255,255,255,.10)' : '1px solid rgba(15,23,42,.12)',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.18)'
            }}
          >
            <div
              className="w-8 h-8 rounded-full grid place-items-center"
              style={{
                background: 'radial-gradient(60% 60% at 50% 40%, rgba(255,255,255,.22), rgba(255,255,255,.08))',
                border: isDark ? '1px solid rgba(255,255,255,.24)' : '1px solid rgba(15,23,42,.28)'
              }}
            >
              <UserIcon className="w-4 h-4" style={{ color: '#0b0f0e' }} />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                  {userName?.trim() || userEmail?.split('@')[0] || 'Account'}
                </div>
                <div className="text-[11px] truncate" style={{ color: isDark ? 'rgba(236,242,247,.60)' : 'rgba(15,23,42,.62)' }}>
                  {userEmail || ''}
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Collapse handle (unchanged location; colors tuned) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
          style={{
            border: `1px solid ${SEP_GREEN}`,
            background: isDark ? PANEL_DARK : PANEL_LIGHT,
            boxShadow: '0 2px 12px rgba(0,0,0,.18), 0 0 10px rgba(0,255,194,0.06)'
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" style={{ color: isDark ? ICON_WEAK : '#334155' }} />
            : <ChevronLeft  className="w-4 h-4" style={{ color: isDark ? ICON_WEAK : '#334155' }} />}
        </button>
      </div>

      {/* Light/Dark text color var for non-rail areas (we mostly inline colors to match your tokens) */}
      <style jsx>{`
        :global(.font-movatif){ font-weight: 500; } /* less bold default */
      `}</style>
    </aside>
  );
}// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Cpu, Wrench, Presentation, Rocket,
  Store, Brain, Key, Grid2x2, PlayCircle, LifeBuoy, Users,
  ChevronLeft, ChevronRight, Bot as BotIcon, User as UserIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ───────── Brand & theme ───────── */
const BRAND        = '#59d9b3';
const BRAND_DEEP   = '#3ec4a2';
const GREEN_LINE   = 'rgba(89,217,179,.20)';
const WHITE_60     = 'rgba(255,255,255,.60)';
const WHITE_36     = 'rgba(255,255,255,.36)';
const PANEL_DARK   = '#0b0f11';

/** ultra-subtle rail bands: center darkest, sides ~0.5% lighter */
function railBands() {
  const s = 11; const bw = 100 / s;
  const parts: string[] = [];
  const center = Math.floor(s / 2);
  for (let i = 0; i < s; i++) {
    const dist = Math.abs(i - center);
    const lift = Math.min(dist * 0.005, 0.015); // 0%..0.5%..1.5% at edges
    const col  = `color-mix(in oklab, ${PANEL_DARK} ${100 - lift * 100}%, ${BRAND} ${lift * 100}%)`;
    parts.push(`${col} ${i * bw}%, ${col} ${(i + 1) * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* ───────── Types & data ───────── */
type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
};

const NAV: NavItem[] = [
  /* WORKSPACE */
  { id: 'build',   href: '/builder',     label: 'Build',   sub: 'Create AI agent',   icon: <Cpu />,          group: 'workspace' },
  { id: 'improve', href: '/improve',     label: 'Improve', sub: 'Integrate & Improve', icon: <Wrench />,     group: 'workspace' },
  { id: 'demo',    href: '/demo',        label: 'Demo',    sub: 'Showcase to clients', icon: <Presentation />, group: 'workspace' },
  { id: 'launch',  href: '/launch',      label: 'Launch',  sub: 'Deploy to production', icon: <Rocket />,     group: 'workspace' },

  /* RESOURCES (dark chips, white icons) */
  { id: 'market',  href: '/marketplace', label: 'Marketplace',   icon: <Store />,      group: 'resources' },
  { id: 'mentor',  href: '/mentor',      label: 'AI Mentor',     icon: <Brain />,      group: 'resources' },
  { id: 'keys',    href: '/apikeys',     label: 'API Key',       icon: <Key />,        group: 'resources' },
  { id: 'bulk',    href: '/bulk',        label: 'Bulk Tester',   icon: <Grid2x2 />,    group: 'resources' },
  { id: 'videos',  href: '/videos',      label: 'Video Guides',  icon: <PlayCircle />, group: 'resources' },
  { id: 'support', href: '/support',     label: 'Support',       icon: <LifeBuoy />,   group: 'resources' },
  { id: 'aff',     href: '/affiliates',  label: 'Affiliate Program', icon: <Users />,  group: 'resources' },
];

const W_EXPANDED = 244;
const W_COLLAPSED = 64;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

/* ───────── Helpers ───────── */
const renderIcon = (node: JSX.Element) =>
  cloneElement(node, { className: 'w-[18px] h-[18px] shrink-0', strokeWidth: 2 });

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

/* ───────── Component ───────── */
export default function Sidebar() {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  /* user (no “Loading…” label UI) */
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName,  setUserName]  = useState<string | null>(null);
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

  const isActive = (item: NavItem) => (pathname || '').startsWith(item.href);

  /* item chips */
  function Item({ item }: { item: NavItem }) {
    const active = isActive(item);
    const inWorkspace = item.group === 'workspace';

    // Shared measurements
    const R = 12; // squarer than before
    const iconPlateBg = inWorkspace
      ? `color-mix(in oklab, ${PANEL_DARK} 88%, ${BRAND} 12%)`
      : 'rgba(255,255,255,.06)';
    const iconPlateBorder = inWorkspace ? GREEN_LINE : 'rgba(255,255,255,.10)';
    const iconColor = inWorkspace ? BRAND_DEEP : 'rgba(255,255,255,.92)';

    return (
      <Link href={item.href} className="block group">
        <div
          className="flex items-center h-[48px] pr-2 rounded-[14px]"
          style={{ paddingLeft: collapsed ? 0 : 10, gap: collapsed ? 0 : 10 }}
        >
          {/* icon plate */}
          <div
            className="grid place-items-center"
            style={{
              width: 40, height: 40, borderRadius: R,
              background: iconPlateBg,
              border: `1px solid ${iconPlateBorder}`,
              boxShadow: active && inWorkspace
                ? '0 0 0 1px rgba(89,217,179,.10), 0 14px 28px rgba(0,0,0,.18), 0 0 22px rgba(89,217,179,.22)'
                : 'inset 0 0 10px rgba(0,0,0,.12)',
              color: iconColor,
            }}
            title={collapsed ? item.label : undefined}
          >
            {/* icon a *bit* smaller than before */}
            {renderIcon(cloneElement(item.icon, { className: 'w-[16px] h-[16px]' }))}
          </div>

          {/* label */}
          <div
            className="overflow-hidden"
            style={{
              transition: 'max-width .35s cubic-bezier(.16,1,.3,1), opacity .35s, transform .35s',
              maxWidth: collapsed ? 0 : 180,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)'
            }}
          >
            <div className="text-[14px] font-medium" style={{ color: 'var(--sidebar-text)' }}>
              {item.label}
            </div>
            {item.sub && (
              <div className="text-[12px]" style={{ color: WHITE_60, marginTop: 2 }}>
                {item.sub}
              </div>
            )}
          </div>

          {/* tiny green dot when active & expanded (workspace only) */}
          {!collapsed && active && inWorkspace && (
            <span aria-hidden className="ml-auto rounded-full" style={{ width: 8, height: 8, background: BRAND }} />
          )}
        </div>
      </Link>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width .42s cubic-bezier(.16,1,.3,1)',
        background: railBands(),
        color: 'var(--sidebar-text)',
        borderRight: `1px solid ${GREEN_LINE}`,
        boxShadow: 'inset 0 0 18px rgba(0,0,0,.28)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">

        {/* Brand row — centered, white AI, no bands behind */}
        <div
          className="px-3 pt-5 pb-4"
          style={{
            background: PANEL_DARK, // solid, no bands
            boxShadow: '0 1px 0 rgba(0,0,0,.04)'
          }}
        >
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
              style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.20)' }}
            >
              <BotIcon className="w-5 h-5" style={{ color: '#fff' }} />
            </div>
            {!collapsed && (
              <div className="text-[17px] font-medium tracking-wide" style={{ color: '#fff' }}>
                Reduc <span style={{ color: BRAND }}>AI</span>
              </div>
            )}
          </div>
        </div>

        {/* Hard separator line under brand (left→right) */}
        <div aria-hidden style={{ height: 1, background: GREEN_LINE }} />

        {/* WORKSPACE */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-3 pt-3">
            {!collapsed && (
              <div className="text-[11px] font-medium tracking-[.14em]" style={{ color: WHITE_36, margin: '6px 2px 8px' }}>
                WORKSPACE
              </div>
            )}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'workspace').map(n => <Item key={n.id} item={n} />)}
            </nav>
          </div>

          {/* Separator between groups (full width) */}
          <div aria-hidden className="my-10" style={{ height: 1, background: GREEN_LINE }} />

          {/* RESOURCES (dark chips + white icons) */}
          <div className="px-3 pb-4">
            {!collapsed && (
              <div className="text-[11px] font-medium tracking-[.14em]" style={{ color: WHITE_36, margin: '0 2px 8px' }}>
                RESOURCES
              </div>
            )}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group === 'resources').map(n => <Item key={n.id} item={n} />)}
            </nav>
          </div>
        </div>

        {/* Account card (no loading text, cleaner look) */}
        <div className="px-3 pb-4" style={{ background: PANEL_DARK }}>
          <Link
            href="/account"
            className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.10)',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.18)'
            }}
          >
            <div
              className="w-8 h-8 rounded-full grid place-items-center"
              style={{
                background: 'radial-gradient(60% 60% at 50% 40%, rgba(255,255,255,.22), rgba(255,255,255,.08))',
                border: '1px solid rgba(255,255,255,.24)'
              }}
            >
              <UserIcon className="w-4 h-4" style={{ color: '#0b0f0e' }} />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: '#fff' }}>
                  {getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: WHITE_60 }}>
                  {userEmail || ''}
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
          style={{
            border: `1px solid ${GREEN_LINE}`,
            background: PANEL_DARK,
            boxShadow: '0 2px 12px rgba(0,0,0,.18), 0 0 10px rgba(0,255,194,0.06)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" style={{ color: WHITE_60 }} />
            : <ChevronLeft  className="w-4 h-4" style={{ color: WHITE_60 }} />}
        </button>
      </div>

      {/* theme vars for light/dark; keep dark defaults */}
      <style jsx>{`
        :global(:root:not([data-theme="dark"])) .fixed.left-0 {
          --sidebar-text: #0f172a;
        }
        :global([data-theme="dark"]) .fixed.left-0 {
          --sidebar-text: rgba(236,242,247,.92);
        }
      `}</style>
    </aside>
  );
}
