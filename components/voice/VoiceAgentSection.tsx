'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket,
  KeyRound, Play, Square, Plus, Trash2, Phone, Globe, Lock
} from 'lucide-react';

import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';

// ✅ correct path for your StyledSelect
import StyledSelect from '@/components/ui/StyledSelect';
import PromptDiffTyping from '@/components/voice/PromptDiffTyping';
import GeneratePromptModal from '@/components/voice/GeneratePromptModal';
import ImportWebsiteModal from '@/components/voice/ImportWebsiteModal';

// ✅ bundle-safe JSZip loader (no webpack https: import)
import { loadJSZip } from '@/lib/jszip-loader';

// prompt engine
import {
  DEFAULT_PROMPT as _DEFAULT_PROMPT,
  looksLikeFullPrompt as _looksLikeFullPrompt,
  normalizeFullPrompt as _normalizeFullPrompt,
  compilePrompt
} from '@/lib/prompt-engine';

/* ───────── constants ───────── */
const EPHEMERAL_TOKEN_ENDPOINT = '/api/voice/ephemeral';
const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const ACTIVE_KEY = 'va:activeId';
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';
const PHONE_LIST_KEY_V1   = 'phoneNumbers.v1';
const PHONE_LIST_KEY_LEG  = 'phoneNumbers';
const PHONE_SELECTED_ID   = 'phoneNumbers.selectedId';
const LS_SELECTED  = 'apiKeys.selectedId';

/* ───────── Assistant rail (lazy) ───────── */
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

/* ───────── tiny helpers ───────── */
const isFn = (f: any): f is Function => typeof f === 'function';
const isStr = (v: any): v is string => typeof v === 'string';
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const coerceStr = (v: any): string => (isStr(v) ? v : '');
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : '');
const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms));

/* strip leaked meta lines */
const STRIP_META_RE = /^(SYSTEM_SPEC|IDENTITY|STYLE|GUIDELINES|GOALS|FALLBACK|BUSINESS_FACTS|POLICY)::.*$/gmi;
const sanitizePrompt = (s: string) => (s || '').replace(STRIP_META_RE, '').trim();

/* theme tokens */
const Tokens = ({theme}:{theme:'dark'|'light'}) => (
  <style jsx global>{`
    :root {
      ${theme==='dark' ? `
        --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;
        --page-bg:var(--bg); --panel-bg:var(--panel);
        --input-bg:#101314; --input-border:rgba(255,255,255,.10); --input-shadow:0 0 0 1px rgba(255,255,255,.06) inset;
        --border-weak:rgba(255,255,255,.10);
        --card-shadow:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${GREEN_LINE};
      ` : `
        --bg:#f6f8f9; --panel:#ffffff; --text:#0b1620; --text-muted:#50606a;
        --page-bg:var(--bg); --panel-bg:var(--panel);
        --input-bg:#ffffff; --input-border:rgba(0,0,0,.12); --input-shadow:0 0 0 1px rgba(0,0,0,.03) inset;
        --border-weak:rgba(0,0,0,.10);
        --card-shadow:0 14px 28px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04) inset, 0 0 0 1px rgba(89,217,179,.16);
      `}
      --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
      --radius-outer:8px; --control-h:40px; --header-h:80px;
      --fz-title:18px; --fz-label:12.5px; --lh-body:1.45; --ease:cubic-bezier(.22,.61,.36,1);
      --app-sidebar-w:240px; --rail-w:260px; --green-weak:rgba(89,217,179,.12);
      --vs-menu-bg: var(--panel-bg); --vs-menu-border: var(--border-weak);
      --vs-input-bg: var(--input-bg); --vs-input-border: var(--input-border);
    }
    .va-root{animation:vaPageIn 380ms var(--ease) both; background:var(--page-bg);}
    .va-card{border-radius:8px;border:1px solid var(--border-weak);background:var(--panel-bg);box-shadow:var(--card-shadow);overflow:hidden}
    .va-head{min-height:var(--header-h);display:grid;grid-template-columns:1fr auto;align-items:center;padding:0 16px;border-bottom:1px solid var(--border-weak)}
    .va-cta{box-shadow:0 10px 22px rgba(89,217,179,.28)}
    @keyframes vaPageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  `}</style>
);

