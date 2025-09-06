// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
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
  Settings as SettingsIcon,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 260;
const W_COLLAPSED = 72;
const LS_COLLAPSED = 'ui:sidebarCollapsed';

/* Accent generator for the account avatar */
const palette = ['#6af7d1', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (seed: string) =>
  palette[Math.abs([...seed].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

function getDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim()) return name.trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Account';
}

export default function Sidebar() {
  const pathname = usePathname();

  // collapse (persist)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      return raw ? JSON.parse(raw) : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  // user
  const [userLoading, setUserLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);

  useEffect(() => {
    let sub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserLoading(false);
      sub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
        setUserLoading(false);
      });
    })();
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);
  useEffect(() => setAcctOpen(false), [pathname]);

  const onSignOut = async () => {
    try { await supabase.auth.signOut(); setAcctOpen(false); } catch {}
  };

  const Item = ({
    href,
    label,
    sub,
    icon,
    active,
    disabled,
  }: {
    href: string;
    label: string;
    sub?: string;
    icon: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
  }) => {
    const body = (
      <div
        className={[
          'group rounded-xl flex items-center h-12 transition-all duration-200',
          collapsed ? 'justify-center' : 'px-3',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:translate-x-[1px]',
        ].join(' ')}
        /* Light + dark via CSS vars from globals.css */
        style={{
          border: `1px solid ${active ? 'var(--brand-weak)' : 'var(--sidebar-border)'}`,
          background: active
            ? 'linear-gradient(180deg, rgba(0,255,194,.08), rgba(0,0,0,0))'
            : 'var(--card)',
          color: 'var(--sidebar-text)',
          boxShadow: active
            ? '0 0 0 1px rgba(0,255,194,.10), 0 8px 18px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.06)'
            : 'var(--shadow-card)',
        }}
        title={collapsed ? label : undefined}
      >
        {/* Icon pill */}
        <div className={collapsed ? 'w-8 h-8 mx-auto flex items-center justify-center' : 'w-8 h-8 mr-3 flex items-center justify-center'}>
          <div
            className="w-8 h-8 rounded-xl grid place-items-center"
            style={{
              background:
                active
                  ? 'linear-gradient(180deg, rgba(0,255,194,.20), rgba(0,255,194,.10))'
                  : 'linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,0))',
              border: '1px solid var(--sidebar-border)',
              boxShadow: active
                ? '0 0 0 1px rgba(0,255,194,.10), 0 6px 16px rgba(0,0,0,.22)'
                : 'inset 0 0 12px rgba(0,0,0,.08)',
            }}
          >
            {/* Icons inherit text color via CSS var */}
            <div className="w-5 h-5" style={{ color: active ? 'var(--brand)' : 'var(--sidebar-text)' }}>
              {icon}
            </div>
          </div>
        </div>

        {/* label/sub (hide when collapsed) */}
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
      className="fixed left-0 top-0 h-screen z-50 font-movatif transition-[width] duration-300 ease-out"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        borderRight: '1px solid var(--sidebar-border)',
        boxShadow: '0 10px 28px rgba(0,0,0,.08), inset 0 0 18px rgba(0,0,0,.04)',
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="border-b px-4 py-5 flex items-center gap-3" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--brand)', boxShadow: '0 0 12px rgba(0,255,194,.35)' }}
          >
            <Bot className="w-5 h-5 text-black" />
          </div>
          <div
            className={[
              'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
              collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0',
            ].join(' ')}
          >
            <div className="leading-tight">
              <div className="text-[17px] font-semibold tracking-wide" style={{ color: 'var(--sidebar-text)' }}>
                reduc<span style={{ color: 'var(--brand)' }}>ai.io</span>
              </div>
              <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Builder Workspace</div>
            </div>
          </div>
        </div>

        {/* Scrollable nav area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-3">
          <nav className="space-y-2.5">
            {/* Workspace (renamed a bit for your brand identity) */}
            <Item href="/builder"      label="Create"        sub="Design your agent"     icon={<Home />}   active={pathname?.startsWith('/builder')} />
            <Item href="/improve"      label="Tuning"        sub="Integrate & optimize"  icon={<Hammer />} active={pathname?.startsWith('/improve')} />
            <Item href="/voice-agent"  label="Voice Studio"  sub="Calls & persona"       icon={<Mic />}    active={pathname?.startsWith('/voice-agent')} />
            <Item href="/launch"       label="Launchpad"     sub="Go live"               icon={<Rocket />} active={pathname === '/launch'} />

            {/* Divider */}
            <div className="my-3" style={{ borderTop: '1px solid var(--sidebar-border)' }} />

            {/* Resources */}
            <Item href="/phone-numbers" label="Numbers"   sub="Twilio & BYO"           icon={<Phone />} active={pathname?.startsWith('/phone-numbers')} />
            <Item href="/apikeys"       label="API Keys"  sub="Models & access"        icon={<Key />}   active={pathname?.startsWith('/apikeys')} />
            <Item href="/support"       label="Help"      sub="Guides & FAQ"           icon={<HelpCircle />} active={pathname === '/support'} />
          </nav>
        </div>

        {/* Account chip */}
        <div className="px-4 pb-5">
          <button
            onClick={() => setAcctOpen((v) => !v)}
            aria-expanded={acctOpen}
            aria-haspopup="true"
            className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-colors duration-200 hover:brightness-[1.02]"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--sidebar-border)',
              boxShadow: 'var(--shadow-card)',
              color: 'var(--sidebar-text)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: accentFor(userEmail || 'x'), boxShadow: '0 0 8px rgba(0,0,0,0.15)' }}
            >
              <UserIcon className="w-4 h-4 text-black/80" />
            </div>

            <div
              className={[
                'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
                collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0',
              ].join(' ')}
            >
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
                  {userLoading ? <span className="inline-block h-4 w-28 rounded bg-black/5 dark:bg-white/10 animate-pulse" /> : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
                  {userLoading ? <span className="inline-block h-3 w-40 rounded bg-black/3 dark:bg-white/5 animate-pulse" /> : (userEmail || 'Signed in')}
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
                  style={{ background: 'var(--panel)', border: '1px solid var(--sidebar-border)', boxShadow: 'var(--shadow-soft)' }}
                >
                  <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-black/3 dark:hover:bg-white/5">
                    <SettingsIcon className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                  <button onClick={onSignOut} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-black/3 dark:hover:bg-white/5">
                    <LogOut className="w-4 h-4" />
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
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid var(--sidebar-border)',
            background: 'var(--card)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12), var(--shadow-card)',
            color: 'var(--sidebar-text)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
              style={{ background: 'var(--panel)', borderTop: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <div className="font-semibold">{getDisplayName(userName, userEmail)}</div>
                <div className="text-sm" style={{ color: 'var(--sidebar-muted)' }}>{userEmail}</div>
              </div>
              <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-5 py-4 text-left" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
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
