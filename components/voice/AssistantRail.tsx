// FILE: components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, cloneElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket, Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight, User as UserIcon, Bot, FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 260;
const W_COLLAPSED = 76;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

/* Match VoiceAgentSection tokens */
const CTA       = '#59d9b3';
const CTA_WEAK  = 'rgba(89,217,179,.12)';
const CTA_LINE  = 'rgba(89,217,179,.20)';

type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  group: 'workspace' | 'resources';
};

const NAV: NavItem[] = [
  { id: 'create',   href: '/builder',       label: 'Create',       sub: 'Design your agent',     icon: <Home />,     group: 'workspace' },
  { id: 'tuning',   href: '/improve',       label: 'Tuning',       sub: 'Integrate & optimize',  icon: <Hammer />,   group: 'workspace' },
  { id: 'voice',    href: '/voice-agent',   label: 'Voice Studio', sub: 'Calls & persona',       icon: <Mic />,      group: 'workspace' },
  { id: 'subs',     href: '/subaccounts',   label: 'Subaccounts',  sub: 'Transcripts',           icon: <FileText />, group: 'workspace' },
  { id: 'launch',   href: '/launch',        label: 'Launchpad',    sub: 'Go live',               icon: <Rocket />,   group: 'workspace' },

  { id: 'numbers',  href: '/phone-numbers', label: 'Numbers',      sub: 'Twilio & BYO',          icon: <Phone />,    group: 'resources' },
  { id: 'keys',     href: '/apikeys',       label: 'API Keys',     sub: 'Models & access',       icon: <Key />,      group: 'resources' },
  { id: 'help',     href: '/support',       label: 'Help',         sub: 'Guides & FAQ',          icon: <HelpCircle />, group: 'resources' },
];

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

