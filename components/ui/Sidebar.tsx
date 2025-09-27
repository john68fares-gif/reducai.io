// components/ui/Sidebar.tsx
'use client';

import { useEffect, useMemo, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight,
  Bot, User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ───────────────────────────────── TOKENS ───────────────────────────────── */
const W_EXPANDED   = 228;     // slim but readable (fits best-practice banding)
const W_COLLAPSED  = 58;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

const CTA     = '#59d9b3';                                        // brand green
const TXT_DARK= '#0f172a';
const TXT     = 'rgba(236,242,247,.92)';                          // light text
const MUTED   = 'rgba(176,196,210,.62)';                          // secondary
const BORDER  = 'rgba(89,217,179,.10)';                           // greeny sep
const BASE_DK = '#0b0f11';                                        // deep blue-teal
const BASE_LT = '#ffffff';

const SHOW_GROUP_TAGS = false; // flip to true if you want WORKSPACE/RESOURCES labels

/* ultra-subtle side bands (center darker, sides +≤0.8%) */
function railBands(isDark: boolean, steps = 13, cap = 0.008) {
  const base = isDark ? BASE_DK : BASE_LT;
  const bw = 100 / steps;
  const mid = Math.floor(steps / 2);
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const lift = Math.min(Math.abs(i - mid) * 0.004, cap); // 0.4% per step, max 0.8%
    const col = `color-mix(in oklab, ${base} ${100 - lift * 100}%, ${CTA} ${lift * 100}%)`;
    parts.push(`${col} ${i * bw}%, ${col} ${(i + 1) * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* ─────────────────────────────── NAV (exact names) ─────────────────────────────── */
type NavItem = {
  id: 'build'|'improve'|'demo'|'launch'|'market'|'mentor'|'keys';
  href: string; label: string; sub?: string; icon: JSX.Element;
  group: 'workspace'|'resources';
};
const NAV: NavItem[] = [
  { id:'build',   href:'/builder',     label:'Build',   sub:'Create AI agent',        icon:<Home/>,   group:'workspace' },
  { id:'improve', href:'/improve',     label:'Improve', sub:'Integrate and Improve',  icon:<Hammer/>, group:'workspace' },
  { id:'demo',    href:'/voice-agent', label:'Demo',    sub:'Showcase to clients',    icon:<Mic/>,    group:'workspace' },
  { id:'launch',  href:'/launch',      label:'Launch',  sub:'Deploy to production',   icon:<Rocket/>, group:'workspace' },

  { id:'market',  href:'/marketplace', label:'Marketplace',                           icon:<Phone/>,       group:'resources' },
  { id:'mentor',  href:'/ai-mentor',   label:'AI Mentor',                             icon:<Key/>,         group:'resources' },
  { id:'keys',    href:'/apikeys',     label:'API Key',                               icon:<HelpCircle/>,  group:'resources' },
];

/* ─────────────────────────── helpers ─────────────────────────── */
function getDisplayName(name?:string|null, email?:string|null){
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}
const isDarkMode = () =>
  (typeof window !== 'undefined' && (localStorage.getItem('theme') || 'dark')) === 'dark';

/* ─────────────────────────── COMPONENT ─────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });
  const [dark, setDark] = useState<boolean>(() => isDarkMode());

  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  /* listen for theme changes from your account settings page */
  useEffect(() => {
    const onTheme = () => setDark(isDarkMode());
    window.addEventListener('theme:change', onTheme);
    return () => window.removeEventListener('theme:change', onTheme);
  }, []);

  // auth (no spinner UI here; we keep the row clean)
  const [userEmail, setUserEmail] = useState<string|null>(null);
  const [userName, setUserName] = useState<string|null>(null);
  useEffect(() => {
    let unsub:any;
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
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

  const isActive = (item: NavItem) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch';
    return p.startsWith(item.href);
  };

  /* visual sizes — smaller icons, squarer plates */
  const plateSize  = 36;  // was 34; still compact
  const plateRad   = 10;
  const iconPx     = 15;

  const iconize = (n: JSX.Element) =>
    cloneElement(n, { className: `w-[${iconPx}px] h-[${iconPx}px] shrink-0`, strokeWidth: 2 });

  /* plate variants */
  const Plate = ({ children, tone }:{
    children: React.ReactNode; tone: 'workspace'|'resources';
  }) => {
    const isWorkspace = tone === 'workspace';
    const bg = isWorkspace
      ? `color-mix(in oklab, ${dark ? '#12191d' : '#e6fffa'} ${dark?88:94}%, ${CTA} ${dark?12:6}%)`
      : (dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)');
    const border = isWorkspace ? 'rgba(89,217,179,.20)'
                               : (dark ? 'rgba(255,255,255,.10)' : 'rgba(15,23,42,.12)');
    const color = isWorkspace ? CTA : (dark ? 'rgba(255,255,255,.86)' : TXT_DARK);

    return (
      <div
        className="grid place-items-center plate"
        style={{
          width: plateSize, height: plateSize,
          borderRadius: plateRad,
          background: bg,
          border: `1px solid ${border}`,
          color,
          transition: 'box-shadow 180ms ease, transform 180ms ease, background 180ms ease'
        }}
      >
        {children}
        <style jsx>{`
          .plate:has(> svg) {}
        `}</style>
      </div>
    );
  };

  const Item = ({ item }: { item: NavItem }) => {
    const active = isActive(item);
    const isWorkspace = item.group === 'workspace';

    return (
      <Link href={item.href} className="block group" title={collapsed ? item.label : undefined}>
        <div
          className="relative flex items-center h-[46px] rounded-[10px] pr-2"
          style={{
            paddingLeft: collapsed ? 0 : 12,
            gap: collapsed ? 0 : 12,
            transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)'
          }}
        >
          <Plate tone={isWorkspace ? 'workspace' : 'resources'}>
            {iconize(item.icon)}
          </Plate>

          <div
            className="overflow-hidden"
            style={{
              maxWidth: collapsed ? 0 : 160,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
              lineHeight: 1.08
            }}
          >
            <div className="font-movatif" style={{ fontSize: 13.5, fontWeight: 520, color: dark ? TXT : TXT_DARK }}>
              {item.label}
            </div>
            {isWorkspace && item.sub && (
              <div style={{ fontSize: 11.5, marginTop: 2, opacity: .6, color: dark ? TXT : TXT_DARK }}>
                {item.sub}
              </div>
            )}
          </div>

          {/* tiny green dot when active & expanded */}
          {!collapsed && active && (
            <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: CTA }} />
          )}

          {/* hover bloom like the photo (workspace stronger, resources softer) */}
          <style jsx>{`
            a.block.group:hover .plate{
              box-shadow: ${isWorkspace
                ? '0 16px 26px rgba(0,0,0,.22), 0 0 18px rgba(89,217,179,.18)'
                : '0 10px 20px rgba(0,0,0,.18), 0 0 12px rgba(255,255,255,.10)'};
              transform: translateY(-1px);
            }
          `}</style>
        </div>
      </Link>
    );
  };

  /* computed lists */
  const workspace = useMemo(() => NAV.filter(n => n.group === 'workspace'), []);
  const resources = useMemo(() => NAV.filter(n => n.group === 'resources'), []);

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 font-movatif"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width 300ms cubic-bezier(0.16,1,0.3,1)',
        background: railBands(dark),               // blended bands (no bands on brand/account)
        color: dark ? TXT : TXT_DARK,
        borderRight: `1px solid ${BORDER}`,
        boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)'
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* BRAND — centered; white AI icon + “Reduc AI”; NO separators here */}
        <div className="px-3 pt-5 pb-4" style={{ background: dark ? BASE_DK : BASE_LT }}>
          <div className="flex flex-col items-center gap-2">
            <div className="grid place-items-center"
                 style={{
                   width: 40, height: 40, borderRadius: 12,
                   background: dark ? 'rgba(255,255,255,.14)' : 'rgba(15,23,42,.10)',
                   border: dark ? '1px solid rgba(255,255,255,.18)' : '1px solid rgba(15,23,42,.16)'
                 }}>
              <Bot className="w-5 h-5" style={{ color:'#fff' }} />
            </div>
            {!collapsed && (
              <div className="font-movatif" style={{ fontSize: 17, fontWeight: 560, color: dark ? '#fff' : TXT_DARK }}>
                Reduc <span style={{ color: CTA, fontWeight: 520 }}>AI</span>
              </div>
            )}
          </div>
        </div>

        {/* optional thin divider under brand for structure */}
        <div aria-hidden style={{ height: 1, background: BORDER }} />

        {/* WORKSPACE */}
        <div className="px-3 mt-2">
          {SHOW_GROUP_TAGS && !collapsed && (
            <div className="mb-2" style={{ color: MUTED, fontSize: 10, letterSpacing: '.14em', fontWeight: 520 }}>
              WORKSPACE
            </div>
          )}
          <nav className="space-y-[6px]">
            {workspace.map(item => <Item key={item.id} item={item} />)}
          </nav>
        </div>

        {/* push RESOURCES to bottom */}
        <div className="flex-1" />

        {/* full-width subtle green separator (edge→edge) */}
        <div aria-hidden className="mx-3" style={{ height: 1, background: BORDER }} />

        {/* RESOURCES (white icons on dark plates; low opacity feel via plate) */}
        <div className="px-3 mt-2 mb-2">
          {SHOW_GROUP_TAGS && !collapsed && (
            <div className="mb-2" style={{ color: MUTED, fontSize: 10, letterSpacing: '.14em', fontWeight: 520 }}>
              RESOURCES
            </div>
          )}
          <nav className="space-y-[6px]">
            {resources.map(item => <Item key={item.id} item={item} />)}
          </nav>
        </div>

        {/* ACCOUNT — solid card, no bands; polished gradient avatar; no “Loading…” */}
        <div className="px-3 pb-4" style={{ background: dark ? BASE_DK : BASE_LT }}>
          <button
            onClick={() => router.push('/account')}
            className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left"
            style={{
              background: dark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.05)',
              border: dark ? '1px solid rgba(255,255,255,.10)' : '1px solid rgba(15,23,42,.12)',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.18)',
              color: dark ? TXT : TXT_DARK
            }}
          >
            <div
              className="grid place-items-center"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'radial-gradient(60% 60% at 50% 40%, rgba(255,255,255,.22), rgba(255,255,255,.08))',
                border: dark ? '1px solid rgba(255,255,255,.24)' : '1px solid rgba(15,23,42,.28)'
              }}
            >
              <UserIcon className="w-4 h-4" style={{ color:'#0b0f0e' }} />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ fontSize: 13, fontWeight: 560 }}>
                  {getDisplayName(userName, userEmail)}
                </div>
                <div className="truncate" style={{ fontSize: 11, opacity: .62 }}>
                  {userEmail || 'Open account'}
                </div>
              </div>
            )}
          </button>
        </div>

        {/* collapse handle (mid-rail) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
          style={{
            border: `1px solid rgba(89,217,179,.26)`,
            background: 'rgba(89,217,179,.10)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18), 0 0 10px rgba(0,255,194,0.10)'
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" style={{ color: CTA }} />
            : <ChevronLeft  className="w-4 h-4" style={{ color: CTA }} />}
        </button>
      </div>
    </aside>
  );
}
