// components/ui/Sidebar.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home, Hammer, Mic, Rocket, Phone, Key, HelpCircle, Bot,
  ChevronLeft, ChevronRight, LogIn, LogOut, User as UserIcon,
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

const ui = {
  bg: 'linear-gradient(180deg, rgba(10,12,13,0.98), rgba(9,11,12,0.98))',
  cardBg: 'rgba(15,18,20,0.55)',
  borderIdle: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,255,194,0.28)',
  glowActive: '0 0 12px rgba(0,255,194,0.16) inset, 0 0 8px rgba(0,255,194,0.04)',
  cardShadow: 'inset 0 0 10px rgba(0,0,0,0.28)',
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // SSR/hydration guard the same way you had
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
  const widthPx = collapsed ? W_COLLAPSED : W_EXPANDED;

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

  // Update CSS var for your layout push
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  // Minimal auth context for the account panel
  const [loadingUser, setLoadingUser] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserEmail(user?.email ?? null);
        setUserName((user?.user_metadata?.name as string) || null);
      } finally {
        setLoadingUser(false);
      }
    })();
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUserEmail(u?.email ?? null);
      setUserName((u?.user_metadata?.name as string) || null);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const avatarText = useMemo(() => {
    if (userName) {
      const parts = userName.trim().split(/\s+/).slice(0, 2);
      return parts.map(s => s[0]?.toUpperCase() ?? '').join('') || 'U';
    }
    if (userEmail) return (userEmail[0] || 'U').toUpperCase();
    return 'U';
  }, [userName, userEmail]);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      router.replace('/auth?mode=signin');
    } catch {}
  }

  // Tiny route loader: shows for a short time when clicking nav
  const [navigating, setNavigating] = useState(false);
  useEffect(() => {
    // whenever pathname changes, stop the loader
    if (navigating) {
      // small grace to allow page to settle (feels smoother)
      const t = setTimeout(() => setNavigating(false), 300);
      return () => clearTimeout(t);
    }
  }, [pathname, navigating]);

  if (!allowed) return null;

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 text-white font-movatif transition-[width] duration-700 ease-in-out"
      style={{
        width: widthPx,
        background: ui.bg,
        borderRight: '1px solid rgba(0,255,194,0.08)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
    >
      {/* Top progress bar */}
      <AnimatePresence>
        {navigating && (
          <motion.div
            key="routebar"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            style={{ transformOrigin: '0% 50%', height: 2, background: '#00ffc2' }}
          />
        )}
      </AnimatePresence>

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div
          className="border-b px-4 py-5 flex items-center gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#00ffc2', boxShadow: '0 0 10px rgba(0,255,194,0.35)' }}
            whileHover={{ rotate: 6, scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <Bot className="w-5 h-5 text-black" />
          </motion.div>
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
        <Section>
          <NavList>
            <NavItem
              collapsed={collapsed}
              href="/builder"
              label="Build"
              sub="Create AI agent"
              icon={<Home />}
              active={pathname?.startsWith('/builder')}
              onNavigate={() => setNavigating(true)}
            />
            <NavItem
              collapsed={collapsed}
              href="/improve"
              label="Improve"
              sub="Integrate & optimize"
              icon={<Hammer />}
              active={pathname?.startsWith('/improve')}
              onNavigate={() => setNavigating(true)}
            />
            <NavItem
              collapsed={collapsed}
              href="/voice-agent"
              label="Voice Agent"
              sub="Calls & persona"
              icon={<Mic />}
              active={pathname?.startsWith('/voice-agent')}
              onNavigate={() => setNavigating(true)}
            />
            <NavItem
              collapsed={collapsed}
              href="/launch"
              label="Launch"
              sub="Deploy to production"
              icon={<Rocket />}
              active={pathname === '/launch'}
              onNavigate={() => setNavigating(true)}
            />
          </NavList>
        </Section>

        <div className="my-3 border-t border-white/10" />

        {/* Resources (Numbers, API Key, Support) */}
        <Section>
          <NavList>
            <NavItem
              collapsed={collapsed}
              href="/phone-numbers"
              label="Phone Numbers"
              sub="Bring your provider"
              icon={<Phone />}
              active={pathname?.startsWith('/phone-numbers')}
              onNavigate={() => setNavigating(true)}
            />
            <NavItem
              collapsed={collapsed}
              href="/apikeys"
              label="API Key"
              icon={<Key />}
              active={pathname === '/apikeys'}
              onNavigate={() => setNavigating(true)}
            />
            <NavItem
              collapsed={collapsed}
              href="/support"
              label="Support"
              sub="Help & FAQ"
              icon={<HelpCircle />}
              active={pathname === '/support'}
              onNavigate={() => setNavigating(true)}
            />
          </NavList>
        </Section>

        {/* Account */}
        <div className="mt-auto px-4 pb-5">
          <div
            className="rounded-2xl px-4 py-3"
            style={{
              background: 'rgba(15,18,20,0.85)',
              border: '1px solid rgba(0,255,194,0.12)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35), 0 0 10px rgba(0,255,194,0.04)',
            }}
          >
            {/* identity line */}
            <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
              <motion.div
                whileHover={{ scale: 1.04 }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,194,0.16), rgba(0,0,0,0.35))',
                  border: '1px solid rgba(0,255,194,0.25)',
                }}
              >
                {loadingUser ? '…' : (userEmail ? avatarText : <UserIcon className="w-4 h-4 text-white/80" />)}
              </motion.div>
              {!collapsed && (
                <div className="leading-tight min-w-0">
                  <div className="text-sm font-semibold truncate max-w-[140px]">
                    {loadingUser ? 'Loading…' : (userName || userEmail || 'Guest')}
                  </div>
                  <div className="text-[11px] text-white/60 truncate max-w-[160px]">
                    {loadingUser ? '' : (userEmail ? userEmail : 'Not signed in')}
                  </div>
                </div>
              )}
            </div>

            {/* actions */}
            {!collapsed && (
              <div className="mt-3 flex gap-2">
                {userEmail ? (
                  <>
                    <Link
                      href="/account"
                      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border hover:bg-white/[0.06] transition"
                      style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                      onClick={() => setNavigating(true)}
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                      Manage account
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border hover:bg-white/[0.06] transition"
                      style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth?mode=signin"
                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border hover:bg-white/[0.06] transition"
                    style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                    onClick={() => setNavigating(true)}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(16,19,21,0.95)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.45), 0 0 10px rgba(0,255,194,0.06)',
          }}
          aria-label="Toggle sidebar"
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

/* ---------- helpers ---------- */

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

function NavItem({
  href, label, sub, icon, active, collapsed, onNavigate,
}: {
  href: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  active?: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        onNavigate?.();
        router.push(href);
      }}
      className={cn(
        'group w-full rounded-xl flex items-center h-12 transition-all duration-200',
        collapsed ? 'justify-center' : 'px-3',
        'hover:translate-x-[1px]'
      )}
      style={{
        border: `1px solid ${active ? ui.borderActive : ui.borderIdle}`,
        background: active ? 'rgba(0,255,194,0.06)' : ui.cardBg,
        boxShadow: active ? ui.glowActive : ui.cardShadow,
      }}
      title={collapsed ? label : undefined}
    >
      <motion.div
        initial={false}
        whileHover={{ scale: 1.08, rotate: 4 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        className={cn('flex items-center justify-center', collapsed ? 'w-8 h-8 mx-auto' : 'w-8 h-8 mr-3')}
      >
        <div className="w-5 h-5 flex items-center justify-center text-white/90">
          {icon}
        </div>
      </motion.div>

      {!collapsed && (
        <div className="leading-tight text-left">
          <div className="text-[13px] font-semibold text-white/95">{label}</div>
          {sub && <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">{sub}</div>}
        </div>
      )}
    </button>
  );
}

function ChevronRight(props: any) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="m9 18 6-6-6-6"/></svg>;
}