/* OpenAI logo */
function OpenAIStamp({size=14}:{size?:number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M37.532 16.37a8.9 8.9 0 00-.77-7.3 8.96 8.96 0 00-11.87-3.42A8.99 8.99 0 007.53 9.63a8.9 8.9 0 00.77 7.3 8.96 8.96 0 0011.87 3.42 8.99 8.99 0 0017.36-3.99z" fill="currentColor" opacity=".18"/>
      <path d="M20.5 6.5l-8 4.6v9.3l8 4.6 8-4.6v-9.3l-8-4.6z" fill="currentColor" />
    </svg>
  );
}
const PhoneFilled = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...props} aria-hidden>
    <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.03-.24c1.12.37 2.33.57 3.56.57a1 1 0 011 1v3.5a1 1 0 01-1 1C11.3 22 2 12.7 2 2.99a1 1 0 011-1H6.5a1 1 0 011 1c0 1.23.2 2.44.57 3.56a1 1 0 01-.24 1.03l-2.2 2.2z" fill="currentColor"/>
  </svg>
);

/* ───────── types ───────── */
type ApiKey = { id: string; name: string; key?: string };
type PhoneNum = { id: string; name: string; number: string };
type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
  firstMsg: string;
  firstMsgs?: string[];
  greetPick?: 'sequence'|'random';
  systemPrompt: string;
  systemPromptBackend?: string;
  language: 'English'|'Dutch'|'German'|'Spanish'|'Arabic';
  contextText?: string;
  ctxFiles?: { name:string; text:string }[];
  ttsProvider: 'openai' | 'elevenlabs' | 'google-tts';
  voiceName: string;
  apiKeyId?: string;
  phoneId?: string;
  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrModel: string;
  denoise: boolean;
  numerals: boolean;
};

/* ───────── defaults ───────── */
const PROMPT_SKELETON = `[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

const looksLikeFullPromptRT = (raw: string) => isFn(_looksLikeFullPrompt) ? !!_looksLikeFullPrompt(raw) : false;
const normalizeFullPromptRT = (raw: string) => isFn(_normalizeFullPrompt) ? coerceStr(_normalizeFullPrompt(raw)) : raw;
const DEFAULT_PROMPT_RT = nonEmpty(_DEFAULT_PROMPT) ? _DEFAULT_PROMPT! : PROMPT_SKELETON;

const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'gpt-4o',
  firstMode: 'User speaks first',
  firstMsg: '',
  firstMsgs: [],
  greetPick: 'sequence',
  systemPrompt:
    (normalizeFullPromptRT(`
[Identity]
- You are a helpful, professional AI assistant for this business.

[Style]
- Clear, concise, friendly.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.

[Task & Goals]
- Guide users to their next best action (booking, purchase, or escalation).

