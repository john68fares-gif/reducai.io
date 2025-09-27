// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket,
  KeyRound, Play, Pause, Square, Plus, Trash2, Phone, Globe, Lock, Check, X
} from 'lucide-react';

import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';
import StyledSelect from '@/components/ui/StyledSelect';
import GeneratePromptModal from '@/components/voice/GeneratePromptModal';
import ImportWebsiteModal from '@/components/voice/ImportWebsiteModal';
import { loadJSZip } from '@/lib/jszip-loader';
import { DEFAULT_PROMPT as BUILDER_DEFAULT, buildPromptFromWebsite } from '@/utils/prompt-builder';
import { shapePromptForScheduling } from '@/components/voice/utils/prompt';

/* —— Your prompt engine —— */
import {
  DEFAULT_PROMPT as ENGINE_DEFAULT,
  looksLikeFullPrompt,
  normalizeFullPrompt,
  compilePrompt
} from '@/lib/prompt-engine';

/* ───────── constants ───────── */
const EPHEMERAL_TOKEN_ENDPOINT = '/api/voice/ephemeral';
const PREVIEW_TTS_ENDPOINT     = '/api/voice/tts/preview';
const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const ACTIVE_KEY = 'va:activeId';
const IS_CLIENT = typeof window !== 'undefined';

/* storage keys */
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';
const PHONE_LIST_KEY_V1   = 'phoneNumbers.v1';
const PHONE_LIST_KEY_LEG  = 'phoneNumbers';
const PHONE_SELECTED_ID   = 'phoneNumbers.selectedId';

/* Assistant rail (lazy) */
const AssistantRail = dynamic(
  () =>
    import('@/components/voice/AssistantRail')
      .then(m => m.default ?? m)
      .catch(() => Promise.resolve(() => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>)),
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> }
);

class RailBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  constructor(p:any){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(){ return {hasError:true}; }
  render(){ return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* ───────── utils ───────── */
const isStr = (v: any): v is string => typeof v === 'string';
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : '');
const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms));

/* strip any meta lines leaking into prompt */
const STRIP_META_RE = /^(SYSTEM_SPEC|IDENTITY|STYLE|GUIDELINES|GOALS|FALLBACK|BUSINESS_FACTS|POLICY)::.*$/gmi;
const sanitizePrompt = (s: string) => (s || '').replace(STRIP_META_RE, '').trim();

/* theme */
const Tokens = () => (
  <style jsx global>{`
    :root {
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;
      --page-bg:var(--bg); --panel-bg:var(--panel);
      --input-bg:#101314; --input-border:rgba(255,255,255,.10);
      --border-weak:rgba(255,255,255,.10);
      --card-shadow:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${GREEN_LINE};
      --control-h:40px; --header-h:80px; --ease:cubic-bezier(.22,.61,.36,1);
    }
    .va-root{background:var(--page-bg)}
    .va-card{border-radius:8px;border:1px solid var(--border-weak);background:var(--panel-bg);box-shadow:var(--card-shadow);overflow:hidden}
    .va-head{min-height:var(--header-h);display:grid;grid-template-columns:1fr auto;align-items:center;padding:0 16px;border-bottom:1px solid var(--border-weak)}
    .va-cta{box-shadow:0 10px 22px rgba(89,217,179,.28)}
  `}</style>
);

/* tiny SVG */
const PhoneFilled = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...props} aria-hidden>
    <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.03-.24c1.12.37 2.33.57 3.56.57a1 1 0 011 1v3.5a1 1 0 01-1 1C11.3 22 2 12.7 2 2.99a1 1 0 011-1H6.5a1 1 0 011 1c0 1.23.2 2.44.57 3.56a1 1 0 01-.24 1.03l-2.2 2.2z" fill="currentColor"/>
  </svg>
);

/* ───────── DIFF ENGINE (LCS, merged runs) ───────── */
type Op = { t:'same'|'add'|'rem'; text:string };

