// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home, Hammer, Monitor, Rocket, Key,
  Package, BookOpen, HelpCircle, Users,
  ShoppingCart, Bot, User, Mic, Phone,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

// Prevent duplicate sidebars if _app renders twice on client
let SIDEBAR_MOUNTED = false;

// tiny class joiner
function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const LS_COLLAPSED = 'ui:sidebarCollapsed';

export default function Sidebar() {
  // 1) Hooks first
  const [allowed, setAllowed] = useState<boolean>(() => !SIDEBAR_MOUNTED);
  useEffect(() => {
    if (SIDEBAR_MOUNTED) {
      setAllowed(false);
      return;
    }
    SIDEBAR_MOUNTED = true;
    return () => {
      SIDEBAR_MOUNTED = false;
    };
  }, []);

  const pathname = usePathname();
  const [lastBotId, setLastBotId] = useState<string | null>(null);

  // collapsed state (persisted)
  const [collapsed, setCollapsed] = useState<boolean>(false);
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

  // Read last created bot id from localStorage (for Improve link)
  useEffect(() => {
    try {
      const bots = JSON.parse(localStorage.getItem('chatbots') || '[]');
      const lastBot = bots[bots.length - 1];
      if (lastBot?.id) setLastBotId(lastBot.id);
    } catch {}
  }, []);

  const widthPx = collapsed ? 72 : 260;

  // Drive main content padding via CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  // 2) Safe to short-circuit render after hooks
  if (!allowed) return null;

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 text-white font-movatif"
      style={{
        width: widthPx,
        transition: 'width 220ms ease',
        background: 'linear-gradient(180deg, rgba(13,15,17,0.98) 0%, rgba(10,12,13,0.98) 100%)',
        borderRight: '1px solid rgba(0,255,194,0.12)',
        boxShadow: 'inset 0 0 22px rgba(0,0,0,0.35)',
      }}
    >
      {/* teal auras */}
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-[28%] -right-[28%] w-[70%] h-[70%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
      />

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className={cn('px-5 pt-6 pb-5 border-b border-white/10', collapsed && 'px-3')}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center gap-2')}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#00ffc2', boxShadow: '0 0 14px rgba(0,255,194,0.45)' }}
              aria-label="reducai.io"
            >
              <Bot className="w-5 h-5 text-black" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="text-[17px] font-semibold tracking-wide">
                  reduc<span style={{ color: '#00ffc2' }}>ai.io</span>
                </div>
                <div className="text-[11px] text-white/55">Builder Workspace</div>
              </div>
            )}
          </div>
        </div>

        {/* Workspace */}
        <div className={cn('px-4 py-4', collapsed && 'px-2')}>
          {!collapsed && <div className="text-[11px] uppercase tracking-wide text-white/55 mb-3 px-1">Workspace</div>}
          <nav className={cn('space-y-2', collapsed && 'space-y-1')}>
            <SidebarItem
              collapsed={collapsed}
              href="/builder"
              label="Build"
              sub="Create AI agent"
              icon={<Home className="w-4 h-4" />}
              active={pathname?.startsWith('/builder')}
            />
            <SidebarItem
              collapsed={collapsed}
              href={lastBotId ? `/improve/${lastBotId}` : '#'}
              label="Improve"
              sub="Integrate & optimize"
              icon={<Hammer className="w-4 h-4" />}
              active={pathname?.startsWith('/improve')}
              disabled={!lastBotId}
            />
            <SidebarItem
              collapsed={collapsed}
              href="/voice-agent"
              label="Voice Agent"
              sub="Calls & persona"
              icon={<Mic className="w-4 h-4" />}
              active={pathname === '/voice-agent' || pathname?.startsWith('/voice-agent')}
            />
            <SidebarItem
              collapsed={collapsed}
              href="/phone-numbers"
              label="Phone Numbers"
              sub="Link provider numbers"
              icon={<Phone className="w-4 h-4" />}
              active={pathname === '/phone-numbers' || pathname?.startsWith('/phone-numbers')}
            />
            <SidebarItem
              collapsed={collapsed}
              href="/demo"
              label="Demo"
              sub="Showcase to clients"
              icon={<Monitor className="w-4 h-4" />}
              active={pathname === '/demo'}
            />
            <SidebarItem
              collapsed={collapsed}
              href="/launch"
              label="Launch"
              sub="Deploy to production"
              icon={<Rocket className="w-4 h-4" />}
              active={pathname === '/launch'}
            />
          </nav>
        </div>

        {/* Divider */}
        <div className="mt-2 mb-3 border-t border-white/10" />

        {/* Resources */}
        <div className={cn('px-4', collapsed && 'px-2')}>
          {!collapsed && <div className="text-[11px] uppercase tracking-wide text-white/55 mb-3 px-1">Resources</div>}
          <nav className={cn('space-y-2', collapsed && 'space-y-1')}>
            <SidebarItem collapsed={collapsed} href="#" label="Marketplace" icon={<ShoppingCart className="w-4 h-4" />} />
            <SidebarItem collapsed={collapsed} href="#" label="AI Mentor" icon={<BookOpen className="w-4 h-4" />} />
            <SidebarItem collapsed={collapsed} href="/apikeys" label="API Key" icon={<Key className="w-4 h-4" />} />
            <SidebarItem collapsed={collapsed} href="#" label="Bulk Tester" icon={<Package className="w-4 h-4" />} />
            <SidebarItem collapsed={collapsed} href="#" label="Video Guides" icon={<HelpCircle className="w-4 h-4" />} />
            <SidebarItem collapsed={collapsed} href="#" label="Support" icon={<Users className="w-4 h-4" />} />
          </nav>
        </div>

        {/* Account card */}
        <div className={cn('mt-auto px-4 pb-5 pt-4', collapsed && 'px-2')}>
          <div
            className={cn('rounded-2xl flex items-center justify-between', collapsed ? 'px-2 py-2' : 'px-4 py-3')}
            style={{
              background: 'rgba(16,19,20,0.90)',
              border: '1px solid rgba(0,255,194,0.18)',
              boxShadow: '0 0 14px rgba(0,255,194,0.06), inset 0 0 14px rgba(0,0,0,0.35)',
            }}
          >
            <div className={cn('flex items-center gap-3', collapsed && 'justify-center w-full gap-0')}>
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-[0_0_10px_rgba(255,165,0,0.35)]">
                <User className="w-4 h-4 text-white" />
              </div>
              {!collapsed && (
                <div className="leading-tight">
                  <div className="text-sm font-semibold">My Account</div>
                  <div className="text-[11px] text-yellow-300/90">980 XP • Bronze</div>
                </div>
              )}
            </div>
            {!collapsed && <div className="text-white/60 text-xs">▼</div>}
          </div>
        </div>

        {/* Collapse / expand handle (mid-right) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full shadow bg-[#0f1216] border border-white/10 hover:bg-white/10 p-1.5"
          style={{ transition: 'background 140ms ease' }}
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

function SidebarItem({
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
  collapsed?: boolean;
}) {
  const content = (
    <div
      className={cn(
        'group rounded-xl flex items-start transition-all',
        collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2.5 gap-3',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:translate-x-[1px]'
      )}
      style={{
        border: `1px solid ${active ? 'rgba(0,255,194,0.45)' : 'rgba(0,255,194,0.18)'}`,
        background: active ? 'rgba(0,255,194,0.10)' : 'rgba(15,18,20,0.65)',
        boxShadow: active
          ? '0 0 16px rgba(0,255,194,0.22), inset 0 0 16px rgba(0,0,0,0.30)'
          : 'inset 0 0 16px rgba(0,0,0,0.28)',
      }}
      title={collapsed ? label : undefined}
    >
      <div
        className={cn('mt-[2px] shrink-0', !collapsed && 'mr-3')}
        style={{ color: active ? '#00ffc2' : 'rgba(255,255,255,0.85)' }}
      >
        {icon}
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">
            <span className={cn(!active && 'text-white/90')}>{label}</span>
          </div>
          {sub && <div className="text-[11px] text-white/55 group-hover:text-white/70">{sub}</div>}
        </div>
      )}
    </div>
  );

  if (disabled) return <div>{content}</div>;
  return (
    <Link href={href} className="block relative">
      {content}
    </Link>
  );
}
