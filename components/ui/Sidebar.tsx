// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Wand2 as CreateIcon,
  SlidersHorizontal as TuneIcon,
  Mic,
  Rocket,
  Phone,
  Key,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Bot,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 256;
const W_COLLAPSED = 68;
const LS_COLLAPSED = 'ui:sidebarCollapsed:v2';

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

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
    try {
      localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed));
    } catch {}
    // avoid a lingering background when collapsed
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
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
    try { await supabase.auth.signOut(); setAcctOpen(false); } catch {}
  };

  type ItemT = { href: string; label: string; sub?: string; Icon: any; active: boolean };
  const workspace: ItemT[] = useMemo(() => ([
    { href: '/builder',      label: 'Create',      sub: 'Design your agent',   Icon: CreateIcon, active: pathname?.startsWith('/builder') || pathname === '/' },
    { href: '/improve',      label: 'Tuning',      sub: 'Integrate & optimize',Icon: TuneIcon,   active: pathname?.startsWith('/improve') },
    { href: '/voice-agent',  label: 'Voice Studio',sub: 'Calls & persona',     Icon: Mic,        active: pathname?.startsWith('/voice-agent') },
    { href: '/launch',       label: 'Launchpad',   sub: 'Go live',             Icon: Rocket,     active: pathname === '/launch' },
  ]), [pathname]);

  const resources: ItemT[] = useMemo(() => ([
    { href: '/phone-numbers', label: 'Numbers', sub: 'Twilio & BYO', Icon: Phone, active: pathname?.startsWith('/phone-numbers') },
    { href: '/apikeys',       label: 'API Keys', sub: 'Models & access', Icon: Key, active: pathname?.startsWith('/apikeys') },
    { href: '/support',       label: 'Help', sub: 'Guides & FAQ', Icon: HelpCircle, active: pathname === '/support' },
  ]), [pathname]);

  const Item = ({ href, label, sub, Icon, active }: ItemT) => {
    const content = (
      <div
        className={cx(
          'sidebar-item group rounded-xl flex items-center h-11 transition-all duration-200',
          collapsed ? 'justify-center' : 'px-3',
          active && 'is-active'
        )}
        title={collapsed ? label : undefined}
      >
        <div className={cx(collapsed ? 'w-9 h-9 mx-auto' : 'w-9 h-9 mr-3', 'shrink-0 rounded-lg grid place-items-center icon-chip')}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {/* label/sub hide when collapsed */}
        <div className={cx(
          'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
          collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0'
        )}>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold sidebar-text">{label}</div>
            {sub && <div className="text-[11px] mt-[3px] sidebar-muted">{sub}</div>}
          </div>
        </div>
      </div>
    );
    return <Link href={href} className="block">{content}</Link>;
  };

  return (
    <aside
      className={cx(
        'sidebar-modern fixed left-0 top-0 h-screen z-50 transition-[width] duration-300 ease-out',
      )}
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
      }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="sidebar-header border-b px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 brand-chip">
            <Bot className="w-5 h-5 brand-chip-icon" />
          </div>
          <div className={cx(
            'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
            collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0'
          )}>
            <div className="leading-tight">
              <div className="text-[17px] font-semibold tracking-wide">
                reduc<span className="brand-accent">ai.io</span>
              </div>
              <div className="text-[11px] sidebar-muted">Builder Workspace</div>
            </div>
          </div>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-4 pb-3">
          {/* Workspace */}
          <div className={cx('section-label', collapsed && 'sr-only')}>WORKSPACE</div>
          <nav className="space-y-2.5 mb-4">
            {workspace.map((it) => <Item key={it.href} {...it} />)}
          </nav>

          {/* Divider */}
          <div className="divider" />

          {/* Resources */}
          <div className={cx('section-label mt-4', collapsed && 'sr-only')}>RESOURCES</div>
          <nav className="space-y-2.5">
            {resources.map((it) => <Item key={it.href} {...it} />)}
          </nav>
        </div>

        {/* Account chip */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setAcctOpen((v) => !v)}
            aria-expanded={acctOpen}
            aria-haspopup="true"
            className="acct-chip w-full rounded-2xl px-3 py-3.5 flex items-center gap-3 text-left transition-colors duration-200"
          >
            <div className="w-8 h-8 rounded-full grid place-items-center avatar">
              <UserIcon className="w-4 h-4 avatar-icon" />
            </div>
            <div className={cx(
              'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
              collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0'
            )}>
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold sidebar-text truncate">
                  {userLoading ? 'Account' : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] sidebar-muted truncate">
                  {userLoading ? 'Loading…' : (userEmail || 'Signed in')}
                </div>
              </div>
            </div>
            {!collapsed && <span className="ml-auto sidebar-muted text-xs">{acctOpen ? '▲' : '▼'}</span>}
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
                <div className="acct-menu mt-2 rounded-xl overflow-hidden">
                  <Link href="/account" onClick={() => setAcctOpen(false)} className="acct-row">
                    <SettingsIcon className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                  <button onClick={onSignOut} className="acct-row">
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
          className="collapse-handle absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
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
              className="w-full rounded-t-2xl overflow-hidden acct-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b sidebar-border">
                <div className="font-semibold sidebar-text">{getDisplayName(userName, userEmail)}</div>
                <div className="sidebar-muted text-sm">{userEmail}</div>
              </div>
              <Link href="/account" onClick={() => setAcctOpen(false)} className="acct-row border-b sidebar-border">
                <SettingsIcon className="w-4 h-4" />
                <span>Settings</span>
              </Link>
              <button onClick={() => { setAcctOpen(false); onSignOut(); }} className="acct-row">
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoped styles (uses your CSS tokens) */}
      <style jsx global>{`
        /* Base rail uses your sidebar tokens so light mode stays 1:1 with globals.css */
        .sidebar-modern{
          background: var(--sidebar-bg);
          color: var(--sidebar-text);
          border-right: 1px solid var(--sidebar-border);
          box-shadow: none;
        }
        /* When collapsed, remove big panel feel */
        .sidebar-modern{
          overflow: hidden;
        }
        .sidebar-modern .sidebar-header{
          border-color: var(--sidebar-border);
        }
        .sidebar-modern .brand-accent{ color: var(--brand); }
        .sidebar-modern .sidebar-text{ color: var(--sidebar-text); }
        .sidebar-modern .sidebar-muted{ color: var(--sidebar-muted); }

        .sidebar-modern .brand-chip{
          background: var(--brand);
          box-shadow: 0 0 10px rgba(0,255,194,.35);
        }
        .sidebar-modern .brand-chip-icon{ color:#000; }

        .sidebar-modern .icon-chip{
          background: var(--card);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-card);
          color: var(--text);
        }
        .sidebar-modern .sidebar-item{
          background: var(--card);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-card);
          transition: transform var(--dur-quick) var(--ease), box-shadow var(--dur-quick) var(--ease), border-color var(--dur-quick) var(--ease);
        }
        .sidebar-modern .sidebar-item:hover{
          transform: translateX(1px);
        }
        .sidebar-modern .sidebar-item.is-active{
          border-color: var(--brand-weak);
          box-shadow: 0 10px 26px rgba(0,0,0,.18), 0 0 0 1px rgba(0,255,194,.10) inset;
        }

        .sidebar-modern .divider{
          height:1px; margin:10px 0; background: var(--sidebar-border);
        }
        .sidebar-modern .section-label{
          font-size:10px; letter-spacing:.14em; font-weight:700; color: var(--sidebar-muted);
          margin: 0 6px 8px;
        }

        .sidebar-modern .acct-chip{
          background: var(--card);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-card);
        }
        .sidebar-modern .avatar{
          background: var(--brand);
        }
        .sidebar-modern .avatar-icon{ color:#000; }

        .sidebar-modern .acct-menu{
          background: var(--panel);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-soft);
        }
        .sidebar-modern .acct-row{
          display:flex; align-items:center; gap:.5rem; padding:.75rem 1rem; width:100%;
          color: var(--text);
        }
        .sidebar-modern .acct-row:hover{
          background: color-mix(in oklab, var(--card) 90%, var(--brand) 10%);
        }

        .sidebar-modern .collapse-handle{
          border: 1px solid var(--border);
          background: var(--card);
          box-shadow: var(--shadow-card);
          color: var(--text);
        }

        /* Dark-only refinements to match your panel glow/green tint */
        [data-theme="dark"] .sidebar-modern{
          /* slim, glassy rail — no big halo when collapsed */
          background: linear-gradient(180deg, rgba(14,18,20,.96), rgba(12,16,18,.96));
          box-shadow: inset 0 0 14px rgba(0,0,0,.35);
        }
        [data-theme="dark"] .sidebar-modern .sidebar-item{
          background: linear-gradient(180deg, rgba(24,32,31,.86), rgba(16,22,21,.86));
          border-color: rgba(255,255,255,.06);
          box-shadow: 0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
        }
        [data-theme="dark"] .sidebar-modern .sidebar-item.is-active{
          border-color: rgba(0,255,194,.22);
          box-shadow: 0 16px 34px rgba(0,0,0,.55), 0 0 0 1px rgba(0,255,194,.10) inset, 0 0 20px rgba(0,255,194,.06);
        }
        [data-theme="dark"] .sidebar-modern .icon-chip{
          background: rgba(18,22,23,.92);
          border-color: rgba(255,255,255,.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 6px 14px rgba(0,0,0,.35);
          color: rgba(255,255,255,.9);
        }
        [data-theme="dark"] .sidebar-modern .acct-chip{
          background: linear-gradient(180deg, rgba(22,27,28,.9), rgba(16,20,21,.9));
          border-color: rgba(255,255,255,.08);
        }
        [data-theme="dark"] .sidebar-modern .acct-menu{
          background: rgba(13,15,17,.97);
          border-color: rgba(255,255,255,.10);
          box-shadow: 0 12px 24px rgba(0,0,0,.45);
        }
        [data-theme="dark"] .sidebar-modern .collapse-handle{
          background: rgba(16,19,21,.95);
          border-color: rgba(255,255,255,.10);
          box-shadow: 0 2px 12px rgba(0,0,0,.45), 0 0 10px rgba(0,255,194,.06);
          color: rgba(255,255,255,.8);
        }
      `}</style>
    </aside>
  );
}
