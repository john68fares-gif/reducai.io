// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Hammer, Mic, Rocket, Phone, Key, HelpCircle, Bot,
  ChevronLeft, ChevronRight as ChevronRightIcon, // alias to avoid duplicate name
  LogIn, LogOut, User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase-client';

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const LS_COLLAPSED = 'ui:sidebarCollapsed';
const W_EXPANDED = 260;
const W_COLLAPSED = 72;

let SIDEBAR_MOUNTED = false;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Prevent double-mount race (same as before)
  const [allowed, setAllowed] = useState<boolean>(() => !SIDEBAR_MOUNTED);
  useEffect(() => {
    if (SIDEBAR_MOUNTED) {
      setAllowed(false);
      return;
    }
    SIDEBAR_MOUNTED = true;
    return () => void (SIDEBAR_MOUNTED = false);
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [lastBotId, setLastBotId] = useState<string | null>(null);

  // Read/write collapsed state
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

  // Last bot id (for Improve)
  useEffect(() => {
    try {
      const bots = JSON.parse(localStorage.getItem('chatbots') || '[]');
      const lastBot = bots[bots.length - 1];
      if (lastBot?.id) setLastBotId(lastBot.id);
    } catch {}
  }, []);

  const widthPx = collapsed ? W_COLLAPSED : W_EXPANDED;
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  // Simple “micro-loading” state for clicks
  const [navLoading, setNavLoading] = useState<string | null>(null);
  const handleNav = (href: string, disabled?: boolean) => (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    setNavLoading(href);
    // push & clear loading soon after mount; we don't hijack logic
    router.push(href);
    setTimeout(() => setNavLoading(null), 700);
  };

  // Auth section (Supabase)
  const [authLoading, setAuthLoading] = useState<'in' | 'out' | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        setUserEmail(session?.user?.email ?? null);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const onSignIn = async () => {
    setAuthLoading('in');
    try {
      // keep your existing auth flow (redirect to /auth)
      router.push('/auth?mode=signin');
    } finally {
      setTimeout(() => setAuthLoading(null), 600);
    }
  };

  const onSignOut = async () => {
    setAuthLoading('out');
    try {
      await supabase.auth.signOut();
      // your middleware will redirect as needed
      router.refresh();
    } finally {
      setTimeout(() => setAuthLoading(null), 600);
    }
  };

  if (!allowed) return null;

  return (
    // NOT fixed; parent wrapper controls stickiness/height
    <aside
      className="h-screen text-white font-movatif transition-[width] duration-700 ease-in-out"
      style={{
        width: widthPx,
        background: 'linear-gradient(180deg, rgba(10,12,13,0.98), rgba(9,11,12,0.98))',
        borderRight: '1px solid rgba(0,255,194,0.08)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.25)',
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
          <AnimatedText collapsed={collapsed}>
            <div className="leading-tight">
              <div className="text-[17px] font-semibold tracking-wide">
                reduc<span style={{ color: '#00ffc2' }}>ai.io</span>
              </div>
              <div className="text-[11px] text-white/55">Builder Workspace</div>
            </div>
          </AnimatedText>
        </div>

        {/* Workspace */}
        <Section>
          <NavList>
            <Item
              collapsed={collapsed}
              href="/builder"
              label="Build"
              sub="Create AI agent"
              icon={<Home />}
              active={pathname?.startsWith('/builder')}
              onClick={handleNav('/builder')}
              loading={navLoading === '/builder'}
            />
            <Item
              collapsed={collapsed}
              href={lastBotId ? `/improve/${lastBotId}` : '#'}
              label="Improve"
              sub="Integrate & optimize"
              icon={<Hammer />}
              active={pathname?.startsWith('/improve')}
              disabled={!lastBotId}
              onClick={handleNav(lastBotId ? `/improve/${lastBotId}` : '#', !lastBotId)}
              loading={navLoading === `/improve/${lastBotId}`}
            />
            <Item
              collapsed={collapsed}
              href="/voice-agent"
              label="Voice Agent"
              sub="Calls & persona"
              icon={<Mic />}
              active={pathname?.startsWith('/voice-agent')}
              onClick={handleNav('/voice-agent')}
              loading={navLoading === '/voice-agent'}
            />
            <Item
              collapsed={collapsed}
              href="/phone-numbers"
              label="Phone Numbers"
              sub="Link provider numbers"
              icon={<Phone />}
              active={pathname?.startsWith('/phone-numbers')}
              onClick={handleNav('/phone-numbers')}
              loading={navLoading === '/phone-numbers'}
            />
            {/* Removed Demo */}
            <Item
              collapsed={collapsed}
              href="/launch"
              label="Launch"
              sub="Deploy to production"
              icon={<Rocket />}
              active={pathname === '/launch'}
              onClick={handleNav('/launch')}
              loading={navLoading === '/launch'}
            />
          </NavList>
        </Section>

        <div className="my-3 border-t border-white/10" />

        {/* Resources (trimmed): keep only API Key & Support */}
        <Section>
          <NavList>
            <Item
              collapsed={collapsed}
              href="/apikeys"
              label="API Key"
              icon={<Key />}
              active={pathname === '/apikeys'}
              onClick={handleNav('/apikeys')}
              loading={navLoading === '/apikeys'}
            />
            <Item
              collapsed={collapsed}
              href="/support"
              label="Support"
              sub="Help & FAQ"
              icon={<HelpCircle />}
              active={pathname === '/support'}
              onClick={handleNav('/support')}
              loading={navLoading === '/support'}
            />
          </NavList>
        </Section>

        {/* Account */}
        <div className="mt-auto px-4 pb-5">
          <div
            className="rounded-2xl flex items-center justify-between px-4 py-3 transition-all duration-700 ease-in-out"
            style={{
              background: 'rgba(15,18,20,0.85)',
              border: '1px solid rgba(0,255,194,0.12)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35), 0 0 10px rgba(0,255,194,0.04)',
            }}
          >
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#08c] flex items-center justify-center shadow-[0_0_8px_rgba(0,136,204,0.30)]">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              <AnimatedText collapsed={collapsed}>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">
                    {userEmail ? userEmail : 'Not signed in'}
                  </div>
                  <div className="text-[11px] text-white/55">
                    {userEmail ? 'Account' : 'Please sign in'}
                  </div>
                </div>
              </AnimatedText>
            </div>

            <div className="ml-3">
              {userEmail ? (
                <button
                  onClick={onSignOut}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-3 py-1.5 hover:bg-white/10 transition text-sm"
                  disabled={authLoading === 'out'}
                  title="Sign out"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {authLoading === 'out' ? (
                      <motion.span
                        key="outspin"
                        className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      />
                    ) : (
                      <LogOut key="outicon" className="w-4 h-4" />
                    )}
                  </AnimatePresence>
                  <AnimatedText collapsed={collapsed}>Sign out</AnimatedText>
                </button>
              ) : (
                <button
                  onClick={onSignIn}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-3 py-1.5 hover:bg-white/10 transition text-sm"
                  disabled={authLoading === 'in'}
                  title="Sign in"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {authLoading === 'in' ? (
                      <motion.span
                        key="inspin"
                        className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      />
                    ) : (
                      <LogIn key="inicon" className="w-4 h-4" />
                    )}
                  </AnimatePresence>
                  <AnimatedText collapsed={collapsed}>Sign in</AnimatedText>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collapse handle (uses alias) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(16,19,21,0.95)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.45), 0 0 10px rgba(0,255,194,0.06)',
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-4 h-4 text-white/80" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white/80" />
          )}
        </button>
      </div>
    </aside>
  );
}

/* ---------- Helpers ---------- */

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4">
      <div className="mb-2.5 h-4" />
      {children}
    </div>
  );
}

