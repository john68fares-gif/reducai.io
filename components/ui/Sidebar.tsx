// components/ui/Sidebar.tsx
'use client';

import { useEffect, useMemo, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  ShoppingBag, GraduationCap, KeyRound,
  Layers3, PlayCircle, LifeBuoy, Users,
  ChevronLeft, ChevronRight, Bot, User as UserIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ────────────────────────────────────────────────────────────────────────── */
/* Sizing & tokens                                                          */
const W_EXPANDED = 228;                 // slim width (fits the screenshots)
const W_COLLAPSED = 58;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

const CTA   = '#59d9b3';                // brand green
const SEP   = 'rgba(89,217,179,.10)';   // separators
const DARK_BASE = '#0b0f11';
const LIGHT_BASE = '#ffffff';
const TXT_DARK  = 'rgba(236,242,247,.92)';
const TXT_LIGHT = '#0f172a';

const PLATE_SIZE = 36;                  // square icon plate
const PLATE_RADIUS = 10;                // less rounded
const ICON_PX = 15;                     // slightly smaller icons

/* Subtle line-gradient bands: center darkest, sides lighten ≤0.5% */
function railBands(isDark: boolean) {
  const base = isDark ? DARK_BASE : LIGHT_BASE;
  const steps = 13, bw = 100 / steps, mid = Math.floor(steps / 2);
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const lift = Math.min(Math.abs(i - mid) * 0.005, 0.005); // ≤ 0.5%
    const col = `color-mix(in oklab, ${base} ${100 - lift * 100}%, ${CTA} ${lift * 100}%)`;
    parts.push(`${col} ${i * bw}%, ${col} ${(i + 1) * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* Helpers */
const iconize = (node: JSX.Element, px = ICON_PX) =>
  cloneElement(node, { className: `w-[${px}px] h-[${px}px] shrink-0`, strokeWidth: 2 });

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

/* Your OWN names (not buildmyagent’s) — adjust labels/hrefs freely */
type Nav = {
  id: string; href: string; label: string; sub?: string;
  icon: JSX.Element; group: 'workspace' | 'resources';
};

const NAV: Nav[] = [
  // WORKSPACE (top four)
  { id:'create',  href:'/builder',     label:'Create',     sub:'Design your agent',      icon:<Home/>,        group:'workspace' },
  { id:'tuning',  href:'/improve',     label:'Tuning',     sub:'Integrate & optimize',   icon:<Hammer/>,      group:'workspace' },
  { id:'showcase',href:'/voice-agent', label:'Showcase',   sub:'Demos & persona',        icon:<Mic/>,         group:'workspace' },
  { id:'launch',  href:'/launch',      label:'Launchpad',  sub:'Go live',                icon:<Rocket/>,      group:'workspace' },

  // RESOURCES (muted)
  { id:'market',  href:'/market',      label:'Market',                                 icon:<ShoppingBag/>, group:'resources' },
  { id:'mentor',  href:'/mentor',      label:'AI Mentor',                             icon:<GraduationCap/>,group:'resources' },
  { id:'keys',    href:'/apikeys',     label:'API Keys',                              icon:<KeyRound/>,     group:'resources' },
  { id:'bulk',    href:'/bulk-tester', label:'Bulk Tester',                           icon:<Layers3/>,      group:'resources' },
  { id:'videos',  href:'/videos',      label:'Video Guides',                          icon:<PlayCircle/>,   group:'resources' },
  { id:'support', href:'/support',     label:'Support',                               icon:<LifeBuoy/>,     group:'resources' },
  { id:'aff',     href:'/affiliate',   label:'Affiliate',                             icon:<Users/>,        group:'resources' },
];

/* ────────────────────────────────────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  /* collapsed state */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) ?? 'false'); }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  /* theme (light/dark) — derive from attribute or localStorage.theme */
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const get = () =>
      (document.documentElement.getAttribute('data-theme') ?? localStorage.getItem('theme') ?? 'dark') === 'dark';
    setIsDark(get());
    const onChange = () => setIsDark(get());
    window.addEventListener('theme:change', onChange);
    return () => window.removeEventListener('theme:change', onChange);
  }, []);

  /* auth (for account row) */
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

  const textColor = isDark ? TXT_DARK : TXT_LIGHT;
  const subColor  = isDark ? 'rgba(176,196,210,.62)' : 'rgba(60,72,88,.74)';

  const isActive = (item: Nav) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch'; // exact on launch
    return p.startsWith(item.href);
  };

  /* Plates */
  const WorkPlate = ({ children, active }: {children: React.ReactNode; active?: boolean}) => (
    <div
      className="grid place-items-center"
      style={{
        width: PLATE_SIZE, height: PLATE_SIZE, borderRadius: PLATE_RADIUS,
        background: isDark
          ? 'color-mix(in oklab, #12191d 88%, #59d9b3 12%)'
          : 'color-mix(in oklab, #eaf3ef 92%, #10b981 8%)',
        border: `1px solid ${isDark ? 'rgba(89,217,179,.22)' : 'rgba(16,185,129,.28)'}`,
        color: active ? CTA : textColor,
        transition: 'box-shadow .18s ease, transform .18s ease'
      }}
    >
      {children}
    </div>
  );

  const ResPlate = ({ children }: {children: React.ReactNode}) => (
    <div
      className="grid place-items-center plate-res"
      style={{
        width: PLATE_SIZE, height: PLATE_SIZE, borderRadius: PLATE_RADIUS,
        background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)',
        border: isDark ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(15,23,42,.12)',
        color: isDark ? 'rgba(255,255,255,.82)' : '#0f172a',
        transition: 'opacity .18s ease'
      }}
    >
      {children}
    </div>
  );

  const Item = ({ item, active, white }: { item: Nav; active: boolean; white?: boolean }) => (
    <Link href={item.href} className="block group" title={collapsed ? item.label : undefined}>
      <div
        className="relative flex items-center h-[46px] rounded-[10px] pr-2"
        style={{
          paddingLeft: collapsed ? 0 : 12,
          gap: collapsed ? 0 : 12,
          transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)'
        }}
      >
        {white
          ? <ResPlate>{iconize(item.icon)}</ResPlate>
          : <WorkPlate active={active}>{iconize(item.icon)}</WorkPlate>
        }

        {/* labels (hidden in collapsed) */}
        <div
          className="overflow-hidden"
          style={{
            maxWidth: collapsed ? 0 : 160,
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
            transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
            lineHeight: 1.05
          }}
        >
          <div className="font-movatif" style={{ fontSize: 13.5, fontWeight: 500, color: textColor }}>
            {item.label}
          </div>
          {item.sub && item.group === 'workspace' && (
            <div className="font-movatif" style={{ fontSize: 11.5, opacity: .6, color: subColor, marginTop: 2, fontWeight: 450 }}>
              {item.sub}
            </div>
          )}
        </div>

        {/* tiny active dot (expanded only) */}
        {!collapsed && active && (
          <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: CTA }} />
        )}
      </div>

      <style jsx>{`
        /* hover */
        a.block.group > div:hover > div:first-child{ /* the plate */
          ${white
            ? 'opacity:.94;'
            : 'box-shadow:0 0 0 1px rgba(89,217,179,.32), 0 0 18px rgba(89,217,179,.14); transform: translateY(-1px);'
          }
        }
      `}</style>
    </Link>
  );

  const workspace = useMemo(() => NAV.filter(n => n.group === 'workspace'), []);
  const resources = useMemo(() => NAV.filter(n => n.group === 'resources'), []);

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 font-movatif sidebar"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width 300ms cubic-bezier(0.16,1,0.3,1)',
        background: railBands(isDark),               // bands only on rail body
        color: textColor,
        borderRight: `1px solid ${SEP}`,
        boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)'
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">

        {/* BRAND (filled block; NO bands inside) */}
        <div style={{ padding: '16px 12px 12px', background: isDark ? DARK_BASE : LIGHT_BASE }}>
          <div className="flex flex-col items-center gap-2">
            <div
              className="grid place-items-center"
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: isDark ? 'rgba(255,255,255,.12)' : 'rgba(15,23,42,.08)',
                border: isDark ? '1px solid rgba(255,255,255,.18)' : '1px solid rgba(15,23,42,.16)'
              }}
            >
              <Bot className="w-5 h-5" style={{ color: '#fff' }} />
            </div>
            {!collapsed && (
              <div className="font-movatif" style={{ fontSize: 16, fontWeight: 550, color: isDark ? '#fff' : '#0f172a' }}>
                Reduc <span style={{ color: CTA, fontWeight: 520 }}>AI</span>
              </div>
            )}
          </div>
        </div>

        {/* WORKSPACE (top 4) */}
        <div className="px-3 pt-1">
          <nav className="space-y-[6px]">
            {workspace.map(item => (
              <Item key={item.id} item={item} active={isActive(item)} />
            ))}
          </nav>
        </div>

        {/* push resources down */}
        <div className="flex-1" />

        {/* full-width separator (left→right), low opacity */}
        <div aria-hidden className="mx-3" style={{ height: 1, background: SEP }} />

        {/* RESOURCES (muted; white icons on dark) */}
        <div className="px-3 mt-2 mb-2">
          <nav className="space-y-[6px]">
            {resources.map(item => (
              <Item key={item.id} item={item} active={isActive(item)} white />
            ))}
          </nav>
        </div>

        {/* ACCOUNT (teal-ish card; not grey) — also no bands */}
        <div className="px-3 pb-4" style={{ background: isDark ? DARK_BASE : LIGHT_BASE }}>
          <button
            onClick={() => router.push('/account')}
            className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
            style={{
              background: isDark ? 'linear-gradient(180deg, rgba(23,34,37,.92), rgba(11,18,20,.9))'
                                  : 'linear-gradient(180deg, rgba(240,244,246,.92), rgba(232,237,239,.94))',
              border: `1px solid ${isDark ? 'rgba(255,255,255,.10)' : 'rgba(15,23,42,.12)'}`,
              boxShadow: 'inset 0 0 8px rgba(0,0,0,.18)',
              color: textColor
            }}
          >
            <div
              className="grid place-items-center"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: CTA
              }}
            >
              <UserIcon className="w-4 h-4 text-black/85" />
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[13px] truncate" style={{ fontWeight: 560 }}>
                  {userLoading ? 'Account' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: subColor }}>
                  {userEmail || 'Open account'}
                </div>
              </div>
            )}

            {!collapsed && (
              <span className="text-[11px]" style={{ color: subColor }}>Open</span>
            )}
          </button>
        </div>

        {/* Collapse handle (mid-rail) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
          style={{
            border: `1px solid rgba(89,217,179,.26)`,
            background: 'rgba(89,217,179,.10)',
            boxShadow: '0 2px 12px rgba(0,0,0,.18), 0 0 10px rgba(0,255,194,.10)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" style={{ color: CTA }} />
            : <ChevronLeft  className="w-4 h-4" style={{ color: CTA }} />}
        </button>
      </div>
    </aside>

    /* Minor light/dark overrides (icon plates for resources flip in light) */
    <style jsx global>{`
      :root:not([data-theme="dark"]) .sidebar .plate-res {
        color: #0f172a;
      }
    `}</style>
  );
}
