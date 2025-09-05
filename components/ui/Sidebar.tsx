@@ -1,314 +1,92 @@
// components/ui/Sidebar.tsx
'use client';
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Hammer,
  Mic,
  Monitor,
  Rocket,
  Phone,
  Key,
  Package,
  BookOpen,
  HelpCircle,
  ShoppingCart,
  Bot,
  User,
  Mic,
  Phone,
  ChevronLeft,
  ChevronRight,
  Settings as SettingsIcon,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
} from "lucide-react";

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
// tiny class joiner
function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // collapse (persist)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      return raw ? JSON.parse(raw) : false;
    } catch {
      return false;
    }
  });
  // persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed));
    } catch {}
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
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setCollapsed(saved === "true");
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
        ].join(' ')}
        style={{
          border: `1px solid ${active ? 'rgba(0,255,194,0.28)' : 'rgba(255,255,255,0.06)'}`,
          background: active ? 'rgba(0,255,194,0.06)' : 'rgba(15,18,20,0.55)',
          boxShadow: active
            ? '0 0 12px rgba(0,255,194,0.16) inset, 0 0 8px rgba(0,255,194,0.04)'
            : 'inset 0 0 10px rgba(0,0,0,0.28)',
        }}
        title={collapsed ? label : undefined}
      >
        <div className={collapsed ? 'w-8 h-8 mx-auto flex items-center justify-center' : 'w-8 h-8 mr-3 flex items-center justify-center'}>
          <div className="w-5 h-5 flex items-center justify-center text-white/90">{icon}</div>
        </div>
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

        {/* label/sub hide when collapsed */}
        <div
          className={[
            'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
            collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0',
          ].join(' ')}
        >
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white/95">{label}</div>
            {sub && <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">{sub}</div>}
          </div>
        </div>
      </div>
    );
    return disabled ? <div>{body}</div> : <Link href={href} className="block">{body}</Link>;
  };
  const navItems = [
    { href: "/build", label: "Build", icon: Home },
    { href: "/improve", label: "Improve", icon: Hammer },
    { href: "/voice", label: "Voice Agent", icon: Mic },
    { href: "/launch", label: "Launch", icon: Rocket },
    { href: "/phone-numbers", label: "Phone Numbers", icon: Phone },
    { href: "/api-key", label: "API Key", icon: Key },
    { href: "/support", label: "Support", icon: HelpCircle },
  ];

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 text-white font-movatif transition-[width] duration-300 ease-out"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        background: 'linear-gradient(180deg, rgba(10,12,13,0.98), rgba(9,11,12,0.98))',
        borderRight: '1px solid rgba(0,255,194,0.08)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
      aria-label="Primary"
    <div
      className={cn(
        "sidebar flex flex-col h-screen border-r transition-all duration-300",
        collapsed ? "collapsed w-[72px]" : "expanded w-[260px]"
      )}
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="border-b px-4 py-5 flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#00ffc2', boxShadow: '0 0 10px rgba(0,255,194,0.35)' }}>
            <Bot className="w-5 h-5 text-black" />
          </div>
          <div
            className={[
              'overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out',
              collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0',
            ].join(' ')}
          >
            <div className="leading-tight">
              <div className="text-[17px] font-semibold tracking-wide">
                reduc<span style={{ color: '#00ffc2' }}>ai.io</span>
              </div>
              <div className="text-[11px] text-white/55">Builder Workspace</div>
            </div>
          </div>
        </div>

        {/* Scrollable nav area so iPad & small screens behave the same */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-3">
          <nav className="space-y-2.5">
            {/* Workspace */}
            <Item href="/builder"      label="Build"        sub="Create AI agent"       icon={<Home />}   active={pathname?.startsWith('/builder')} />
            <Item href="/improve"      label="Improve"      sub="Integrate & optimize"  icon={<Hammer />} active={pathname?.startsWith('/improve')} />
            <Item href="/voice-agent"  label="Voice Agent"  sub="Calls & persona"       icon={<Mic />}    active={pathname?.startsWith('/voice-agent')} />
            <Item href="/launch"       label="Launch"       sub="Deploy to production"  icon={<Rocket />} active={pathname === '/launch'} />

            {/* Divider */}
            <div className="my-3 border-t border-white/10" />

            {/* Resources */}
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
            className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-colors duration-200 hover:bg-white/5"
            style={{
              background: 'rgba(15,18,20,0.85)',
              border: '1px solid rgba(0,255,194,0.12)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35), 0 0 10px rgba(0,255,194,0.04)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: accentFor(userEmail || 'x'), boxShadow: '0 0 8px rgba(0,0,0,0.25)' }}
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
                <div className="text-sm font-semibold truncate">
                  {userLoading ? <span className="inline-block h-4 w-28 rounded bg-white/10 animate-pulse" /> : getDisplayName(userName, userEmail)}
                </div>
                <div className="text-[11px] text-white/60 truncate">
                  {userLoading ? <span className="inline-block h-3 w-40 rounded bg-white/5 animate-pulse" /> : (userEmail || 'Signed in')}
                </div>
              </div>
            </div>

            {!collapsed && <span className="ml-auto text-white/70 text-xs">{acctOpen ? '▲' : '▼'}</span>}
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
                  className="mt-2 rounded-xl overflow-hidden border border-white/10"
                  style={{ background: 'rgba(13,15,17,0.97)', boxShadow: '0 12px 24px rgba(0,0,0,0.45)' }}
                >
                  <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5">
                    <SettingsIcon className="w-4 h-4 text-white/80" />
                    <span>Settings</span>
                  </Link>
                  <button onClick={onSignOut} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5">
                    <LogOut className="w-4 h-4 text-white/80" />
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
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(16,19,21,0.95)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.45), 0 0 10px rgba(0,255,194,0.06)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4 text-white/80" /> : <ChevronLeft className="w-4 h-4 text-white/80" />}
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
              style={{ background: 'rgba(13,15,17,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)' }}
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-accent-green/40 bg-background text-foreground shadow-md hover:bg-accent-green/10 transition"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Nav items */}
      <nav className="mt-16 flex flex-col gap-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center" : "justify-start",
                active
                  ? "bg-accent-green/10 text-accent-green"
                  : "text-foreground/70 hover:bg-accent-green/5 hover:text-foreground"
              )}
            >
              <div className="px-5 py-4 border-b border-white/10">
                <div className="font-semibold">{getDisplayName(userName, userEmail)}</div>
                <div className="text-white/60 text-sm">{userEmail}</div>
              </div>
              <Link href="/account" onClick={() => setAcctOpen(false)} className="w-full flex items-center gap-2 px-5 py-4 text-left border-b border-white/10">
                <SettingsIcon className="w-4 h-4 text-white/80" />
                <span>Settings</span>
              </Link>
              <button onClick={() => { setAcctOpen(false); onSignOut(); }} className="w-full flex items-center gap-2 px-5 py-4 text-left">
                <LogOut className="w-4 h-4 text-white/80" />
                <span>Sign out</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
              <Icon size={20} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
