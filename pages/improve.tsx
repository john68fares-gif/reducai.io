// pages/improve.tsx
// Improve: tune/test/compare Builder agents (model/temp/system) with live chat.
// - Supabase user id for ownership scoping (sync across devices).
// - Calls /api/improve/chat (App Router) with messages[].
// - Typing dots, Vapi-like scramble preview sentence.
// - Smarter snapshot titles (model/temp/rules/system diffs).
// - "+" opens OS picker immediately; attachments preview below composer.
// - No tailwind blue rings; brand-matched accents.

'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Bot, Search, Loader2, Save, Trash2, RefreshCw, X, Plus,
  MessageSquare, Send, ChevronDown, Film, Paperclip
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* ───────── Types ───────── */
type BotRow = {
  id: string;
  ownerId: string;
  name: string;
  model: string;
  temperature: number;
  system: string;
  createdAt?: string;
  updatedAt?: string;
};
type Version = {
  id: string;
  ts: number;
  label: string;
  name: string;
  model: string;
  temperature: number;
  system: string;
};
type ChatMsg = { role: 'user' | 'assistant'; content: string };
type Attachment = { id: string; name: string; mime: string; url?: string; size?: number };

/* ───────── Styles ───────── */
const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--bg) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  borderRadius: 14,
  boxShadow: '0 3px 14px rgba(0,0,0,.08)',
};
const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--bg) 98%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  borderRadius: 10,
};

