// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Plus, Trash2, Edit3, Check, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  FileText, Sparkles, RefreshCw, X, MessageSquare, Copy, ChevronDown, KeyRound, Phone as PhoneIcon,
  Phone, PhoneOff
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ======================================================================================
   PROPS (provider-agnostic)
   Wire your call stack (Vapi, custom WebRTC, etc.) with these optional callbacks.
   If you don’t pass them, the UI still works and shows a toast instead of crashing.
====================================================================================== */
export type StartCallArgs = {
  apiKey: string;
  phoneFrom: string;
  prompt: string;
  firstMessage: string;
  model: string;
  temperature: number;
};
export default function VoiceAgentSection({
  onStartCall,
  onStopCall,
}: {
  onStartCall?: (args: StartCallArgs) => Promise<void> | void;
  onStopCall?: () => Promise<void> | void;
}) {
  /* =========================================================================
     DATA: assistants (same source-of-truth model as Builder)
  ========================================================================= */
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
  const now = () => Date.now();
  const K_LIST = 'chatbots'; // matches your builder’s local primary key
  const K_CLOUD = 'chatbots.v1';

  const normalize = (a: any): Assistant => ({
    id: String(a?.assistantId || a?.id || crypto.randomUUID()),
    name: String(a?.name || 'Untitled Assistant'),
    updatedAt:
      Number(a?.updatedAt) ||
      Date.parse(a?.updatedAt || a?.createdAt || '') ||
      now(),
    config: {
      model: {
        provider: (a?.provider as Provider) || 'openai',
        model: (a?.model as ModelId) || 'gpt-4o',
        temperature:
          typeof a?.temperature === 'number' ? a.temperature : 0.5,
        firstMessageMode:
          (a?.firstMessageMode as any) || 'assistant_first',
        firstMessage: String(a?.firstMessage || 'Hello.'),
        systemPrompt: String(a?.prompt || a?.systemPrompt || ''),
      },
    },
  });
  const sortNewest = (arr: Assistant[]) =>
    arr
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const mergeNewest = (a: Assistant[], b: Assistant[]) => {
    const map = new Map<string, Assistant>();
    const put = (x: Assistant) => {
      const id = x.id;
      const old = map.get(id);
      if (!old || x.updatedAt > old.updatedAt) map.set(id, x);
    };
    a.forEach(put);
    b.forEach(put);
    return sortNewest([...map.values()]);
  };

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const active = useMemo(
    () => assistants.find((a) => a.id === activeId) || null,
    [assistants, activeId]
  );

  // Load both stores and merge (local + scopedStorage)
  useEffect(() => {
    let alive = true;
    (async () => {
      // local
      let local: Assistant[] = [];
      try {
        const raw = localStorage.getItem(K_LIST);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) local = arr.map(normalize);
        }
      } catch {}
      // cloud
      let cloud: Assistant[] = [];
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const arr = await ss.getJSON<any[]>(K_CLOUD, []);
        if (Array.isArray(arr)) cloud = arr.map(normalize);
      } catch {}
      const merged = mergeNewest(local, cloud);
      if (!merged.length) {
        // seed one if totally empty (no prompt)
        merged.push(
          normalize({
            id: crypto.randomUUID(),
            name: 'My First Voice Agent',
            firstMessage: 'Hello. How may I help you today?',
            prompt: '',
          })
        );
      }
      if (alive) {
        setAssistants(sortNewest(merged));
        setActiveId((merged[0] && merged[0].id) || '');
      }
      try {
        localStorage.setItem(K_LIST, JSON.stringify(merged));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveAssistant = (next: Assistant) => {
    setAssistants((prev) => {
      const upd = prev.map((a) => (a.id === next.id ? next : a));
      try {
        localStorage.setItem(K_LIST, JSON.stringify(sortNewest(upd)));
      } catch {}
      (async () => {
        try {
          const ss = await scopedStorage();
          await ss.ensureOwnerGuard();
          const arr = await ss.getJSON<any[]>(K_CLOUD, []);
          const cloud = Array.isArray(arr) ? arr : [];
          const i = cloud.findIndex((x) => (x.assistantId || x.id) === next.id);
          const payload = {
            id: next.id,
            name: next.name,
            model: next.config.model.model,
            temperature: next.config.model.temperature,
            firstMessageMode: next.config.model.firstMessageMode,
            firstMessage: next.config.model.firstMessage,
            prompt: next.config.model.systemPrompt,
            updatedAt: Date.now(),
          };
          if (i >= 0) cloud[i] = { ...(cloud[i] || {}), ...payload };
          else cloud.unshift(payload);
          await ss.setJSON(K_CLOUD, cloud);
          try {
            window.dispatchEvent(new Event('builds:updated'));
          } catch {}
        } catch {}
      })();
      return sortNewest(upd);
    });
  };

  const createAssistant = () => {
    const fresh = normalize({
      id: crypto.randomUUID(),
      name: 'Untitled Agent',
      firstMessage: 'Hello.',
      prompt: '',
    });
    setAssistants((prev) => {
      const upd = [fresh, ...prev];
      try {
        localStorage.setItem(K_LIST, JSON.stringify(upd));
      } catch {}
      return upd;
    });
    setActiveId(fresh.id);
  };
  const renameAssistant = (id: string, name: string) => {
    const cur = assistants.find((a) => a.id === id);
    if (!cur) return;
    saveAssistant({ ...cur, name, updatedAt: Date.now() });
  };
  const deleteAssistant = (id: string) => {
    setAssistants((prev) => {
      const upd = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem(K_LIST, JSON.stringify(upd));
      } catch {}
      (async () => {
        try {
          const ss = await scopedStorage();
          await ss.ensureOwnerGuard();
          const arr = await ss.getJSON<any[]>(K_CLOUD, []);
          const cloud = Array.isArray(arr) ? arr : [];
          const cut = cloud.filter((x) => (x.assistantId || x.id) !== id);
          await ss.setJSON(K_CLOUD, cut);
        } catch {}
      })();
      if (activeId === id && upd[0]) setActiveId(upd[0].id);
      return upd;
    });
  };

  /* =========================================================================
     API KEYS & PHONE NUMBERS (no auto-select; matches your Api Keys page)
  ========================================================================= */
  type StoredKey = { id: string; name: string; key: string };
  const [apiKeys, setApiKeys] = useState<StoredKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [numbers, setNumbers] = useState<Array<{ id: string; e164?: string; label?: string }>>([]);
  const [fromE164, setFromE164] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const arr = await ss.getJSON<StoredKey[]>('apiKeys.v1', []);
        setApiKeys(Array.isArray(arr) ? arr.filter(Boolean) : []);
      } catch {
        setApiKeys([]);
      }
    })();
    (async () => {
      try {
        const r = await fetch('/api/telephony/phone-numbers', { cache: 'no-store' });
        const j = await r.json();
        const list = j?.ok ? j.data : j;
        setNumbers(Array.isArray(list) ? list : []);
      } catch {
        setNumbers([]);
      }
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const ss = await scopedStorage();
        const arr = await ss.getJSON<StoredKey[]>('apiKeys.v1', []);
        const hit = (Array.isArray(arr) ? arr : []).find((k) => k.id === apiKeyId);
        setApiKey(hit?.key || '');
        if (apiKeyId) await ss.setJSON('apiKeys.selectedId', apiKeyId);
      } catch {
        setApiKey('');
      }
    })();
  }, [apiKeyId]);

  const keyOptions = useMemo(
    () =>
      apiKeys.map((k) => ({
        value: k.id,
        label: k.name,
        sub: (k.key || '').slice(-4).toUpperCase(),
      })),
    [apiKeys]
  );
  const numOptions = useMemo(
    () =>
      numbers.map((n) => ({
        value: n.e164 || '',
        label: (n.e164 || n.id || '').trim() + (n.label ? ` — ${n.label}` : ''),
      })),
    [numbers]
  );

  /* =========================================================================
     Generate + Typing Diff (subtle, uses brand)
  ========================================================================= */
  type Tok = { ch: string; added: boolean; removed?: boolean };
  const [genInput, setGenInput] = useState('');
  const [typing, setTyping] = useState<Tok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [previewPrompt, setPreviewPrompt] = useState('');
  const typingBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  function charDiff(oldStr: string, newStr: string): Tok[] {
    const o = [...oldStr],
      n = [...newStr];
    const dp = Array(o.length + 1)
      .fill(0)
      .map(() => Array(n.length + 1).fill(0));
    for (let i = o.length - 1; i >= 0; i--)
      for (let j = n.length - 1; j >= 0; j--)
        dp[i][j] = o[i] === n[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out: Tok[] = [];
    let i = 0,
      j = 0;
    while (i < o.length && j < n.length) {
      if (o[i] === n[j]) {
        out.push({ ch: n[j], added: false });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        out.push({ ch: o[i], added: false, removed: true });
        i++;
      } else {
        out.push({ ch: n[j], added: true });
        j++;
      }
    }
    while (i < o.length) {
      out.push({ ch: o[i], added: false, removed: true });
      i++;
    }
    while (j < n.length) {
      out.push({ ch: n[j], added: true });
      j++;
    }
    return out;
  }

  useEffect(() => {
    if (!typing) return;
    setTypedCount(0);
    if (typingTimer.current) window.clearInterval(typingTimer.current);
    typingTimer.current = window.setInterval(() => {
      setTypedCount((c) => {
        const step = 6;
        const n = Math.min(c + step, typing.length);
        if (n >= typing.length && typingTimer.current) {
          window.clearInterval(typingTimer.current);
          typingTimer.current = null;
        }
        return n;
      });
    }, 12);
  }, [typing]);
  useEffect(() => {
    if (typingBoxRef.current) typingBoxRef.current.scrollTop = typingBoxRef.current.scrollHeight;
  }, [typedCount]);

  function handleGenerate() {
    if (!active) return;
    const before = active.config.model.systemPrompt || '';
    const ask = genInput.trim();
    if (!ask) return;
    const next =
      ask.split(/\s+/).length <= 6
        ? `You are a ${ask.toLowerCase()}. Keep responses concise. Confirm key details. Decline restricted requests.`
        : ask;
    setPreviewPrompt(next);
    setTyping(charDiff(before, next));
    setGenInput('');
  }
  const acceptTyping = () => {
    if (!active) return;
    saveAssistant({
      ...active,
      updatedAt: Date.now(),
      config: { model: { ...active.config.model, systemPrompt: previewPrompt } },
    });
    setTyping(null);
  };

  /* =========================================================================
     Call controls (provider-agnostic; show toast if not wired)
  ========================================================================= */
  const [inCall, setInCall] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function startCall() {
    if (!active) return;
    if (!apiKey) {
      setToast('No API Key selected.');
      return;
    }
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
        setToast('No call provider wired yet.');
      }
      setInCall(true);
    } catch (e: any) {
      setToast(e?.message || 'Failed to start call.');
    }
  }
  async function stopCall() {
    try {
      if (onStopCall) await onStopCall();
    } finally {
      setInCall(false);
    }
  }

  /* =========================================================================
     InlineSelect (same look as your API Keys page; compact)
  ========================================================================= */
  function InlineSelect({
    value,
    onChange,
    options,
    placeholder = '— Choose —',
    left,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string; sub?: string }>;
    placeholder?: string;
    left?: React.ReactNode;
  }) {
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const portalRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const [q, setQ] = useState('');
    const sel = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);
    const filtered = useMemo(() => {
      const s = q.trim().toLowerCase();
      if (!s) return options;
      return options.filter((o) => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(s));
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
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 h-[46px] rounded-[14px] text-sm outline-none transition hover:-translate-y-[1px]"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <span className="flex items-center gap-2 truncate">{left}</span>
          <span className="flex-1 text-left truncate">
            {sel ? (
              <>
                {sel.label}
                {sel.sub ? (
                  <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                    ••••{sel.sub}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
            )}
          </span>
          <ChevronDown className="w-4 h-4 opacity-80" style={{ color: 'var(--text-muted)' }} />
        </button>

        {open && rect && (
          <div
            ref={portalRef}
            className="fixed z-[9999] p-3 rounded-[16px]"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-2 flex items-center gap-2 rounded-[10px] px-2 py-1" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
              <Search className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <input className="bg-transparent outline-none text-sm w-full" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {filtered.map((o) => (
                <button
                  key={o.value || o.label}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 hover:bg-[rgba(0,255,194,.10)]"
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.sub && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      ••••{o.sub}
                    </span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No items.
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  /* =========================================================================
     Assistant Rail (compact, left of main content)
  ========================================================================= */
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [q, setQ] = useState('');
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? assistants.filter((a) => a.name.toLowerCase().includes(s)) : assistants;
  }, [assistants, q]);

  /* =========================================================================
     LAYOUT
  ========================================================================= */
  if (!active)
    return (
      <div className="min-h-screen page-shell grid place-items-center">
        <div className="section p-8">
          <div className="font-semibold">No assistants</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Create one to get started.
          </div>
          <div className="mt-4">
            <button className="btn" onClick={createAssistant}>
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen page-shell font-sans">
      {/* Left fixed rail */}
      <aside
        className="hidden lg:flex flex-col"
        style={{
          position: 'fixed',
          left: 'var(--app-sidebar-w, 248px)',
          top: 64,
          width: railCollapsed ? 72 : 300,
          height: 'calc(100vh - 64px)',
          background: 'var(--panel)',
          borderRight: '1px solid var(--border)',
          boxShadow: 'var(--shadow-soft)',
          zIndex: 10,
          borderTopLeftRadius: 16,
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            {!railCollapsed && <span>Assistants</span>}
          </div>
          <div className="flex items-center gap-2">
            {!railCollapsed && (
              <button onClick={createAssistant} className="btn text-xs">
                <Plus className="w-4 h-4" /> Create
              </button>
            )}
            <button onClick={() => setRailCollapsed((v) => !v)} className="btn" title={railCollapsed ? 'Expand' : 'Collapse'}>
              {railCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {!railCollapsed && (
            <div className="card p-2 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <input className="bg-transparent outline-none text-sm w-full" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            {visible.map((a) => {
              const isActive = a.id === activeId;
              if (railCollapsed) {
                return (
                  <button
                    key={a.id}
                    onClick={() => setActiveId(a.id)}
                    title={a.name}
                    className="w-full rounded-xl p-3 grid place-items-center"
                    style={{
                      background: isActive ? 'color-mix(in oklab, var(--brand) 10%, var(--card))' : 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                  </button>
                );
              }
              return (
                <div key={a.id} className="card p-3 lift-hover" style={{ background: isActive ? 'color-mix(in oklab, var(--brand) 8%, var(--card))' : 'var(--card)' }}>
                  <button onClick={() => setActiveId(a.id)} className="w-full text-left flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                        <span className="truncate">{a.name}</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(a.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isActive ? <Check className="w-4 h-4" style={{ color: 'var(--brand)' }} /> : null}
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        const name = prompt('Rename assistant', a.name) || a.name;
                        renameAssistant(a.id, name.trim() || 'Untitled');
                      }}
                      className="btn text-xs"
                    >
                      <Edit3 className="w-4 h-4" /> Rename
                    </button>
                    <button
                      onClick={() => deleteAssistant(a.id)}
                      className="btn text-xs"
                      style={{ background: 'rgba(220,38,38,.10)', borderColor: 'rgba(220,38,38,.28)', color: '#fda4af' }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main
        className="px-4 sm:px-6"
        style={{ marginLeft: 'calc(var(--app-sidebar-w, 248px) + 300px)', paddingTop: 76, paddingBottom: 80 }}
      >
        <div className="max-w-[1200px] mx-auto grid gap-8">
          {/* SECTION: Prompt */}
          <section className="section p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                Prompt
              </div>
              <div className="flex items-center gap-2">
                <div className="section-pill">New agents start empty</div>
                <button
                  onClick={() =>
                    saveAssistant({
                      ...active,
                      updatedAt: Date.now(),
                      config: { model: { ...active.config.model, systemPrompt: '' } },
                    })
                  }
                  className="btn"
                >
                  <RefreshCw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>

            {/* Generate row */}
            <div className="card p-3 mt-4">
              <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Generate / Edit
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder='e.g. "sales agent for roofers" or paste a full prompt'
                  value={genInput}
                  onChange={(e) => setGenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate();
                  }}
                />
                <button className="btn btn-brand halo" onClick={handleGenerate}>
                  <Sparkles className="w-4 h-4" /> Generate
                </button>
              </div>
            </div>

            {/* Editor or diff */}
            {!typing ? (
              <div className="mt-4">
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  System Prompt
                </div>
                <textarea
                  rows={18}
                  className="input input-elevated w-full"
                  style={{ borderRadius: 18, padding: '1rem' }}
                  placeholder="(Empty)"
                  value={active.config.model.systemPrompt}
                  onChange={(e) =>
                    saveAssistant({
                      ...active,
                      updatedAt: Date.now(),
                      config: { model: { ...active.config.model, systemPrompt: e.target.value } },
                    })
                  }
                />
                <div className="mt-2 flex gap-2 justify-end">
                  <button
                    className="btn"
                    onClick={() =>
                      navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(() => {})
                    }
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Proposed Changes (typing + diff)
                </div>
                <div
                  ref={typingBoxRef}
                  className="input w-full"
                  style={{ borderRadius: 18, padding: '1rem', whiteSpace: 'pre-wrap', maxHeight: 560, overflowY: 'auto' }}
                >
                  {(() => {
                    const slice = typing.slice(0, typedCount);
                    const out: JSX.Element[] = [];
                    let buf = '';
                    let mode: 'add' | 'del' | 'norm' = 'norm';
                    const flush = () => {
                      if (!buf) return;
                      if (mode === 'add')
                        out.push(
                          <ins key={out.length} style={{ background: 'rgba(0,255,194,.16)', textDecoration: 'none' }}>
                            {buf}
                          </ins>
                        );
                      else if (mode === 'del')
                        out.push(
                          <del key={out.length} style={{ background: 'rgba(244,63,94,.14)' }}>
                            {buf}
                          </del>
                        );
                      else out.push(<span key={out.length}>{buf}</span>);
                      buf = '';
                    };
                    for (const t of slice) {
                      const m = t.added ? 'add' : t.removed ? 'del' : 'norm';
                      if (m !== mode) {
                        flush();
                        mode = m as any;
                      }
                      buf += t.ch;
                    }
                    flush();
                    if (typedCount < typing.length) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                    return out;
                  })()}
                </div>
                <div className="mt-3 flex items-center gap-2 justify-end">
                  <button className="btn" onClick={() => setTyping(null)}>
                    <X className="w-4 h-4" /> Decline
                  </button>
                  <button className="btn btn-brand halo" onClick={acceptTyping}>
                    <Check className="w-4 h-4" /> Accept
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* SECTION: Conversation Setup */}
          <section className="section p-6">
            <div className="flex items-center gap-2 font-semibold">
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              Conversation Setup
            </div>
            <div className="grid gap-4 mt-4 md:grid-cols-3">
              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Provider
                </div>
                <select
                  className="input w-full"
                  value={active.config.model.provider}
                  onChange={(e) =>
                    saveAssistant({
                      ...active,
                      updatedAt: Date.now(),
                      config: { model: { ...active.config.model, provider: e.target.value as any } },
                    })
                  }
                >
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Model
                </div>
                <select
                  className="input w-full"
                  value={active.config.model.model}
                  onChange={(e) =>
                    saveAssistant({
                      ...active,
                      updatedAt: Date.now(),
                      config: { model: { ...active.config.model, model: e.target.value as any } },
                    })
                  }
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Temperature
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={active.config.model.temperature ?? 0.5}
                  onChange={(e) =>
                    saveAssistant({
                      ...active,
                      updatedAt: Date.now(),
                      config: { model: { ...active.config.model, temperature: Number(e.target.value) } },
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-4 mt-4 md:grid-cols-2">
              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  First Message Mode
                </div>
                <select
                  className="input w-full"
                  value={active.config.model.firstMessageMode}
                  onChange={(e) =>
                    saveAssistant({
                      ...active,
                      updatedAt: Date.now(),
                      config: { model: { ...active.config.model, firstMessageMode: e.target.value as any } },
                    })
                  }
                >
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </select>
              </div>
              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  First Message
                </div>
                <input
                  className="input w-full"
                  value={active.config.model.firstMessage}
                  onChange={(e) =>
                    saveAssistant({
                      ...active,
                      updatedAt: Date.now(),
                      config: { model: { ...active.config.model, firstMessage: e.target.value } },
                    })
                  }
                />
              </div>
            </div>
          </section>

          {/* SECTION: Credentials */}
          <section className="section p-6">
            <div className="flex items-center gap-2 font-semibold">
              <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              Credentials
            </div>
            <div className="grid gap-4 mt-4 md:grid-cols-3">
              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  OpenAI API Key
                </div>
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

              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  From Number
                </div>
                <InlineSelect
                  value={fromE164}
                  onChange={setFromE164}
                  options={numOptions}
                  placeholder={numbers.length ? '— Choose —' : 'No numbers imported'}
                  left={<PhoneIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
                />
                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Optional here; used by your telephony backend.
                </div>
              </div>

              <div className="card p-3">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Status
                </div>
                <div className="section-pill inline-flex items-center gap-2">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: apiKey ? 'var(--brand)' : '#f87171',
                    }}
                  />
                  {apiKey ? 'API Key selected' : 'No API Key'}
                </div>
                <div className="mt-3 flex gap-2">
                  {!inCall ? (
                    <button onClick={startCall} className="btn btn-brand halo flex-1">
                      <Phone className="w-4 h-4" /> Start Web Call
                    </button>
                  ) : (
                    <button onClick={stopCall} className="btn flex-1" style={{ borderColor: 'rgba(255,120,120,.45)', color: 'salmon' }}>
                      <PhoneOff className="w-4 h-4" /> Stop Call
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: Transcript (placeholder log) */}
          <section className="section p-6">
            <div className="flex items-center gap-2 font-semibold">
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              Session Transcript
            </div>
            <div className="card p-3 mt-3">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Connect your backend to stream turns here.
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed inset-0 z-[9997] pointer-events-none flex items-center justify-center">
          <div
            className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl elevate animate-[popIn_120ms_ease]"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
          >
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
