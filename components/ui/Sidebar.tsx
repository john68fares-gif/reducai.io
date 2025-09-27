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
/* Dimensions & behavior */
const W_EXPANDED = 228;
const W_COLLAPSED = 58;
const LS_COLLAPSED = 'ui:sidebarCollapsed';
const LS_THEME = 'ui:theme';

/* Helpers (read theme + minor utilities) */
function readIsDark(): boolean {
  try {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    const ls = localStorage.getItem(LS_THEME);
    if (ls === 'dark') return true;
    if (ls === 'light') return false;
  } catch {}
  return true; // default dark
}

const iconize = (node: JSX.Element, px = 15) =>
  cloneElement(node, { className: `w-[${px}px] h-[${px}px] shrink-0`, strokeWidth: 2 });

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

/* Your sections (not buildmyagent’s) */
type Nav = {
  id: string; href: string; label: string; sub?: string;
  icon: JSX.Element; group: 'workspace' | 'resources';
};

const NAV: Nav[] = [
  { id:'create',   href:'/builder',      label:'Create',     sub:'Design your agent',     icon:<Home/>,        group:'workspace' },
  { id:'tuning',   href:'/improve',      label:'Tuning',     sub:'Integrate & optimize',  icon:<Hammer/>,      group:'workspace' },
  { id:'showcase', href:'/voice-agent',  label:'Showcase',   sub:'Demos & persona',       icon:<Mic/>,         group:'workspace' },
  { id:'launch',   href:'/launch',       label:'Launchpad',  sub:'Go live',               icon:<Rocket/>,      group:'workspace' },

  { id:'market',   href:'/market',       label:'Market',                                 icon:<ShoppingBag/>, group:'resources' },
  { id:'mentor',   href:'/mentor',       label:'AI Mentor',                              icon:<GraduationCap/>,group:'resources' },
  { id:'keys',     href:'/apikeys',      label:'API Keys',                               icon:<KeyRound/>,     group:'resources' },
  { id:'bulk',     href:'/bulk-tester',  label:'Bulk Tester',                            icon:<Layers3/>,      group:'resources' },
  { id:'videos',   href:'/videos',       label:'Video Guides',                           icon:<PlayCircle/>,   group:'resources' },
  { id:'support',  href:'/support',      label:'Support',                                icon:<LifeBuoy/>,     group:'resources' },
  { id:'aff',      href:'/affiliate',    label:'Affiliate',                              icon:<Users/>,        group:'resources' },
];

