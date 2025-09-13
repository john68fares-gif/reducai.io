// components/voice/VoiceStudioContent.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Bot, Plus, Trash2, Edit3, Check, Search, RefreshCw, Copy, KeyRound, Phone as PhoneIcon, ChevronDown } from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ------------------------------ minimal tokens ------------------------------ */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

/* ------------------------------ types ------------------------------ */
type Assistant = {
  id: string;
  name: string;
  updatedAt: number;
  prompt: string;
  model: string;
  temperature: number;
  firstMessageMode: 'assistant_first' | 'user_first';
  firstMessage: string;
};
type StoredKey = { id: string; name: string; key: string };
type PhoneNum = { id: string; e164?: string; label?: string };

const LS_CHATBOTS = 'chatbots';
const CLOUD_CHATBOTS = 'chatbots.v1';
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

/* ------------------------------ helpers ------------------------------ */
const normalize = (a: any): Assistant => ({
  id: String(a?.assistantId || a?.id || crypto.randomUUID()),
  name: String(a?.name || 'Untitled Agent'),
  updatedAt: Number(a?.updatedAt || Date.now()),
  prompt: String(a?.prompt || a?.config?.model?.systemPrompt || ''),
  model: String(a?.model || a?.config?.model?.model || 'gpt-4o-mini'),
  temperature: typeof a?.temperature === 'number' ? a.temperature : (a?.config?.model?.temperature ?? 0.5),
  firstMessageMode: (a?.firstMessageMode || a?.config?.model?.firstMessageMode || 'assistant_first'),
  firstMessage: String(a?.firstMessage || a?.config?.model?.firstMessage || 'Hello.'),
});
const sortNewest = (arr: Assistant[]) => arr.slice().sort((a, b) => b.updatedAt - a.updatedAt);