export default function Sidebar() {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || 'false'); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--app-sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
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

  const activeCheck = (item: NavItem) => {
    const p = pathname || '';
    if (item.href === '/launch') return p === '/launch';
    return p.startsWith(item.href);
  };

  // Unified icon style like “Create” overlay: compact, bold, squared-8
  const renderIcon = (node: JSX.Element) =>
    cloneElement(node, { className: 'w-[16px] h-[16px] shrink-0', strokeWidth: 2.25 });

  const Item = ({ item, active }: { item: NavItem; active: boolean }) => {
    const isWorkspace = item.group === 'workspace';

    return (
      <Link href={item.href} className="block group/sidebar" title={collapsed ? item.label : undefined}>
        <div
          className="sb-item relative flex items-center rounded-[8px]"
          data-active={active ? 'true' : 'false'}
          data-collapsed={collapsed ? 'true' : 'false'}
          style={{
            height: 46,
            paddingLeft: collapsed ? 8 : 10,
            paddingRight: 8,
            gap: collapsed ? 0 : 10,
            transition: 'gap 280ms var(--ease), padding 280ms var(--ease), transform 220ms var(--ease)',
          }}
        >
          {/* icon pill */}
          <div
            className="sb-icon grid place-items-center rounded-[8px] relative"
            style={{
              width: 36, height: 36,
              background: active ? CTA_WEAK : 'var(--sb-icon-bg)',
              border: `1px solid ${active ? CTA_LINE : 'var(--sb-icon-border)'}`,
              color: 'var(--sidebar-text)',
              boxShadow: active
                ? '0 10px 22px rgba(89,217,179,.28), 0 0 0 1px rgba(255,255,255,.06) inset'
                : 'inset 0 0 0 1px rgba(0,0,0,0.04)',
              transform: collapsed ? 'translateX(2px)' : 'none'
            }}
          >
            {/* Glow ring on hover/active like dropdowns */}
            <span className="sb-glow" />
            <span className="sb-glow-outer" />
            <span className="sb-glow-line" />
            <span className="relative" style={{ color: isWorkspace ? CTA : 'var(--sidebar-text)' }}>
              {renderIcon(item.icon)}
            </span>
          </div>

          {/* labels */}
          <div
            className="overflow-hidden"
            style={{
              transition: 'max-width 280ms var(--ease), opacity 280ms var(--ease), transform 280ms var(--ease)',
              maxWidth: collapsed ? 0 : 200,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              lineHeight: 1.12,
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

        {/* active hairline */}
        <div
          className="h-[2px] rounded-full"
          style={{
            marginLeft: collapsed ? 20 : 12,
            marginRight: 12,
            background: active
              ? 'linear-gradient(90deg, transparent, rgba(89,217,179,.55), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(89,217,179,0), transparent)',
            transition: 'background 220ms var(--ease), margin 220ms var(--ease)',
          }}
        />

        {/* row overlay & hover effects */}
        <style jsx>{`
          .sb-item::after{
            content:'';
            position:absolute; inset:0;
            border-radius:8px;
            background:${CTA};
            opacity:0;
            pointer-events:none;
            transition: opacity .18s var(--ease);
            mix-blend-mode:screen;
          }
          .group\/sidebar:hover .sb-item::after{ opacity:.18; }
          .sb-item[data-active="true"]::after{ opacity:.32; }

          .sb-icon .sb-glow{
            position:absolute; inset:-1px;
            border-radius:8px;
            box-shadow: 0 0 0 0 ${CTA};
            opacity:0;
            transition: box-shadow .22s var(--ease), opacity .22s var(--ease), transform .22s var(--ease);
          }
          .sb-icon .sb-glow-outer{
            position:absolute; inset:-6px;
            border-radius:12px;
            background: radial-gradient(60% 60% at 50% 50%, ${CTA} 0%, transparent 70%);
            filter: blur(10px);
            opacity:0;
            transition: opacity .22s var(--ease);
          }
          .sb-icon .sb-glow-line{
            position:absolute; inset:0;
            border-radius:8px;
            box-shadow: 0 0 0 0 ${CTA};
            opacity:0;
            transition: box-shadow .22s var(--ease), opacity .22s var(--ease);
          }

          .group\/sidebar:hover .sb-icon .sb-glow{
            box-shadow: 0 0 0 2px ${CTA};
            opacity:.7;
          }
          .group\/sidebar:hover .sb-icon .sb-glow-outer{ opacity:.55; }
          .group\/sidebar:hover .sb-icon .sb-glow-line{
            box-shadow: inset 0 0 0 1px ${CTA_LINE};
            opacity:1;
          }

          .sb-item[data-active="true"] .sb-icon .sb-glow{
            box-shadow: 0 0 0 3px ${CTA};
            opacity:.9;
          }
          .sb-item[data-active="true"] .sb-icon .sb-glow-outer{ opacity:.7; }

          /* Collapsed hover prettiness: slide item slightly and center icon */
          .sb-item[data-collapsed="true"]:hover{
            transform: translateX(2px);
          }
        `}</style>
      </Link>
    );
  };

  return (
    <aside
      data-app-sidebar
      className="fixed left-0 top-0 h-screen z-50"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width 360ms var(--ease)',
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        borderRight: '1px solid var(--sidebar-border)',
        boxShadow: 'var(--sb-shell-shadow, inset 0 0 18px rgba(0,0,0,.28))',
      }}
      aria-label="Sidebar"
    >
      <div className="relative h-full flex flex-col">
        {/* Header (match overlays: squared-8, CTA chip) */}
        <div className="px-3 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-[8px] grid place-items-center shrink-0"
              style={{ background: CTA, boxShadow: '0 10px 22px rgba(89,217,179,.28)' }}
            >
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div
              className="overflow-hidden"
              style={{
                transition: 'max-width 360ms var(--ease), opacity 360ms var(--ease), transform 360ms var(--ease)',
                maxWidth: collapsed ? 0 : 200,
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
              }}
            >
              <div className="text-[16px] font-semibold tracking-wide" style={{ color: 'var(--sidebar-text)' }}>
                reduc<span style={{ color: CTA }}>ai.io</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div aria-hidden className="pointer-events-none" style={{ height: 1, background: 'var(--sidebar-border)', boxShadow: '0 1px 0 rgba(0,0,0,.04)' }} />

        {/* Groups */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
          {!collapsed && (
            <div
              className="inline-flex items-center h-6 px-2 rounded-[8px] text-[10px] font-semibold tracking-[.14em] mb-2"
              style={{ color: 'var(--sidebar-muted)', border: '1px solid var(--sidebar-border)', background: 'var(--sb-tag-bg)' }}
            >
              WORKSPACE
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'workspace').map(item => (
              <Item key={item.id} item={item} active={activeCheck(item)} />
            ))}
          </nav>

          <div style={{ height: 14 }} />

          {!collapsed && (
            <div
              className="inline-flex items-center h-6 px-2 rounded-[8px] text-[10px] font-semibold tracking-[.14em] mb-2"
              style={{ color: 'var(--sidebar-muted)', border: '1px solid var(--sidebar-border)', background: 'var(--sb-tag-bg)' }}
            >
              RESOURCES
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n => n.group === 'resources').map(item => (
              <Item key={item.id} item={item} active={activeCheck(item)} />
            ))}
          </nav>
        </div>

        {/* Account card */}
        <div className="px-3 pb-4">
          {!collapsed ? (
            <Link
              href="/account"
              className="w-full rounded-[8px] px-3 py-3 flex items-center gap-3 text-left"
              style={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--sidebar-border)',
                boxShadow: 'var(--card-shadow)',
                color: 'var(--sidebar-text)',
              }}
            >
              <div className="w-9 h-9 rounded-[8px] grid place-items-center" style={{ background: CTA, boxShadow: '0 10px 22px rgba(89,217,179,.28)' }}>
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
            <Link
              href="/account"
              title="Account"
              className="block mx-auto rounded-[8px] relative group/account"
              style={{
                width: 40, height: 40,
                background: 'var(--sb-icon-bg)',
                border: '1px solid var(--sb-icon-border)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)'
              }}
            >
              <span className="absolute inset-0 rounded-[8px] opacity-0 group-hover/account:opacity-10"
                    style={{ background: CTA, transition: 'opacity .18s var(--ease)' }} />
              <div className="w-full h-full grid place-items-center relative">
                <UserIcon className="w-5 h-5" style={{ color: 'var(--sidebar-text)' }} />
              </div>
            </Link>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
          style={{
            border: '1px solid var(--sidebar-border)',
            background: 'var(--panel-bg)',
            boxShadow: '0 10px 22px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,.06) inset',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
            : <ChevronLeft  className="w-4 h-4" style={{ color: 'var(--sidebar-text)' }} />
          }
        </button>
      </div>

      {/* Theme alignment with VoiceAgentSection */}
      <style jsx>{`
        :global(:root) { --ease: cubic-bezier(.22,.61,.36,1); }
        /* Light */
        :global(:root:not([data-theme="dark"])) aside[aria-label="Sidebar"]{
          --sidebar-bg: var(--panel-bg, #ffffff);
          --sidebar-text: var(--text, #0b1620);
          --sidebar-muted: var(--text-muted, #50606a);
          --sidebar-border: var(--border-weak, rgba(0,0,0,.10));
          --sb-icon-bg: var(--panel-bg, #ffffff);
          --sb-icon-border: var(--border-weak, rgba(0,0,0,.10));
          --sb-tag-bg: var(--panel-bg, #ffffff);
          --card-shadow: 0 14px 28px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04) inset, 0 0 0 1px ${CTA_LINE};
          --sb-shell-shadow: inset 0 0 18px rgba(0,0,0,.06);
        }
        /* Dark */
        :global([data-theme="dark"]) aside[aria-label="Sidebar"]{
          --sidebar-bg: var(--panel-bg, #0d0f11);
          --sidebar-text: var(--text, #e6f1ef);
          --sidebar-muted: var(--text-muted, #9fb4ad);
          --sidebar-border: var(--border-weak, rgba(255,255,255,.10));
          --sb-icon-bg: rgba(255,255,255,.06);
          --sb-icon-border: rgba(255,255,255,.12);
          --sb-tag-bg: rgba(255,255,255,.03);
          --card-shadow: 0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${CTA_LINE};
          --sb-shell-shadow: inset 0 0 18px rgba(0,0,0,.28), 14px 0 28px rgba(0,0,0,.42);
        }
      `}</style>
    </aside>
  );
}
