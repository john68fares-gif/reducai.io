'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home, Hammer, Mic, Rocket,
  Phone, Key, HelpCircle,
  ChevronLeft, ChevronRight,
  Settings as SettingsIcon, LogOut, User as UserIcon, Bot
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

const W_EXPANDED = 260;
const W_COLLAPSED = 68;
const LS_COLLAPSED = 'ui:sidebarCollapsed';
const BRAND = '#10b981';          // button fill
const BRAND_DEEP = '#12a989';     // dark emerald for icons
const BRAND_WEAK = 'rgba(16,185,129,.25)';

type NavItem = {
  id: string; group: 'workspace'|'resources';
  href: string; label: string; sub?: string; icon: JSX.Element;
};

const NAV: NavItem[] = [
  { id:'create', group:'workspace', href:'/builder',     label:'Create',      sub:'Design your agent',    icon:<Home/> },
  { id:'tuning', group:'workspace', href:'/improve',     label:'Tuning',      sub:'Integrate & optimize', icon:<Hammer/> },
  { id:'voice',  group:'workspace', href:'/voice-agent', label:'Voice Studio',sub:'Calls & persona',      icon:<Mic/> },
  { id:'launch', group:'workspace', href:'/launch',      label:'Launchpad',   sub:'Go live',              icon:<Rocket/> },

  { id:'numbers',group:'resources', href:'/phone-numbers', label:'Numbers',  sub:'Twilio & BYO', icon:<Phone/> },
  { id:'keys',   group:'resources', href:'/apikeys',       label:'API Keys',  sub:'Models & access', icon:<Key/> },
  { id:'help',   group:'resources', href:'/support',       label:'Help',      sub:'Guides & FAQ', icon:<HelpCircle/> },
];

const isWorkspace = (id:string) =>
  NAV.find(n=>n.id===id)?.group==='workspace';

const displayName = (name?:string|null, email?:string|null) =>
  name?.trim() || (email?.includes('@') ? email.split('@')[0] : 'Account');