/* ------------------------------ InlineSelect (keys & numbers) ------------------------------ */
function InlineSelect({
  value, onChange, options, placeholder, left,
}: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string; sub?: string }>;
  placeholder?: string;
  left?: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [q, setQ] = useState('');
  const sel = useMemo(() => options.find(o => o.value === value) || null, [options, value]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
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
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        <span className="flex items-center gap-2 truncate">{left}</span>
        <span className="flex-1 text-left truncate">
          {sel ? (<>{sel.label}{sel.sub ? <span className="ml-2" style={{ color: 'var(--text-muted)' }}>••••{sel.sub}</span> : null}</>)
                : <span style={{ color: 'var(--text-muted)' }}>{placeholder || '— Choose —'}</span>}
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && (
        <div
          ref={portalRef}
          className="fixed z-[9999] p-3"
          style={{
            left: rect.left, top: rect.top, width: rect.width,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20,
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-[10px]"
               style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <Search className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <input className="bg-transparent outline-none text-sm w-full" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filtered.map(o => (
              <button key={o.value || o.label}
                      onClick={() => { onChange(o.value); setOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-[10px] hover:bg-[rgba(0,255,194,.08)]">
                <span className="flex-1 truncate">{o.label}</span>
                {o.sub && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>••••{o.sub}</span>}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No items.</div>}
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------ Assistants rail (TOUCHING SIDEBAR) ------------------------------ */
function AssistantRail({
  items, activeId, onSelect, onCreate, onRename, onDelete,
}: {
  items: Assistant[]; activeId: string;
  onSelect: (id: string) => void; onCreate: () => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const visible = useMemo(() => items.filter(a => a.name.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);

  return (
    <aside
      className="hidden lg:flex flex-col"
      /* NO left radius / NO outer gap so it “touches” the app sidebar */
      style={{ width: 300, borderRight: '1px solid var(--border)', borderLeft: 'none' }}
    >
      <div className="p-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          <span>Assistants</span>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-3 h-[34px] rounded-[10px] text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      <div className="px-3">
        <div className="flex items-center gap-2 rounded-[12px] px-3 h-[38px]"
             style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Search className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          <input className="bg-transparent outline-none text-sm w-full" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mt-3 px-3 pb-3 space-y-2 min-h-0 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
        {visible.map(a => {
          const active = a.id === activeId;
          return (
            <div key={a.id} className="p-3 rounded-[12px]"
                 style={{ background: active ? 'color-mix(in oklab, var(--brand) 10%, var(--card))' : 'var(--card)', border: '1px solid var(--border)' }}>
              <button className="w-full text-left flex items-center gap-2" onClick={() => onSelect(a.id)}>
                <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(a.updatedAt).toLocaleDateString()}</div>
                </div>
                {active && <Check className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              </button>

              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => onRename(a.id, prompt('Rename assistant', a.name) || a.name)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs"
                  style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
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
    </aside>
  );
}

/* ------------------------------ Main Voice Studio content (NO OUTER BOX; WIDE EDITOR) ------------------------------ */
export default function VoiceStudioContent() {
  /* assistants */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const active = useMemo(() => assistants.find(a => a.id === activeId) || null, [assistants, activeId]);

  useEffect(() => {
    let merged: Assistant[] = [];
    // local
    try {
      const raw = localStorage.getItem(LS_CHATBOTS);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) merged = arr.map(normalize);
      }
    } catch {}
    // cloud
    (async () => {
      try {
        const ss = await scopedStorage(); await ss.ensureOwnerGuard();
        const arr = await ss.getJSON<any[]>(CLOUD_CHATBOTS, []);
        if (Array.isArray(arr)) {
          const cloud = arr.map(normalize);
          const map = new Map<string, Assistant>();
          [...merged, ...cloud].forEach(x => map.set(x.id, (map.get(x.id)?.updatedAt || 0) > x.updatedAt ? map.get(x.id)! : x));
          merged = sortNewest([...map.values()]);
        }
      } catch {}
      if (!merged.length) merged = [normalize({ name: 'My First Voice Agent' })];
      setAssistants(merged);
      setActiveId(merged[0].id);
      try { localStorage.setItem(LS_CHATBOTS, JSON.stringify(merged)); } catch {}
    })();
  }, []);

  /* API keys (FIXED default selection) */
  const [apiKeys, setApiKeys] = useState<StoredKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const keyOptions = useMemo(() => apiKeys.map(k => ({ value: k.id, label: k.name, sub: (k.key || '').slice(-4).toUpperCase() })), [apiKeys]);

  async function loadKeys() {
    const ss = await scopedStorage(); await ss.ensureOwnerGuard();
    const v1 = await ss.getJSON<StoredKey[]>(LS_KEYS, []);
    const legacy = await ss.getJSON<StoredKey[]>('apiKeys', []);
    const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
    const cleaned = merged.filter(Boolean).map((k: any) => ({ id: String(k.id), name: String(k.name), key: String(k.key) })).filter(k => k.id && k.name);
    setApiKeys(cleaned);

    // DEFAULT PICK ORDER (robust): last selected (global) -> last selected (local) -> first available
    const ssSelected = await ss.getJSON<string>(LS_SELECTED, '');
    const localSelected = (() => { try { return JSON.parse(localStorage.getItem('voice:selectedKey') || '""'); } catch { return ''; } })();
    const chosen = (ssSelected && cleaned.some(k => k.id === ssSelected)) ? ssSelected
      : (localSelected && cleaned.some(k => k.id === localSelected)) ? localSelected
      : (cleaned[0]?.id || '');
    setApiKeyId(chosen);
  }

  useEffect(() => { loadKeys().catch(() => {}); }, []);
  useEffect(() => {
    (async () => {
      try {
        const found = apiKeys.find(k => k.id === apiKeyId);
        setApiKey(found?.key || '');
        const ss = await scopedStorage(); await ss.ensureOwnerGuard();
        if (apiKeyId) await ss.setJSON(LS_SELECTED, apiKeyId);
        localStorage.setItem('voice:selectedKey', JSON.stringify(apiKeyId));
      } catch { setApiKey(''); }
    })();
  }, [apiKeyId, apiKeys]);

  /* numbers */
  const [numbers, setNumbers] = useState<PhoneNum[]>([]);
  const [fromE164, setFromE164] = useState('');
  const numOptions = useMemo(
    () => numbers.map(n => ({ value: n.e164 || '', label: (n.e164 || n.id || '').trim() + (n.label ? ` — ${n.label}` : '') })),
    [numbers]
  );
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/telephony/phone-numbers', { cache: 'no-store' });
        const j = await r.json();
        const list: PhoneNum[] = j?.ok ? j.data : j;
        setNumbers(Array.isArray(list) ? list : []);
      } catch { setNumbers([]); }
    })();
  }, []);

  /* simple save */
  const save = (next: Partial<Assistant>) => {
    setAssistants(prev => {
      const cur = prev.find(a => a.id === activeId)!;
      const merged: Assistant = { ...cur, ...next, updatedAt: Date.now() } as Assistant;
      const out = sortNewest(prev.map(a => (a.id === cur.id ? merged : a)));
      try { localStorage.setItem(LS_CHATBOTS, JSON.stringify(out)); } catch {}
      (async () => {
        try {
          const ss = await scopedStorage(); await ss.ensureOwnerGuard();
          const cloud = await ss.getJSON<any[]>(CLOUD_CHATBOTS, []);
          const arr = Array.isArray(cloud) ? cloud : [];
          const i = arr.findIndex(x => (x.assistantId || x.id) === merged.id);
          const payload = { id: merged.id, name: merged.name, prompt: merged.prompt, model: merged.model, temperature: merged.temperature, firstMessage: merged.firstMessage, firstMessageMode: merged.firstMessageMode, updatedAt: merged.updatedAt };
          if (i >= 0) arr[i] = { ...(arr[i] || {}), ...payload }; else arr.unshift(payload);
          await ss.setJSON(CLOUD_CHATBOTS, arr);
        } catch {}
      })();
      return out;
    });
  };

  if (!active) return null;

  return (
    /* NO OUTER BOX, just the grid; your page header stays outside */
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-0"> {/* rail touches sidebar; no gap */}
        <AssistantRail
          items={assistants}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={() => { const a = normalize({ name: 'Untitled Agent' }); setAssistants(prev => [a, ...prev]); setActiveId(a.id); }}
          onRename={(id, name) => id === activeId ? save({ name: name || 'Untitled Agent' }) : null}
          onDelete={(id) => setAssistants(prev => prev.filter(a => a.id !== id))}
        />

        {/* Wide editor (max-width bumped; prompt area expanded) */}
        <div className="min-w-0 px-4 sm:px-6">
          {/* Controls row (keys + number) */}
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>OpenAI API Key</div>
              <InlineSelect
                value={apiKeyId}
                onChange={setApiKeyId}
                options={keyOptions}
                placeholder="Select an API key…"
                left={<KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => loadKeys().catch(() => {})}
                  className="inline-flex items-center gap-2 px-3 h-[36px] rounded-[12px] text-sm"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <RefreshCw className="w-4 h-4" /> Reload keys
                </button>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Found {apiKeys.length} key{apiKeys.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>From Number</div>
              <InlineSelect
                value={fromE164}
                onChange={setFromE164}
                options={numOptions}
                placeholder={numbers.length ? '— Choose —' : 'No numbers imported'}
                left={<PhoneIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              />
            </div>

            <div className="flex items-end">
              <button
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-[46px] rounded-[18px] font-semibold"
                style={{ background: BTN_GREEN, color: '#fff' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                onClick={() => {/* hook up your web call here */}}
              >
                Start Web Call
              </button>
            </div>
          </div>

          {/* Prompt editor — WIDER and TALLER */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Prompt</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(active.prompt || '').catch(() => {})}
                  className="inline-flex items-center gap-2 px-3 h-[36px] rounded-[12px] text-sm"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
              </div>
            </div>

            <textarea
              className="w-full rounded-[18px] outline-none mt-2"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '1rem', minHeight: 560 }}
              placeholder="(Empty)"
              value={active.prompt}
              onChange={(e) => save({ prompt: e.target.value })}
            />
          </div>

          {/* Model row (simple; wide) */}
          <div className="grid gap-4 md:grid-cols-3 mt-6">
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Model</div>
              <select
                value={active.model}
                onChange={(e) => save({ model: e.target.value })}
                className="w-full rounded-[14px] px-3 h-[42px] outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o mini</option>
                <option value="gpt-4.1">GPT-4.1</option>
              </select>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Temperature</div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={active.temperature}
                onChange={(e) => save({ temperature: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>First Message</div>
              <input
                className="w-full rounded-[14px] px-3 h-[42px] outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                value={active.firstMessage}
                onChange={(e) => save({ firstMessage: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