function NavList({ children }: { children: React.ReactNode }) {
  return <nav className="space-y-2.5">{children}</nav>;
}

function Item({
  href,
  label,
  sub,
  icon,
  active,
  disabled,
  collapsed,
  onClick,
  loading,
}: {
  href: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  collapsed: boolean;
  onClick?: (e: React.MouseEvent) => void;
  loading?: boolean;
}) {
  const body = (
    <motion.div
      className={cn(
        'group rounded-xl flex items-center h-12 transition-colors duration-200 cursor-pointer',
        collapsed ? 'justify-center' : 'px-3',
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
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled ? { scale: 0.995 } : undefined}
      onClick={onClick}
      title={collapsed ? label : undefined}
    >
      {/* Icon wrapper */}
      <div className={cn('flex items-center justify-center', collapsed ? 'w-8 h-8 mx-auto' : 'w-8 h-8 mr-3')}>
        <AnimatePresence initial={false} mode="popLayout">
          {loading ? (
            <motion.span
              key="spin"
              className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-top-transparent"
              style={{ borderTopColor: 'transparent' as any }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            />
          ) : (
            <motion.div
              key="ico"
              initial={{ opacity: 0.8, y: 1 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -1 }}
              className="w-5 h-5 flex items-center justify-center text-white/90"
            >
              {icon}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Text + Sub */}
      <AnimatedText collapsed={collapsed}>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white/95">{label}</div>
          {sub && (
            <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">
              {sub}
            </div>
          )}
        </div>
      </AnimatedText>
    </motion.div>
  );

  if (disabled) return <div>{body}</div>;
  return (
    <Link href={href} className="block" onClick={onClick}>
      {body}
    </Link>
  );
}

function AnimatedText({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden transition-[max-width,opacity,transform] duration-700 ease-in-out',
        collapsed ? 'opacity-0 max-w-0 -translate-x-2' : 'opacity-100 max-w-[200px] translate-x-0'
      )}
    >
      <div className="transition-opacity duration-700 ease-in-out">{children}</div>
    </div>
  );
}
