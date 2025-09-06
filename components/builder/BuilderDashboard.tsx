// components/builder/BuilderDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus, Bot as BotIcon, ArrowRight, Trash2, SlidersHorizontal, X, Copy,
  Download as DownloadIcon, FileText, Settings, MessageSquareText, Landmark, ListChecks
} from 'lucide-react';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';

/* ---------- theme tokens (exactly like API Keys section uses) ---------- */
const UI = {
  brand: 'var(--brand)',
  brandWeak: 'var(--brand-weak)',
  bg: 'var(--bg)',
  txt: 'var(--text)',
  mut: 'var(--text-muted)',
  panel: 'var(--panel)',
  card: 'var(--card)',
  border: '1px solid var(--border)',
  ring: 'var(--ring)',
  shadowSoft: 'var(--shadow-soft)',
  shadowCard: 'var(--shadow-card)',
};

const Bot3D = dynamic(() => import('./Bot3D.client'), {
  ssr: false,
  loading: () => <div className="h-full w-full" style={{ background: `linear-gradient(180deg, ${UI.brandWeak}, transparent)` }} />,
});

type Appearance = {
  accent?: string; shellColor?: string; bodyColor?: string; trimColor?: string; faceColor?: string;
  variant?: string; eyes?: string; head?: string; torso?: string; arms?: string; legs?: string;
  antenna?: boolean; withBody?: boolean; idle?: boolean;
};

type Bot = {
  id: string; name: string; industry?: string; language?: string; model?: string;
  description?: string; prompt?: string; createdAt?: string; updatedAt?: string; appearance?: Appearance;
};

const STORAGE_KEYS = ['chatbots','agents','builds'];
const SAVE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');
const sortByNewest = (arr: Bot[]) =>
  arr.slice().sort((a,b) => Date.parse(b.updatedAt||b.createdAt||'0') - Date.parse(a.updatedAt||a.createdAt||'0'));

function loadBots(): Bot[] {
  if (typeof window === 'undefined') return [];
  for (const k of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      const out: Bot[] = arr.map((b: any) => ({
        id: b?.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())),
        name: s(b?.name, 'Untitled Bot'),
        industry: s(b?.industry), language: s(b?.language), model: s(b?.model,'gpt-4o-mini'),
        description: s(b?.description), prompt: s(b?.prompt),
        createdAt: b?.createdAt ?? nowISO(), updatedAt: b?.updatedAt ?? b?.createdAt ?? nowISO(),
        appearance: b?.appearance ?? undefined,
      }));
      return sortByNewest(out);
    } catch {}
  }
  return [];
}
function saveBots(bots: Bot[]) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(bots)); } catch {} }

