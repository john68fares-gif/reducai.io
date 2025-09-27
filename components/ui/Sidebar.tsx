// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight,
  Bot, User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 208;         // narrower shell
const W_COLLAPSED = 60;
const LS = 'ui:sidebarCollapsed';

/* palette */
const CTA    = '#59d9b3';
const TEXT   = 'rgba(236,242,247,.92)';
const MUTED  = 'rgba(176,196,210,.62)';
const BORDER = 'rgba(255,255,255,.10)';
const BASE   = '#0a0f12';       // deep blue-teal

/* super-subtle bands: center darkest, sides +0.5% */
function bands({ steps = 9, cap = 0.005, gap = 0.4 }: {steps?:number; cap?:number; gap?:number}) {
  const parts: string[] = [];
  const mid = Math.ceil(steps / 2);
  const slot = 100 / steps;
  for (let i = 1; i <= steps; i++) {
    const d = Math.abs(i - mid);
    const lift = Math.min((cap / (mid - 1)) * d, cap);
    const col = `color-mix(in oklab, ${BASE} ${100 - lift*100}%, ${CTA} ${lift*100}%)`;
    const s = (i - 1) * slot, e = i * slot - gap;
    parts.push(`${col} ${s}%, ${col} ${e}%`, `transparent ${e}%, transparent ${i*slot}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* exact names (no subaccounts) */
type NavItem = {
  id: 'build'|'improve'|'demo'|'launch'|'market'|'mentor'|'keys';
  href: string; label: string; sub?: string; icon: JSX.Element; group: 'workspace'|'resources';
};
const NAV: NavItem[] = [
  { id:'build',   href:'/builder',     label:'Build',   sub:'Create AI agent',        icon:<Home/>,   group:'workspace' },
  { id:'improve', href:'/improve',     label:'Improve', sub:'Integrate and Improve',  icon:<Hammer/>, group:'workspace' },
  { id:'demo',    href:'/voice-agent', label:'Demo',    sub:'Showcase to clients',    icon:<Mic/>,    group:'workspace' },
  { id:'launch',  href:'/launch',      label:'Launch',  sub:'Deploy to production',   icon:<Rocket/>, group:'workspace' },

  { id:'market',  href:'/marketplace', label:'Marketplace',                          icon:<Phone/>,  group:'resources' },
  { id:'mentor',  href:'/ai-mentor',   label:'AI Mentor',                            icon:<Key/>,    group:'resources' },
  { id:'keys',    href:'/apikeys',     label:'API Key',                              icon:<HelpCircle/>, group:'resources' },
];

function getDisplayName(name?:string|null, email?:string|null){
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS) || 'false'); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  // auth + “loading account” veil
  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string|null>(null);
  const [userName, setUserName] = useState<string|null>(null);
  const [veil, setVeil] = useState(false);

  useEffect(() => { let unsub:any;
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserLoading(false);
      unsub = supabase.auth.onAuthStateChange((_e, s) => {
        const u = s?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
        setUserLoading(false);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const isActive = (item: NavItem) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch';
    return p.startsWith(item.href);
  };

  // make icons a tiny bit smaller (15px), text weights lighter
  const renderIcon = (n: JSX.Element) =>
    cloneElement(n, { className: 'w-[15px] h-[15px] shrink-0', strokeWidth: 2 });

  // “overlay style” plate for workspace; white plate for resources
  const Plate = ({ children, white=false, active=false }:{
    children: React.ReactNode; white?: boolean; active?: boolean;
  }) => (
    <div
      className="grid place-items-center"
      style={{
        width: 34, height: 34,
        borderRadius: 8,                 // less rounded, square feel
        background: white
          ? 'rgba(255,255,255,.08)'
          : 'color-mix(in oklab, #12191d 88%, #59d9b3 12%)',
        border: `1px solid ${white ? 'rgba(255,255,255,.16)' : 'rgba(89,217,179,.24)'}`,
        color: white ? '#fff' : (active ? CTA : TEXT),
        transition: 'box-shadow 180ms, transform 180ms, background 180ms'
      }}
    >
      {children}
    </div>
  );

  const Item = ({ item, active, whiteIcon }:{
    item: NavItem; active: boolean; whiteIcon?: boolean;
  }) => (
    <Link href={item.href} className="block group">
      <div
        className="relative flex items-center h-[46px] rounded-[10px] pr-2"
        style={{
          paddingLeft: collapsed ? 0 : 12,
          gap: collapsed ? 0 : 12,
          transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <Plate white={!!whiteIcon} active={active}>{renderIcon(item.icon)}</Plate>

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
          <div className="text-[15px]" style={{ color: TEXT, fontWeight: 520 }}>{item.label}</div>
          {item.sub && <div className="text-[11px] mt-[1px]" style={{ color: MUTED, fontWeight: 440 }}>{item.sub}</div>}
        </div>

        {!collapsed && active && (
          <span aria-hidden className="ml-auto rounded-full" style={{ width: 7, height: 7, background: CTA }} />
        )}

        <style jsx>{`
          a:hover .grid.place-items-center{
            box-shadow: 0 0 0 1px rgba(89,217,179,.34), 0 0 18px rgba(89,217,179,.14);
            transform: translateY(-1px);
          }
        `}</style>
      </div>
    </Link>
  );

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen z-50 font-movatif"
        style={{
          width: collapsed ? W_COLLAPSED : W_EXPANDED,
          transition: 'width 300ms cubic-bezier(0.16,1,0.3,1)',
          background: bands({ steps: 9, cap: 0.005, gap: 0.4 }), // ultra-subtle, blended
          color: TEXT,
          borderRight: `1px solid ${BORDER}`,
          boxShadow: 'inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42)',
        }}
        aria-label="Primary"
      >
        <div className="relative h-full flex flex-col">
          {/* BRAND: centered; white AI icon + “Reduc AI”; NO line here */}
          <div className="px-3 pt-5 pb-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-[12px] grid place-items-center"
                   style={{ background:'rgba(255,255,255,.16)' }}>
                <Bot className="w-5 h-5" style={{ color:'#fff' }} />
              </div>
              {!collapsed && (
                <div className="text-[16px]" style={{ color:'#fff', fontWeight: 560 }}>
                  Reduc <span style={{ color: CTA, fontWeight: 520 }}>AI</span>
                </div>
              )}
            </div>
          </div>

          {/* WORKSPACE */}
          <div className="px-3 mt-1">
            {!collapsed && (
              <div className="mb-2">
                <div className="text-[10px] tracking-[.14em]" style={{ color: MUTED, fontWeight: 520 }}>
                  WORKSPACE
                </div>
              </div>
            )}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group==='workspace').map((item, i) => (
                <Item
                  key={item.id}
                  item={item}
                  active={isActive(item)}
                  whiteIcon={false /* top 4 use overlay style */}
                />
              ))}
            </nav>
          </div>

          {/* push resources down */}
          <div className="flex-1" />

          {/* full-width separator between sections (left→right) */}
          <div aria-hidden className="mx-3" style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent)'
          }} />

          {/* RESOURCES (white icons, smaller labels) */}
          <div className="px-3 mt-2 mb-2">
            {!collapsed && (
              <div className="mb-2">
                <div className="text-[10px] tracking-[.14em]" style={{ color: MUTED, fontWeight: 520 }}>
                  RESOURCES
                </div>
              </div>
            )}
            <nav className="space-y-[6px]">
              {NAV.filter(n => n.group==='resources').map(item => (
                <Item key={item.id} item={item} active={isActive(item)} whiteIcon />
              ))}
            </nav>
          </div>

          {/* Account (teal tone, not grey) */}
          <div className="px-3 pb-4">
            <button
              onClick={() => { setVeil(true); setTimeout(() => router.push('/account'), 120); }}
              className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left"
              style={{
                background: 'linear-gradient(180deg, rgba(23,34,37,.92), rgba(11,18,20,.9))',
                border: `1px solid ${BORDER}`,
                boxShadow: 'inset 0 0 8px rgba(0,0,0,.18)',
                color: TEXT
              }}
            >
              <div className="w-8 h-8 rounded-[10px] grid place-items-center"
                   style={{ background: CTA }}>
                <UserIcon className="w-4 h-4 text-black/85" />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate" style={{ fontWeight: 560 }}>
                    {userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: MUTED, fontWeight: 440 }}>
                    {userEmail || 'Open account'}
                  </div>
                </div>
              )}
              {!collapsed && <span className="text-[11px]" style={{ color: MUTED, fontWeight: 520 }}>Open</span>}
            </button>
          </div>

          {/* collapse handle */}
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

      {/* loading veil for account */}
      {veil && (
        <div className="fixed inset-0 z-[99999] grid place-items-center"
             style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}>
          <div className="rounded-xl px-4 py-3"
               style={{ background:'rgba(15,18,20,.92)', border:`1px solid ${BORDER}`, color: TEXT }}>
            Loading account…
          </div>
        </div>
      )}
    </>
  );
}
