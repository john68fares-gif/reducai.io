'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Hammer,
  HelpCircle,
  Key,
  LogOut,
  Mic,
  Phone,
  Rocket,
  Settings as SettingsIcon,
  User as UserIcon,
  Wand2,
  Home,
  MessageSquare,
  PlayCircle,
  Store,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 260;
const W_COLLAPSED = 72;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

const palette = ['#6af7d1', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (seed: string) =>
  palette[Math.abs([...seed].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

type NavItem = {
  href: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  section: 'WORKSPACE' | 'RESOURCES';
  activeTest: (path: string | null) => boolean;
  disabled?: boolean;
};

export default function Sidebar() {
  const pathname = usePathname();

  // collapse state (persist + update CSS var used by the layout)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      return raw ? JSON.parse(raw) : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed));
    } catch {}
    document.documentElement.style.setProperty(
      '--sidebar-w',
      `${collapsed ? W_COLLAPSED : W_EXPANDED}px`,
    );
  }, [collapsed]);

  // user
  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);

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
  useEffect(() => setAcctOpen(false), [pathname]);

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setAcctOpen(false);
    } catch {}
  };

  // nav structure (renamed a bit so it feels like your identity)
  const items: NavItem[] = useMemo(
    () => [
      // Workspace
      { href: '/builder',      label: 'Create',     sub: 'Design your agent',       icon: <Wand2 />,        section: 'WORKSPACE', activeTest: (p) => p?.startsWith('/builder') ?? false },
      { href: '/tuning',       label: 'Tuning',     sub: 'Integrate & optimize',    icon: <Hammer />,       section: 'WORKSPACE', activeTest: (p) => p?.startsWith('/tuning') ?? false },
      { href: '/voice-studio', label: 'Voice Studio', sub: 'Calls & persona',       icon: <Mic />,          section: 'WORKSPACE', activeTest: (p) => p?.startsWith('/voice-studio') ?? false },
      { href: '/launchpad',    label: 'Launchpad',  sub: 'Go live',                 icon: <Rocket />,       section: 'WORKSPACE', activeTest: (p) => p === '/launchpad' },

      // Resources
      { href: '/phone-numbers', label: 'Numbers',   sub: 'Twilio & BYO',            icon: <Phone />,        section: 'RESOURCES', activeTest: (p) => p?.startsWith('/phone-numbers') ?? false },
      { href: '/apikeys',       label: 'API Keys',  sub: 'Models & access',         icon: <Key />,          section: 'RESOURCES', activeTest: (p) => p?.startsWith('/apikeys') ?? false },
      { href: '/mentor',        label: 'AI Mentor', sub: 'Guidance',                icon: <MessageSquare />,section: 'RESOURCES', activeTest: (p) => p?.startsWith('/mentor') ?? false, disabled: true },
      { href: '/market',        label: 'Marketplace', sub: 'Templates',              icon: <Store />,        section: 'RESOURCES', activeTest: (p) => p?.startsWith('/market') ?? false, disabled: true },
      { href: '/support',       label: 'Help',      sub: 'Guides & FAQ',            icon: <HelpCircle />,   section: 'RESOURCES', activeTest: (p) => p === '/support' },
    ],
    [],
  );

  // split sections for spacing + headers
  const workspace = items.filter((i) => i.section === 'WORKSPACE');
  const resources = items.filter((i) => i.section === 'RESOURCES');

  // compact icon chip (same language as API Keys/Numbers cards)
  const IconChip = ({ children }: { children: React.ReactNode }) => (
    <div
      className="grid place-items-center rounded-[10px]"
      style={{
        width: 28, height: 28,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ width: 18, height: 18, color: 'var(--brand)' }}>{children}</div>
    </div>
  );

  const NavRow = ({
    href, label, sub, icon, active, disabled,
  }: {
    href: string; label: string; sub?: string; icon: React.ReactNode; active?: boolean; disabled?: boolean;
  }) => {
    const body = (
      <div
        className={[
          'group rounded-xl flex items-center h-[44px] transition-all duration-160',
          collapsed ? 'justify-center' : 'px-3',
          disabled ? 'opacity-55 cursor-not-allowed' : 'hover:-translate-y-[1px]',
        ].join(' ')}
        style={{
          border: `1px solid ${active ? 'rgba(0,255,194,0.28)' : 'var(--sidebar-border)'} `,
          background: active ? 'rgba(0,255,194,0.06)' : 'var(--card)',
          boxShadow: active ? '0 0 0 1px rgba(0,255,194,.05), 0 8px 20px rgba(0,0,0,.18) inset' : 'var(--shadow-card)',
          color: 'var(--sidebar-text)',
        }}
        title={collapsed ? label : undefined}
      >
        <div className={collapsed ? 'mx-auto' : 'mr-3'}>
          <IconChip>{icon}</IconChip>
        </div>

        {/* label/sub hidden when collapsed */}
        <div
          className={[
            'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
            collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0',
          ].join(' ')}
        >
          <div className="leading-tight">
            <div className="text-[13px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>{label}</div>
            {sub && (
              <div className="text-[11px] mt-[3px]" style={{ color: 'var(--sidebar-muted)' }}>
                {sub}
              </div>
            )}
          </div>
        </div>
      </div>
    );
    return disabled ? <div>{body}</div> : <Link href={href} className="block">{body}</Link>;
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 transition-[width] duration-300 ease-out"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        borderRight: `1px solid var(--sidebar-border)`,
        boxShadow: collapsed ? 'none' : '0 12px 36px rgba(0,0,0,.18), inset 0 0 0 1px rgba(0,0,0,.04)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="grid place-items-center rounded-xl shrink-0"
              style={{
                width: 34, height: 34, background: 'var(--brand)',
                boxShadow: '0 0 12px rgba(0,255,194,.35)',
              }}
            >
              <Bot className="w-[18px] h-[18px]" color="#0b0c10" />
            </div>
            <div
              className={[
                'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
                collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0',
              ].join(' ')}
            >
              <div className="leading-tight">
                <div className="text-[16px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>
                  reduc<span style={{ color: 'var(--brand)' }}>ai.io</span>
                </div>
                <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Builder Workspace</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-3">
          {/* Workspace */}
          <div
            className={[
              'overflow-hidden transition-[max-height,opacity] duration-300',
              collapsed ? 'max-h-[18px]' : 'max-h-[48px]',
            ].join(' ')}
          >
            <div className="text-[10px] tracking-[.18em] mb-2" style={{ color: 'var(--sidebar-muted)' }}>
              WORKSPACE
            </div>
          </div>
          <nav className="space-y-3.5">
            {workspace.map((i) => (
              <NavRow
                key={i.href}
                href={i.href}
                label={i.label}
                sub={i.sub}
                icon={i.icon}
                active={i.activeTest(pathname)}
                disabled={i.disabled}
              />
            ))}
          </nav>

          {/* Divider */}
          <div className="my-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }} />

          {/* Resources */}
          <div
            className={[
              'overflow-hidden transition-[max-height,opacity] duration-300',
              collapsed ? 'max-h-[18px]' : 'max-h-[48px]',
            ].join(' ')}
          >
            <div className="text-[10px] tracking-[.18em] mb-2" style={{ color: 'var(--sidebar-muted)' }}>
              RESOURCES
            </div>
          </div>
          <nav className="space-y-3.5">
            {resources.map((i) => (
              <NavRow
                key={i.href}
                href={i.href}
                label={i.label}
                sub={i.sub}
                icon={i.icon}
                active={i.activeTest(pathname)}
                disabled={i.disabled}
              />
            ))}
          </nav>
        </div>

        {/* Account chip */}
        <div className="px-4 pb-5">
          <button
            onClick={() => setAcctOpen((v) => !v)}
            aria-expanded={acctOpen}
            aria-haspopup="true"
            className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left transition-colors duration-150"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
              color: 'var(--sidebar-text)',
            }}
          >
            <div
              className="grid place-items-center rounded-full"
              style={{
                width: 30, height: 30,
                background: accentFor(userEmail || 'x'),
                boxShadow: '0 0 8px rgba(0,0,0,.18)',
              }}
            >
              <UserIcon className="w-[16px] h-[16px]" color="#0b0c10" />
            </div>

            <div
              className={[
                'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
                collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0',
              ].join(' ')}
            >
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold truncate">{userLoading ? 'Loading…' : getDisplayName(userName, userEmail)}</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
                  {userLoading ? ' ' : (userEmail || 'Signed in')}
                </div>
              </div>
            </div>

            {!collapsed && <span className="ml-auto text-xs" style={{ color: 'var(--sidebar-muted)' }}>{acctOpen ? '▲' : '▼'}</span>}
          </button>

          {/* Desktop dropdown */}
          <AnimatePresence>
            {!collapsed && acctOpen && (
              <motion.div
                key="acct-dd"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="relative hidden md:block"
              >
                <div
                  className="mt-2 rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:opacity-90">
                    <SettingsIcon className="w-4 h-4" style={{ color: 'var(--text)' }} />
                    <span>Settings</span>
                  </Link>
                  <button onClick={onSignOut} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:opacity-90">
                    <LogOut className="w-4 h-4" style={{ color: 'var(--text)' }} />
                    <span>Sign out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-150"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--card)',
            boxShadow: 'var(--shadow-card)',
            color: 'var(--sidebar-text)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile account sheet */}
      <AnimatePresence>
        {acctOpen && (
          <motion.div
            key="acct-sheet"
            className="md:hidden fixed inset-0 z-[60] flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAcctOpen(false)}
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              initial={{ y: 32 }}
              animate={{ y: 0 }}
              exit={{ y: 32 }}
              transition={{ duration: 0.18 }}
              className="w-full rounded-t-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--panel)',
                borderTop: '1px solid var(--border)',
                boxShadow: 'var(--shadow-soft)',
                color: 'var(--text)',
              }}
            >
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="font-semibold">{getDisplayName(userName, userEmail)}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{userEmail}</div>
              </div>
              <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-5 py-4 text-left border-b" style={{ borderColor: 'var(--border)' }}>
                <SettingsIcon className="w-4 h-4" />
                <span>Settings</span>
              </Link>
              <button onClick={() => { setAcctOpen(false); onSignOut(); }} className="w-full flex items-center gap-2 px-5 py-4 text-left">
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
