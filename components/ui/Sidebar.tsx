// components/ui/Sidebar.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home, Hammer, Monitor, Rocket, Key,
  Package, BookOpen, HelpCircle, Users,
  ShoppingCart, Bot, User, Mic, Phone,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

let SIDEBAR_MOUNTED = false;

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const LS_COLLAPSED = 'ui:sidebarCollapsed';
const W_EXPANDED = 260;
const W_COLLAPSED = 72;

export default function Sidebar() {
  // ensure only one sidebar mounts (avoids double rendering in strict mode)
  const [allowed, setAllowed] = useState<boolean>(() => !SIDEBAR_MOUNTED);
  useEffect(() => {
    if (SIDEBAR_MOUNTED) {
      setAllowed(false);
      return;
    }
    SIDEBAR_MOUNTED = true;
    return () => void (SIDEBAR_MOUNTED = false);
  }, []);

  const pathname = usePathname();
  const [lastBotId, setLastBotId] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      if (raw != null) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    try {
      const bots = JSON.parse(localStorage.getItem('chatbots') || '[]');
      const lastBot = bots[bots.length - 1];
      if (lastBot?.id) setLastBotId(lastBot.id);
    } catch {}
  }, []);

  const widthPx = collapsed ? W_COLLAPSED : W_EXPANDED;

  // drive page padding
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  if (!allowed) return null;

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 text-white font-movatif"
      style={{
        width: widthPx,
        transition: 'width 220ms cubic-bezier(.22,.61,.36,1)',
        background:
          'linear-gradient(180deg, rgba(10,12,13,0.98) 0%, rgba(9,11,12,0.98) 100%)',
        borderRight: '1px solid rgba(0,255,194,0.08)',
        boxShadow:
          'inset 0 0 18px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
      aria-expanded={!collapsed}
    >
      {/* subtle auras */}
      <div
        className="pointer-events-none absolute -top-[30%] -left-[30%] w-[68%] h-[68%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(0,255,194,0.07) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-[30%] -right-[30%] w-[68%] h-[68%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(0,255,194,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div
          className={cn(
            'border-b',
            collapsed ? 'px-3 pt-5 pb-4' : 'px-5 pt-6 pb-5',
          )}
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: '#00ffc2',
                boxShadow: '0 0 10px rgba(0,255,194,0.35)',
              }}
              aria-label="reducai.io"
            >
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div
              className={cn('overflow-hidden transition-[opacity,width] duration-200')}
              style={{
                opacity: collapsed ? 0 : 1,
                width: collapsed ? 0 : 160,
              }}
            >
              <div className="leading-tight">
                <div className="text-[17px] font-semibold tracking-wide">
                  reduc<span style={{ color: '#00ffc2' }}>ai.io</span>
                </div>
                <div className="text-[11px] text-white/55">Builder Workspace</div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <Section title="Workspace" showTitle={!collapsed} collapsed={collapsed}>
          <NavList collapsed={collapsed}>
            <Item
              collapsed={collapsed}
              href="/builder"
              label="Build"
              sub="Create AI agent"
              icon={<Home className="w-[18px] h-[18px]" />}
              active={pathname?.startsWith('/builder')}
            />
            <Item
              collapsed={collapsed}
              href={lastBotId ? `/improve/${lastBotId}` : '#'}
              label="Improve"
              sub="Integrate & optimize"
              icon={<Hammer className="w-[18px] h-[18px]" />}
              active={pathname?.startsWith('/improve')}
              disabled={!lastBotId}
            />
            <Item
              collapsed={collapsed}
              href="/voice-agent"
              label="Voice Agent"
              sub="Calls & persona"
              icon={<Mic className="w-[18px] h-[18px]" />}
              active={pathname?.startsWith('/voice-agent')}
            />
            <Item
              collapsed={collapsed}
              href="/phone-numbers"
              label="Phone Numbers"
              sub="Link provider numbers"
              icon={<Phone className="w-[18px] h-[18px]" />}
              active={pathname?.startsWith('/phone-numbers')}
            />
            <Item
              collapsed={collapsed}
              href="/demo"
              label="Demo"
              sub="Showcase to clients"
              icon={<Monitor className="w-[18px] h-[18px]" />}
              active={pathname === '/demo'}
            />
            <Item
              collapsed={collapsed}
              href="/launch"
              label="Launch"
              sub="Deploy to production"
              icon={<Rocket className="w-[18px] h-[18px]" />}
              active={pathname === '/launch'}
            />
          </NavList>
        </Section>

        {/* Divider */}
        <div
          className="my-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        />

        {/* Resources */}
        <Section title="Resources" showTitle={!collapsed} collapsed={collapsed}>
          <NavList collapsed={collapsed}>
            <Item collapsed={collapsed} href="#" label="Marketplace" icon={<ShoppingCart className="w-[18px] h-[18px]" />} />
            <Item collapsed={collapsed} href="#" label="AI Mentor" icon={<BookOpen className="w-[18px] h-[18px]" />} />
            <Item collapsed={collapsed} href="/apikeys" label="API Key" icon={<Key className="w-[18px] h-[18px]" />} />
            <Item collapsed={collapsed} href="#" label="Bulk Tester" icon={<Package className="w-[18px] h-[18px]" />} />
            <Item collapsed={collapsed} href="#" label="Video Guides" icon={<HelpCircle className="w-[18px] h-[18px]" />} />

            {/* ✅ Support now opens the page */}
            <Item
              collapsed={collapsed}
              href="/support"
              label="Support"
              sub="Help & FAQ"
              icon={<HelpCircle className="w-[18px] h-[18px]" />}
              active={pathname === '/support'}
            />
          </NavList>
        </Section>

        {/* Account */}
        <div className={cn('mt-auto', collapsed ? 'px-2 pb-4' : 'px-4 pb-5')}>
          <div
            className={cn(
              'rounded-2xl flex items-center justify-between',
              collapsed ? 'px-2 py-2' : 'px-4 py-3'
            )}
            style={{
              background: 'rgba(15,18,20,0.85)',
              border: '1px solid rgba(0,255,194,0.12)',
              boxShadow:
                'inset 0 0 12px rgba(0,0,0,0.35), 0 0 10px rgba(0,255,194,0.04)',
            }}
          >
            <div className={cn('flex items-center gap-3', collapsed && 'justify-center w-full gap-0')}>
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-[0_0_8px_rgba(255,165,0,0.30)]">
                <User className="w-4 h-4 text-white" />
              </div>
              <div
                className="overflow-hidden transition-[opacity,width] duration-200"
                style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 140 }}
              >
                <div className="leading-tight">
                  <div className="text-sm font-semibold">My Account</div>
                  <div className="text-[11px] text-yellow-300/90">980 XP • Bronze</div>
                </div>
              </div>
            </div>
            {!collapsed && <div className="text-white/60 text-xs">▼</div>}
          </div>
        </div>

        {/* Expand/Collapse handle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(16,19,21,0.95)',
            boxShadow:
              '0 2px 12px rgba(0,0,0,0.45), 0 0 10px rgba(0,255,194,0.06)',
            transition: 'background 140ms ease',
          }}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-white/80" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white/80" />
          )}
        </button>
      </div>
    </aside>
  );
}

/* ---------- Small building blocks ---------- */

function Section({
  title,
  showTitle,
  collapsed,
  children,
}: {
  title: string;
  showTitle: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(collapsed ? 'px-2 pt-4' : 'px-4 pt-4')}>
      {showTitle && (
        <div className="text-[11px] uppercase tracking-wide text-white/55 mb-2.5 px-1">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function NavList({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return <nav className={cn(collapsed ? 'space-y-1.5' : 'space-y-2.5')}>{children}</nav>;
}

function Item({
  href,
  label,
  sub,
  icon,
  active,
  disabled,
  collapsed,
}: {
  href: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  collapsed: boolean;
}) {
  const body = (
    <div
      className={cn(
        'group rounded-xl flex items-center transition-transform',
        collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:translate-x-[1px]'
      )}
      style={{
        border: `1px solid ${
          active ? 'rgba(0,255,194,0.28)' : 'rgba(255,255,255,0.06)'
        }`,
        background: active ? 'rgba(0,255,194,0.06)' : 'rgba(15,18,20,0.55)',
        boxShadow: active
          ? '0 0 12px rgba(0,255,194,0.16) inset, 0 0 8px rgba(0,255,194,0.04)'
          : 'inset 0 0 10px rgba(0,0,0,0.28)',
      }}
      title={collapsed ? label : undefined}
    >
      <div
        className={cn('shrink-0', collapsed ? '' : 'mr-3')}
        style={{ color: active ? '#00ffc2' : 'rgba(255,255,255,0.86)' }}
      >
        {icon}
      </div>

      <div
        className="overflow-hidden transition-[opacity,width] duration-200"
        style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 999 }}
      >
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white/95">{label}</div>
          {sub && (
            <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (disabled) return <div>{body}</div>;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