/* --------------------- splitter (unchanged) --------------------- */
type PromptSectionKey = 'DESCRIPTION'|'AI DESCRIPTION'|'RULES AND GUIDELINES'|'AI RULES'|'QUESTION FLOW'|'COMPANY FAQ';
type SplitSection = { key: PromptSectionKey; title: string; text: string; };
const DISPLAY_TITLES: Record<PromptSectionKey,string> = {
  'DESCRIPTION':'DESCRIPTION','AI DESCRIPTION':'AI Description','RULES AND GUIDELINES':'RULES AND GUIDELINES',
  'AI RULES':'AI Rules','QUESTION FLOW':'QUESTION FLOW','COMPANY FAQ':'COMPANY FAQ',
};
const ICONS: Record<PromptSectionKey, JSX.Element> = {
  'DESCRIPTION': <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }}/>,
  'AI DESCRIPTION': <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }}/>,
  'RULES AND GUIDELINES': <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }}/>,
  'AI RULES': <ListChecks className="w-4 h-4" style={{ color: 'var(--brand)' }}/>,
  'QUESTION FLOW': <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }}/>,
  'COMPANY FAQ': <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }}/>,
};
const HEADING_REGEX=/^(?:\s*(?:[#>*-]|\d+\.)\s*)?(?:\*\*)?\s*(DESCRIPTION|AI\s*DESCRIPTION|RULES\s*(?:AND|&)\s*GUIDELINES|AI\s*RULES|QUESTION\s*FLOW|COMPANY\s*FAQ)\s*(?:\*\*)?\s*:?\s*$/gmi;
function splitStep3IntoSections(step3Raw?: string): SplitSection[]|null {
  if (!step3Raw) return null;
  const matches: Array<{start:number;end:number;label:PromptSectionKey}> = [];
  let m: RegExpExecArray|null; HEADING_REGEX.lastIndex=0;
  while ((m=HEADING_REGEX.exec(step3Raw))!==null){
    const raw = (m[1]||'').toUpperCase().replace(/\s*&\s*/g,' AND ').replace(/\s+/g,' ') as PromptSectionKey;
    const label = raw==='AI  DESCRIPTION' ? ('AI DESCRIPTION' as PromptSectionKey) : raw;
    matches.push({start:m.index,end:HEADING_REGEX.lastIndex,label});
  }
  if(!matches.length) return null;
  const out: SplitSection[] = [];
  for(let i=0;i<matches.length;i++){
    const h=matches[i], next=i+1<matches.length?matches[i+1].start:step3Raw.length;
    out.push({ key:h.label, title:DISPLAY_TITLES[h.label]||h.label, text:step3Raw.slice(h.end,next) });
  }
  return out;
}

/* ----------------------------------- UI ----------------------------------- */
export default function BuilderDashboard(){
  const router=useRouter(); const pathname=usePathname(); const searchParams=useSearchParams();
  const rawStep=searchParams.get('step'); const step=rawStep&&['1','2','3','4'].includes(rawStep)?rawStep:null;

  const [query,setQuery]=useState(''); const [bots,setBots]=useState<Bot[]>([]);
  const [customizingId,setCustomizingId]=useState<string|null>(null); const [viewId,setViewId]=useState<string|null>(null);

  useEffect(()=>{ try{ if(localStorage.getItem('builder:cleanup')==='1'){ ['builder:step1','builder:step2','builder:step3'].forEach(k=>localStorage.removeItem(k)); localStorage.removeItem('builder:cleanup'); } }catch{} },[]);
  useEffect(()=>{ try{ const norm=(k:string)=>{ const raw=localStorage.getItem(k); if(!raw) return; const v=JSON.parse(raw); if(v&&typeof v==='object'){(['name','industry','language'] as const).forEach(key=>{ if(v[key]!==undefined) v[key]=typeof v[key]==='string'?v[key]:'';}); localStorage.setItem(k,JSON.stringify(v));}}; ['builder:step1','builder:step2','builder:step3'].forEach(norm);}catch{} },[]);
  useEffect(()=>{ setBots(loadBots()); const onStorage=(e:StorageEvent)=>{ if(STORAGE_KEYS.includes(e.key||'')) setBots(loadBots());}; if(typeof window!=='undefined'){ window.addEventListener('storage',onStorage); return()=>window.removeEventListener('storage',onStorage);} },[]);
  const filtered=useMemo(()=>{ const q=query.trim().toLowerCase(); if(!q) return bots; return bots.filter(b=>b.name.toLowerCase().includes(q));},[bots,query]);

  const selectedBot=useMemo(()=>bots.find(b=>b.id===customizingId),[bots,customizingId]);
  const viewedBot=useMemo(()=>bots.find(b=>b.id===viewId),[bots,viewId]);

  const setStep=(next:string|null)=>{ const usp=new URLSearchParams(Array.from(searchParams.entries())); if(next) usp.set('step',next); else usp.delete('step'); router.replace(`${pathname}?${usp.toString()}`,{scroll:false});};

  if(step){
    return (
      <div className="min-h-screen w-full font-movatif" style={{ background:UI.bg, color:UI.txt }}>
        <main className="w-full min-h-screen">
          {step==='1'&&<Step1AIType onNext={()=>setStep('2')}/>}
          {step==='2'&&<Step2ModelSettings onBack={()=>setStep('1')} onNext={()=>setStep('3')}/>}
          {step==='3'&&<Step3PromptEditor onBack={()=>setStep('2')} onNext={()=>setStep('4')}/>}
          {step==='4'&&<Step4Overview onBack={()=>setStep('3')} onFinish={()=>setStep(null)}/>}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full font-movatif" style={{ background:UI.bg, color:UI.txt }}>
      {/* Page tag like your other sections */}
      <div className="px-4 sm:px-6 pt-8">
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: UI.shadowCard,
            color: UI.txt
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: UI.brand }} />
          Builds
        </span>
      </div>

      {/* Center panel (same shell as API Keys / Phone Numbers) */}
      <main
        className="w-full max-w-[1200px] mx-auto mt-4 px-4 sm:px-6 pb-24"
      >
        <section
          className="rounded-[18px] p-5 sm:p-6 md:p-7"
          style={{ background:UI.panel, border:UI.border, boxShadow:UI.shadowSoft }}
        >
          {/* Header row with title + CTA */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-[26px] font-semibold tracking-wide" style={{ color:UI.txt }}>
              Builder Dashboard
            </h1>
            <button
              onClick={() => router.push('/builder?step=1')}
              className="px-4 py-2 rounded-[12px] font-semibold transition hover:translate-y-[-1px] active:translate-y-0"
              style={{ background:UI.brand, color:'#000', boxShadow:'0 0 10px var(--brand-weak)' }}
            >
              Create a Build
            </button>
          </div>

          {/* Search input styled like your inputs */}
          <div className="mb-6">
            <input
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Search projects and builds…"
              className="w-full rounded-[12px] px-5 py-4 text-[15px] outline-none transition"
              style={{ background:UI.card, color:UI.txt, border:'1px solid var(--border)', boxShadow:UI.shadowCard }}
              onFocus={(e)=> (e.currentTarget.style.boxShadow = `0 0 0 4px ${UI.ring}`)}
              onBlur={(e)=> (e.currentTarget.style.boxShadow = UI.shadowCard)}
            />
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <CreateCard onClick={()=>router.push('/builder?step=1')} />

            {filtered.map((bot)=>(
              <BuildCard
                key={bot.id}
                bot={bot}
                accent={bot.appearance?.accent || accentFor(bot.id)}
                onOpen={()=>setViewId(bot.id)}
                onDelete={()=>{
                  const next=bots.filter((b)=>b.id!==bot.id);
                  const sorted=sortByNewest(next); setBots(sorted); saveBots(sorted);
                }}
                onCustomize={()=>setCustomizingId(bot.id)}
              />
            ))}
          </div>

          {filtered.length===0 && (
            <div className="mt-10 text-center" style={{ color:UI.mut }}>
              No builds found. Click <span style={{ color:UI.brand }}>Create a Build</span> to get started.
            </div>
          )}
        </section>
      </main>

      {selectedBot && (
        <CustomizeModal
          bot={selectedBot}
          onClose={()=>setCustomizingId(null)}
          onApply={(ap)=>{
            if(!customizingId) return;
            const next=bots.map((b)=> b.id===customizingId ? { ...b, appearance:{ ...(b.appearance??{}), ...ap }, updatedAt:nowISO() } : b );
            const sorted=sortByNewest(next); setBots(sorted); saveBots(sorted); setCustomizingId(null);
          }}
          onReset={()=>{
            if(!customizingId) return;
            const next=bots.map((b)=> b.id===customizingId ? { ...b, appearance:undefined, updatedAt:nowISO() } : b );
            const sorted=sortByNewest(next); setBots(sorted); saveBots(sorted); setCustomizingId(null);
          }}
          onSaveDraft={(name, ap)=>{
            if(!customizingId) return;
            const key=`drafts:${customizingId}`;
            const arr:Array<{name:string;appearance:Appearance;ts:string}>=JSON.parse(localStorage.getItem(key)||'[]');
            arr.unshift({ name:name||`Draft ${new Date().toLocaleString()}`, appearance:ap, ts:nowISO() });
            localStorage.setItem(key, JSON.stringify(arr.slice(0,20)));
          }}
        />
      )}

      {viewedBot && <PromptOverlay bot={viewedBot} onClose={()=>setViewId(null)} />}
    </div>
  );
}

/* --------------------------- Prompt Overlay --------------------------- */
function buildRawStep1PlusStep3(bot: Bot){ const head=[bot.name,bot.industry,bot.language].filter(Boolean).join('\n'); const step3=bot.prompt??''; return head&&step3?`${head}\n\n${step3}`:head||step3||''; }
function PromptOverlay({ bot, onClose }:{ bot:Bot; onClose:()=>void }){
  const rawOut=buildRawStep1PlusStep3(bot); const sections=splitStep3IntoSections(bot.prompt);
  const copyAll=async()=>{ try{ await navigator.clipboard.writeText(rawOut);}catch{} };
  const downloadTxt=()=>{ const blob=new Blob([rawOut],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${(bot.name||'prompt').replace(/[^\w\-]+/g,'_')}.txt`; a.click(); URL.revokeObjectURL(url); };

  const frame:React.CSSProperties={ background:UI.panel, border:UI.border, boxShadow:UI.shadowSoft, borderRadius:30 };
  const headerBorder={ borderBottom:'1px solid var(--border)' };
  const card:React.CSSProperties={ background:UI.card, border:'1px solid var(--border)', borderRadius:20, boxShadow:UI.shadowCard };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,.45)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col" style={frame}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={headerBorder}>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold truncate" style={{ color:UI.txt }}>Prompt</h2>
            <div className="text-xs md:text-sm truncate" style={{ color:UI.mut }}>
              {[bot.name,bot.industry,bot.language].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyAll} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border transition hover:translate-y-[-1px]"
              style={{ background:UI.card, border:'1px solid var(--border)', color:UI.txt }}>
              <Copy className="w-3.5 h-3.5"/> Copy
            </button>
            <button onClick={downloadTxt} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border transition hover:translate-y-[-1px]"
              style={{ background:UI.card, border:'1px solid var(--border)', color:UI.txt }}>
              <DownloadIcon className="w-3.5 h-3.5"/> Download
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5" aria-label="Close"><X className="w-5 h-5" style={{ color:UI.txt }}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!bot.prompt ? (
            <div className="p-5" style={card}><div style={{ color:UI.mut }}>(No Step 3 prompt yet)</div></div>
          ) : sections ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map((sec,i)=>(
                <div key={i} style={card} className="overflow-hidden">
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2 font-semibold text-sm" style={{ color:UI.txt }}>
                      {ICONS[sec.key]} {sec.title}
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <pre className="whitespace-pre-wrap text-sm leading-6" style={{ color:UI.txt }}>{sec.text}</pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={card} className="p-5">
              <pre className="whitespace-pre-wrap text-sm leading-6" style={{ color:UI.txt }}>{bot.prompt}</pre>
            </div>
          )}
        </div>

        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop:'1px solid var(--border)', background:UI.panel }}>
          <div className="flex justify-end">
            <button className="px-5 py-2 rounded-[14px] font-semibold transition hover:translate-y-[-1px]"
              onClick={onClose} style={{ background:UI.brand, color:'#000', boxShadow:'0 0 10px var(--brand-weak)' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Cards --------------------------------- */

function CreateCard({ onClick }:{ onClick:()=>void }){
  const [hover,setHover]=useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      className="group relative h-[360px] rounded-[16px] p-7 flex flex-col items-center justify-center transition-all active:scale-[0.995]"
      style={{ background:UI.card, border:UI.border, boxShadow:UI.shadowCard }}
    >
      {/* brand glow like other sections */}
      <div className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
           style={{ background:`radial-gradient(circle, ${UI.brandWeak} 0%, transparent 70%)`, filter:'blur(38px)' }} />
      {/* sheen */}
      <div className="pointer-events-none absolute top-0 bottom-0 w-[55%] rounded-[16px]"
           style={{
             left:hover?'120%':'-120%',
             background:'linear-gradient(110deg, transparent 0%, rgba(255,255,255,.06) 40%, rgba(255,255,255,.14) 50%, rgba(255,255,255,.06) 60%, transparent 100%)',
             filter:'blur(1px)', transition:'left 420ms var(--ease)'
           }} />
      <div className="w-20 h-20 rounded-full grid place-items-center mb-5"
           style={{ background:'var(--panel)', border:UI.border, boxShadow:'inset 0 0 12px rgba(0,0,0,.08)' }}>
        <Plus className="w-10 h-10" style={{ color:'var(--brand)' }} />
      </div>
      {/* TEXT IN WHITE as requested */}
      <div className="text-[20px] text-white">Create a Build</div>
      <div className="text-[13px] text-white/70 mt-2">Start building your AI assistant</div>
    </button>
  );
}

const palette=['#6af7d1','#7cc3ff','#b28bff','#ffd68a','#ff9db1'];
const accentFor=(id:string)=> palette[Math.abs([...id].reduce((h,c)=>h+c.charCodeAt(0),0))%palette.length];

function BuildCard({ bot, accent, onOpen, onDelete, onCustomize }:{
  bot:Bot; accent:string; onOpen:()=>void; onDelete:()=>void; onCustomize:()=>void;
}){
  const [hover,setHover]=useState(false);
  const ap=bot.appearance || {};
  return (
    <div className="relative h-[360px] rounded-[16px] p-0 flex flex-col justify-between group transition-all"
         style={{ background:UI.card, border:UI.border, boxShadow:UI.shadowCard }}>
      <div className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
           style={{ background:`radial-gradient(circle, ${UI.brandWeak} 0%, transparent 70%)`, filter:'blur(38px)' }} />
      <div className="h-44 border-b overflow-hidden relative" style={{ borderColor:'var(--border)' }}
           onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
        <button
          onClick={onCustomize}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs border transition hover:translate-y-[-1px]"
          style={{ background:UI.panel, border:'1px solid var(--border)', boxShadow:UI.shadowCard, color:UI.txt }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Customize
        </button>
        {/* @ts-ignore */}
        <Bot3D className="h-full"
          accent={ap.accent||accent} shellColor={ap.shellColor} bodyColor={ap.bodyColor}
          trimColor={ap.trimColor} faceColor={ap.faceColor} variant={ap.variant||'silver'}
          eyes={ap.eyes||'ovals'} head={ap.head||'rounded'} torso={ap.torso||'box'}
          arms={ap.arms??'capsule'} legs={ap.legs??'capsule'}
          antenna={ap.hasOwnProperty('antenna')?Boolean((ap as any).antenna):true}
          withBody={ap.hasOwnProperty('withBody')?Boolean(ap.withBody):true}
          idle={ap.hasOwnProperty('idle')?Boolean(ap.idle):hover}
        />
      </div>
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[10px] grid place-items-center"
               style={{ background:UI.panel, border:'1px solid var(--border)', boxShadow:'inset 0 0 10px rgba(0,0,0,.08)' }}>
            <BotIcon className="w-5 h-5" style={{ color:accent }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate" style={{ color:UI.txt }}>{bot.name}</div>
            <div className="text-[12px] truncate" style={{ color:UI.mut }}>
              {(bot.industry||'—') + (bot.language?` · ${bot.language}`:'')}
            </div>
          </div>
          <button onClick={onDelete} className="ml-auto p-1.5 rounded-md transition hover:bg-black/5" title="Delete">
            <Trash2 className="w-4 h-4" style={{ color:UI.mut }} />
          </button>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-[12px]" style={{ color:UI.mut }}>Updated {fmtDate(bot.updatedAt||bot.createdAt)}</div>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm border transition hover:translate-y-[-1px]"
            style={{ background:UI.panel, border:'1px solid var(--border)', boxShadow:UI.shadowCard, color:UI.txt }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
