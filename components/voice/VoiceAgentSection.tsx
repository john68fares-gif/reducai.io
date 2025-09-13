// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  Bot, Plus, Trash2, Edit3, Check, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  FileText, Sparkles, RefreshCw, X, MessageSquare, Copy, ChevronDown, KeyRound,
  Phone as PhoneIcon, Phone, PhoneOff
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* =============================================================================
   Shared look (matches pages/api-keys.tsx)
============================================================================= */
const FRAME: React.CSSProperties = {
  background: 'var(--frame-bg, var(--panel))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--frame-shadow, var(--shadow-soft))',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: 'var(--card-bg, var(--card))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--card-shadow, var(--shadow-card))',
  borderRadius: 20,
};
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

/* =============================================================================
   Types / storage shapes
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type Assistant = {
  id: string;
  name: string;
  updatedAt: number;
  config: {
    model: {
      provider: Provider;
      model: ModelId;
      temperature?: number;
      firstMessageMode: 'assistant_first' | 'user_first';
      firstMessage: string;
      systemPrompt: string;
    };
  };
};
type StoredKey = { id: string; name: string; key: string };
type PhoneNum = { id: string; e164?: string; label?: string; provider?: string; status?: string };

const LS_CHATBOTS = 'chatbots';
const CLOUD_CHATBOTS = 'chatbots.v1';
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

const normalizeAssistant = (a: any): Assistant => ({
  id: String(a?.assistantId || a?.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now())),
  name: String(a?.name || 'Untitled Assistant'),
  updatedAt:
    Number(a?.updatedAt) ||
    Date.parse(a?.updatedAt || a?.createdAt || '') ||
    Date.now(),
  config: {
    model: {
      provider: (a?.provider as Provider) || 'openai',
      model: (a?.model as ModelId) || 'gpt-4o',
      temperature: typeof a?.temperature === 'number' ? a.temperature : 0.5,
      firstMessageMode: (a?.firstMessageMode as any) || 'assistant_first',
      firstMessage: String(a?.firstMessage || 'Hello.'),
      systemPrompt: String(a?.prompt || a?.systemPrompt || ''),
    },
  },
});
const sortNewest = (arr: Assistant[]) => arr.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
const mergeNewest = (a: Assistant[], b: Assistant[]) => {
  const map = new Map<string, Assistant>();
  const put = (x: Assistant) => {
    const id = x.id;
    const old = map.get(id);
    if (!old || x.updatedAt > old.updatedAt) map.set(id, x);
  };
  a.forEach(put); b.forEach(put);
  return sortNewest([...map.values()]);
};

/* =============================================================================
   Diff typing renderer
============================================================================= */
type Tok = { ch: string; added: boolean; removed?: boolean };
function charDiff(oldStr: string, newStr: string): Tok[] {
  const o = [...oldStr], n = [...newStr];
  const dp = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--)
    for (let j = n.length - 1; j >= 0; j--)
      dp[i][j] = o[i] === n[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Tok[] = []; let i = 0, j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { out.push({ ch: n[j], added: false }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ ch: o[i], added: false, removed: true }); i++; }
    else { out.push({ ch: n[j], added: true }); j++; }
  }
  while (i < o.length) { out.push({ ch: o[i], added: false, removed: true }); i++; }
  while (j < n.length) { out.push({ ch: n[j], added: true }); j++; }
  return out;
}

/* =============================================================================
   Rail alignment: read your app sidebar width so the rail touches it
============================================================================= */
function useAppSidebarWidth(scopeRef: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const scope = scopeRef.current; if (!scope) return;
    const setVar = (w: number) => scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    const find = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) ||
      null;
    let el = find();
    if (!el) { setVar(248); return; }
    setVar(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(() => setVar(el!.getBoundingClientRect().width));
    ro.observe(el);
    const onEnd = () => setVar(el!.getBoundingClientRect().width);
    el.addEventListener('transitionend', onEnd);
    return () => { ro.disconnect(); el.removeEventListener('transitionend', onEnd); };
  }, [scopeRef]);
}