/* ───────── Keys & helpers ───────── */
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const memoryKey  = (o: string, a: string) => `memory:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const sanitize = (text: string) =>
  (text || '')
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/\*\*/g, '')
    .replace(/`([^`]+)`/g, '$1');

/* Snapshot label — model/temp/rules/system-aware */
function snapshotLabel(prev: {system: string; model: string; temperature: number}, next: {system: string; model: string; temperature: number}): string {
  const parts: string[] = [];

  // Model change
  if (prev.model !== next.model) parts.push(`Model: ${prev.model} → ${next.model}`);

  // Temperature change → qualitative delta
  const zone = (t: number) => (t <= 0.25 ? 'precise' : t >= 0.75 ? 'creative' : 'balanced');
  if (Math.abs((prev.temperature ?? 0.5) - (next.temperature ?? 0.5)) > 1e-9) {
    const from = zone(prev.temperature ?? 0.5);
    const to   = zone(next.temperature ?? 0.5);
    parts.push(`Tone: ${from} → ${to}`);
  }

  const before = (prev.system || '').toLowerCase();
  const after  = (next.system || '').toLowerCase();

  // Specific intents
  const hadYesNo = /yes\/?\s*no|only\s+yes|strict\s+yes|binary\s*(?:answers|reply)/i.test(prev.system || '');
  const hasYesNo = /yes\/?\s*no|only\s+yes|strict\s+yes|binary\s*(?:answers|reply)/i.test(next.system || '');
  if (!hadYesNo && hasYesNo) parts.push('Only yes/no');

  const addedCite = !/cite|sources?|references?/.test(before) && /cite|sources?|references?/.test(after);
  if (addedCite) parts.push('Cites sources');

  const jsonBias = !/json/.test(before) && /json/.test(after);
  if (jsonBias) parts.push('JSON output');

  // Rules delta (heuristic)
  const br = parseRules(prev.system);
  const nr = parseRules(next.system);
  if (nr.length > br.length) {
    const firstNew = nr.find(r => !br.includes(r));
    if (firstNew) parts.push(`Rule added: ${firstNew.replace(/\s+/g,' ').slice(0,36)}${firstNew.length>36?'…':''}`);
  }

  if (parts.length) return parts.join(' • ');

  // Generic “conciseness/creativity” cues
  if (!/concise|brief|short/.test(before) && /concise|brief|short/.test(after)) return 'More concise';
  if (!/creative|playful|imaginative/.test(before) && /creative|playful|imaginative/.test(after)) return 'More creative';

  return 'Prompt edited';
}

/* Extract "goal" & "rules" from system (heuristic, non-destructive) */
function parseGoal(system: string, name: string): string {
  const m1 = system.match(/^\s*(?:#+\s*)?(?:goal|mission|purpose)\s*[:\-]\s*(.+)$/im);
  if (m1) return m1[1].trim();
  return `help the user with ${name || 'their tasks'} clearly and efficiently`;
}
function parseRules(system: string): string[] {
  const rulesBlock = system.match(/^\s*(?:#{2,3}\s*rules|rules\s*:)\s*([\s\S]+?)(?:\n#{1,3}\s|\n{2,}|$)/im)?.[1];
  const lines = (rulesBlock || system)
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^[-•*]\s+/.test(l) || /^\d+\)\s+/.test(l))
    .map(l => l.replace(/^[-•*]\s+/, '').replace(/^\d+\)\s+/, '').trim());
  return Array.from(new Set(lines)).slice(0, 10);
}

/* Compose Builder-style SYSTEM with optional local memory */
function composeSystem(base: string, pre: string, post: string, memory: string | null) {
  const blocks: string[] = [];
  if (pre.trim()) blocks.push(`### PRE\n${pre.trim()}`);
  if (memory && memory.trim()) blocks.push(`### MEMORY (local)\n${memory.trim()}`);
  blocks.push(`### SYSTEM\n${(base || '').trim()}`);
  if (post.trim()) blocks.push(`### POST\n${post.trim()}`);
  return blocks.join('\n\n').trim();
}

/* Vapi-like scramble (slow enough to read) */
function VapiScramble({ text, jitter = 900, className = '' }: { text: string; jitter?: number; className?: string }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    const chars = '!<>-_\\/[]{}—=+*^?#%$&|~';
    const src = text ?? '';
    const duration = Math.min(2400, Math.max(900, jitter + src.length * 10));
    const start = performance.now();
    let raf = 0;

    const step = () => {
      const now = performance.now();
      const t = (now - start) / duration;
      if (t >= 1) { setOut(src); return; }
      const resolved = Math.floor(src.length * (0.15 + 0.85 * t));
      let s = '';
      for (let i = 0; i < src.length; i++) s += i < resolved ? src[i] : chars[Math.floor(Math.random()*chars.length)];
      setOut(s);
      raf = requestAnimationFrame(step);
    };
    setOut(src.replace(/./g, () => chars[Math.floor(Math.random()*chars.length)]));
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, jitter]);

  return <span className={className} style={{ whiteSpace: 'pre-wrap' }}>{out}</span>;
}

/* Typing dots (…) */
function TypingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`${className} inline-flex items-center gap-[3px]`} aria-label="typing">
      <i className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text)', animationDelay: '0ms' }} />
      <i className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text)', animationDelay: '140ms' }} />
      <i className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text)', animationDelay: '280ms' }} />
      <style jsx>{`
        @keyframes bounce { 0%,80%,100% { transform: translateY(0) } 40% { transform: translateY(-3px) } }
        .animate-bounce { animation: bounce 1.2s infinite ease-in-out; display:inline-block }
      `}</style>
    </span>
  );
}