function diffOps(a: string, b: string): Op[] {
  const A = Array.from(a||''); const B = Array.from(b||'');
  const n = A.length, m = B.length;
  const dp = Array.from({length:n+1},()=>new Array<number>(m+1).fill(0));
  for (let i=1;i<=n;i++) for (let j=1;j<=m;j++)
    dp[i][j] = A[i-1]===B[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const out: Op[] = [];
  let i=n, j=m;
  while (i>0 && j>0){
    if (A[i-1]===B[j-1]) { out.push({t:'same', text:A[i-1]}); i--; j--; }
    else if (dp[i-1][j] >= dp[i][j-1]) { out.push({t:'rem', text:A[i-1]}); i--; }
    else { out.push({t:'add', text:B[j-1]}); j--; }
  }
  while (i>0){ out.push({t:'rem', text:A[i-1]}); i--; }
  while (j>0){ out.push({t:'add', text:B[j-1]}); j--; }
  out.reverse();

  // merge runs
  const merged: Op[] = [];
  for (const o of out){
    const last = merged[merged.length-1];
    if (last && last.t===o.t) last.text += o.text;
    else merged.push({...o});
  }
  return merged;
}

/* Progressive preview:
   - shows ALL removals immediately (red strike)
   - reveals additions progressively in green
   - same text plain */
function ProgressiveDiffView({ base, candidate, revealChars }: { base:string; candidate:string; revealChars:number }) {
  const ops = useMemo(()=>diffOps(base, candidate), [base, candidate]);
  let remaining = revealChars;
  return (
    <pre className="whitespace-pre-wrap break-words m-0" style={{ lineHeight: 1.55 }}>
      {ops.map((o, idx) => {
        if (o.t === 'same') return <span key={idx}>{o.text}</span>;
        if (o.t === 'rem') {
          return (
            <span key={idx} style={{ background:'rgba(239,68,68,.18)', color:'#ef4444', textDecoration:'line-through' }}>
              {o.text}
            </span>
          );
        }
        // added: only reveal the first N chars; hidden remainder not shown yet
        const show = Math.max(0, Math.min(o.text.length, remaining));
        const visible = o.text.slice(0, show);
        remaining -= show;
        return visible ? (
          <span key={idx} style={{ background:'rgba(16,185,129,.14)', color:'#10b981' }}>{visible}</span>
        ) : <span key={idx} />;
      })}
    </pre>
  );
}

/* ───────── Sectioning helpers (force full sections) ───────── */
const SECTION_ORDER = [
  'Identity',
  'Style',
  'Response Guidelines',
  'Task & Goals',
  'Error Handling / Fallback'
] as const;
type SectionName = typeof SECTION_ORDER[number];

function emptySectionMap(): Record<SectionName, string[]> {
  return {
    'Identity': [],
    'Style': [],
    'Response Guidelines': [],
    'Task & Goals': [],
    'Error Handling / Fallback': [],
  };
}

/* Map free text into sections using light heuristics + keywords */
function mapDescriptionToSections(desc: string, name: string): Record<SectionName, string[]> {
  const lines = desc.split('\n').map(s => s.trim()).filter(Boolean);
  const map = emptySectionMap();
  let cur: SectionName = 'Identity';

  const kw = (s:string) => s.toLowerCase();
  const pick = (l:string): SectionName => {
    const s = kw(l);
    if (/^\[(identity|style|guidelines?|task|goal|error|fallback)\]/i.test(l)) {
      if (/\[style\]/i.test(l)) return 'Style';
      if (/\[(guideline|response)/i.test(l)) return 'Response Guidelines';
      if (/\[(task|goal)/i.test(l)) return 'Task & Goals';
      if (/\[(error|fallback)/i.test(l)) return 'Error Handling / Fallback';
      return 'Identity';
    }
    if (/(tone|voice|style|writing)/.test(s)) return 'Style';
    if (/(guideline|respond|format|steps|do:|don’t|don't)/.test(s)) return 'Response Guidelines';
    if (/(task|goal|kpi|conversion|book|schedule|purchase|escalate)/.test(s)) return 'Task & Goals';
    if (/(error|fallback|unsure|unknown|can.t|cannot)/.test(s)) return 'Error Handling / Fallback';
    return cur;
  };

  for (const l of lines) {
    const target = pick(l);
    cur = target;
    map[cur].push(l);
  }

  // sensible defaults if user gave nothing for a section
  if (map['Identity'].length === 0) {
    map['Identity'].push(`- You are ${name || 'the assistant'}, a helpful AI for this business.`);
  }
  if (map['Style'].length === 0) {
    map['Style'].push('- Clear, concise, friendly. Use plain language and short sentences.');
  }
  if (map['Response Guidelines'].length === 0) {
    map['Response Guidelines'].push('- Ask for any missing info; confirm critical details; provide a single clear next step.');
  }
  if (map['Task & Goals'].length === 0) {
    map['Task & Goals'].push('- Help users complete their next best action (book, purchase, escalate).');
  }
  if (map['Error Handling / Fallback'].length === 0) {
    map['Error Handling / Fallback'].push('- If unsure, ask a specific clarifying question before proceeding.');
  }

  return map;
}

function sectionsToString(map: Record<SectionName, string[]>): string {
  const blocks = SECTION_ORDER.map(sec => {
    const body = map[sec].join('\n').trim();
    return `[${sec}]\n${body}`;
  });
  const s = blocks.join('\n\n').trim();
  return normalizeFullPrompt?.(s) ?? s;
}

/* defaults */
const PROMPT_SKELETON = `[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

const DEFAULT_PROMPT_RT =
  (ENGINE_DEFAULT && ENGINE_DEFAULT.trim()) ||
  (BUILDER_DEFAULT && BUILDER_DEFAULT.trim()) ||
  PROMPT_SKELETON;

type ApiKey = { id: string; name: string; key: string };
type PhoneNum = { id: string; name: string; number: string };

type AgentData = {
  name: string;
  provider: 'openai'|'anthropic'|'google';
  model: string;
  firstMode: 'Assistant speaks first'|'User speaks first'|'Silent until tool required';
  firstMsg: string;
  firstMsgs?: string[];
  greetPick?: 'sequence'|'random';
  systemPrompt: string;
  systemPromptBackend?: string;
  language: 'English'|'Dutch'|'German'|'Spanish'|'Arabic';
  contextText?: string;
  ctxFiles?: { name:string; text:string }[];
  ttsProvider: 'openai'|'elevenlabs'|'google-tts';
  voiceName: string;
  apiKeyId?: string;
  phoneId?: string;
  asrProvider: 'deepgram'|'whisper'|'assemblyai';
  asrModel: string;
  denoise: boolean;
  numerals: boolean;
};

const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'gpt-4o',
  firstMode: 'User speaks first',
  firstMsg: '',
  firstMsgs: [],
  greetPick: 'sequence',
  systemPrompt: normalizeFullPrompt?.(
`[Identity]
- You are a helpful, professional AI assistant for this business.

[Style]
- Clear, concise, friendly.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.

[Task & Goals]
- Guide users to their next best action (booking, purchase, or escalation).

[Error Handling / Fallback]
- If unsure, ask a specific clarifying question first.`) ?? PROMPT_SKELETON,
  systemPromptBackend: '',
  contextText: '',
  ctxFiles: [],
  ttsProvider: 'openai',
  voiceName: 'Alloy (American)',
  apiKeyId: '',
  phoneId: '',
  asrProvider: 'deepgram',
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
  language: 'English'
};

const keyFor = (id: string) => `va:agent:${id}`;

/* voice options */
const OPENAI_VOICES = [
  { value: 'Alloy (American)', label: 'Alloy', id: 'alloy' },
  { value: 'Verse (American)', label: 'Verse', id: 'verse' },
  { value: 'Coral (British)',  label: 'Coral', id: 'coral' },
  { value: 'Amber (Australian)',label: 'Amber', id: 'amber' },
];

/* storage helpers */
const loadAgentData = (id: string): AgentData => {
  try {
    const raw = IS_CLIENT ? localStorage.getItem(keyFor(id)) : null;
    if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) };
  } catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try { if (IS_CLIENT) localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
};

/* backend stubs */
async function apiSave(agentId: string, payload: AgentData){
  const r = await fetch(`/api/voice/agent/${agentId}/save`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }).catch(()=>null as any);
  if (!r?.ok) throw new Error('Save failed');
  return r.json();
}
async function apiPublish(agentId: string){
  const r = await fetch(`/api/voice/agent/${agentId}/publish`, { method: 'POST' }).catch(()=>null as any);
  if (!r?.ok) throw new Error('Publish failed');
  return r.json();
}

/* options */
type Opt = { value: string; label: string; disabled?: boolean };
function useOpenAIModels(){
  const [opts] = useState<Opt[]>(
    [
      { value: 'gpt-5', label: 'GPT-5' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
      { value: 'gpt-5-realtime', label: 'GPT-5 Realtime' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'o4', label: 'o4' },
      { value: 'o4-mini', label: 'o4 Mini' },
      { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime Preview' },
      { value: 'gpt-4o-realtime-preview-mini', label: 'GPT-4o Realtime Preview Mini' },
    ]
  );
  return { opts, loading:false };
}

/* file helpers */
async function readFileAsText(f: File): Promise<string> {
  const name = f.name.toLowerCase();
  const looksZip = async () => {
    const buf = new Uint8Array(await f.slice(0,4).arrayBuffer());
    return buf[0]===0x50 && buf[1]===0x4b;
  };
  if (name.endsWith('.docx') || name.endsWith('.docs') || await looksZip()) {
    try {
      const JSZip = await loadJSZip();
      const buf = await f.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const docXml = await zip.file('word/document.xml')?.async('string');
      if (!docXml) return '';
      const text = docXml
        .replace(/<w:p[^>]*>/g,'\n').replace(/<w:tab\/>/g,'\t').replace(/<w:br\/>/g,'\n')
        .replace(/<(.|\n)*?>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      return text.trim();
    } catch { return ''; }
  }
  if (name.endsWith('.doc')) {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      let out = '', run:number[]=[];
      const flush = () => { if (run.length >= 3) out += String.fromCharCode(...run) + '\n'; run = []; };
      for (const b of buf) { if (b >= 32 && b <= 126) run.push(b); else flush(); }
      flush(); return out.trim();
    } catch { return ''; }
  }
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = () => rej(new Error('Read failed'));
    r.onload = () => res(String(r.result || '')); r.readAsText(f);
  });
}

/* Fallback: force a full sectioned prompt if engine output isn’t structured */
function sectionizeFallback(desc: string, baseName: string) {
  const map = mapDescriptionToSections(desc, baseName);
  return sectionsToString(map);
}

/* page */
export default function VoiceAgentSection(){
  const [activeId, setActiveId] = useState<string>(() => {
    try { return IS_CLIENT ? localStorage.getItem(ACTIVE_KEY) || '' : ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [toastKind, setToastKind] = useState<'info'|'error'>('info');

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNum[]>([]);
  const [showCall, setShowCall] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  /* DIFF PREVIEW STATE */
  const [diffMode, setDiffMode] = useState(false);
  const [basePrompt, setBasePrompt] = useState('');
  const [candidatePrompt, setCandidatePrompt] = useState('');
  const [revealedAdds, setRevealedAdds] = useState(0);
  const totalAddsRef = useRef(0);
  const candidateBackendRef = useRef(''); // machine prompt for accepted state

  /* voice preview */
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const [audioURL, setAudioURL] = useState<string>('');
  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);

  useEffect(() => {
    if (!IS_CLIENT) return;
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);
  useEffect(() => { if (activeId) setData(loadAgentData(activeId)); try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {} }, [activeId]);
  useEffect(() => { if (activeId) saveAgentData(activeId, data); }, [activeId, data]);

  /* keys + phones */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ss = await scopedStorage(); await ss.ensureOwnerGuard();
        const v1 = await ss.getJSON<ApiKey[]>(LS_KEYS, []); const legacy = await ss.getJSON<ApiKey[]>('apiKeys', []);
        const merged = (Array.isArray(v1) && v1.length ? v1 : (Array.isArray(legacy) ? legacy : []))
          .filter(Boolean).map((k:any)=>({ id:String(k.id||''), name:String(k.name||''), key:String(k.key||'') }))
          .filter(k=>k.id && k.name);
        if (!mounted) return;
        setApiKeys(merged);
        const globalSelected = await ss.getJSON<string>(LS_SELECTED, '');
        const chosen = (data.apiKeyId && merged.some(k=>k.id===data.apiKeyId)) ? data.apiKeyId :
                       (globalSelected && merged.some(k=>k.id===globalSelected)) ? globalSelected :
                       (merged[0]?.id || '');
        if (chosen !== (data.apiKeyId||'')) setData(p=>({...p, apiKeyId: chosen}));
        if (chosen) await ss.setJSON(LS_SELECTED, chosen);
      } catch { if (mounted) setApiKeys([]); }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const store = await scopedStorage().catch(()=>null);
        if (!mounted || !store) return;
        store.ensureOwnerGuard?.().catch(()=>{});
        const phoneV1 = await store.getJSON<PhoneNum[]>(PHONE_LIST_KEY_V1, []).catch(()=>[]);
        const phoneLegacy = await store.getJSON<PhoneNum[]>(PHONE_LIST_KEY_LEG, []).catch(()=>[]);
        const phonesMerged = (Array.isArray(phoneV1) && phoneV1.length ? phoneV1 : (Array.isArray(phoneLegacy) ? phoneLegacy : []))
          .filter(Boolean).map((p:any)=>({ id:String(p.id||''), name:String(p.name||''), number:String(p.number||p.phone||'') }))
          .filter(p=>p.id && (p.number || p.name));
        setPhoneNumbers(phonesMerged);

        const sel = await store.getJSON<string>(PHONE_SELECTED_ID, '').catch(()=> '');
        const chosen = (data.phoneId && phonesMerged.some(p=>p.id===data.phoneId)) ? data.phoneId :
                       (sel && phonesMerged.some(p=>p.id===sel)) ? sel : (phonesMerged[0]?.id || '');
        if (chosen && chosen !== data.phoneId) { setData(p=>({...p, phoneId: chosen})); await store.setJSON(PHONE_SELECTED_ID, chosen).catch(()=>{}); }
      } catch { if (mounted) setPhoneNumbers([]); }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line
  }, []);

  function setField<K extends keyof AgentData>(k: K) {
    return (v: AgentData[K]) => setData(prev => ({ ...prev, [k]: v }));
  }

  /* keep backend (machine) prompt synced for manual edits */
  useEffect(() => {
    const raw = sanitizePrompt(data.systemPrompt || '');
    if (!raw) return;
    try {
      if (looksLikeFullPrompt?.(raw) && compilePrompt) {
        const compiled = compilePrompt({ basePrompt: raw, userText: '' });
        if (compiled?.backendString && compiled.backendString !== data.systemPromptBackend) {
          setData(p=>({ ...p, systemPromptBackend: compiled.backendString }));
        }
      } else if (raw !== data.systemPromptBackend) {
        setData(p=>({ ...p, systemPromptBackend: raw }));
      }
    } catch {
      if (raw !== data.systemPromptBackend) setData(p=>({ ...p, systemPromptBackend: raw }));
    }
  }, [data.systemPrompt]);

  async function doSave(){
    if (!activeId) { setToastKind('error'); setToast('Select or create an agent'); return; }
    setData(prev => ({ ...prev, firstMsg: (prev.firstMsgs?.[0] || prev.firstMsg || '') }));
    setSaving(true); setToast('');
    try {
      await apiSave(activeId, {
        ...data,
        systemPrompt: sanitizePrompt(data.systemPrompt),
        systemPromptBackend: sanitizePrompt(data.systemPromptBackend||''),
        firstMsg: (data.firstMsgs?.[0] || data.firstMsg || '')
      });
      setToastKind('info'); setToast('Saved');
    } catch { setToastKind('error'); setToast('Save failed'); }
    finally { setSaving(false); setTimeout(()=>setToast(''), 1400); }
  }
  async function doPublish(){
    if (!activeId) { setToastKind('error'); setToast('Select or create an agent'); return; }
    setPublishing(true); setToast('');
    try { await apiPublish(activeId); setToastKind('info'); setToast('Published'); }
    catch { setToastKind('error'); setToast('Publish failed'); }
    finally { setPublishing(false); setTimeout(()=>setToast(''), 1400); }
  }

  /* files */
  const fileInputRef = useRef<HTMLInputElement|null>(null);
  const rebuildContextText = (files:{name:string;text:string}[]) => {
    const merged = files.map(f => `# File: ${f.name}\n${(f.text||'').trim()}`).join('\n\n');
    setField('ctxFiles')(files);
    setField('contextText')(merged.trim());
  };
  const onPickFiles = async (files: File[]) => {
    if (!files?.length) return;
    const out: {name:string;text:string}[] = [...(data.ctxFiles||[])];
    for (const f of files) {
      const txt = await readFileAsText(f);
      if (!txt) continue;
      out.push({ name: f.name, text: txt });
    }
    rebuildContextText(out);
    setToastKind('info'); setToast('File(s) added'); setTimeout(()=>setToast(''), 1200);
  };

  /* ===== DIFF PREVIEW FLOW ===== */
  function totalAddChars(base: string, cand: string){
    return diffOps(base, cand).filter(o=>o.t==='add').reduce((s,o)=>s+o.text.length,0);
  }
  async function startDiffPreview(nextFrontend: string, nextBackend?: string) {
    const base = sanitizePrompt((data.systemPromptBackend || data.systemPrompt || DEFAULT_PROMPT_RT).trim());
    const cand = sanitizePrompt(nextFrontend);

    setBasePrompt(base);
    setCandidatePrompt(cand);
    candidateBackendRef.current = sanitizePrompt(nextBackend || nextFrontend);

    totalAddsRef.current = totalAddChars(base, cand);
    setRevealedAdds(0);
    setDiffMode(true);

    // progressively reveal only "adds"
    for (let i = 0; i <= totalAddsRef.current; i += Math.max(1, Math.round(totalAddsRef.current/120))) {
      setRevealedAdds(i);
      // small delay → smooth typing effect
      // eslint-disable-next-line no-await-in-loop
      await sleep(8);
    }
    setRevealedAdds(totalAddsRef.current);
  }

  const acceptDiff = () => {
    // Apply immediately; editor returns to plain white (no typing)
    const front = candidatePrompt;
    const back  = candidateBackendRef.current || candidatePrompt;

    setData(prev => ({
      ...prev,
      systemPrompt: front,
      systemPromptBackend: back
    }));

    // reset preview state
    setDiffMode(false);
    setBasePrompt('');
    setCandidatePrompt('');
    setRevealedAdds(0);
    candidateBackendRef.current = '';
  };

  const declineDiff = () => {
    // Discard candidate, keep previous
    setDiffMode(false);
    setBasePrompt('');
    setCandidatePrompt('');
    setRevealedAdds(0);
    candidateBackendRef.current = '';
  };

  /* Import files → propose appended [Context] */
  const importFilesIntoPrompt = async () => {
    const ctx  = sanitizePrompt((data.contextText || '').trim());
    const base = sanitizePrompt((data.systemPromptBackend || data.systemPrompt || DEFAULT_PROMPT_RT).trim());
    const next = ctx ? `${base}\n\n[Context]\n${ctx}`.trim() : base;
    await startDiffPreview(next, next);
  };

  /* GENERATE FLOW
     - use your prompt-engine first
     - ensure the FRONTEND prompt is fully sectioned (fallback sectionizer if needed)
     - backend string is saved as machine prompt */
  const onGenerate = async (userDesc: string) => {
    const base = sanitizePrompt((data.systemPrompt || DEFAULT_PROMPT_RT).trim());
    try {
      const compiled = compilePrompt({ basePrompt: base, userText: userDesc });

      // FRONTEND: make sure it contains ALL sections
      const engineFront = (compiled?.frontendText || '').trim();
      const hasAll = SECTION_ORDER.every(h => new RegExp(`\\[${h.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\]`, 'i').test(engineFront));
      const front = hasAll
        ? (normalizeFullPrompt?.(engineFront) ?? engineFront)
        : sectionizeFallback(userDesc, data.name || 'Assistant');

      // BACKEND: engine backend string or normalized front
      const back = sanitizePrompt((compiled?.backendString || front));

      await startDiffPreview(front, back);
    } catch {
      const front = sectionizeFallback(userDesc, data.name || 'Assistant');
      await startDiffPreview(front, front);
    }
  };

  /* model + keys */
  const { opts: openaiModels, loading: loadingModels } = useOpenAIModels();
  const selectedModelLabel = useMemo(() => openaiModels.find(o => o.value === data.model)?.label || data.model || '—', [openaiModels, data.model]);
  const hasApiKey = !!(data.apiKeyId && apiKeys.some(k=>k.id===data.apiKeyId && k.key));
  const selectedKey = useMemo(() => apiKeys.find(k => k.id === data.apiKeyId)?.key || '', [apiKeys, data.apiKeyId]);
  const callModel = useMemo(() => (data.model.toLowerCase().includes('realtime') ? data.model : 'gpt-4o-realtime-preview'), [data.model]);

  const [justAddedIndex, setJustAddedIndex] = useState<number | null>(null);
  const addFirstMessage = () => {
    const next = [...(data.firstMsgs||[])]; if (next.length >= 20) return;
    next.push(''); setField('firstMsgs')(next); setJustAddedIndex(next.length - 1); setTimeout(()=>setJustAddedIndex(null), 200);
  };
  const greetingJoined = useMemo(() => {
    if (data.firstMode !== 'Assistant speaks first') return '';
    const list = (data.greetPick==='random' ? [...(data.firstMsgs||[])].filter(Boolean).sort(()=>Math.random()-0.5) : (data.firstMsgs||[]).filter(Boolean));
    let s = list.join('\n').trim(); if (!s) s = 'Hello! How can I help you today?'; return s;
  }, [data.greetPick, data.firstMsgs, data.firstMode]);
  const langToHint = (lang: AgentData['language']): 'en'|'nl'|'de'|'es'|'ar' => {
    switch (lang) { case 'Dutch': return 'nl'; case 'German': return 'de'; case 'Spanish': return 'es'; case 'Arabic': return 'ar'; default: return 'en'; }
  };

  /* voice preview progress */
  useEffect(() => {
    const el = audioRef.current; if (!el) return;
    const onTime = () => { if (!el.duration || Number.isNaN(el.duration)) return setAudioProgress(0); setAudioProgress((el.currentTime/el.duration)*100); };
    const onEnd = () => { setAudioPlaying(false); setAudioProgress(0); };
    el.addEventListener('timeupdate', onTime); el.addEventListener('ended', onEnd);
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnd); };
  }, []);
  async function fetchVoicePreview(text: string) {
    const item = OPENAI_VOICES.find(v => v.value === data.voiceName);
    const providerVoiceId = item?.id || 'alloy';
    try {
      setAudioLoading(true);
      const r = await fetch(PREVIEW_TTS_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: data.ttsProvider, voiceName: providerVoiceId, text })
      });
      if (!r.ok) throw new Error('Preview route not ready');
      const blob = await r.blob(); const url = URL.createObjectURL(blob);
      setAudioURL(prev=>{ if (prev) URL.revokeObjectURL(prev); return url; });
    } catch {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text); const voices = window.speechSynthesis.getVoices();
        const en = voices.find(v => v.lang?.startsWith('en')); if (en) u.voice = en;
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      }
    } finally { setAudioLoading(false); }
  }
  async function onClickPreview() {
    if (audioPlaying) { audioRef.current?.pause(); setAudioPlaying(false); return; }
    if (!audioURL) await fetchVoicePreview(`Hi, I'm ${data.name || 'your assistant'}.`);
    const el = audioRef.current; if (!el) return;
    el.currentTime = 0; el.play().then(()=>setAudioPlaying(true)).catch(()=>{});
  }
  function stopPreview(){ try { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; } catch {} setAudioPlaying(false); setAudioProgress(0); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }

  return (
    <section className="va-root">
      <Tokens />
      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid var(--border-weak)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w/full max-w-[1160px]" style={{ fontSize:'14px', lineHeight:1.45, color:'var(--text)' }}>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <button onClick={doSave} disabled={saving}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm"
              style={{ height:'40px', background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={doPublish} disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm"
              style={{ height:'40px', background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}>
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>
            <div className="mr-auto text-xs opacity-70 pl-1">Model selected: <span className="opacity-100">{selectedModelLabel}</span></div>
            <button
              onClick={()=>{
                if (!hasApiKey) { setToastKind('error'); setToast('Add your OpenAI API key in API Keys.'); setTimeout(()=>setToast(''), 2200); return; }
                setShowCall(true);
              }}
              className="inline-flex items-center gap-2 rounded-[8px] select-none va-cta"
              style={{ height:'40px', padding:'0 16px', background:CTA, color:'#ffffff', fontWeight:700 }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <PhoneFilled style={{ color:'#ffffff' }} />
              <span>Talk to Assistant</span>
            </button>
          </div>

          {!hasApiKey && (
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
                 style={{ background: 'rgba(239,68,68,.12)', color: 'var(--text)', boxShadow:'0 0 0 1px rgba(239,68,68,.25) inset' }}>
              <Lock className="w-4 h-4" /> No API key selected. Add one on the <b>&nbsp;API Keys&nbsp;</b> page.
            </div>
          )}

          {/* Model */}
          <Section title="Model" icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />} desc="Configure the model, assistant name, greetings, and language." defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Assistant Name</div>
                <input
                  value={data.name}
                  onChange={(e)=>setField('name')(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[8px] px-3"
                  style={{ height:'40px', background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}
                  placeholder="e.g., Riley"
                />
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">Provider</div>
                <StyledSelect
                  value={data.provider}
                  onChange={(v)=>setField('provider')(v as AgentData['provider'])}
                  options={[
                    { value: 'openai', label: 'OpenAI' },
                    { value: 'anthropic', label: 'Anthropic — coming soon', disabled: true },
                    { value: 'google', label: 'Google — coming soon', disabled: true },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div>
                <div className="mb-2 text-[12.5px]">Model</div>
                <StyledSelect
                  value={data.model}
                  onChange={setField('model')}
                  options={openaiModels}
                  placeholder={loadingModels ? 'Loading models…' : 'Choose a model'}
                />
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">First Message Mode</div>
                <StyledSelect value={data.firstMode} onChange={setField('firstMode')} options={[
                  { value: 'Assistant speaks first', label: 'Assistant speaks first' },
                  { value: 'User speaks first', label: 'User speaks first' },
                  { value: 'Silent until tool required', label: 'Silent until tool required' },
                ]}/>
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">Language</div>
                <StyledSelect
                  value={data.language}
                  onChange={setField('language')}
                  options={[
                    { value: 'English', label: 'English' },
                    { value: 'Dutch',   label: 'Dutch' },
                    { value: 'German',  label: 'German' },
                    { value: 'Spanish', label: 'Spanish' },
                    { value: 'Arabic',  label: 'Arabic' },
                  ]}
                />
              </div>
            </div>

            {/* First messages */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-[12.5px]">First Messages</div>
                <div className="flex items-center gap-2">
                  <StyledSelect
                    value={data.greetPick || 'sequence'}
                    onChange={(v)=>setField('greetPick')(v as AgentData['greetPick'])}
                    options={[{ value: 'sequence', label: 'Play in order' }, { value: 'random', label: 'Randomize' }]}
                  />
                  <button
                    type="button"
                    onClick={addFirstMessage}
                    className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
                    style={{ border:'1px solid var(--border-weak)' }}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>

              {(data.firstMsgs?.length ? data.firstMsgs : []).map((msg, idx) => (
                <div key={idx} className={`flex items-center gap-2 mb-2 ${justAddedIndex===idx?'va-row-add':''}`}>
                  <input
                    value={msg}
                    onChange={(e)=>{
                      const next = [...(data.firstMsgs || [])];
                      next[idx] = e.target.value;
                      setField('firstMsgs')(next);
                      setField('firstMsg')(next[0] || '');
                    }}
                    className="w-full bg-transparent outline-none rounded-[8px] px-3"
                    style={{ height:'40px', background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}
                    placeholder={`Message ${idx+1}`}
                  />
                  <button
                    onClick={()=>{
                      const next = [...(data.firstMsgs||[])];
                      next.splice(idx,1);
                      setField('firstMsgs')(next);
                      setField('firstMsg')((next[0]||''));}}
                    className="w-10 h-10 grid place-items-center rounded-[8px]"
                    style={{ border:'1px solid var(--border-weak)' }}
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {!(data.firstMsgs && data.firstMsgs.length) && (
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                  No greetings yet. If you choose “Assistant speaks first” and keep this empty, a default greeting will be used.
                </div>
              )}
            </div>

            {/* Prompt + Generate */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium" style={{ fontSize:'12.5px' }}>System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-[8px] text-sm"
                    style={{ height:34, padding:'0 12px', background:CTA, color:'#fff', border:'1px solid rgba(255,255,255,.08)' }}
                    onClick={()=> setShowGenerate(true)}
                  >
                    <Wand2 className="w-4 h-4" /> Generate
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-[8px] text-sm"
                    style={{ height:34, padding:'0 12px', background:'var(--panel-bg)', color:'var(--text)', border:'1px solid var(--border-weak)' }}
                    onClick={()=> setShowImport(true)}
                  >
                    <Globe className="w-4 h-4" /> Import website
                  </button>
                </div>
              </div>

              {/* Accept/Decline show AFTER typing finished */}
              {diffMode && revealedAdds >= totalAddsRef.current && (
                <div className="mb-2 flex items-center gap-2">
                  <button
                    onClick={acceptDiff}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] font-semibold"
                    style={{ background:CTA, color:'#fff' }}
                  >
                    <Check className="w-4 h-4" /> Accept changes
                  </button>
                  <button
                    onClick={declineDiff}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
                    style={{ border:'1px solid var(--border-weak)' }}
                  >
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              )}

              <div className="relative">
                {!diffMode ? (
                  <textarea
                    className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[10px]"
                    style={{ minHeight: 320, background:'var(--panel-bg)', border:'1px solid var(--border-weak)', color:'var(--text)' }}
                    value={data.systemPrompt}
                    onChange={(e)=> setField('systemPrompt')(sanitizePrompt(e.target.value))}
                  />
                ) : (
                  <div className="rounded-[8px] border p-3 text-xs" style={{ borderColor:'var(--border-weak)', background:'var(--panel-bg)', minHeight: 320 }}>
                    <ProgressiveDiffView base={basePrompt} candidate={candidatePrompt} revealChars={revealedAdds} />
                  </div>
                )}
              </div>

              {/* Context files */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium text-[12.5px]">Context Files</div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.md,.csv,.json,.docx,.doc,.docs,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/zip"
                      className="hidden"
                      onChange={async (e)=>{ const files = Array.from(e.target.files || []); await onPickFiles(files); if (fileInputRef.current) fileInputRef.current.value=''; }}
                    />
                    <button
                      type="button"
                      onClick={()=>fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
                      style={{ border:'1px solid var(--border-weak)' }}
                    >
                      Add file
                    </button>
                    {!!(data.ctxFiles && data.ctxFiles.length) && (
                      <>
                        <button
                          type="button"
                          onClick={importFilesIntoPrompt}
                          className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
                          style={{ background:CTA, color:'#fff', border:'1px solid rgba(255,255,255,.10)' }}
                        >
                          Import to Prompt
                        </button>
                        <button
                          type="button"
                          onClick={()=>{ rebuildContextText([]); }}
                          className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
                          style={{ border:'1px solid var(--border-weak)' }}
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!(data.ctxFiles && data.ctxFiles.length) ? (
                  <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                    No files yet. Click <b>Add file</b> to upload (.txt, .md, .csv, .json, .docx or best-effort .doc / .docs).
                  </div>
                ) : (
                  <div className="rounded-[8px] p-3" style={{ background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}>
                    {(data.ctxFiles||[]).map((f, idx) => (
                      <div key={idx} className="mb-3 last:mb-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-medium truncate">{f.name}</div>
                          <button
                            onClick={()=>{
                              const next = [...(data.ctxFiles||[])]; next.splice(idx,1);
                              rebuildContextText(next);
                            }}
                            className="text-xs rounded-[6px] px-2 py-1"
                            style={{ border:'1px solid var(--border-weak)' }}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                          {(f.text || '').slice(0, 240) || '(empty)'}{(f.text||'').length>240?'…':''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />} desc="Choose TTS and preview the voice." defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Voice Provider</div>
                <StyledSelect
                  value={data.ttsProvider}
                  onChange={(v)=>setField('ttsProvider')(v as AgentData['ttsProvider'])}
                  options={[
                    { value: 'openai', label: 'OpenAI' },
                    { value: 'elevenlabs', label: 'ElevenLabs — coming soon', disabled: true },
                    { value: 'google-tts', label: 'Google TTS — coming soon', disabled: true },
                  ]}
                />
              </div>

              <div>
                <div className="mb-2 text:[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={(v)=>{ setField('voiceName')(v); stopPreview(); setAudioURL(''); setAudioProgress(0); }}
                  options={OPENAI_VOICES.map(v => ({ value: v.value, label: v.label }))}
                  placeholder="— Choose —"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={onClickPreview} disabled={audioLoading}
                          className="w-9 h-9 rounded-full grid place-items-center"
                          aria-label="Play / Pause preview" style={{ background: CTA, color:'#0a0f0d' }}>
                    {audioPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={stopPreview}
                          className="w-9 h-9 rounded-full grid place-items-center border"
                          aria-label="Stop preview"
                          style={{ background: 'var(--panel-bg)', color:'var(--text)', borderColor:'var(--border-weak)' }}
                  >
                    <Square className="w-4 h-4" />
                  </button>

                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ minWidth: 120, background:'var(--border-weak)' }}>
                    <div style={{ width: `${audioProgress}%`, height:'100%', background: CTA }} />
                  </div>
                  <audio ref={audioRef} src={audioURL || undefined} preload="auto" />
                </div>
                {audioLoading && <div className="mt-2 text-xs" style={{ color:'var(--text-muted)' }}>Generating preview…</div>}
              </div>
            </div>
          </Section>

          {/* Credentials */}
          <Section title="Credentials" icon={<Phone className="w-4 h-4" style={{ color: CTA }} />} desc="Select the API key and phone number." defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 opacity-80" /> OpenAI API Key
                </div>
                <StyledSelect
                  value={data.apiKeyId || ''}
                  onChange={async (val)=>{ setField('apiKeyId')(val); try { const ss = await scopedStorage(); await ss.ensureOwnerGuard(); await ss.setJSON(LS_SELECTED, val); } catch {} }}
                  options={[
                    { value: '', label: 'Select your API key…' },
                    ...apiKeys.map(k=>({ value: k.id, label: `${k.name} ••••${(k.key||'').slice(-4).toUpperCase()}` }))
                  ]}
                />
              </div>

              <div>
                <div className="mb-2 text-[12.5px]">Phone Number</div>
                <StyledSelect
                  value={data.phoneId || ''}
                  onChange={async (val)=>{ setField('phoneId')(val); try { const ss = await scopedStorage(); await ss.ensureOwnerGuard(); await ss.setJSON(PHONE_SELECTED_ID, val); } catch {} }}
                  options={[
                    { value: '', label: 'Select a phone number…' },
                    ...phoneNumbers.map(p => ({ value: p.id, label: `${p.name ? `${p.name} • ` : ''}${p.number}` }))
                  ]}
                />
              </div>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<Mic className="w-4 h-4" style={{ color: CTA }} />} desc="Transcription settings" defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Provider</div>
                <StyledSelect
                  value={data.asrProvider}
                  onChange={(v)=>setField('asrProvider')(v as AgentData['asrProvider'])}
                  options={[
                    { value: 'deepgram', label: 'Deepgram' },
                    { value: 'whisper', label: 'Whisper — coming soon', disabled: true },
                    { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true },
                  ]}
                />
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">Model</div>
                <StyledSelect
                  value={data.asrModel}
                  onChange={setField('asrModel')}
                  options={[{ value: 'Nova 2', label: 'Nova 2' }, { value: 'Nova', label: 'Nova' }]}
                />
              </div>
            </div>
          </Section>
          <div style={{ height: 72 }} />
        </div>
      </div>

      {/* Generate → sectioned → diff preview */}
      <GeneratePromptModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerate={async (userDescription: string) => {
          const desc = safeTrim(userDescription);
          if (!desc) return;
          setShowGenerate(false);
          await sleep(10);
          await onGenerate(desc);
        }}
      />

      {/* Import website → append [Context] → diff preview */}
      <ImportWebsiteModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={async (urls: string[])=>{
          const list = urls.map(s=>s.trim()).filter(Boolean);
          if (!list.length) return;

          const chunks: string[] = [];
          for (const u of list) {
            try {
              const r = await fetch('/api/connectors/website-import', {
                method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: u })
              });
              const j = r.ok ? await r.json().catch(()=>null) : null;
              const facts: string[] = Array.isArray(j?.facts) ? j.facts : [];
              if (facts.length) { chunks.push(`# ${u}`, ...facts.map(s => `- ${s}`), ''); }
              else { chunks.push(`# ${u}`, '- No obvious facts extracted.', ''); }
            } catch { chunks.push(`# ${u}`, '- Fetch failed.', ''); }
          }

          const merged = chunks.join('\n').trim();
          const base = sanitizePrompt((data.systemPromptBackend || data.systemPrompt || DEFAULT_PROMPT_RT).trim());
          const next = buildPromptFromWebsite(merged, base);

          setShowImport(false);
          await sleep(10);
          await startDiffPreview(next, next);
        }}
      />

      {/* Call overlay */}
      {IS_CLIENT ? createPortal(
        <>
          <div
            className={`fixed inset-0 ${showCall ? '' : 'pointer-events-none'}`}
            style={{ zIndex: 9996, background: showCall ? 'rgba(8,10,12,.78)' : 'transparent', opacity: showCall ? 1 : 0, transition: 'opacity .2s cubic-bezier(.22,.61,.36,1)' }}
            onClick={()=> setShowCall(false)}
          />
          {showCall && (
            <WebCallButton
              model={callModel}
              systemPrompt={
                (() => {
                  const base = sanitizePrompt(data.systemPromptBackend || data.systemPrompt || '');
                  const ctx  = sanitizePrompt((data.contextText || '').trim());
                  return ctx ? `${base}\n\n[Context]\n${ctx}`.trim() : base;
                })()
              }
              voiceName={data.voiceName}
              assistantName={data.name || 'Assistant'}
              apiKey={selectedKey}
              ephemeralEndpoint={EPHEMERAL_TOKEN_ENDPOINT}
              onError={(err:any) => {
                const msg = err?.message || err?.error?.message || (typeof err === 'string' ? err : '') || 'Call failed';
                setToastKind('error'); setToast(msg);
              }}
              onClose={()=> setShowCall(false)}
              prosody={{ fillerWords: true, microPausesMs: 200, phoneFilter: true, turnEndPauseMs: 120 }}
              firstMode={data.firstMode}
              firstMsg={greetingJoined}
              languageHint={langToHint(data.language)}
            />
          )}
        </>,
        document.body
      ) : null}

      {/* Toast */}
      {!!toast && (
        <div className="fixed bottom-4 right-4 rounded-[8px] px-3 py-2 text-sm"
             style={{ zIndex: 100050, background: toastKind==='error' ? 'rgba(239,68,68,.14)' : 'rgba(89,217,179,.12)', color: 'var(--text)', border: `1px solid ${toastKind==='error' ? 'rgba(239,68,68,.30)' : GREEN_LINE}`, boxShadow: '0 10px 24px rgba(0,0,0,.18)' }}>
          {toast}
        </div>
      )}
    </section>
  );
}

/* Section */
function Section({ title, icon, desc, children, defaultOpen = true }:{
  title: string; icon: React.ReactNode; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const innerRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<number>(0);
  const measure = () => { if (innerRef.current) setH(innerRef.current.offsetHeight); };
  useLayoutEffect(() => { measure(); }, [children, open]);
  return (
    <div className="mb-3">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>{title}</div>
      <div className="va-card">
        <button onClick={()=>setOpen(v=>!v)} className="va-head w-full text-left" style={{ color:'var(--text)' }}>
          <span className="min-w-0 flex items-center gap-3">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full" style={{ background:'rgba(89,217,179,.12)' }}>
              {icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold truncate" style={{ fontSize:'18px' }}>{title}</span>
              {desc ? <span className="block text-xs truncate" style={{ color:'var(--text-muted)' }}>{desc}</span> : null}
            </span>
          </span>
          <span className="justify-self-end">
            {open ? <ChevronUp className="w-4 h-4" style={{ color:'var(--text-muted)' }}/> :
                    <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }}/>}
          </span>
        </button>

        <div
          className="va-section-body"
          style={{ height: open ? h : 0, opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-4px)', transition: 'height 260ms var(--ease), opacity 230ms var(--ease), transform 260ms var(--ease)', overflow:'hidden' }}
          onTransitionEnd={() => { if (open) measure(); }}
        >
          <div ref={innerRef} className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
