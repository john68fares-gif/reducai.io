// components/ui/Sidebar.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Hammer,
  Mic,
  Rocket,
  Phone,
  Key,
  HelpCircle,
  Bot,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase-client';

type NavItem = {
  href: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  active: (pathname: string) => boolean;
  disabled?: boolean;
};

const W_EXPANDED = 260;
const W_COLLAPSED = 72;
const LS_COLLAPSE = 'ui:sidebarCollapsed';

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  // ----- collapse -----
  const [collapsed, setCollapsed] = useState<boolean>(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSE);
      if (raw != null) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSE, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);
  const widthPx = collapsed ? W_COLLAPSED : W_EXPANDED;
  useEffect(() => {
    // expose to layout
    document.documentElement.style.setProperty('--sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  // ----- auth (just to show name/email + sign-out) -----
  const [userLoading, setUserLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    let unsub: any;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserName(user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account');
        setUserEmail(user?.email || '');
      } finally {
        setUserLoading(false);
      }
      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUserName(u?.user_metadata?.name || u?.email?.split('@')[0] || 'Account');
        setUserEmail(u?.email || '');
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const onSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace('/auth?mode=signin');
    }
  }, [router]);

  // ----- nav -----
  const workspace: NavItem[] = useMemo(
    () => [
      {
        href: '/builder',
        label: 'Build',
        sub: 'Create AI agent',
        icon: <Home className="w-5 h-5" />,
        active: (p) => p.startsWith('/builder'),
      },
      {
        href: '/improve',
        label: 'Improve',
        sub: 'Integrate & optimize',
        icon: <Hammer className="w-5 h-5" />,
        active: (p) => p.startsWith('/improve'),
      },
      {
        href: '/voice-agent',
        label: 'Voice Agent',
        sub: 'Calls & persona',
        icon: <Mic className="w-5 h-5" />,
        active: (p) => p.startsWith('/voice-agent'),
      },
      {
        href: '/launch',
        label: 'Launch',
        sub: 'Deploy to production',
        icon: <Rocket className="w-5 h-5" />,
        active: (p) => p === '/launch',
      },
    ],
    []
  );

  // “Resources” (you asked to keep *Phone Numbers*, *API Key*, *Support* only)
  const resources: NavItem[] = useMemo(
    () => [
      {
        href: '/phone-numbers',
        label: 'Phone Numbers',
        sub: 'Link provider numbers',
        icon: <Phone className="w-5 h-5" />,
        active: (p) => p.startsWith('/phone-numbers'),
      },
      {
        href: '/apikeys',
        label: 'API Key',
        icon: <Key className="w-5 h-5" />,
        active: (p) => p.startsWith('/apikey'),
      },
      {
        href: '/support',
        label: 'Support',
        sub: 'Help & FAQ',
        icon: <HelpCircle className="w-5 h-5" />,
        active: (p) => p === '/support',
      },
    ],
    []
  );

  // account dropdown
  const [acctOpen, setAcctOpen] = useState(false);

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-40 text-white font-movatif transition-[width] duration-500 ease-out"
      style={{
        width: widthPx,
        background: 'linear-gradient(180deg, rgba(8,10,11,0.98), rgba(9,11,12,0.98))',
        borderRight: '1px solid rgba(0,255,194,0.08)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.36), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div
          className="border-b px-4 py-5 flex items-center gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#00ffc2', boxShadow: '0 0 10px rgba(0,255,194,0.35)' }}
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

        {/* Workspace */}
        <Section title="Workspace" collapsed={collapsed}>
          {workspace.map((item) => (
            <NavRow key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
          ))}
        </Section>

        {/* Resources */}
        <div className="my-3 border-t border-white/10" />
        <Section title="Resources" collapsed={collapsed}>
          {resources.map((item) => (
            <NavRow key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
          ))}
        </Section>

        {/* Spacer */}
        <div className="mt-auto" />

        {/* Account */}
        <div className="px-4 pb-5">
          <div
            className={cn(
              'rounded-2xl flex items-center justify-between px-4 py-3 transition-all duration-500 ease-out',
              collapsed && 'px-2'
            )}
            style={{
              background: 'rgba(15,18,20,0.85)',
              border: '1px solid rgba(0,255,194,0.12)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35), 0 0 10px rgba(0,255,194,0.04)',
            }}
          >
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-[0_0_8px_rgba(255,165,0,0.30)]">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              {!collapsed && (
                <div className="leading-tight min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {userLoading ? 'Loading…' : userName || 'Account'}
                  </div>
                  <div className="text-[11px] text-white/60 truncate">
                    {userLoading ? '' : userEmail}
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                className="text-white/70 text-xs px-2 py-1 rounded-md hover:bg-white/10"
                onClick={() => setAcctOpen((v) => !v)}
                aria-label="Account menu"
              >
                {acctOpen ? '▲' : '▼'}
              </button>
            )}
          </div>

          {/* Dropdown */}
          <AnimatePresence>
            {!collapsed && acctOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="mt-2 rounded-xl overflow-hidden border border-white/10"
                style={{ background: 'rgba(13,15,17,0.95)' }}
              >
                <button
                  onClick={() => {
                    setAcctOpen(false);
                    router.push('/account');
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5"
                >
                  <SettingsIcon className="w-4 h-4 text-white/80" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5"
                >
                  <LogOut className="w-4 h-4 text-white/80" />
                  <span>Sign out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(16,19,21,0.95)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.45), 0 0 10px rgba(0,255,194,0.06)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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

/* ----------------- small pieces ----------------- */

function Section({
  title,
  children,
  collapsed,
}: {
  title: string;
  children: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <div className="px-4 pt-4">
      {!collapsed && (
        <div className="text-[11px] uppercase tracking-wider text-white/45 mb-2.5">{title}</div>
      )}
      <nav className="space-y-2.5">{children}</nav>
    </div>
  );
}

function NavRow({
  item,
  collapsed,
  pathname,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
}) {
  const active = item.active(pathname);

  const body = (
    <div
      className={cn(
        'group rounded-xl flex items-center h-12 transition-all duration-200 will-change-transform',
        collapsed ? 'justify-center' : 'px-3',
        !item.disabled && 'hover:translate-x-[1px]',
        item.disabled && 'opacity-50 cursor-not-allowed'
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
      title={collapsed ? item.label : undefined}
    >
      <motion.div
        className={cn(
          'flex items-center justify-center',
          collapsed ? 'w-8 h-8 mx-auto' : 'w-8 h-8 mr-3'
        )}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="w-5 h-5 flex items-center justify-center text-white/90">{item.icon}</div>
      </motion.div>

      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white/95">{item.label}</div>
          {item.sub && (
            <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">{item.sub}</div>
          )}
        </div>
      )}
    </div>
  );

  if (item.disabled) return <div>{body}</div>;
  return (
    <Link href={item.href} className="block">
      {body}
    </Link>
  );
}