/* ───────── Component ───────── */
export default function Improve() {
  /* Identity (Supabase) */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id || null;
      setUserId(id);
      if (id) {
        try { document.cookie = `ra_uid=${encodeURIComponent(id)}; Path=/; Max-Age=31536000`; } catch {}
      }
    })();
  }, []);

  /* List + selection */
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  /* Editor */
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [prePrompt, setPrePrompt] = useState('');
  const [postPrompt, setPostPrompt] = useState('');
  const [showPromptPanel, setShowPromptPanel] = useState(false);

  /* Memory */
  const [useMemory, setUseMemory] = useState(true);
  const [memoryText, setMemoryText] = useState('');

  /* Versions */
  const [versions, setVersions] = useState<Version[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Chat lanes */
  const [msgsA, setMsgsA] = useState<ChatMsg[]>([]);
  const [msgsB, setMsgsB] = useState<ChatMsg[]>([]);
  const [laneB, setLaneB] = useState<Version | null>(null);
  const [laneTyping, setLaneTyping] = useState<{ A: boolean; B: boolean }>({ A: false, B: false });
  const [sendBoth, setSendBoth] = useState(false);
  const [activeLane, setActiveLane] = useState<'A' | 'B'>('A');
  const [input, setInput] = useState('');

  /* Attachments (picker + chips) */
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [pics,  setPics]  = useState<Attachment[]>([]);
  const [vids,  setVids]  = useState<Attachment[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const currentAttachments = useCallback(() => [...pics, ...vids, ...files], [pics, vids, files]);

  /* Chat scroll refs (auto-scroll) */
  const laneARef = useRef<HTMLDivElement | null>(null);
  const laneBRef = useRef<HTMLDivElement | null>(null);

  /* Fetch bots for this owner */
  const fetchBots = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, {
        headers: { 'x-owner-id': uid }, credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      const rows: BotRow[] = Array.isArray(json?.data) ? json.data : [];
      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      console.error('[Improve] fetchBots failed:', e);
      setList([]); setSelectedId(null);
    }
  }, [selectedId]);
  useEffect(() => { if (userId) void fetchBots(userId); }, [userId, fetchBots]);

  /* Load selection */
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    setPrePrompt(''); setPostPrompt('');
    setMsgsA([]); setMsgsB([]); setLaneB(null); setActiveLane('A'); setInput('');
    try {
      const rawV = localStorage.getItem(versionsKey(userId, selected.id));
      setVersions(rawV ? (JSON.parse(rawV) as Version[]) : []);
    } catch { setVersions([]); }
    try {
      const mem = localStorage.getItem(memoryKey(userId, selected.id));
      setMemoryText(mem || '');
    } catch { setMemoryText(''); }
    setDirty(false);
  }, [selectedId, userId, selected]);

  /* Dirty tracking */
  useEffect(() => {
    if (!selected) return;
    const d =
      name !== (selected.name || '') ||
      model !== (selected.model || 'gpt-4o') ||
      Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9 ||
      system !== (selected.system || '') ||
      prePrompt !== '' || postPrompt !== '';
    setDirty(d);
  }, [name, model, temperature, system, prePrompt, postPrompt, selected]);

  /* Auto-scroll */
  useEffect(() => { if (laneARef.current) laneARef.current.scrollTop = laneARef.current.scrollHeight; }, [msgsA, laneTyping.A]);
  useEffect(() => { if (laneBRef.current) laneBRef.current.scrollTop = laneBRef.current.scrollHeight; }, [msgsB, laneTyping.B]);

  /* Left rail filter/sort */
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'name_asc' | 'updated_desc'>('updated_desc');
  const filtered = useMemo(() => {
    let rows = [...list];
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.model || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name_asc') rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sort === 'updated_desc') rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return rows;
  }, [list, query, sort]);