/* =============================================================================
   InlineSelect (API Keys & Numbers) — same feel as api-keys
============================================================================= */
function InlineSelect({
  value, onChange, options, placeholder = '— Choose —', left,
}: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string; sub?: string }>;
  placeholder?: string; left?: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [q, setQ] = useState('');
  const sel = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return options;
    return options.filter(o => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(s));
  }, [options, q]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 8, left: r.left, width: r.width });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 h-[46px] rounded-[14px] text-sm outline-none transition hover:-translate-y-[1px]"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--chip-shadow, none)' }}
      >
        <span className="flex items-center gap-2 truncate">{left}</span>
        <span className="flex-1 text-left truncate">
          {sel ? (<>{sel.label}{sel.sub ? <span className="ml-2" style={{ color: 'var(--text-muted)' }}>••••{sel.sub}</span> : null}</>)
            : <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>}
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && (
        <div ref={portalRef} className="fixed z-[9999] p-3 animate-[fadeIn_120ms_ease-out]"
             style={{ ...CARD, left: rect.left, top: rect.top, width: rect.width }}>
          <div className="mb-2 flex items-center gap-2 rounded-[10px] px-2 py-1"
               style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <Search className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <input className="bg-transparent outline-none text-sm w-full" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filtered.map(o => (
              <button key={o.value || o.label} onClick={() => { onChange(o.value); setOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 hover:bg-[rgba(0,255,194,.10)]">
                <span className="flex-1 truncate">{o.label}</span>
                {o.sub && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>••••{o.sub}</span>}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No items.</div>}
          </div>
        </div>
      )}
    </>
  );
}

