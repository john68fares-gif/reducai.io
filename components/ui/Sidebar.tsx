// components/ui/Sidebar.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home, Hammer, Monitor, Rocket, Key,
  HelpCircle, Bot, Mic, Phone, ChevronLeft, ChevronRight,
  LogOut, LogIn, User as UserIcon,
} from 'lucide-react';
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

  // auth-aware account panel (independent per user)
  const [loadingUser, setLoadingUser] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserEmail(user?.email ?? null);
        const name = (user?.user_metadata?.name as string) || null;
        setUserName(name);
      } finally {
        setLoadingUser(false);
      }
    })();

    const sub = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const u = session?.user;
      setUserEmail(u?.email ?? null);
      setUserName((u?.user_metadata?.name as string) || null);
    });

    return () => sub.data.subscription.unsubscribe();
  }, []);

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
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  if (!allowed) return null;

  const isActive = (p: string | ((p: string) => boolean)) =>
    typeof p === 'function' ? p(pathname || '') : (pathname || '').startsWith(p);

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
    } catch {
      // no-op
    }
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 text-white font-movatif transition-[width] duration-700 ease-in-out"
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
            style={{
              background: '#00ffc2',
              boxShadow: '0 0 10px rgba(0,255,194,0.35)',
            }}
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
            <Item collapsed={collapsed} href="/builder" label="Build" sub="Create AI agent" icon={<Home />} active={isActive('/builder')} />
            <Item collapsed={collapsed} href={lastBotId ? `/improve/${lastBotId}` : '#'} label="Improve" sub="Integrate & optimize" icon={<Hammer />} active={isActive('/improve')} disabled={!lastBotId} />
            <Item collapsed={collapsed} href="/voice-agent" label="Voice Agent" sub="Calls & persona" icon={<Mic />} active={isActive('/voice-agent')} />
            <Item collapsed={collapsed} href="/phone-numbers" label="Phone Numbers" sub="Link provider numbers" icon={<Phone />} active={isActive('/phone-numbers')} />
            {/* Demo REMOVED */}
            <Item collapsed={collapsed} href="/launch" label="Launch" sub="Deploy to production" icon={<Rocket />} active={isActive('/launch')} />
          </NavList>
        </Section>

        <div className="my-3 border-t border-white/10" />

        {/* Resources (only API Key + Support) */}
        <Section>
          <NavList>
            <Item collapsed={collapsed} href="/apikeys" label="API Key" icon={<Key />} active={pathname === '/apikeys'} />
            <Item collapsed={collapsed} href="/support" label="Support" sub="Help & FAQ" icon={<HelpCircle />} active={pathname === '/support'} />
          </NavList>
        </Section>

        {/* Account panel (independent per user) */}
        <div className="mt-auto px-4 pb-5">
          <div
            className="rounded-2xl px-4 py-3 transition-all duration-700 ease-in-out"
            style={{
              background: 'rgba(15,18,20,0.85)',
              border: '1px solid rgba(0,255,194,0.12)',
              boxShadow:
                'inset 0 0 12px rgba(0,0,0,0.35), 0 0 10px rgba(0,255,194,0.04)',
            }}
          >
            {loadingUser ? (
              <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
                <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                <AnimatedText collapsed={collapsed}>
                  <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-white/5 rounded mt-1 animate-pulse" />
                </AnimatedText>
              </div>
            ) : userEmail ? (
              <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,255,194,0.16), rgba(0,0,0,0.35))',
                    border: '1px solid rgba(0,255,194,0.25)',
                  }}
                >
                  {avatarText}
                </div>
                <AnimatedText collapsed={collapsed}>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold truncate max-w-[140px]">
                      {userName || userEmail}
                    </div>
                    {userName && (
                      <div className="text-[11px] text-white/60 truncate max-w-[160px]">
                        {userEmail}
                      </div>
                    )}
                  </div>
                </AnimatedText>
              </div>
            ) : (
              <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white/80" />
                </div>
                <AnimatedText collapsed={collapsed}>
                  <div className="text-sm font-semibold">Guest</div>
                  <div className="text-[11px] text-white/60">Not signed in</div>
                </AnimatedText>
              </div>
            )}

            {/* Actions */}
            {!collapsed && (
              <div className="mt-3 flex gap-2">
                {userEmail ? (
                  <>
                    <Link
                      href="/account"
                      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                      Manage account
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth?mode=signin"
                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Collapse handle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5 transition-colors duration-200"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(16,19,21,0.95)',
            boxShadow:
              '0 2px 12px rgba(0,0,0,0.45), 0 0 10px rgba(0,255,194,0.06)',
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
        'group rounded-xl flex items-center h-12 transition-colors duration-200',
        collapsed ? 'justify-center' : 'px-3',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:translate-x-[1px]'
      )}
      style={{
        border: `1px solid ${
          active ? 'rgba(0,255,194,0.28)' : 'rgba(255,255,255,0.06)'
        }`,
        background: active
          ? 'rgba(0,255,194,0.06)'
          : 'rgba(15,18,20,0.55)',
        boxShadow: active
          ? '0 0 12px rgba(0,255,194,0.16) inset, 0 0 8px rgba(0,255,194,0.04)'
          : 'inset 0 0 10px rgba(0,0,0,0.28)',
      }}
      title={collapsed ? label : undefined}
    >
      {/* Icon wrapper */}
      <div
        className={cn(
          'flex items-center justify-center',
          collapsed ? 'w-8 h-8 mx-auto' : 'w-8 h-8 mr-3'
        )}
      >
        <div className="w-5 h-5 flex items-center justify-center text-white/90">
          {icon}
        </div>
      </div>

      {/* Text + Sub */}
      <AnimatedText collapsed={collapsed}>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-white/95">
            {label}
          </div>
          {sub && (
            <div className="text-[11px] text-white/55 mt-[3px] group-hover:text-white/70">
              {sub}
            </div>
          )}
        </div>
      </AnimatedText>
    </div>
  );
  if (disabled) return <div>{body}</div>;
  return (
    <Link href={href} className="block">
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
        collapsed
          ? 'opacity-0 max-w-0 -translate-x-2'
          : 'opacity-100 max-w-[200px] translate-x-0'
      )}
    >
      <div className="transition-opacity duration-700 ease-in-out">
        {children}
      </div>
    </div>
  );
}