async function saveEdits() {
  if (!userId || !selectedId) return;
  setSaving(true);
  const keepSelected = selectedId;

  try {
    // Snapshot first (unchanged)
    const prev = list.find(b => b.id === selectedId);
    const v: Version = {
      id: `v_${Date.now()}`,
      ts: Date.now(),
      label: labelFromChange(prev?.system || '', system),
      name, model, temperature, system
    };
    const next = [v, ...versions].slice(0, 80);
    setVersions(next);
    try { localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(next)); } catch {}

    // 🔁 Use the same endpoint as Builder so persistence is consistent
    const resp = await fetch(`/api/chatbots/save?ownerId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
      credentials: 'include',
      body: JSON.stringify({ id: selectedId, name, model, temperature, system }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `Save failed (${resp.status})`);
    }

    const json = await resp.json().catch(() => null);
    const saved: BotRow = (json?.data as BotRow) ?? {
      id: selectedId, ownerId: userId, name, model, temperature, system,
      updatedAt: new Date().toISOString(),
    };

    // Optimistic local update
    setList(cur => {
      const exists = cur.some(b => b.id === saved.id);
      const merged = exists
        ? cur.map(b => (b.id === saved.id ? { ...b, ...saved, updatedAt: new Date().toISOString() } : b))
        : [{ ...saved, updatedAt: new Date().toISOString() }, ...cur];
      return merged;
    });

    setDirty(false);

    // 🔄 Hard refresh from API to defeat cross-instance drift
    await fetchBots(userId);
    setSelectedId(keepSelected);
  } catch (e: any) {
    console.error('[Improve] save failed:', e?.message || e);
    alert(`Save failed: ${e?.message || 'unknown error'}`);
  } finally {
    setSaving(false);
  }
}


  async function deleteSelected() {
    if (!userId || !selectedId) return;
    if (!confirm('Delete this assistant?')) return;
    try {
      await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'DELETE', headers: { 'x-owner-id': userId }, credentials: 'include',
      });
      setList(cur => cur.filter(b => b.id !== selectedId));
      setSelectedId(null);
    } catch { alert('Failed to delete'); }
  }

  /* Memory heuristic from chat */
  function updateLocalMemory(history: ChatMsg[]) {
    if (!useMemory || !userId || !selected) return;
    const flat = history.slice(-10)
      .map(m => `${m.role === 'user' ? 'U' : 'A'}:${m.content.replace(/\s+/g, ' ').slice(0, 80)}`)
      .join(' • ');
    const mem = `User prefs (recent): ${flat}`.slice(0, 900);
    setMemoryText(mem);
    try { localStorage.setItem(memoryKey(userId, selected.id), mem); } catch {}
  }

  /* Files → attachments (UI sugar) */
  function fileToAttachment(file: File): Promise<Attachment> {
    return new Promise(resolve => {
      const id = `${file.name}_${file.size}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
      const base: Attachment = { id, name: file.name, mime: file.type, size: file.size };
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const fr = new FileReader(); fr.onload = () => resolve({ ...base, url: String(fr.result || '') }); fr.readAsDataURL(file);
      } else resolve(base);
    });
  }
  async function handlePicked(filesList: FileList | null) {
    if (!filesList || !filesList.length) return;
    const arr = Array.from(filesList).slice(0, 16);
    for (const f of arr) {
      const att = await fileToAttachment(f);
      if (att.mime.startsWith('image/')) setPics(prev => [...prev, att].slice(0, 16));
      else if (att.mime.startsWith('video/')) setVids(prev => [...prev, att].slice(0, 8));
      else setFiles(prev => [...prev, att].slice(0, 16));
    }
    if (pickerRef.current) try { pickerRef.current.value = ''; } catch {}
  }

  /* === AI: /api/improve/chat (messages[]) === */
  const sendLane = useCallback(async (which: 'A' | 'B', text: string) => {
    const laneVersion = which === 'A'
      ? { system, model, temperature }
      : (laneB ? { system: laneB.system, model: laneB.model, temperature: laneB.temperature } : null);
    if (!laneVersion) return;

    const sys = composeSystem(laneVersion.system, prePrompt, postPrompt, useMemory ? memoryText : '');

    const base = which === 'A' ? msgsA : msgsB;
    const history: ChatMsg[] = [...base, ...(text ? [{ role: 'user' as const, content: text }] : [])].slice(-16);

    if (text) {
      if (which === 'A') setMsgsA(cur => [...cur, { role: 'user', content: text }]);
      else setMsgsB(cur => [...cur, { role: 'user', content: text }]);
    }
    setLaneTyping(t => ({ ...t, [which]: true }));

    try {
      const resp = await fetch('/api/improve/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          agentId: selectedId,
          model: laneVersion.model,
          temperature: laneVersion.temperature,
          system: sys,
          messages: history,
          guardLevel: 'provider-only',
        }),
      });

      const data = await resp.json().catch(() => null);
      const reply = typeof data?.content === 'string'
        ? sanitize(data.content)
        : (data?.message ? String(data.message) : (resp.ok ? '[no response]' : 'Request failed.'));

      if (which === 'A') {
        setMsgsA(cur => [...cur, { role: 'assistant', content: reply }]);
        updateLocalMemory([...history, { role: 'assistant', content: reply }]);
      } else {
        setMsgsB(cur => [...cur, { role: 'assistant', content: reply }]);
        updateLocalMemory([...history, { role: 'assistant', content: reply }]);
      }
    } catch {
      const fallback = 'Could not reach /api/improve/chat.';
      if (which === 'A') setMsgsA(cur => [...cur, { role: 'assistant', content: fallback }]);
      else setMsgsB(cur => [...cur, { role: 'assistant', content: fallback }]);
    } finally {
      setLaneTyping(t => ({ ...t, [which]: false }));
    }
  }, [system, model, temperature, prePrompt, postPrompt, useMemory, memoryText, msgsA, msgsB, laneB, selectedId]);

  async function sendPrompt() {
    const text = (input || '').trim();
    if (!text && currentAttachments().length === 0) return;
    setInput('');
    // clear chips (they're visual only for now)
    setPics([]); setVids([]); setFiles([]);
    if (sendBoth && laneB) await Promise.all([sendLane('A', text), sendLane('B', text)]);
    else await sendLane(activeLane, text);
  }

  /* Prompt preview: one sentence + scramble */
  const goal  = useMemo(() => parseGoal(system, name), [system, name]);
  const rules = useMemo(() => parseRules(system), [system]);
  const previewSentence = useMemo(() => {
    const tone = temperature <= 0.25 ? 'precise' : temperature >= 0.75 ? 'creative' : 'balanced';
    const rulesPhrase = (rules.length ? rules : ['keep replies clear and concise']).join('; ');
    return `You’re called ${name || 'test'}. Your goal is to ${goal}. You run on ${model} with a ${tone} tone, and you follow these rules: ${rulesPhrase}.`;
  }, [name, model, temperature, goal, rules]);

  /* Insert rule helper */
  function insertRuleIntoSystem(rule: string) {
    setSystem((s) => {
      const r = rule.trim(); if (!r) return s;
      const m = s.match(/(^|\n)#{2,3}\s*rules[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|\n{2,}|$)/i);
      if (m) return s.replace(m[0], m[0].replace(/\s*$/, '') + `\n- ${r}\n`);
      return `${s.trim()}\n\n### RULES\n- ${r}\n`;
    });
  }
  const [newRule, setNewRule] = useState('');
  const [scrambleKey, setScrambleKey] = useState(0);
  function addRule() {
    const r = newRule.trim(); if (!r) return;
    insertRuleIntoSystem(r); setNewRule(''); setScrambleKey(k => k + 1);
  }

  return (
    <div
      className="h-screen w-full overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        if (!e.dataTransfer?.files?.length) return;
        await handlePicked(e.dataTransfer.files);
      }}
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-20 backdrop-blur border-b px-6 py-3"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--bg) 92%, transparent)' }}
      >
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <MessageSquare className="w-5 h-5" />
          <h1 className="text-[18px] font-semibold">{selected ? (selected.name || 'Assistant') : 'Agent Tuning'}</h1>

          <span className="text-xs px-2 py-[2px] rounded-full"
                style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)', border: '1px solid var(--border)' }}>
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓'}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => userId && fetchBots(userId)}
                    className="px-3 py-1.5 rounded-md text-sm"
                    style={{ ...CARD }}>
              <RefreshCw className="inline w-4 h-4 mr-1" /> Refresh
            </button>
            <button
              onClick={() => !saving && dirty && saveEdits()}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
              style={{ background: 'var(--brand)', color: '#00120a' }}>
              <Save className="w-4 h-4" />
              <span>Save + Snapshot</span>
            </button>
            <button onClick={deleteSelected} disabled={!selected || saving}
              className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
              style={{ background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.35)' }}>
              <Trash2 className="inline w-4 h-4 mr-1" /> Delete
            </button>
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="max-w-[1600px] mx-auto px-6 py-5" style={{ height: 'calc(100vh - 62px)' }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: '300px 1fr 300px', height: '100%' }}>
          {/* Left rail */}
          <aside className="h-full flex flex-col" style={PANEL}>
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" /><div className="font-semibold">Assistants</div>
              </div>
              <div className="relative mt-3">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
                  className="w-full rounded-md pl-8 pr-3 py-2 text-sm outline-none" style={CARD} />
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
              </div>
              <div className="mt-2">
                <select value={sort} onChange={(e) => setSort(e.target.value as any)}
                        className="px-2 py-1 rounded-md text-xs" style={CARD}>
                  <option value="updated_desc">Recent</option>
                  <option value="name_asc">Name</option>
                </select>
              </div>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 90px)' }}>
              {!userId ? (
                <div className="text-sm opacity-80 py-8">
                  Sign in to load your agents (we scope by your Supabase user id).
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm opacity-80 py-8 text-center">
                  No agents for this account.
                  <div className="mt-2">
                    <Link href="/builder" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: 'var(--brand)', color: '#00120a' }}>
                      Go to Builder
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map(b => {
                    const active = selectedId === b.id;
                    return (
                      <li key={b.id}>
                        <button
                          onClick={() => setSelectedId(b.id)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition"
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)', boxShadow: active ? '0 0 0 1.5px var(--brand) inset' : 'none' }}>
                          <div className="w-8 h-8 rounded-md grid place-items-center"
                               style={{ background: 'rgba(0,0,0,.06)', border: '1px solid var(--border)' }}>
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{b.name || 'Untitled'}</div>
                            <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0, 8)}</div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Middle: Editor + Live Test */}
          <section className="h-full grid gap-3" style={{ gridTemplateRows: 'auto 1fr' }}>
            {/* Editor */}
            <div className="p-3" style={PANEL}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1.1fr 0.9fr 1fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Name</div>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                         className="w-full px-3 py-2 rounded-md text-[15px] outline-none" style={CARD} placeholder="Agent name" />
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Model</div>
                  <select value={model} onChange={(e) => setModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-md outline-none" style={CARD}>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Temperature</div>
                  <div className="flex items-center gap-2">
                    {([0.1, 0.5, 0.9] as const).map(val => {
                      const lbl = val === 0.1 ? 'Precise' : val === 0.5 ? 'Balanced' : 'Creative';
                      const active = Math.abs(temperature - val) < 0.01;
                      return (
                        <button key={val} onClick={() => setTemperature(val)}
                          className="px-3 py-2 rounded-md text-sm"
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)', boxShadow: active ? '0 0 0 1.5px var(--brand) inset' : 'none' }}>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Show prompt & Add rule (short) */}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setShowPromptPanel(s => !s)} className="px-3 py-2 rounded-md text-sm"
                        style={{ ...CARD }}>
                  <ChevronDown className="inline w-4 h-4 mr-1" /> {showPromptPanel ? 'Hide prompt' : 'Show prompt'}
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <input
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addRule(); }}
                    placeholder="Add a rule…"
                    className="px-3 py-2 rounded-md text-sm min-w-[220px] outline-none"
                    style={CARD}
                  />
                  <button onClick={addRule} className="px-3 py-2 rounded-md text-sm"
                          style={{ background: 'var(--brand)', color: '#00120a' }}>
                    Add
                  </button>
                </div>
              </div>

              {/* Prompt preview + pre/post */}
              {showPromptPanel && (
                <div className="mt-3 space-y-3">
                  <div className="p-3 rounded-md" style={CARD}>
                    <div className="text-[13px] leading-6">
                      <VapiScramble key={scrambleKey} text={previewSentence} />
                    </div>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <input
                      value={prePrompt}
                      onChange={(e) => setPrePrompt(e.target.value)}
                      placeholder="Short preface injected before SYSTEM"
                      className="px-3 py-2 rounded-md text-sm outline-none"
                      style={CARD}
                    />
                    <input
                      value={postPrompt}
                      onChange={(e) => setPostPrompt(e.target.value)}
                      placeholder="Short guidance injected after SYSTEM"
                      className="px-3 py-2 rounded-md text-sm outline-none"
                      style={CARD}
                    />
                  </div>
                  <div className="text-[12px] opacity-70">
                    This preview reads from your saved System prompt — no extra schema needed.
                  </div>
                </div>
              )}
            </div>

            {/* Live Test */}
            <div className="p-3 grid gap-3" style={{ ...PANEL, gridTemplateRows: 'auto 1fr auto' }}>
              <div className="flex items-center justify-between">
                <div className="font-medium flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Live Test</div>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={sendBoth} onChange={(e) => setSendBoth(e.target.checked)}
                         style={{ accentColor: 'var(--brand)' }} />
                  Send to both lanes
                </label>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: laneB ? '1fr 1fr' : '1fr', height: '100%', minHeight: 360 }}>
                {/* Lane A */}
                <div className="flex flex-col rounded-md border" style={{ ...CARD }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm font-medium">Lane A (current)</div>
                    <button onClick={() => setActiveLane('A')} className="text-xs px-2 py-1 rounded"
                            style={{ ...CARD, boxShadow: activeLane==='A' ? '0 0 0 1.5px var(--brand) inset' : 'none' }}>
                      Focus
                    </button>
                  </div>
                  <div ref={laneARef} className="flex-1 overflow-auto p-3 text-sm leading-6">
                    {msgsA.length === 0 ? <div className="opacity-50">No messages yet.</div> :
                      msgsA.map((m, i) => (
                        <div key={i} className="mb-2">
                          <b>{m.role === 'user' ? 'You' : 'AI'}:</b>{' '}
                          <span>{m.content}</span>
                        </div>
                      ))
                    }
                    {laneTyping.A && <div className="mt-1"><TypingDots /></div>}
                  </div>
                </div>

                {/* Lane B */}
                {laneB ? (
                  <div className="flex flex-col rounded-md border" style={{ ...CARD }}>
                    <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                      <div className="text-sm">
                        <span className="font-medium">Lane B (version):</span> {laneB.label} <span className="opacity-60 text-xs">• {fmtTime(laneB.ts)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveLane('B')} className="text-xs px-2 py-1 rounded"
                                style={{ ...CARD, boxShadow: activeLane==='B' ? '0 0 0 1.5px var(--brand) inset' : 'none' }}>
                          Focus
                        </button>
                        <button onClick={() => setLaneB(null)} className="text-xs px-2 py-1 rounded" style={CARD}><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div ref={laneBRef} className="flex-1 overflow-auto p-3 text-sm leading-6">
                      {msgsB.length === 0 ? <div className="opacity-50">No messages yet.</div> :
                        msgsB.map((m, i) => (
                          <div key={i} className="mb-2">
                            <b>{m.role === 'user' ? 'You' : 'AI'}:</b>{' '}
                            <span>{m.content}</span>
                          </div>
                        ))
                      }
                      {laneTyping.B && <div className="mt-1"><TypingDots /></div>}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-md border grid place-items-center text-sm opacity-80"
                    style={{ ...CARD, borderStyle: 'dashed' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/plain');
                      const v = versions.find(x => x.id === id);
                      if (v) { setLaneB(v); setActiveLane('A'); setMsgsB([]); }
                    }}
                  >
                    Drag a version card here to create Lane B
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="space-y-2 rounded-md">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message…"
                    rows={1}
                    className="flex-1 px-3 py-2 rounded-md bg-transparent outline-none resize-none text-sm"
                    style={CARD}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendPrompt(); } }}
                  />
                  <button
                    onClick={() => pickerRef.current?.click()}
                    className="px-3 py-2 rounded-md"
                    style={CARD}
                    aria-label="Add attachments"
                    title="Add attachments"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <input
                    ref={pickerRef}
                    type="file"
                    accept="image/*,video/*,*/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePicked(e.target.files)}
                  />
                  <button
                    onClick={() => void sendPrompt()}
                    disabled={laneTyping.A || laneTyping.B || (!input.trim() && currentAttachments().length === 0)}
                    className="px-3 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
                    style={{ background: 'var(--brand)', color: '#00120a' }}
                  >
                    {(laneTyping.A && activeLane === 'A') || (laneTyping.B && activeLane === 'B')
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Send className="w-4 h-4" /> Send</>}
                  </button>
                </div>

                {/* Attachments preview chips */}
                {(pics.length + vids.length + files.length > 0) && (
                  <div className="mt-1 space-y-2">
                    {pics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {pics.map(a => (
                          <div key={a.id} className="relative rounded-md overflow-hidden"
                               style={{ border: '1px solid var(--border)' }}>
                            {a.url ? <img src={a.url} alt={a.name} className="w-16 h-16 object-cover" />
                                   : <div className="w-16 h-16 grid place-items-center text-xs opacity-60">image</div>}
                            <button
                              className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full w-5 h-5 text-[11px] leading-5"
                              onClick={() => setPics(cur => cur.filter(x => x.id !== a.id))}
                              aria-label="Remove" title="Remove">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {vids.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {vids.map(a => (
                          <div key={a.id} className="px-2 py-1 rounded-md text-xs" style={CARD}>
                            <Film className="inline w-3.5 h-3.5 mr-1" /> {a.name}
                            <button className="ml-2 opacity-70"
                                    onClick={() => setVids(cur => cur.filter(x => x.id !== a.id))}
                                    aria-label="Remove" title="Remove">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {files.map(a => (
                          <div key={a.id} className="px-2 py-1 rounded-md text-xs" style={CARD}>
                            <Paperclip className="inline w-3.5 h-3.5 mr-1" /> {a.name}
                            <button className="ml-2 opacity-70"
                                    onClick={() => setFiles(cur => cur.filter(x => x.id !== a.id))}
                                    aria-label="Remove" title="Remove">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Memory toggle */}
                <div className="flex items-center justify-between text-xs opacity-70 mt-1">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)}
                           style={{ accentColor: 'var(--brand)' }} />
                    Session memory for test chats
                  </label>
                  <span>Model: {model} · Temp: {temperature.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Right: Versions rail */}
          <aside className="h-full flex flex-col overflow-hidden" style={PANEL}>
            <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold">Versions</div>
              <div className="text-[11px] opacity-60">Drag to other column to compare</div>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 44px)' }}>
              {versions.length === 0 ? (
                <div className="text-sm opacity-60">No snapshots yet. Save to create one.</div>
              ) : (
                <div className="space-y-2">
                  {versions.map(v => (
                    <div
                      key={v.id}
                      className="p-2 rounded-md text-sm border cursor-grab"
                      style={CARD}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', v.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <div className="font-medium truncate">{v.label}</div>
                      <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          className="px-2 py-1 rounded-md text-xs"
                          style={CARD}
                          onClick={() => {
                            setName(v.name);
                            setModel(v.model);
                            setTemperature(v.temperature);
                            setSystem(v.system);
                            setDirty(true);
                          }}
                        >
                          Load
                        </button>
                        <button
                          className="px-2 py-1 rounded-md text-xs"
                          style={CARD}
                          onClick={() => { try { navigator.clipboard.writeText(v.id); } catch {} }}
                        >
                          Copy ID
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