export default function Sidebar(){
  const pathname = usePathname();

  /* collapse state (persist) */
  const [collapsed,setCollapsed] = useState<boolean>(() => {
    try{ return JSON.parse(localStorage.getItem(LS_COLLAPSED)||'false'); } catch { return false; }
  });
  useEffect(() => {
    try{ localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed)); }catch{}
    document.documentElement.style.setProperty('--sidebar-w', `${collapsed ? W_COLLAPSED : W_EXPANDED}px`);
  }, [collapsed]);

  /* user state */
  const [email,setEmail] = useState<string|null>(null);
  const [name,setName]   = useState<string|null>(null);
  const [userLoading,setUserLoading]=useState(true);
  const [acctOpen,setAcctOpen]=useState(false);

  useEffect(() => {
    let unsub:any;
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
      setName((user?.user_metadata as any)?.full_name ?? user?.user_metadata?.name ?? null);
      setUserLoading(false);
      unsub = supabase.auth.onAuthStateChange((_e, session) => {
        const u = session?.user;
        setEmail(u?.email ?? null);
        setName((u?.user_metadata as any)?.full_name ?? u?.user_metadata?.name ?? null);
        setUserLoading(false);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);
  useEffect(() => setAcctOpen(false), [pathname]);

  const onSignOut = async () => { try{ await supabase.auth.signOut(); setAcctOpen(false);}catch{} };

  const active = (item:NavItem) => {
    const p = pathname || '';
    return item.href === '/launch' ? p === '/launch' : p.startsWith(item.href);
  };

  const Row = ({item}:{item:NavItem}) => {
    const a = active(item);
    const green = isWorkspace(item.id);
    return (
      <Link href={item.href} className="block">
        <div className="sb-row">
          <div
            className="flex items-center h-10 rounded-[12px] pr-2 transition-all"
            style={{ paddingLeft: collapsed?0:10, gap: collapsed?0:10 }}
          >
            {/* single icon tile */}
            <div
              className="w-10 h-10 rounded-[12px] grid place-items-center transition-shadow"
              style={{
                background:'var(--sb-icon-bg)',
                border:'1px solid var(--sb-icon-border)',
                color: green ? BRAND_DEEP : 'var(--sidebar-text)',
                boxShadow: a
                  ? `0 0 0 1px ${BRAND_WEAK}, 0 10px 22px rgba(0,0,0,.22), 0 0 18px ${BRAND_WEAK}`
                  : 'inset 0 0 8px rgba(0,0,0,.12)',
              }}
              title={collapsed?item.label:undefined}
            >
              <span className="w-5 h-5">{item.icon}</span>
            </div>

            {/* label/sub */}
            <div
              className="overflow-hidden transition-[max-width,opacity,transform] duration-300"
              style={{
                maxWidth: collapsed?0:200,
                opacity: collapsed?0:1,
                transform: collapsed?'translateX(-6px)':'translateX(0)',
                lineHeight:1.1
              }}
            >
              <div className="text-[13px] font-semibold" style={{ color:'var(--sidebar-text)' }}>
                {item.label}
              </div>
              {item.sub && (
                <div className="text-[11px] mt-[3px]" style={{ color:'var(--sidebar-muted)' }}>
                  {item.sub}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50"
      style={{
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        transition: 'width 260ms var(--ease)',
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        borderRight: '1px solid var(--sidebar-border)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28)',
      }}
    >
      <div className="relative h-full flex flex-col pb-3">
        {/* header/logo */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: BRAND, boxShadow:'0 0 10px rgba(0,255,194,.35)' }}>
              <Bot className="w-5 h-5 text-black"/>
            </div>
            <div
              className="overflow-hidden transition-[max-width,opacity,transform] duration-300"
              style={{ maxWidth: collapsed?0:200, opacity: collapsed?0:1, transform: collapsed?'translateX(-6px)':'translateX(0)' }}
            >
              <div className="text-[17px] font-semibold" style={{ color:'var(--sidebar-text)' }}>
                reduc<span style={{ color: BRAND }}>ai.io</span>
              </div>
              <div className="text-[11px]" style={{ color:'var(--sidebar-muted)' }}>Builder Workspace</div>
            </div>
          </div>
        </div>

        {/* workspace */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3">
          {!collapsed && (
            <div className="text-[10px] font-semibold tracking-[.14em] mb-2" style={{ color:'var(--sidebar-muted)' }}>
              WORKSPACE
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n=>n.group==='workspace').map(n=> <Row key={n.id} item={n}/>)}
          </nav>

          <div style={{ height:14 }} />

          {!collapsed && (
            <div className="text-[10px] font-semibold tracking-[.14em] mb-2" style={{ color:'var(--sidebar-muted)' }}>
              RESOURCES
            </div>
          )}
          <nav className="space-y-[6px]">
            {NAV.filter(n=>n.group==='resources').map(n=> <Row key={n.id} item={n}/>)}
          </nav>
        </div>

        {/* account – sticky to bottom, never clipped */}
        <div className="px-3 pt-2">
          {!collapsed ? (
            <button
              onClick={()=>setAcctOpen(v=>!v)}
              className="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left"
              style={{
                background:'var(--acct-bg)', border:'1px solid var(--acct-border)',
                boxShadow:'inset 0 0 10px rgba(0,0,0,.12)', color:'var(--sidebar-text)'
              }}
            >
              <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: BRAND }}>
                <UserIcon className="w-4 h-4 text-black/80"/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {userLoading ? 'Loading…' : displayName(name,email)}
                </div>
                <div className="text-[11px] truncate" style={{ color:'var(--sidebar-muted)' }}>
                  {email || ''}
                </div>
              </div>
              <span className="text-xs" style={{ color:'var(--sidebar-muted)' }}>{acctOpen ? '▲':'▼'}</span>
            </button>
          ) : (
            <button
              onClick={()=>setAcctOpen(v=>!v)}
              className="w-10 h-10 rounded-2xl grid place-items-center"
              style={{
                background:'var(--sb-icon-bg)', border:'1px solid var(--sb-icon-border)',
                color:'var(--sidebar-text)'
              }}
              aria-label="Account"
            >
              <UserIcon className="w-5 h-5"/>
            </button>
          )}

          <AnimatePresence>
            {!collapsed && acctOpen && (
              <motion.div
                initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                transition={{ duration:.16 }}
              >
                <div className="mt-2 rounded-xl overflow-hidden"
                  style={{ background:'var(--acct-menu-bg)', border:'1px solid var(--acct-border)', boxShadow:'0 12px 24px rgba(0,0,0,.25)' }}>
                  <Link href="/account" onClick={()=>setAcctOpen(false)} className="flex items-center gap-2 px-4 py-3 hover:opacity-90">
                    <SettingsIcon className="w-4 h-4" /><span>Settings</span>
                  </Link>
                  <button onClick={()=>{setAcctOpen(false); onSignOut();}} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:opacity-90">
                    <LogOut className="w-4 h-4" /><span>Sign out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* collapse handle */}
        <button
          onClick={()=>setCollapsed(c=>!c)}
          className="absolute top-1/2 -right-3 translate-y-[-50%] rounded-full p-1.5"
          style={{
            border:'1px solid var(--sidebar-border)',
            background:'var(--sb-icon-bg)',
            boxShadow:'0 2px 12px rgba(0,0,0,.25), 0 0 10px rgba(16,185,129,.06)'
          }}
          aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4"/> : <ChevronLeft className="w-4 h-4"/>}
        </button>
      </div>
    </aside>
  );
}