[Error Handling / Fallback]
- If unsure, ask a specific clarifying question first.`).trim()),
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

/* ───────── storage helpers ───────── */
const IS_BROWSER = typeof window !== 'undefined';
const loadAgentData = (id: string): AgentData => {
  try {
    const raw = IS_BROWSER ? localStorage.getItem(keyFor(id)) : null;
    if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) };
  } catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try { if (IS_BROWSER) localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
};

/* ───────── backend stubs ───────── */
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

/* ───────── option helpers ───────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string; iconLeft?: React.ReactNode };
const providerOpts: Opt[] = [
  { value: 'openai',     label: 'OpenAI',    iconLeft: <OpenAIStamp size={14} /> },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true },
  { value: 'google',     label: 'Google — coming soon',    disabled: true },
];
function modelFamilyKey(v: string){
  const s = v.toLowerCase();
  if (s.startsWith('o4')) return '4';
  const m = s.match(/^gpt-(\d+)/); if (m) return m[1];
  const m2 = s.match(/^(\d)\D/);   return m2 ? m2[1] : 'other';
}
function filterModelsForUI(all: Array<{ value: string; label: string }>) {
  const seen: Record<string, number> = {};
  const out: typeof all = [];
  for (const m of all) {
    const fam = modelFamilyKey(m.value);
    const cap = fam === '4' ? 5 : 3;
    const n = seen[fam] ?? 0;
    if (n < cap) { out.push(m); seen[fam] = n + 1; }
  }
  return out;
}

/** models list (static list UI; you can later fetch per key) */
function useOpenAIModels(selectedKeyId?: string){
  const [opts] = useState<Opt[]>(
    filterModelsForUI([
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
    ])
  );
  return { opts, loading:false };
}

/* ───────── File helpers (bundle-safe) ───────── */
async function readFileAsText(f: File): Promise<string> {
  const name = f.name.toLowerCase();

  const looksZip = async () => {
    const buf = new Uint8Array(await f.slice(0,4).arrayBuffer());
    return buf[0]===0x50 && buf[1]===0x4b; // PK..
  };

  if (name.endsWith('.docx') || name.endsWith('.docs') || await looksZip()) {
    try {
      const JSZip = await loadJSZip();
      const buf = await f.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const docXml = await zip.file('word/document.xml')?.async('string');
      if (!docXml) return '';

      const text = docXml
        .replace(/<w:p[^>]*>/g,'\n')
        .replace(/<w:tab\/>/g,'\t')
        .replace(/<w:br\/>/g,'\n')
        .replace(/<(.|\n)*?>/g,'')
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      return text.trim();
    } catch {
      return '';
    }
  }

  if (name.endsWith('.doc')) {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      let out = '', run:number[]=[];
      const flush = () => { if (run.length >= 3) out += String.fromCharCode(...run) + '\n'; run = []; };
      for (const b of buf) { if (b >= 32 && b <= 126) run.push(b); else flush(); }
      flush();
      return out.trim();
    } catch { return ''; }
  }

  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Read failed'));
    r.onload = () => res(String(r.result || ''));
    r.readAsText(f);
  });
}

/* ───────── Import helpers ───────── */
function deelWebsiteToBuckets(raw: string){
  const text = (raw || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const lower = text.toLowerCase();
  const pick = (re: RegExp, take = 1600) => {
    const m = lower.match(re);
    if (!m) return '';
    const i = Math.max(0, m.index || 0);
    return text.slice(i, i + take).trim();
  };

  const identity = [
    pick(/\b(about us|about|who we are|our story|mission|vision|values)\b/),
    pick(/\b(team|leadership|founders)\b/),
  ].filter(Boolean).join('\n\n');

  const services = pick(/\b(services|what we do|products|solutions|offerings)\b/);
  const contact  = pick(/\b(contact|get in touch|address|email|phone)\b/);

  const sponsors = pick(/\b(sponsors?|partners?|our partners|supported by)\b/);

  const other = text;

  return { identity: identity || '', services: services || '', contact: contact || '', sponsors: sponsors || '', other: other || '' };
}

function buildPromptFromWebsite(raw: string, basePrompt: string){
  const b = deelWebsiteToBuckets(raw);
  const blocks: string[] = [];
  if (b.identity)  blocks.push(`[Identity]\n${b.identity}`);
  if (b.services)  blocks.push(`[Services]\n${b.services}`);
  if (b.contact)   blocks.push(`[Contact]\n${b.contact}`);
  if (b.sponsors)  blocks.push(`[Sponsors]\n${b.sponsors}`);
  if (b.other)     blocks.push(`[Context]\n${b.other.slice(0, 4000)}`);

  const base = nonEmpty(basePrompt) ? basePrompt : DEFAULT_PROMPT_RT;
  return [base, ...blocks].join('\n\n').trim();
}

/* ───────── API key import (hardened) ───────── */
function normalizeApiKeyList(anyVal:any): ApiKey[] {
  if (!anyVal) return [];
  try {
    if (Array.isArray(anyVal)) {
      return anyVal.map((k:any)=>({
        id:String(k?.id ?? k?._id ?? k?.keyId ?? k?.name ?? '').trim(),
        name:String(k?.name ?? k?.label ?? k?.title ?? 'Key').trim(),
        key:k?.key?'••••':(k?.secret||k?.value?'••••':undefined)
      })).filter(k=>k.id && k.name);
    }
    if (typeof anyVal === 'string' && anyVal.trim().length > 10) {
      return [{ id:'default', name:'My OpenAI Key', key:'••••' }];
    }
    if (typeof anyVal === 'object') {
      const maybe = anyVal?.key || anyVal?.openai?.key || anyVal?.openai_key || anyVal?.OPENAI_API_KEY;
      if (typeof maybe === 'string' && maybe.trim().length > 10) {
        return [{ id:'default', name:'My OpenAI Key', key:'••••' }];
      }
    }
  } catch {}
  return [];
}

async function loadApiKeysEverywhere(setter:(list:ApiKey[], selectedId:string)=>void, currentSelected?:string){
  let merged: ApiKey[] = [];
  try {
    const store = await scopedStorage().catch(() => null);
    if (store) {
      store.ensureOwnerGuard?.().catch(() => {});
      const v1     = normalizeApiKeyList(await store.getJSON('apiKeys.v1', []).catch(() => []));
      const legacy = normalizeApiKeyList(await store.getJSON('apiKeys', []).catch(() => []));
      const c1     = normalizeApiKeyList(await store.getJSON('credentials.apiKeys', []).catch(() => []));
      const c2     = normalizeApiKeyList(await store.getJSON('openai.apiKeys', []).catch(() => []));
      const c3     = normalizeApiKeyList(await store.getJSON('keys.openai', []).catch(() => []));
      merged = [v1, legacy, c1, c2, c3].find(a => a.length) || [];

      if (!merged.length) {
        try {
          const candidates = [
            'credentials.apiKeys','openai.apiKeys','keys.openai',
            'openai.apiKey','openai_key','apiKey','OPENAI_API_KEY'
          ];
          for (const k of candidates) {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            let parsed:any = null;
            try { parsed = JSON.parse(raw); } catch { parsed = raw; }
            const norm = normalizeApiKeyList(parsed);
            if (norm.length) { merged = norm; break; }
          }
        } catch {}
      }

      const globalSelected = await store.getJSON<string>('apiKeys.selectedId', '').catch(() => '');
      const chosenId =
        (currentSelected && merged.some(k => k.id === currentSelected)) ? currentSelected :
        (globalSelected && merged.some(k => k.id === globalSelected)) ? globalSelected :
        (merged[0]?.id || '');

      setter(merged, chosenId);
      if (chosenId && chosenId !== globalSelected) {
        try { await store.setJSON('apiKeys.selectedId', chosenId); } catch {}
      }
      return;
    }
  } catch {}

  try {
    const r = await fetch('/api/credentials').catch(()=>null as any);
    const j = await r?.json().catch(()=>null as any);
    const list = normalizeApiKeyList(j?.apiKeys || j);
    if (list?.length) {
      const chosenId = currentSelected && list.some(k=>k.id===currentSelected) ? currentSelected : (list[0].id);
      setter(list, chosenId);
      return;
    }
  } catch {}
  setter([], '');
}

/* ───────── Page ───────── */
export default function VoiceAgentSection() {
  /* Theme */
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    if (!IS_CLIENT) return 'dark';
    try {
      const keys = ['account.theme', 'app.theme', 'theme'];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v === 'light' || v === 'dark') return v;
      }
      const ds = document.documentElement.dataset.theme;
      if (ds === 'light' || ds === 'dark') return ds;
    } catch {}
    return 'dark';
  });
  useEffect(() => {
    if (!IS_CLIENT) return;
    const apply = (t:'light'|'dark') => { document.documentElement.dataset.theme = t; setTheme(t); };
    apply(theme);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (['account.theme','app.theme','theme'].includes(e.key)) {
        const v = e.newValue || '';
        if (v === 'light' || v === 'dark') apply(v);
      }
    };
    const onThemeEvt = (e: Event) => {
      const t = (e as CustomEvent<'light'|'dark'>).detail;
      if (t === 'light' || t === 'dark') apply(t);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('account:theme', onThemeEvt as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('account:theme', onThemeEvt as EventListener);
    };
  }, []); // eslint-disable-line

  /* sidebar width sync */
  useEffect(() => {
    if (!IS_CLIENT) return;
    const candidates = ['[data-app-sidebar]','aside[aria-label="Sidebar"]','aside[class*="sidebar"]','#sidebar'];
    const el = document.querySelector<HTMLElement>(candidates.join(', '));
    const setW = (w:number) => document.documentElement.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    if (!el) { setW(240); return; }
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.getBoundingClientRect().width;
      setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Generate / typed diff flow
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [isTypingIntoPrompt, setIsTypingIntoPrompt] = useState(false);
  const [diffCandidate, setDiffCandidate] = useState<string>('');
  const basePromptRef = useRef<string>('');
  const typingRef = useRef<number | null>(null);

  // Website import overlay
  const [showImport, setShowImport] = useState(false);
  const [urlsText, setUrlsText] = useState('');
  const [importing, setImporting] = useState(false);

  // models list
  const { opts: openaiModels, loading: loadingModels } = useOpenAIModels(data.apiKeyId || undefined);

  // voice preview via speechSynthesis
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!IS_CLIENT || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    (window.speechSynthesis as any).onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);
  function speakPreview(line?: string){
    if (!IS_CLIENT || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(line || `Hi, I'm ${data.name || 'your assistant'}. This is a preview.`);
    const byName = voices.find(v => v.name.toLowerCase().includes((data.voiceName || '').split(' ')[0]?.toLowerCase() || ''));
    const en = voices.find(v => v.lang?.startsWith('en'));
    if (byName) u.voice = byName; else if (en) u.voice = en;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  }
  const stopPreview = () => { if (IS_CLIENT && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };

  /* listen for active rail id */
  useEffect(() => {
    if (!IS_CLIENT) return;
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { if (IS_CLIENT) localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  useEffect(() => { if (activeId) saveAgentData(activeId, data); }, [activeId, data]);

  const [credsTick, setCredsTick] = useState(0);
  useEffect(() => {
    if (!IS_CLIENT) return;
    const onCredsUpdated = () => setCredsTick(t=>t+1);
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.toLowerCase().includes('apikey')) onCredsUpdated(); };
    window.addEventListener('credentials:updated', onCredsUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('credentials:updated', onCredsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // load keys + phones
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadApiKeysEverywhere((list, selectedId) => {
          if (!mounted) return;
          setApiKeys(list);
          if (selectedId && selectedId !== data.apiKeyId) setData(prev => ({ ...prev, apiKeyId: selectedId }));
        }, data.apiKeyId);
      } catch {
        if (mounted) setApiKeys([]);
      }

      try {
        const store = await scopedStorage().catch(() => null);
        if (!mounted) return;
        if (!store) { setPhoneNumbers([]); return; }

        store.ensureOwnerGuard?.().catch(() => {});
        const phoneV1 = await store.getJSON<PhoneNum[]>(PHONE_LIST_KEY_V1, []).catch(() => []);
        const phoneLegacy = await store.getJSON<PhoneNum[]>(PHONE_LIST_KEY_LEG, []).catch(() => []);
        const phonesMerged = Array.isArray(phoneV1) && phoneV1.length ? phoneV1
                             : Array.isArray(phoneLegacy) ? phoneLegacy : [];
        const phoneCleaned = phonesMerged
          .filter(Boolean)
          .map((p: any) => ({ id: String(p?.id || ''), name: String(p?.name || ''), number: String(p?.number || p?.phone || '') }))
          .filter(p => p.id && (p.number || p.name));

        setPhoneNumbers(phoneCleaned);

        const selPhone = await store.getJSON<string>(PHONE_SELECTED_ID, '').catch(() => '');
        const chosenPhoneId =
          (data.phoneId && phoneCleaned.some(p => p.id === data.phoneId)) ? data.phoneId! :
          (selPhone && phoneCleaned.some(p => p.id === selPhone)) ? selPhone :
          (phoneCleaned[0]?.id || '');

        if (chosenPhoneId && chosenPhoneId !== data.phoneId) {
          setData(prev => ({ ...prev, phoneId: chosenPhoneId }));
          await store.setJSON(PHONE_SELECTED_ID, chosenPhoneId).catch(() => {});
        }
      } catch {
        if (!mounted) return;
        setPhoneNumbers([]);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line
  }, [credsTick]);

  function setField<K extends keyof AgentData>(k: K) {
    return (v: AgentData[K]) => setData(prev => ({ ...prev, [k]: v }));
  }

  // keep backend prompt synced when user types
  useEffect(() => {
    if (!data.systemPrompt) return;
    try {
      const compiled = compilePrompt({ basePrompt: sanitizePrompt(data.systemPrompt), userText: '' });
      if (compiled?.backendString && compiled.backendString !== data.systemPromptBackend) {
        setData(p => ({ ...p, systemPromptBackend: sanitizePrompt(compiled.backendString) }));
      }
    } catch {}
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
    } catch {
      setToastKind('error'); setToast('Save failed');
    } finally { setSaving(false); setTimeout(()=>setToast(''), 1400); }
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

  // Import files → prompt (typed diff)
  const importFilesIntoPrompt = async () => {
    const ctx  = sanitizePrompt((data.contextText || '').trim());
    const base = sanitizePrompt((data.systemPromptBackend || data.systemPrompt || DEFAULT_PROMPT_RT).trim());
    const next = ctx ? `${base}\n\n[Context]\n${ctx}`.trim() : base;

    basePromptRef.current = sanitizePrompt(data.systemPrompt || DEFAULT_PROMPT_RT);
    setShowGenerate(false);
    await sleep(80);

    setIsTypingIntoPrompt(true);
    setDiffCandidate('');
    if (typingRef.current) cancelAnimationFrame(typingRef.current as any);

    let i = 0;
    const step = () => {
      i += Math.max(1, Math.round(next.length / 140));
      setDiffCandidate(next.slice(0, i));
      if (i < next.length) typingRef.current = requestAnimationFrame(step);
    };
    typingRef.current = requestAnimationFrame(step);

    // precompile backend for faster accept
    try {
      const compiled = compilePrompt({ basePrompt: next, userText: '' });
      setField('systemPromptBackend')(sanitizePrompt(compiled.backendString));
    } catch {}
  };

  /* Generate → type inside the prompt box with Accept/Decline diff */
  const startTypingIntoPrompt = async (targetText:string) => {
    basePromptRef.current = sanitizePrompt(data.systemPrompt || DEFAULT_PROMPT_RT);
    setIsTypingIntoPrompt(true);
    setDiffCandidate('');
    if (typingRef.current) cancelAnimationFrame(typingRef.current as any);
    let i = 0;
    const step = () => {
      i += Math.max(1, Math.round(targetText.length / 140));
      const slice = targetText.slice(0, i);
      setDiffCandidate(slice);
      if (i < targetText.length) typingRef.current = requestAnimationFrame(step);
    };
    typingRef.current = requestAnimationFrame(step);
  };
  const acceptGenerated = () => {
    const chosen = sanitizePrompt((diffCandidate || data.systemPrompt).replace(/\u200b/g,''));
    setField('systemPrompt')(chosen);
    try {
      const compiled = compilePrompt({ basePrompt: chosen, userText: '' });
      setField('systemPromptBackend')(sanitizePrompt(compiled.backendString));
    } catch {}
    setIsTypingIntoPrompt(false);
    setDiffCandidate('');
  };
  const declineGenerated = () => { setIsTypingIntoPrompt(false); setDiffCandidate(''); };

  /* call model */
  const callModel = useMemo(() => {
    const m = (data.model || '').toLowerCase();
    if (m.includes('realtime')) return data.model;
    return 'gpt-4o-realtime-preview';
  }, [data.model]);

  const selectedModelLabel = useMemo(() => {
    const found = openaiModels.find(o => o.value === data.model);
    return found?.label || data.model || '—';
  }, [openaiModels, data.model]);

  const [justAddedIndex, setJustAddedIndex] = useState<number | null>(null);
  const addFirstMessage = () => {
    const next = [...(data.firstMsgs||[])];
    if (next.length >= 20) return;
    next.push('');
    setField('firstMsgs')(next);
    setJustAddedIndex(next.length - 1);
    setTimeout(()=>setJustAddedIndex(null), 260);
  };

  const langToHint = (lang: AgentData['language']): 'en'|'nl'|'de'|'es'|'ar' => {
    switch (lang) { case 'Dutch': return 'nl'; case 'German': return 'de'; case 'Spanish': return 'es'; case 'Arabic': return 'ar'; default: return 'en'; }
  };
  const greetingJoined = useMemo(() => {
    const list = (data.greetPick==='random'
      ? [...(data.firstMsgs||[])].filter(Boolean).sort(()=>Math.random()-0.5)
      : (data.firstMsgs||[]).filter(Boolean)
    );
    let s = list.join('\n').trim();
    if (data.firstMode === 'Assistant speaks first' && !s) s = 'Hello! How can I help you today?';
    return s;
  }, [data.greetPick, data.firstMsgs, data.firstMode]);

  const hasApiKey = !!data.apiKeyId;

  return (
    <section className="va-root">
      <Tokens theme={theme} />

      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid var(--border-weak)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]" style={{ fontSize:'14px', lineHeight:1.45, color:'var(--text)' }}>
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

            <div className="mr-auto text-xs opacity-70 pl-1">
              Model selected: <span className="opacity-100">{selectedModelLabel}</span>
            </div>

            <button
              onClick={()=>{
                if (!hasApiKey) {
                  setToastKind('error'); setToast('Add your own OpenAI API key in Credentials.');
                  setTimeout(()=>setToast(''), 2600);
                  return;
                }
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
              <Lock className="w-4 h-4" /> No API key selected. Each user must add their own key in <b>&nbsp;Credentials&nbsp;</b>.
            </div>
          )}

          {/* Model */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the model, assistant name, greetings, and language."
            defaultOpen
          >
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
                <StyledSelect value={data.provider} onChange={(v)=>setField('provider')(v as AgentData['provider'])} options={providerOpts}
                  placeholder="Choose a provider" />
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
                      setField('firstMsg')((next[0]||''));
                    }}
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
                    onClick={()=>{ setComposerText(''); setShowGenerate(true); }}
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

              <div className="relative">
                {!isTypingIntoPrompt ? (
                  <textarea
                    className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[10px]"
                    style={{ minHeight: 320, background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}
                    value={data.systemPrompt}
                    onChange={(e)=> setField('systemPrompt')(sanitizePrompt(e.target.value))}
                  />
                ) : (
                  <PromptDiffTyping
                    base={basePromptRef.current}
                    next={diffCandidate || data.systemPrompt}
                    onAccept={acceptGenerated}
                    onDecline={declineGenerated}
                  />
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
          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose TTS, language, and preview the voice."
            defaultOpen
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Voice Provider</div>
                <StyledSelect
                  value={data.ttsProvider}
                  onChange={(v)=>setField('ttsProvider')(v as AgentData['ttsProvider'])}
                  options={[
                    { value: 'openai', label: 'OpenAI', iconLeft: <OpenAIStamp size={14} /> },
                    { value: 'elevenlabs', label: 'ElevenLabs — coming soon', disabled: true },
                    { value: 'google-tts', label: 'Google TTS — coming soon', disabled: true },
                  ]}
                />
                <div className="mt-2 text-xs" style={{ color:'var(--text-muted)' }}>
                  Only OpenAI is available right now.
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={(v)=>setField('voiceName')(v)}
                  options={[
                    { value: 'Alloy (American)', label: 'Alloy' },
                    { value: 'Verse (American)', label: 'Verse' },
                    { value: 'Coral (British)', label: 'Coral' },
                    { value: 'Amber (Australian)', label: 'Amber' },
                  ]}
                  placeholder="— Choose —"
                  disabled={data.ttsProvider !== 'openai'}
                  menuTop={
                    <div className="flex items-center justify-between px-3 py-2 rounded-[8px]"
                         style={{ background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}
                    >
                      <div className="text-xs" style={{ color:'var(--text-muted)' }}>Preview</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={()=>speakPreview(`This is ${data.voiceName || 'the selected'} voice preview.`)}
                          className="w-8 h-8 rounded-full grid place-items-center"
                          aria-label="Play voice"
                          style={{ background: data.ttsProvider !== 'openai' ? 'rgba(0,0,0,.08)' : CTA, color:'#0a0f0d', opacity: data.ttsProvider !== 'openai' ? .6 : 1, pointerEvents: data.ttsProvider !== 'openai' ? 'none' : 'auto' }}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={stopPreview}
                          className="w-8 h-8 rounded-full grid place-items-center border"
                          aria-label="Stop preview"
                          style={{ background: 'var(--panel-bg)', color:'var(--text)', borderColor:'var(--border-weak)', opacity: data.ttsProvider !== 'openai' ? .6 : 1, pointerEvents: data.ttsProvider !== 'openai' ? 'none' : 'auto' }}
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  }
                />
              </div>
            </div>
          </Section>

          {/* Credentials */}
          <Section
            title="Credentials"
            icon={<Phone className="w-4 h-4" style={{ color: CTA }} />}
            desc="Each user selects their own OpenAI API key. Keys are not shared."
            defaultOpen
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 opacity-80" /> OpenAI API Key
                </div>
                <StyledSelect
                  value={data.apiKeyId || ''}
                  onChange={async (val)=>{
                    setField('apiKeyId')(val);
                    try { const store = await scopedStorage(); await store.ensureOwnerGuard?.(); await store.setJSON(LS_SELECTED, val); } catch {}
                  }}
                  options={[
                    { value: '', label: 'Select your API key…', iconLeft: <OpenAIStamp size={14} /> },
                    ...apiKeys.map(k=>({ value: k.id, label: k.name, iconLeft: <OpenAIStamp size={14} /> }))
                  ]}
                  leftIcon={<OpenAIStamp size={14} />}
                />
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  The realtime call uses only the key ID; the server resolves the secret.
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12.5px]">Phone Number</div>
                <StyledSelect
                  value={data.phoneId || ''}
                  onChange={async (val)=>{
                    setField('phoneId')(val);
                    try { const store = await scopedStorage(); await store.ensureOwnerGuard?.(); await store.setJSON(PHONE_SELECTED_ID, val); } catch {}
                  }}
                  options={[
                    { value: '', label: 'Select a phone number…' },
                    ...phoneNumbers.map(p => ({ value: p.id, label: `${p.name ? `${p.name} • ` : ''}${p.number}` }))
                  ]}
                />
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Imported from your Phone Number section. Manage numbers there.
                </div>
              </div>
            </div>
          </Section>

          {/* Transcriber */}
          <Section
            title="Transcriber"
            icon={<Mic className="w-4 h-4" style={{ color: CTA }} />}
            desc="Transcription settings"
            defaultOpen
          >
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
                  options={
                    data.asrProvider === 'deepgram'
                      ? [{ value: 'Nova 2', label: 'Nova 2' }, { value: 'Nova', label: 'Nova' }]
                      : [{ value: 'coming', label: 'Models coming soon', disabled: true }]
                  }
                />
              </div>
            </div>
          </Section>

          <div style={{ height: 72 }} />
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerate && IS_CLIENT ? createPortal(
        <GeneratePromptModal
          open={showGenerate}
          value={composerText}
          onChange={setComposerText}
          onCancel={()=> setShowGenerate(false)}
          onGenerate={async () => {
            const raw = safeTrim(composerText);
            if (!raw) return;
            try {
              const base = nonEmpty(data.systemPrompt) ? sanitizePrompt(data.systemPrompt) : DEFAULT_PROMPT_RT;
              const compiled = compilePrompt({ basePrompt: base, userText: raw });
              setField('systemPromptBackend')(sanitizePrompt(compiled.backendString));
              setShowGenerate(false);
              await sleep(80);
              await startTypingIntoPrompt(sanitizePrompt(compiled.frontendText));
            } catch {
              setToastKind('error'); setToast('Generate failed — try simpler wording.');
              setTimeout(()=>setToast(''), 2200);
            }
          }}
        />,
        document.body
      ) : null}

      {/* Import website modal */}
      {showImport && IS_CLIENT ? createPortal(
        <ImportWebsiteModal
          open={showImport}
          value={urlsText}
          importing={importing}
          onChange={setUrlsText}
          onCancel={()=> setShowImport(false)}
          onImport={async ()=>{
            const list = urlsText.split(/\s+/).map(s=>s.trim()).filter(Boolean);
            if (!list.length) return;
            setImporting(true);
            try {
              // Use your API: POST /api/connectors/website-import → { ok, facts: string[] }
              const allFacts: string[] = [];
              for (const u of list) {
                try {
                  const r = await fetch('/api/connectors/website-import', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ url: u })
                  });
                  const j = r.ok ? await r.json().catch(()=>null) : null;
                  const facts: string[] = Array.isArray(j?.facts) ? j.facts : [];
                  if (facts.length) {
                    allFacts.push(`# Source: ${u}`, ...facts.map(s => `- ${s}`));
                  }
                } catch {}
              }

              let merged = allFacts.join('\n');
              if (!merged.trim()) merged = `# Sources\n${list.map(u=>`- ${u}`).join('\n')}\n\n(No obvious facts extracted.)`;

              const base = sanitizePrompt((data.systemPromptBackend || data.systemPrompt || DEFAULT_PROMPT_RT).trim());
              const next = buildPromptFromWebsite(merged.trim(), base);

              setShowImport(false);
              await sleep(80);
              await startTypingIntoPrompt(next);
              try {
                const compiled = compilePrompt({ basePrompt: next, userText: '' });
                setField('systemPromptBackend')(sanitizePrompt(compiled.backendString));
              } catch {}
              setToastKind('info'); setToast('Imported website content into the prompt'); setTimeout(()=>setToast(''), 1500);
            } finally {
              setImporting(false);
            }
          }}
        />,
        document.body
      ) : null}

      {/* Voice/Call overlay */}
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
              apiKeyId={data.apiKeyId || undefined}
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
        <div
          className="fixed bottom-4 right-4 rounded-[8px] px-3 py-2 text-sm"
          style={{
            zIndex: 100050,
            background: toastKind==='error' ? 'rgba(239,68,68,.14)' : 'rgba(89,217,179,.12)',
            color: 'var(--text)',
            border: `1px solid ${toastKind==='error' ? 'rgba(239,68,68,.30)' : GREEN_LINE}`,
            boxShadow: '0 10px 24px rgba(0,0,0,.18)'
          }}
        >
          {toast}
        </div>
      )}
    </section>
  );
}

/* ───────── Section ───────── */
function Section({
  title, icon, desc, children, defaultOpen = true
}:{
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
          style={{
            height: open ? h : 0, opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'height 260ms var(--ease), opacity 230ms var(--ease), transform 260ms var(--ease)',
            overflow:'hidden'
          }}
          onTransitionEnd={() => { if (open) measure(); }}
        >
          <div ref={innerRef} className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