/* =============================================================================
   Assistant Rail — flush with main sidebar
============================================================================= */
function AssistantRail({
  items, activeId, onSelect, onCreate, onRename, onDelete,
}: {
  items: Assistant[]; activeId: string;
  onSelect: (id: string) => void; onCreate: () => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  useAppSidebarWidth(scopeRef);
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState('');
  const visible = useMemo(() => items.filter(a => a.name.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);

  return (
    <div ref={scopeRef}>
      <aside
        className="hidden lg:flex flex-col"
        style={{
          position: 'fixed',
          left: 'var(--app-sidebar-w, 248px)',   // ← touches your main app sidebar
          top: 64,
          width: collapsed ? 68 : 320,
          height: 'calc(100vh - 64px)',
          ...CARD,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          borderRight: '1px solid var(--border)',
          zIndex: 10,
          padding: 12,
        }}
      >
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            {!collapsed && <span>Assistants</span>}
          </div>
          <div className="flex items-center gap-2">
            {!collapsed && (
              <button onClick={onCreate}
                      className="inline-flex items-center gap-2 px-3 h-[36px] rounded-[12px] text-sm"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <Plus className="w-4 h-4" /> New
              </button>
            )}
            <button onClick={() => setCollapsed(v => !v)}
                    className="inline-flex items-center gap-2 px-3 h-[36px] rounded-[12px] text-sm"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                    title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="mt-3 flex items-center gap-2 rounded-[14px] px-3 h-[40px]"
                 style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Search className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <input className="bg-transparent outline-none text-sm w-full" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
            </div>

            <div className="mt-3 space-y-2 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {visible.map(a => {
                const isActive = a.id === activeId;
                return (
                  <div key={a.id} className="p-3 rounded-[14px] transition"
                       style={{
                         ...CARD,
                         borderColor: isActive ? 'var(--brand-weak)' : 'var(--border)',
                         background: isActive ? 'color-mix(in oklab, var(--brand) 10%, var(--card))' : undefined
                       }}>
                    <button className="w-full text-left flex items-center gap-2" onClick={() => onSelect(a.id)}>
                      <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{a.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {new Date(a.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                    </button>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => {
                          const n = prompt('Rename assistant', a.name) || a.name;
                          onRename(a.id, (n || '').trim() || 'Untitled');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Rename
                      </button>
                      <button
                        onClick={() => onDelete(a.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs"
                        style={{ background: 'rgba(220,38,38,.10)', border: '1px solid rgba(220,38,38,.28)', color: '#fda4af' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* =============================================================================
   Main section — wider editor; keys + numbers imported like StepV2Telephony
============================================================================= */
export default function VoiceAgentSection({
  onStartCall,
  onStopCall,
}: {
  onStartCall?: (args: {
    apiKey: string; phoneFrom: string; prompt: string; firstMessage: string; model: string; temperature: number;
  }) => Promise<void> | void;
  onStopCall?: () => Promise<void> | void;
}) {
  /* Assistants */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const active = useMemo(() => assistants.find(a => a.id === activeId) || null, [assistants, activeId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      let local: Assistant[] = [];
      try {
        const raw = localStorage.getItem(LS_CHATBOTS);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) local = arr.map(normalizeAssistant);
        }
      } catch {}
      let cloud: Assistant[] = [];
      try {
        const ss = await scopedStorage(); await ss.ensureOwnerGuard();
        const arr = await ss.getJSON<any[]>(CLOUD_CHATBOTS, []);
        if (Array.isArray(arr)) cloud = arr.map(normalizeAssistant);
      } catch {}
      let merged = mergeNewest(local, cloud);
      if (!merged.length) {
        merged = [normalizeAssistant({ id: (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())), name: 'My First Voice Agent', firstMessage: 'Hello.', prompt: '' })];
      }
      if (alive) { setAssistants(merged); setActiveId(merged[0].id); }
      try { localStorage.setItem(LS_CHATBOTS, JSON.stringify(merged)); } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const saveAssistant = (next: Assistant) => {
    setAssistants(prev => {
      const upd = prev.map(a => a.id === next.id ? next : a);
      try { localStorage.setItem(LS_CHATBOTS, JSON.stringify(sortNewest(upd))); } catch {}
      (async () => {
        try {
          const ss = await scopedStorage(); await ss.ensureOwnerGuard();
          const arr = await ss.getJSON<any[]>(CLOUD_CHATBOTS, []);
          const cloud = Array.isArray(arr) ? arr : [];
          const i = cloud.findIndex(x => (x.assistantId || x.id) === next.id);
          const payload = {
            id: next.id, name: next.name,
            model: next.config.model.model,
            temperature: next.config.model.temperature,
            firstMessageMode: next.config.model.firstMessageMode,
            firstMessage: next.config.model.firstMessage,
            prompt: next.config.model.systemPrompt,
            updatedAt: Date.now(),
          };
          if (i >= 0) cloud[i] = { ...(cloud[i] || {}), ...payload }; else cloud.unshift(payload);
          await ss.setJSON(CLOUD_CHATBOTS, cloud);
          try { window.dispatchEvent(new Event('builds:updated')); } catch {}
        } catch {}
      })();
      return sortNewest(upd);
    });
  };
  const createAssistant = () => {
    const a = normalizeAssistant({ id: (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())), name: 'Untitled Agent', firstMessage: 'Hello.', prompt: '' });
    setAssistants(prev => { const upd = [a, ...prev]; try { localStorage.setItem(LS_CHATBOTS, JSON.stringify(upd)); } catch {}; return upd; });
    setActiveId(a.id);
  };
  const renameAssistant = (id: string, name: string) => {
    const cur = assistants.find(a => a.id === id); if (!cur) return;
    saveAssistant({ ...cur, name: name || 'Untitled', updatedAt: Date.now() });
  };
  const deleteAssistant = (id: string) => {
    setAssistants(prev => {
      const upd = prev.filter(a => a.id !== id);
      try { localStorage.setItem(LS_CHATBOTS, JSON.stringify(upd)); } catch {}
      (async () => {
        try { const ss = await scopedStorage(); await ss.ensureOwnerGuard();
          const arr = await ss.getJSON<any[]>(CLOUD_CHATBOTS, []);
          if (Array.isArray(arr)) await ss.setJSON(CLOUD_CHATBOTS, arr.filter(x => (x.assistantId || x.id) !== id));
        } catch {}
      })();
      if (activeId === id && upd[0]) setActiveId(upd[0].id);
      return upd;
    });
  };

  /* Keys & phone numbers (import like StepV2Telephony) */
  const [apiKeys, setApiKeys] = useState<StoredKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [numbers, setNumbers] = useState<PhoneNum[]>([]);
  const [fromE164, setFromE164] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();

        // prefer v1; fallback to legacy
        const v1 = await ss.getJSON<StoredKey[]>(LS_KEYS, []);
        const legacy = await ss.getJSON<StoredKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ''), name: String(k?.name || ''), key: String(k?.key || '') }))
          .filter(k => k.id && k.name);
        setApiKeys(cleaned);

        // choose default id: prior selection -> global selected -> first
        const prev = await ss.getJSON<string>(LS_SELECTED, '');
        const chosen = (apiKeyId && cleaned.some(k => k.id === apiKeyId)) ? apiKeyId
          : (prev && cleaned.some(k => k.id === prev)) ? prev
          : (cleaned[0]?.id || '');
        setApiKeyId(chosen);
        if (chosen) await ss.setJSON(LS_SELECTED, chosen);
      } catch {}
    })();

    (async () => {
      try {
        const r = await fetch('/api/telephony/phone-numbers', { cache: 'no-store' });
        const j = await r.json();
        const list: PhoneNum[] = j?.ok ? j.data : j;
        setNumbers(Array.isArray(list) ? list : []);
      } catch { setNumbers([]); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const all = await ss.getJSON<StoredKey[]>(LS_KEYS, []);
        const sel = (Array.isArray(all) ? all : []).find(k => k.id === apiKeyId);
        setApiKey(sel?.key || '');
        if (apiKeyId) await ss.setJSON(LS_SELECTED, apiKeyId);
      } catch { setApiKey(''); }
    })();
  }, [apiKeyId]);

  const keyOptions = useMemo(
    () => apiKeys.map(k => ({ value: k.id, label: k.name, sub: (k.key || '').slice(-4).toUpperCase() })),
    [apiKeys]
  );
  const numOptions = useMemo(
    () => numbers.map(n => ({ value: n.e164 || '', label: (n.e164 || n.id || '').trim() + (n.label ? ` — ${n.label}` : '') })),
    [numbers]
  );

  /* Generate + typing diff */
  const [genInput, setGenInput] = useState('');
  const [typing, setTyping] = useState<Tok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [previewPrompt, setPreviewPrompt] = useState('');
  const typingBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!typing) return;
    setTypedCount(0);
    if (typingTimer.current) window.clearInterval(typingTimer.current);
    typingTimer.current = window.setInterval(() => {
      setTypedCount(c => {
        const step = 6; const n = Math.min(c + step, typing.length);
        if (n >= typing.length && typingTimer.current) { window.clearInterval(typingTimer.current); typingTimer.current = null; }
        return n;
      });
    }, 12);
  }, [typing]);
  useEffect(() => { if (typingBoxRef.current) typingBoxRef.current.scrollTop = typingBoxRef.current.scrollHeight; }, [typedCount]);

  function handleGenerate() {
    if (!active) return;
    const before = active.config.model.systemPrompt || '';
    const ask = genInput.trim(); if (!ask) return;
    const next = ask.split(/\s+/).length <= 6
      ? `You are a ${ask.toLowerCase()}. Keep responses concise. Confirm key details. Politely decline restricted requests.`
      : ask;
    setPreviewPrompt(next);
    setTyping(charDiff(before, next));
    setGenInput('');
  }
  const acceptTyping = () => {
    if (!active) return;
    saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, systemPrompt: previewPrompt } } });
    setTyping(null);
  };

  /* Calls */
  const [inCall, setInCall] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  async function startCall() {
    if (!active) return;
    if (!apiKey) { setToast('Select an OpenAI API Key first.'); return; }
    try {
      if (onStartCall) {
        await onStartCall({
          apiKey,
          phoneFrom: fromE164,
          prompt: active.config.model.systemPrompt || '',
          firstMessage: active.config.model.firstMessage || 'Hello.',
          model: active.config.model.model,
          temperature: active.config.model.temperature ?? 0.5,
        });
      } else {
        setToast('Wire your call provider (Vapi/WebRTC) to onStartCall.');
      }
      setInCall(true);
    } catch (e: any) {
      setToast(e?.message || 'Failed to start call.');
    }
  }
  async function stopCall() { try { if (onStopCall) await onStopCall(); } finally { setInCall(false); } }

  if (!active) return null;

  return (
    <div className="px-6 py-10 voice-panel" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Section label like api-keys */}
      <div className="mx-auto w-full max-w-[1400px] mb-3">
        <div className="text-xs font-semibold tracking-[.12em] opacity-70" style={{ color: 'var(--text-muted)' }}>
          VOICE AGENTS
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px]">
        <div className="relative" style={FRAME}>
          {/* Header */}
          <div className="flex items-start justify-between px-6 lg:px-8 py-6">
            <div>
              <h1 className="text-2xl font-semibold">Voice Agents</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Build, tune, and call your agents.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl grid place-items-center" style={{ background: 'var(--brand-weak)' }}>
              <Bot className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            </div>
          </div>

          {/* Body: rail that touches app sidebar + WIDE editor (spaced like v0.dev/vapi shots) */}
          <div className="px-4 lg:px-6 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
              {/* Flush rail */}
              <AssistantRail
                items={assistants}
                activeId={activeId}
                onSelect={setActiveId}
                onCreate={createAssistant}
                onRename={renameAssistant}
                onDelete={deleteAssistant}
              />

              {/* Main editor column (wider) */}
              <div className="lg:ml-[calc(var(--app-sidebar-w,248px)+320px)]">
                <div className="grid gap-6">
                  {/* PROMPT */}
                  <section style={CARD} className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                        Prompt
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs"
                              style={{ background: 'color-mix(in oklab, var(--brand) 12%, var(--panel))', border: '1px solid var(--border)' }}>
                          New agents start empty
                        </span>
                        <button
                          onClick={() => saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, systemPrompt: '' } } })}
                          className="inline-flex items-center gap-2 px-3 h-[38px] rounded-[12px] text-sm"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                        >
                          <RefreshCw className="w-4 h-4" /> Reset
                        </button>
                      </div>
                    </div>

                    {/* Generate row */}
                    <div className="mt-4 p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Generate / Edit</div>
                      <div className="flex gap-2">
                        <input
                          className="w-full rounded-[14px] px-3 h-[44px] outline-none"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          placeholder='e.g. "sales agent for roofers" or paste a full prompt'
                          value={genInput}
                          onChange={(e) => setGenInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
                        />
                        <button
                          onClick={handleGenerate}
                          className="inline-flex items-center gap-2 px-4 h-[44px] rounded-[18px] font-semibold"
                          style={{ background: BTN_GREEN, color: '#fff' }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                        >
                          <Sparkles className="w-4 h-4" /> Generate
                        </button>
                      </div>
                    </div>

                    {/* Editor / Diff */}
                    {!typing ? (
                      <div className="mt-4">
                        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>System Prompt</div>
                        <textarea
                          rows={20}
                          className="w-full rounded-[18px] outline-none"
                          style={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            padding: '1rem',
                            minHeight: 460,
                            boxShadow: 'var(--card-shadow)'
                          }}
                          placeholder="(Empty)"
                          value={active.config.model.systemPrompt}
                          onChange={(e) => saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, systemPrompt: e.target.value } } })}
                        />
                        <div className="mt-2 flex gap-2 justify-end">
                          <button
                            className="inline-flex items-center gap-2 px-3 h-[38px] rounded-[12px] text-sm"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            onClick={() => navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(() => {})}
                          >
                            <Copy className="w-4 h-4" /> Copy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Proposed Changes (typing + diff)</div>
                        <div ref={typingBoxRef}
                             className="w-full rounded-[18px]"
                             style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '1rem', whiteSpace: 'pre-wrap', maxHeight: 560, overflowY: 'auto' }}>
                          {(() => {
                            const slice = typing.slice(0, typedCount);
                            const out: JSX.Element[] = []; let buf = ''; let mode: 'add'|'del'|'norm' = 'norm';
                            const flush = () => {
                              if (!buf) return;
                              if (mode === 'add') out.push(<ins key={out.length} style={{ background: 'rgba(0,255,194,.16)', textDecoration: 'none' }}>{buf}</ins>);
                              else if (mode === 'del') out.push(<del key={out.length} style={{ background: 'rgba(244,63,94,.14)' }}>{buf}</del>);
                              else out.push(<span key={out.length}>{buf}</span>);
                              buf = '';
                            };
                            for (const t of slice) {
                              const m = t.added ? 'add' : t.removed ? 'del' : 'norm';
                              if (m !== mode) { flush(); mode = m as any; }
                              buf += t.ch;
                            }
                            flush();
                            if (typedCount < typing.length) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                            return out;
                          })()}
                        </div>
                        <div className="mt-3 flex items-center gap-2 justify-end">
                          <button
                            className="inline-flex items-center gap-2 px-3 h-[40px] rounded-[12px] text-sm"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            onClick={() => setTyping(null)}
                          >
                            <X className="w-4 h-4" /> Decline
                          </button>
                          <button
                            onClick={acceptTyping}
                            className="inline-flex items-center gap-2 px-4 h-[40px] rounded-[18px] font-semibold"
                            style={{ background: BTN_GREEN, color: '#fff' }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                          >
                            <Check className="w-4 h-4" /> Accept
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Conversation Setup */}
                  <section style={CARD} className="p-5">
                    <div className="flex items-center gap-2 font-semibold">
                      <MessageSquare className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      Conversation Setup
                    </div>
                    <div className="grid gap-4 mt-4 md:grid-cols-3">
                      <div className="p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Provider</div>
                        <select
                          className="w-full rounded-[14px] px-3 h-[42px] outline-none"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          value={active.config.model.provider}
                          onChange={(e) => saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, provider: e.target.value as Provider } } })}
                        >
                          <option value="openai">OpenAI</option>
                        </select>
                      </div>
                      <div className="p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Model</div>
                        <select
                          className="w-full rounded-[14px] px-3 h-[42px] outline-none"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          value={active.config.model.model}
                          onChange={(e) => saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, model: e.target.value as ModelId } } })}
                        >
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o mini</option>
                          <option value="gpt-4.1">GPT-4.1</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </select>
                      </div>
                      <div className="p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Temperature</div>
                        <input
                          type="range" min={0} max={1} step={0.05}
                          value={active.config.model.temperature ?? 0.5}
                          onChange={(e) => saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, temperature: Number(e.target.value) } } })}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 mt-4 md:grid-cols-2">
                      <div className="p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>First Message Mode</div>
                        <select
                          className="w-full rounded-[14px] px-3 h-[42px] outline-none"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          value={active.config.model.firstMessageMode}
                          onChange={(e) => saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, firstMessageMode: e.target.value as any } } })}
                        >
                          <option value="assistant_first">Assistant speaks first</option>
                          <option value="user_first">User speaks first</option>
                        </select>
                      </div>
                      <div className="p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>First Message</div>
                        <input
                          className="w-full rounded-[14px] px-3 h-[42px] outline-none"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          value={active.config.model.firstMessage}
                          onChange={(e) => saveAssistant({ ...active, updatedAt: Date.now(), config: { model: { ...active.config.model, firstMessage: e.target.value } } })}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Credentials + Call (dropdowns & green buttons like api-keys; keys/numbers wired like StepV2) */}
                  <section style={CARD} className="p-5">
                    <div className="flex items-center gap-2 font-semibold">
                      <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      Credentials
                    </div>
                    <div className="grid gap-4 mt-4 md:grid-cols-3">
                      <div className="p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>OpenAI API Key</div>
                        <InlineSelect
                          value={apiKeyId}
                          onChange={setApiKeyId}
                          options={keyOptions}
                          placeholder="Select an API Key…"
                          left={<KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                        />
                        <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Loaded from your API Keys page (scoped).
                        </div>
                      </div>
                      <div className="p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>From Number</div>
                        <InlineSelect
                          value={fromE164}
                          onChange={setFromE164}
                          options={numOptions}
                          placeholder={numbers.length ? '— Choose —' : 'No numbers imported'}
                          left={<PhoneIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                        />
                        <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Optional; used by your telephony backend.
                        </div>
                      </div>
                      <div className="p-3 rounded-[14px] flex flex-col justify-between" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Status</div>
                          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-[12px]"
                               style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                            <div style={{ width: 8, height: 8, borderRadius: 999, background: apiKey ? 'var(--brand)' : '#f87171' }} />
                            <span className="text-sm">{apiKey ? 'API Key selected' : 'No API Key'}</span>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          {!inCall ? (
                            <button
                              onClick={startCall}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-[44px] rounded-[18px] font-semibold"
                              style={{ background: BTN_GREEN, color: '#fff' }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                            >
                              <Phone className="w-4 h-4" /> Start Web Call
                            </button>
                          ) : (
                            <button
                              onClick={stopCall}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-[44px] rounded-[18px] font-semibold"
                              style={{ background: 'rgba(255,120,120,.18)', color: 'rgba(255,170,170,.95)', border: '1px solid rgba(255,120,120,.45)' }}
                            >
                              <PhoneOff className="w-4 h-4" /> Stop Call
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Transcript placeholder */}
                  <section style={CARD} className="p-5">
                    <div className="flex items-center gap-2 font-semibold">
                      <MessageSquare className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      Session Transcript
                    </div>
                    <div className="mt-3 p-3 rounded-[14px]" style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      Connect your backend (Vapi/WebRTC) to stream live transcript here.
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>

          {/* Page-scoped dark cosmetics (mirror api-keys) */}
          <style jsx global>{`
            [data-theme="dark"] .voice-panel{
              --frame-bg:
                radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
                linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
              --frame-shadow:
                0 26px 70px rgba(0,0,0,.60),
                0 8px 24px rgba(0,0,0,.45),
                0 0 0 1px rgba(0,255,194,.06);
              --card-bg:
                linear-gradient(180deg, rgba(24,32,31,.86) 0%, rgba(16,22,21,.86) 100%);
              --card-shadow:
                0 16px 36px rgba(0,0,0,.55),
                0 2px 8px rgba(0,0,0,.35),
                inset 0 1px 0 rgba(255,255,255,.07),
                0 0 0 1px rgba(0,255,194,.05);
            }
          `}</style>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed inset-0 z-[9997] pointer-events-none flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl animate-[popIn_120ms_ease]"
               style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
            <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: 'var(--brand-weak)' }}>
              <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="text-sm">{toast}</div>
            <button onClick={() => setToast(null)} className="ml-2 p-1 rounded hover:opacity-70">
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
