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
    try {
      localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed));
    } catch {}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  // user
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);

  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      setUserName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setUserEmail(u?.email ?? null);
        setUserName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
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
          active
            ? 'border border-green-400 bg-green-50 dark:bg-green-900/20'
            : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b0c10]',
        ].join(' ')}
        title={collapsed ? label : undefined}
      >
        <div className={collapsed ? 'w-8 h-8 mx-auto flex items-center justify-center' : 'w-8 h-8 mr-3 flex items-center justify-center'}>
          <div className="w-5 h-5 flex items-center justify-center text-black dark:text-white">
            {icon}
          </div>
        </div>

        {!collapsed && (
          <div className="overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out">
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-black dark:text-white">
                {label}
              </div>
              {sub && (
                <div className="text-[11px] mt-[3px] text-gray-500 dark:text-gray-400">
                  {sub}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
    return disabled ? <div>{body}</div> : <Link href={href} className="block">{body}</Link>;
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 font-movatif transition-[width] duration-300 ease-out bg-white dark:bg-[#0b0c10] text-black dark:text-white border-r border-gray-200 dark:border-gray-700"
      style={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
      aria-label="Primary"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-green-400 shadow">
            <Bot className="w-5 h-5 text-black" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[17px] font-semibold tracking-wide">
                reduc<span className="text-green-400">ai.io</span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Builder Workspace
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-3">
          <nav className="space-y-2.5">
            <Item href="/builder"      label="Build"        sub="Create AI agent"       icon={<Home />}   active={pathname?.startsWith('/builder')} />
            <Item href="/improve"      label="Improve"      sub="Integrate & optimize"  icon={<Hammer />} active={pathname?.startsWith('/improve')} />
            <Item href="/voice-agent"  label="Voice Agent"  sub="Calls & persona"       icon={<Mic />}    active={pathname?.startsWith('/voice-agent')} />
            <Item href="/launch"       label="Launch"       sub="Deploy to production"  icon={<Rocket />} active={pathname === '/launch'} />

            <div className="my-3 border-t border-gray-200 dark:border-gray-700" />

            <Item href="/phone-numbers" label="Phone Numbers" sub="Link provider numbers" icon={<Phone />} active={pathname?.startsWith('/phone-numbers')} />
            <Item href="/apikeys"       label="API Key"                                  icon={<Key />}   active={pathname?.startsWith('/apikeys')} />
            <Item href="/support"       label="Support"        sub="Help & FAQ"          icon={<HelpCircle />} active={pathname === '/support'} />
          </nav>
        </div>

        {/* Account chip */}
        <div className="px-4 pb-5">
          <button
            onClick={() => setAcctOpen((v) => !v)}
            aria-expanded={acctOpen}
            aria-haspopup="true"
            className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b0c10] hover:bg-gray-50 dark:hover:bg-[#1a1d21] transition"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: accentFor(userEmail || 'x') }}
            >
              <UserIcon className="w-4 h-4 text-black/80" />
            </div>
            {!collapsed && (
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold truncate">{getDisplayName(userName, userEmail)}</div>
                <div className="text-[11px] truncate text-gray-500 dark:text-gray-400">
                  {userEmail || 'Signed in'}
                </div>
              </div>
            )}
          </button>

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
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b0c10]">
                  <Link
                    href="/account"
                    onClick={() => setAcctOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#1a1d21]"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                  <button
                    onClick={onSignOut}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#1a1d21]"
                  >
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
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b0c10] shadow"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-black dark:text-white" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-black dark:text-white" />
          )}
        </button>
      </div>
    </aside>
  );
}