/* Subtle band generator (uses your tokens) */
function railBands(isDark: boolean) {
  // Use panel as the base so the bands blend naturally with your token set.
  const panel = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || (isDark ? '#0d0f11' : '#ffffff');
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#59d9b3';
  const steps = 13, bw = 100 / steps, mid = Math.floor(steps / 2);
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    // ≤ 0.5% toward brand at far edges, center darkest
    const lift = Math.min(Math.abs(i - mid) * 0.005, 0.005);
    const col = `color-mix(in oklab, ${panel} ${100 - lift * 100}%, ${brand} ${lift * 100}%)`;
    parts.push(`${col} ${i * bw}%, ${col} ${(i + 1) * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* ────────────────────────────────────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) ?? 'false'); }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const sync = () => setIsDark(readIsDark());
    sync();
    window.addEventListener('theme:change', sync);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { window.removeEventListener('theme:change', sync); mo.disconnect(); };
  }, []);

  // auth → account chip
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

  // tokens from CSS vars (so we match account page exactly)
  const cs = getComputedStyle(document.documentElement);
  const TXT  = cs.getPropertyValue('--text').trim()        || (isDark ? 'rgba(230,241,239,.96)' : '#0f172a');
  const MUT  = cs.getPropertyValue('--text-muted').trim()  || (isDark ? '#9fb4ad' : '#475569');
  const BR   = cs.getPropertyValue('--brand').trim()       || '#59d9b3';
  const PANEL= cs.getPropertyValue('--panel').trim()       || (isDark ? '#0d0f11' : '#ffffff');
  const BORDER_WEAK = cs.getPropertyValue('--border').trim() || (isDark ? 'rgba(255,255,255,.10)' : 'rgba(15,23,42,.12)');

  const isActive = (item: Nav) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch';
    return p.startsWith(item.href);
  };

  /* Plates (workspace vs resources) */
  const WorkPlate = ({ children, active }: {children: React.ReactNode; active?: boolean}) => (
    <div
      className="grid place-items-center"
      style={{
        width: 36, height: 36, borderRadius: 10,
        background: isDark
          ? 'color-mix(in oklab, #12191d 88%, var(--brand) 12%)'
          : 'color-mix(in oklab, #eaf3ef 92%, var(--brand) 8%)',
        border: `1px solid ${isDark ? 'rgba(89,217,179,.22)' : 'rgba(16,185,129,.28)'}`,
        color: active ? BR : TXT,
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
        width: 36, height: 36, borderRadius: 10,
        background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)',
        border: isDark ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(15,23,42,.12)',
        color: isDark ? 'rgba(255,255,255,.90)' : '#0f172a',
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
          <div className="font-movatif" style={{ fontSize: 13.5, fontWeight: 500, color: TXT }}>
            {item.label}
          </div>
          {item.sub && item.group === 'workspace' && (
            <div className="font-movatif" style={{ fontSize: 11.5, opacity: .6, color: MUT, marginTop: 2, fontWeight: 450 }}>
              {item.sub}
            </div>
          )}
        </div>

        {/* tiny active dot */}
        {!collapsed && active && (
          <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: BR }} />
        )}
      </div>

      <style jsx>{`
        a.block.group > div:hover > div:first-child{
          ${white
            ? 'opacity:.95;'
            : 'box-shadow:0 0 0 1px color-mix(in oklab, var(--brand) 40%, transparent), 0 0 18px color-mix(in oklab, var(--brand) 18%, transparent); transform: translateY(-1px);'
          }
        }
      `}</style>
    </Link>
  );

  const workspace = useMemo(() => NAV.filter(n => n.group === 'workspace'), []);
  const resources = useMemo(() => NAV.filter(n => n.group === 'resources'), []);

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen z-50 font-movatif sidebar"
        style={{
          width: collapsed ? W_COLLAPSED : W_EXPANDED,
          transition: 'width 300ms cubic-bezier(0.16,1,0.3,1)',
          background: railBands(isDark),               // bands only on rail shell
          color: TXT,
          borderRight: `1px solid ${BORDER_WEAK}`,
          boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)'
        }}
        aria-label="Primary"
      >
        <div className="relative h-full flex flex-col">

          {/* BRAND (filled; no bands) */}
          <div style={{ padding: '16px 12px 12px', background: PANEL }}>
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
                <div className="font-movatif" style={{ fontSize: 16, fontWeight: 550, color: TXT }}>
                  Reduc <span style={{ color: BR, fontWeight: 520 }}>AI</span>
                </div>
              )}
            </div>
          </div>

          {/* WORKSPACE */}
          <div className="px-3 pt-1">
            <nav className="space-y-[6px]">
              {workspace.map(item => (
                <Item key={item.id} item={item} active={isActive(item)} />
              ))}
            </nav>
          </div>

          {/* push resources down */}
          <div className="flex-1" />

          {/* full-width separator */}
          <div aria-hidden className="mx-3" style={{ height: 1, background: 'var(--border)' }} />

          {/* RESOURCES (muted plates) */}
          <div className="px-3 mt-2 mb-2">
            <nav className="space-y-[6px]">
              {resources.map(item => (
                <Item key={item.id} item={item} active={isActive(item)} white />
              ))}
            </nav>
          </div>

          {/* ACCOUNT (solid, not banded) */}
          <div className="px-3 pb-4" style={{ background: PANEL }}>
            <button
              onClick={() => router.push('/account')}
              className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
              style={{
                background: isDark ? 'linear-gradient(180deg, rgba(23,34,37,.92), rgba(11,18,20,.9))'
                                    : 'linear-gradient(180deg, rgba(240,244,246,.92), rgba(232,237,239,.94))',
                border: `1px solid ${BORDER_WEAK}`,
                boxShadow: 'inset 0 0 8px rgba(0,0,0,.18)',
                color: TXT
              }}
            >
              <div
                className="grid place-items-center"
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: BR
                }}
              >
                <UserIcon className="w-4 h-4 text-black/85" />
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate" style={{ fontWeight: 560 }}>
                    {userLoading ? 'Account' : getDisplayName(userName, userEmail)}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: MUT }}>
                    {userEmail || 'Open account'}
                  </div>
                </div>
              )}

              {!collapsed && (
                <span className="text-[11px]" style={{ color: MUT }}>Open</span>
              )}
            </button>
          </div>

          {/* Collapse handle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
            style={{
              border: `1px solid color-mix(in oklab, var(--brand) 40%, transparent)`,
              background: 'color-mix(in oklab, var(--brand) 12%, transparent)',
              boxShadow: '0 2px 12px rgba(0,0,0,.18), 0 0 10px rgba(0,255,194,.10)',
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" style={{ color: BR }} />
              : <ChevronLeft  className="w-4 h-4" style={{ color: BR }} />}
          </button>
        </div>
      </aside>

      {/* Light/dark tweak for resource plates (icon color) */}
      <style jsx global>{`
        :root:not([data-theme="dark"]) .sidebar .plate-res { color: #0f172a; }
      `}</style>
    </>
  );
}
