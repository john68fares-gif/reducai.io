// pages/improve.tsx
// Improve: tune/test/compare existing agents. No creation UI here.
// Key updates:
// - Media tabs auto-open pickers (also re-open on same-tab click). No extra "Add" buttons.
// - You can re-open immediately (we reset <input>.value before programmatic click).
// - Attachments-only messages supported.
// - "Show Prompt" displays a single, optimized composed prompt (Pre/System/Post/Memory) with
//   a live, typewriter-style animation whenever any piece changes.
// - Version drag: onto Lane B to lock; onto footer to "test next message" (one-shot).

'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Bot, Search, Loader2, Save, Trash2, RefreshCw, History, RotateCcw, X, Upload, Download,
  Copy, Check, MessageSquare, Send, Layers, CornerDownRight, ChevronDown, Image as ImageIcon,
  Paperclip, Film, FileText, Info
} from 'lucide-react';

/* Types */
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

type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: string };
type Attachment = { id: string; name: string; mime: string; url?: string; size?: number };

/* Styles */
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

/* Utils */
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const memoryKey = (o: string, a: string) => `memory:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();

const stripMd = (t: string) =>
  (t || '').replace(/```[\s\S]*?```/g, '').replace(/[*_`>#-]/g, '').replace(/\s+/g, ' ').trim();

const sanitize = (text: string) =>
  (text || '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1');

function autoLabel(prevSys: string, nextSys: string): string {
  const before = stripMd(prevSys || '');
  const after = stripMd(nextSys || '');
  if (before === after) return 'minor edit';
  const added = after.replace(before, '').slice(0, 160).toLowerCase();
  if (/\byes\b.*\bno\b/i.test(after) && /only/i.test(after)) return 'Yes/No only';
  if (/concise|short|brief/i.test(after)) return 'More concise answers';
  if (/json|schema|strict/i.test(after)) return 'JSON output enforced';
  if (/markdown|code fence/i.test(after)) return 'Markdown format';
  if (/cit(e|ation)|source/i.test(after)) return 'Cites sources';
  if (/formal/i.test(after)) return 'Formal tone';
  if (/casual|friendly/i.test(after)) return 'Casual tone';
  return (added || 'Prompt edited').slice(0, 48);
}

function SplitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M4 4h6v16H4zM14 4h6v16h-6z" />
    </svg>
  );
}

/* Compose a single, optimized prompt (Pre/System/Post/Memory) */
function composeSystem(base: string, pre: string, post: string, memory: string | null) {
  // Optimized structure for clarity & functionality (inspired by vapi-like layouts)
  const blocks: string[] = [];
  if (pre.trim()) {
    blocks.push(
      [
        '### PRE',
        pre.trim(),
        '> Purpose: role/goals/context that runs before the main system.',
      ].join('\n')
    );
  }
  if (memory && memory.trim()) {
    blocks.push(
      [
        '### MEMORY (local)',
        memory.trim(),
        '> Derived from recent chats; adapt tone & preferences accordingly.',
      ].join('\n')
    );
  }
  const main = base.trim() || 'Be helpful, precise, and concise.';
  blocks.push(['### SYSTEM (main)', main, '> Core behavior. Keep outputs tidy.'].join('\n'));
  if (post.trim()) {
    blocks.push(
      ['### POST', post.trim(), '> Runs after; formatting/checks/constraints.'].join('\n')
    );
  }
  return blocks.join('\n\n').trim();
}

/* Component */
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  // Editor state (read-only meta + editable prompt fields)
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');     // main behavior (from agent)
  const [prePrompt, setPrePrompt] = useState('');   // optional prepend
  const [postPrompt, setPostPrompt] = useState(''); // optional append
  const [showPromptBlock, setShowPromptBlock] = useState(false);

  // Memory (local, optional)
  const [useMemory, setUseMemory] = useState(true);
  const [memoryText, setMemoryText] = useState('');

  // Versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live test lanes
  const [laneB, setLaneB] = useState<Version | null>(null);
  const [sendBoth, setSendBoth] = useState(false);
  const [activeLane, setActiveLane] = useState<'A' | 'B'>('A');
  const [msgsA, setMsgsA] = useState<ChatMsg[]>([]);
  const [msgsB, setMsgsB] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');

  // Input tabs: text / pictures / videos / files
  type Tab = 'text' | 'pics' | 'vids' | 'files';
  const [tab, setTab] = useState<Tab>('text');
  const [pics, setPics] = useState<Attachment[]>([]);
  const [vids, setVids] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const picsRef = useRef<HTMLInputElement | null>(null);
  const vidsRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);

  // Footer drag target (test-one-shot)
  const [dropActive, setDropActive] = useState(false);
  const [testVersion, setTestVersion] = useState<Version | null>(null);

  // === Stable local dev id (only used if session not present) ===
  useEffect(() => {
    let dev = localStorage.getItem('dev:userId');
    if (!dev) {
      dev = `dev_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('dev:userId', dev);
    }
    // Try to pick session user id if exposed by your app
    const nx = (window as any).__NEXT_DATA__?.props?.pageProps?.session?.user?.id
            || (window as any).__NEXT_DATA__?.props?.session?.user?.email
            || dev;
    setUserId(nx || dev);
  }, []);

  // === Fetch agents strictly for this user (no creation here) ===
  const fetchBots = useCallback(async (uid: string) => {
    try {
      // Cookie-scoped, with owner header as fallback
      let res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, {
        credentials: 'include',
        headers: { 'x-owner-id': uid }
      });
      let json = await res.json().catch(() => null);
      let rows: BotRow[] = Array.isArray(json?.data) ? json.data : [];

      if (!rows.length) {
        // Unscoped fallback (if your API allows)
        res = await fetch('/api/chatbots', { credentials: 'include' });
        json = await res.json().catch(() => null);
        rows = Array.isArray(json?.data) ? json.data : [];
      }

      // Normalize shape just in case
      rows = rows.map((r: any) => ({
        id: r.id,
        ownerId: r.ownerId ?? r.owner ?? r.userId ?? uid,
        name: r.name ?? r.title ?? 'Untitled',
        model: r.model ?? r.engine ?? 'gpt-4o',
        temperature: typeof r.temperature === 'number' ? r.temperature : 0.5,
        system: r.system ?? r.prompt ?? '',
        createdAt: r.createdAt ?? r.created_at ?? undefined,
        updatedAt: r.updatedAt ?? r.updated_at ?? undefined,
      })).filter(r => r.id);

      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      console.error('[Improve] fetchBots failed:', e);
      setList([]);
    }
  }, [selectedId]);

  useEffect(() => { if (userId) void fetchBots(userId); }, [userId, fetchBots]);

  // === Load selection (versions + memory) ===
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    setPrePrompt(''); setPostPrompt('');
    setLaneB(null); setMsgsA([]); setMsgsB([]); setInput('');

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

  // Unsaved guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (!dirty) return; e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Dirty tracking (only prompt-related here)
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

  // Helpers
  const copyId = async () => { if (!selected) return; await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(() => setCopied(false), 900); };
  const fmtTok = (s: string) => Math.max(1, Math.round((s || '').length / 4));

  // Snapshots (only of prompt settings; we don't edit metadata here)
  function makeSnapshot(prev?: BotRow) {
    if (!selectedId || !userId) return;
    const label = autoLabel(prev?.system || '', system);
    const v: Version = { id: `v_${Date.now()}`, ts: Date.now(), label, name, model, temperature, system };
    const next = [v, ...versions].slice(0, 80);
    setVersions(next);
    localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(next));
  }

  async function saveEdits() {
    if (!userId || !selectedId) return;
    try {
      setSaving(true);
      const prev = list.find(b => b.id === selectedId);
      makeSnapshot(prev);

      // best-effort patch to server (we only patch fields we actually allow from Improve)
      try {
        await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
          body: JSON.stringify({ name, model, temperature, system }),
          credentials: 'include',
        });
      } catch {}

      // reflect locally
      setList(cur => cur.map(b => b.id === selectedId ? { ...b, name, model, temperature, system, updatedAt: new Date().toISOString() } : b));
      setDirty(false);
    } catch {
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  // Memory helper (light): keep last ~1000 chars of conversation gist
  function updateLocalMemory(from: ChatMsg[]) {
    if (!useMemory || !userId || !selected) return;
    const last = from.slice(-12).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${stripMd(m.content)}`).join(' | ');
    const mem = `User prefs & style (heuristic): ${last}`.slice(0, 1000);
    setMemoryText(mem);
    try { localStorage.setItem(memoryKey(userId, selected.id), mem); } catch {}
  }

  // === Composed prompt (optimized) + live animation ===
  const composed = useMemo(
    () => composeSystem(system, prePrompt, postPrompt, useMemory ? memoryText : ''),
    [system, prePrompt, postPrompt, useMemory, memoryText]
  );

  const [animatedPrompt, setAnimatedPrompt] = useState('');
  const animTimer = useRef<number | null>(null);
  const lastTargetRef = useRef<string>('');

  function startTypingAnimation(target: string) {
    if (animTimer.current) { window.clearInterval(animTimer.current); animTimer.current = null; }
    // If target shares a long prefix with current, resume from there (feels less "resetty")
    const current = animatedPrompt;
    let i = 0;
    while (i < target.length && i < current.length && target[i] === current[i]) i++;
    let pos = i;
    setAnimatedPrompt(target.slice(0, pos));
    const step = Math.max(1, Math.ceil(target.length / 250)); // speed scales with size
    animTimer.current = window.setInterval(() => {
      pos = Math.min(target.length, pos + step);
      setAnimatedPrompt(target.slice(0, pos));
      if (pos >= target.length) {
        if (animTimer.current) { window.clearInterval(animTimer.current); animTimer.current = null; }
      }
    }, 16) as unknown as number;
  }

  // Trigger animation whenever composed changes and the preview is visible
  useEffect(() => {
    if (!showPromptBlock) return;
    if (composed !== lastTargetRef.current) {
      lastTargetRef.current = composed;
      startTypingAnimation(composed);
    }
    // cleanup on unmount
    return () => { if (animTimer.current) { window.clearInterval(animTimer.current); animTimer.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composed, showPromptBlock]);

  // === Attachments handling ===
  function fileToAttachment(file: File): Promise<Attachment> {
    return new Promise(resolve => {
      const id = `${file.name}_${file.size}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
      const base: Attachment = { id, name: file.name, mime: file.type, size: file.size };
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const fr = new FileReader();
        fr.onload = () => resolve({ ...base, url: String(fr.result || '') });
        fr.readAsDataURL(file);
      } else {
        resolve(base);
      }
    });
  }

  async function addFiles(fileList: FileList | null, kind: 'pics' | 'vids' | 'files') {
    if (!fileList || !fileList.length) return;
    const arr = Array.from(fileList).slice(0, 8);
    const atts = await Promise.all(arr.map(fileToAttachment));
    if (kind === 'pics') setPics(prev => [...prev, ...atts.filter(a => a.mime.startsWith('image/'))].slice(0, 16));
    if (kind === 'vids') setVids(prev => [...prev, ...atts.filter(a => a.mime.startsWith('video/'))].slice(0, 8));
    if (kind === 'files') setFiles(prev => [...prev, ...atts.filter(a => !a.mime.startsWith('image/') && !a.mime.startsWith('video/'))].slice(0, 16));
  }

  // Always-open picker helper (works even if clicking the same tab again)
  const openPicker = useCallback((kind: Tab) => {
    if (kind === 'pics' && picsRef.current) {
      try { picsRef.current.value = ''; } catch {}
      picsRef.current.click();
    }
    if (kind === 'vids' && vidsRef.current) {
      try { vidsRef.current.value = ''; } catch {}
      vidsRef.current.click();
    }
    if (kind === 'files' && filesRef.current) {
      try { filesRef.current.value = ''; } catch {}
      filesRef.current.click();
    }
  }, []);

  // Tab click handler: set the tab and always open picker if media tab
  const onTabClick = (kind: Tab) => {
    setTab(kind);
    if (kind !== 'text') {
      // open immediately (and also re-open on same-tab press)
      setTimeout(() => openPicker(kind), 20);
    }
  };

  // --- Chat send (Support style) ---
  const sendToLane = useCallback(
    async (which: 'A' | 'B', text: string, attachments: Attachment[]) => {
      const laneVersion =
        which === 'A'
          ? { system, model, temperature, versionId: null as string | null }
          : laneB
          ? { system: laneB.system, model: laneB.model, temperature: laneB.temperature, versionId: laneB.id }
          : null;

      if (!laneVersion) return;

      const memory = useMemory ? memoryText : '';
      const effectiveSystem = composeSystem(laneVersion.system, prePrompt, postPrompt, memory);

      const userMsg =
        (text && text.trim()) ||
        (attachments.length ? `(sent ${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : '');
      if (userMsg) {
        if (which === 'A') setMsgsA(cur => [...cur, { role: 'user', content: userMsg }]);
        else setMsgsB(cur => [...cur, { role: 'user', content: userMsg }]);
      }

      setBusy(true);
      try {
        const res = await fetch('/api/support/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: text || '',
            agentId: selected?.id || null,
            versionId: laneVersion.versionId,
            system: effectiveSystem,
            model: laneVersion.model,
            temperature: laneVersion.temperature,
            attachments: attachments.map(a => ({ id: a.id, name: a.name, mime: a.mime, url: a.url, size: a.size })),
          }),
        });

        const data = await res.json().catch(() => null);
        const reply =
          data?.ok && typeof data?.message === 'string'
            ? sanitize(data.message)
            : data?.message
            ? String(data.message)
            : 'Something went wrong.';

        if (which === 'A') {
          setMsgsA(cur => [...cur, { role: 'assistant', content: reply }]);
          updateLocalMemory([...msgsA, { role: 'user', content: text || '' }, { role: 'assistant', content: reply }]);
        } else {
          setMsgsB(cur => [...cur, { role: 'assistant', content: reply }]);
          updateLocalMemory([...msgsB, { role: 'user', content: text || '' }, { role: 'assistant', content: reply }]);
        }
      } catch {
        const fallback = 'Failed to contact server.';
        if (which === 'A') setMsgsA(cur => [...cur, { role: 'assistant', content: fallback }]);
        else setMsgsB(cur => [...cur, { role: 'assistant', content: fallback }]);
      } finally {
        setBusy(false);
      }
    },
    [selected, laneB, system, model, temperature, prePrompt, postPrompt, useMemory, memoryText, msgsA, msgsB]
  );

  // Master send (supports one-shot testVersion + attachments-only)
  async function sendPrompt() {
    if (busy) return;
    const t = (input || '').trim();
    const atts = [...pics, ...vids, ...files];
    if (!t && atts.length === 0) return;

    setInput('');
    setPics([]); setVids([]); setFiles([]);

    if (testVersion) {
      const lane = activeLane;
      const memory = useMemory ? memoryText : '';
      const effectiveSystem = composeSystem(testVersion.system, prePrompt, postPrompt, memory);

      const userMsg = t || (atts.length ? `(sent ${atts.length} attachment${atts.length > 1 ? 's' : ''})` : '');
      if (lane === 'A') setMsgsA(cur => [...cur, { role: 'user', content: userMsg }]);
      else setMsgsB(cur => [...cur, { role: 'user', content: userMsg }]);

      setBusy(true);
      try {
        const res = await fetch('/api/support/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: t || '',
            agentId: selected?.id || null,
            versionId: testVersion.id,
            system: effectiveSystem,
            model: testVersion.model,
            temperature: testVersion.temperature,
            attachments: atts.map(a => ({ id: a.id, name: a.name, mime: a.mime, url: a.url, size: a.size })),
          }),
        });

        const data = await res.json().catch(() => null);
        const reply =
          data?.ok && typeof data?.message === 'string'
            ? sanitize(data.message)
            : data?.message
            ? String(data.message)
            : 'Something went wrong.';

        if (lane === 'A') {
          setMsgsA(cur => [...cur, { role: 'assistant', content: reply }]);
          updateLocalMemory([...msgsA, { role: 'user', content: t || '' }, { role: 'assistant', content: reply }]);
        } else {
          setMsgsB(cur => [...cur, { role: 'assistant', content: reply }]);
          updateLocalMemory([...msgsB, { role: 'user', content: t || '' }, { role: 'assistant', content: reply }]);
        }
      } catch {
        const fallback = 'Failed to contact server.';
        if (lane === 'A') setMsgsA(cur => [...cur, { role: 'assistant', content: fallback }]);
        else setMsgsB(cur => [...cur, { role: 'assistant', content: fallback }]);
      } finally {
        setBusy(false);
        setTestVersion(null);
      }
      return;
    }

    if (sendBoth && laneB) {
      await Promise.all([sendToLane('A', t, atts), sendToLane('B', t, atts)]);
    } else {
      await sendToLane(activeLane, t, atts);
    }
  }

  // Footer drag-and-test (drop a version to test only next message)
  const footerDragOver: React.DragEventHandler = (e) => {
    if (!versions.length) return;
    if (!e.dataTransfer) return;
    e.preventDefault();
    setDropActive(true);
  };
  const footerDragLeave: React.DragEventHandler = () => setDropActive(false);
  const footerDrop: React.DragEventHandler = (e) => {
    e.preventDefault();
    setDropActive(false);
    const id = e.dataTransfer.getData('text/plain');
    const v = versions.find(x => x.id === id);
    if (v) setTestVersion(v);
  };

  // Auto-open when switching to media tabs
  useEffect(() => {
    if (tab !== 'text') {
      const k = tab; setTimeout(() => openPicker(k), 20);
    }
  }, [tab, openPicker]);

  // === UI ===
  return (
    <div className="h-screen w-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 backdrop-blur border-b px-6 py-3"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--bg) 92%, transparent)' }}>
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <Layers className="w-5 h-5" />
          <h1 className="text-[18px] font-semibold">{selected ? (selected.name || 'Assistant') : 'Agent Tuning'}</h1>
          <span className="text-xs px-2 py-[2px] rounded-full" style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)', border: '1px solid var(--border)' }}>
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓'}
          </span>
          {selected && (
            <button onClick={copyId} className="text-xs px-2 py-1 rounded-md hover:opacity-90" style={{ ...CARD, marginLeft: 6 }}>
              {copied ? <><Check className="inline w-3.5 h-3.5 mr-1" /> Copied</> : <><Copy className="inline w-3.5 h-3.5 mr-1" /> ID</>}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => userId && fetchBots(userId)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
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
            <button onClick={() => {
              if (!confirm('Delete this assistant locally? (Server deletion is not exposed here)')) return;
              if (!selected || !userId) return;
              setList(cur => cur.filter(b => b.id !== selected.id));
              localStorage.removeItem(versionsKey(userId, selected.id));
              localStorage.removeItem(memoryKey(userId, selected.id));
              setSelectedId(null);
            }} disabled={!selected || saving}
              className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
              style={{ background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.35)' }}>
              <Trash2 className="inline w-4 h-4 mr-1" /> Delete (local)
            </button>
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="max-w-[1600px] mx-auto px-6 py-5" style={{ height: 'calc(100vh - 62px)' }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: '300px 1fr 300px', height: '100%' }}>
          {/* Left rail: Assistants (read-only list) */}
          <aside className="h-full flex flex-col" style={PANEL}>
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" /><div className="font-semibold">Assistants</div>
              </div>
              <div className="relative mt-3">
                <input placeholder="Search" className="w-full rounded-md pl-8 pr-3 py-2 text-sm outline-none" style={CARD}
                  onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    const rows = list.filter(b =>
                      (b.name || '').toLowerCase().includes(q) ||
                      (b.model || '').toLowerCase().includes(q) ||
                      (b.id || '').toLowerCase().includes(q)
                    );
                    // We don’t alter list; just pick first match for quick nav:
                    if (rows[0]) setSelectedId(rows[0].id);
                  }} />
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
              </div>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 90px)' }}>
              {(!list || list.length === 0) ? (
                <div className="text-sm opacity-80 py-8 text-center">
                  No agents.
                  <div className="mt-2">
                    <Link href="/builder" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: 'var(--brand)', color: '#00120a' }}>
                      Open Builder
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {list.map(b => {
                    const active = selectedId === b.id;
                    return (
                      <li key={b.id}>
                        <button
                          onClick={() => setSelectedId(b.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${active ? 'ring-1' : ''}`}
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.06)', border: '1px solid var(--border)' }}>
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
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-md text-[15px]" style={CARD} placeholder="Agent name" />
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Model</div>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-3 py-2 rounded-md" style={CARD}>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Temperature</div>
                  <div className="flex items-center gap-2">
                    {(['Precise', 'Balanced', 'Creative'] as const).map((lbl, idx) => {
                      const val = idx === 0 ? 0.1 : idx === 1 ? 0.5 : 0.9;
                      const active = Math.abs(temperature - val) < 0.01;
                      return (
                        <button key={lbl} onClick={() => setTemperature(val)}
                          className={`px-3 py-2 rounded-md text-sm ${active ? 'ring-1' : ''}`}
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Prompt controls */}
              <div className="mt-3 grid gap-2 items-center" style={{ gridTemplateColumns: 'auto auto 1fr auto' }}>
                <button
                  onClick={() => { setShowPromptBlock(true); startTypingAnimation(composed); }}
                  className="px-3 py-2 rounded-md text-sm"
                  style={{ ...CARD }}
                >
                  <ChevronDown className="inline w-4 h-4 mr-1" /> Show prompt
                </button>
                <button
                  onClick={() => setShowPromptBlock(false)}
                  className="px-3 py-2 rounded-md text-sm"
                  style={{ ...CARD }}
                >
                  <X className="inline w-4 h-4 mr-1" /> Hide
                </button>
                <div />
                <label className="text-xs flex items-center gap-2 justify-end">
                  <input type="checkbox" checked={useMemory} onChange={(e)=>setUseMemory(e.target.checked)} /> Use local memory
                </label>
              </div>

              {showPromptBlock && (
                <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Pre Prompt <span className="opacity-50">(prepends)</span></div>
                    <textarea value={prePrompt} onChange={(e) => setPrePrompt(e.target.value)} rows={5}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                      placeholder="Role/goals/boundaries…" />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Post Prompt <span className="opacity-50">(appends)</span></div>
                    <textarea value={postPrompt} onChange={(e) => setPostPrompt(e.target.value)} rows={5}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                      placeholder="Formatting/checks/constraints…" />
                  </div>

                  <div className="col-span-2">
                    <div className="text-xs opacity-70 mb-1">System Prompt (main behavior)</div>
                    <textarea value={system} onChange={(e) => setSystem(e.target.value)} rows={10}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6" style={CARD}
                      placeholder="Short, bullet points preferred…" />
                  </div>

                  {/* Live, animated composed prompt preview */}
                  <div className="col-span-2">
                    <div className="text-xs opacity-70 mb-1">Composed Prompt (read-only preview)</div>
                    <pre
                      className="w-full px-3 py-3 rounded-md overflow-auto text-[13px] leading-6"
                      style={{ ...CARD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                    >
{animatedPrompt}
                    </pre>
                  </div>

                  {useMemory && (
                    <div className="col-span-2">
                      <div className="text-xs opacity-70 mb-1">Local Memory (auto-updates from recent chats)</div>
                      <textarea value={memoryText} onChange={(e)=>setMemoryText(e.target.value)} rows={4}
                        className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD} />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 text-[11px] opacity-60">est {fmtTok([system, prePrompt, postPrompt].join('\n'))} tok</div>
            </div>

            {/* Live Test */}
            <div className="p-3 grid gap-3" style={{ ...PANEL, gridTemplateRows: 'auto 1fr auto' }}>
              <div className="flex items-center justify-between">
                <div className="font-medium flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Live Test</div>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={sendBoth} onChange={(e) => setSendBoth(e.target.checked)} />
                  Send to both lanes
                </label>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: laneB ? '1fr 1fr' : '1fr', height: '100%', minHeight: 380 }}>
                {/* Lane A */}
                <div className="flex flex-col rounded-md border" style={{ ...CARD, ...(activeLane === 'A'
                  ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 2px color-mix(in oklab, var(--brand) 40%, transparent) inset' }
                  : {}) }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm font-medium">Lane A (current)</div>
                    <button onClick={() => setActiveLane('A')} className="text-xs px-2 py-1 rounded" style={CARD}>Focus</button>
                  </div>
                  <div className="flex-1 overflow-auto p-3 text-sm leading-6">
                    {msgsA.length === 0 ? <div className="opacity-50">No messages yet.</div> :
                      msgsA.map((m, i) => <div key={i} className="mb-2"><b>{m.role === 'user' ? 'You' : m.role === 'assistant' ? 'AI' : 'Sys'}:</b> <span>{m.content}</span></div>)}
                  </div>
                </div>

                {/* Lane B */}
                {laneB ? (
                  <div className="flex flex-col rounded-md border" style={{ ...CARD, ...(activeLane === 'B'
                    ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 2px color-mix(in oklab, var(--brand) 40%, transparent) inset' }
                    : {}) }}>
                    <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                      <div className="text-sm">
                        <span className="font-medium">Lane B (version):</span> {laneB.label} <span className="opacity-60 text-xs">• {fmtTime(laneB.ts)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveLane('B')} className="text-xs px-2 py-1 rounded" style={CARD}>Focus</button>
                        <button onClick={() => setLaneB(null)} className="text-xs px-2 py-1 rounded" style={CARD}><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-3 text-sm leading-6">
                      {msgsB.length === 0 ? <div className="opacity-50">No messages yet.</div> :
                        msgsB.map((m, i) => <div key={i} className="mb-2"><b>{m.role === 'user' ? 'You' : m.role === 'assistant' ? 'AI' : 'Sys'}:</b> <span>{m.content}</span></div>)}
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

              {/* Input + Tabs + Footer Drop Target */}
              <div
                className="space-y-2 rounded-md"
                onDragOver={(e)=>{footerDragOver(e);}}
                onDragLeave={footerDragLeave}
                onDrop={(e)=>{footerDrop(e); /* also accept file drop */}}
                style={{
                  border: dropActive ? '1px dashed var(--brand)' : '1px dashed transparent',
                  padding: 8
                }}
              >
                {/* Hidden file inputs (auto-opened from tabs) */}
                <input ref={picsRef} type="file" accept="image/*" multiple className="hidden" onChange={(e)=>addFiles(e.target.files,'pics')} />
                <input ref={vidsRef} type="file" accept="video/*" multiple className="hidden" onChange={(e)=>addFiles(e.target.files,'vids')} />
                <input ref={filesRef} type="file" multiple className="hidden" onChange={(e)=>addFiles(e.target.files,'files')} />

                {/* One-shot test badge */}
                {testVersion && (
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className="px-2 py-1 rounded-md" style={{ ...CARD, borderColor: 'var(--brand)' }}>
                      Testing next message with <b className="ml-1" style={{ color:'var(--brand)' }}>{testVersion.label}</b>
                    </span>
                    <button className="text-xs px-2 py-1 rounded-md" style={CARD} onClick={()=>setTestVersion(null)}><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={()=>onTabClick('text')} className={`px-2 py-1 rounded ${tab==='text'?'ring-1':''}`} style={{ ...CARD, borderColor: tab==='text'?'var(--brand)':'var(--border)' }}>Text</button>
                  <button onClick={()=>onTabClick('pics')} className={`px-2 py-1 rounded ${tab==='pics'?'ring-1':''}`} style={{ ...CARD, borderColor: tab==='pics'?'var(--brand)':'var(--border)' }}><ImageIcon className="inline w-3.5 h-3.5 mr-1" />Pictures</button>
                  <button onClick={()=>onTabClick('vids')} className={`px-2 py-1 rounded ${tab==='vids'?'ring-1':''}`} style={{ ...CARD, borderColor: tab==='vids'?'var(--brand)':'var(--border)' }}><Film className="inline w-3.5 h-3.5 mr-1" />Videos</button>
                  <button onClick={()=>onTabClick('files')} className={`px-2 py-1 rounded ${tab==='files'?'ring-1':''}`} style={{ ...CARD, borderColor: tab==='files'?'var(--brand)':'var(--border)' }}><FileText className="inline w-3.5 h-3.5 mr-1" />Files</button>
                  <div className="ml-auto text-[10px] opacity-50">Tip: drag a version onto this footer to test it for one message</div>
                </div>

                {/* Text composer */}
                {tab === 'text' && (
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message… (or just send attachments)"
                      rows={1}
                      className="flex-1 px-3 py-2 rounded-md bg-transparent outline-none resize-none text-sm"
                      style={CARD}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendPrompt(); } }}
                    />
                    <button
                      onClick={() => void sendPrompt()}
                      disabled={busy || (!input.trim() && (pics.length+vids.length+files.length===0))}
                      className="px-3 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
                      style={{ background: 'var(--brand)', color: '#00120a' }}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                    </button>
                  </div>
                )}

                {/* Pictures */}
                {tab === 'pics' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-x-auto flex gap-2">
                      {pics.length === 0 ? (
                        <div className="text-xs opacity-60 px-2">No pictures selected. The picker should be open — or click the Pictures tab again.</div>
                      ) : pics.map(att => (
                        <div key={att.id} className="min-w-[120px] max-w-[160px] flex items-center gap-2 px-2 py-1 rounded-md border" style={{ ...CARD }}>
                          {att.url ? <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 bg-black/10 rounded" />}
                          <span className="text-[11px] truncate max-w-[120px]">{att.name}</span>
                          <button className="text-[11px] opacity-70 hover:opacity-100" onClick={()=>setPics(prev=>prev.filter(a=>a.id!==att.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => void sendPrompt()} disabled={busy || ((pics.length+vids.length+files.length===0) && !input.trim())} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background: 'var(--brand)', color: '#00120a' }}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                    </button>
                  </div>
                )}

                {/* Videos */}
                {tab === 'vids' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-x-auto flex gap-2">
                      {vids.length === 0 ? (
                        <div className="text-xs opacity-60 px-2">No videos selected. The picker should be open — or click the Videos tab again.</div>
                      ) : vids.map(att => (
                        <div key={att.id} className="min-w-[140px] max-w-[200px] flex items-center gap-2 px-2 py-1 rounded-md border" style={{ ...CARD }}>
                          {att.url ? <video src={att.url} className="w-14 h-10 rounded" muted /> : <div className="w-14 h-10 bg-black/10 rounded" />}
                          <span className="text-[11px] truncate max-w-[120px]">{att.name}</span>
                          <button className="text-[11px] opacity-70 hover:opacity-100" onClick={()=>setVids(prev=>prev.filter(a=>a.id!==att.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => void sendPrompt()} disabled={busy || ((pics.length+vids.length+files.length===0) && !input.trim())} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background: 'var(--brand)', color: '#00120a' }}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                    </button>
                  </div>
                )}

                {/* Files */}
                {tab === 'files' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-x-auto flex gap-2">
                      {files.length === 0 ? (
                        <div className="text-xs opacity-60 px-2">No files selected. The picker should be open — or click the Files tab again.</div>
                      ) : files.map(att => (
                        <div key={att.id} className="min-w-[140px] max-w-[220px] flex items-center gap-2 px-2 py-1 rounded-md border" style={{ ...CARD }}>
                          <Paperclip className="w-4 h-4" />
                          <span className="text-[11px] truncate max-w-[160px]">{att.name}</span>
                          <button className="text-[11px] opacity-70 hover:opacity-100" onClick={()=>setFiles(prev=>prev.filter(a=>a.id!==att.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => void sendPrompt()} disabled={busy || ((pics.length+vids.length+files.length===0) && !input.trim())} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background: 'var(--brand)', color: '#00120a' }}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                    </button>
                  </div>
                )}

                <div className="text-[9px] opacity-40 text-center">Drop a version here to test it once • pickers auto-open on their tabs</div>
              </div>
            </div>
          </section>

          {/* Right rail — Versions */}
          <aside className="h-full flex flex-col" style={PANEL}>
            <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <History className="w-4 h-4" />
              <div className="font-semibold">Versions</div>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {(!versions || versions.length === 0) ? (
                <div className="text-sm opacity-60">No snapshots yet. Click <b>Save + Snapshot</b> to create one.</div>
              ) : (
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id} draggable onDragStart={(e)=>e.dataTransfer.setData('text/plain', v.id)}
                      className="group p-2 rounded-md text-sm border" style={{ ...CARD, cursor: 'grab' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium" style={{ color: 'var(--brand)' }}>{v.label}</div>
                          <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                          <button
                            onClick={() => { setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true); }}
                            className="px-2 py-1 rounded-md text-xs"
                            style={CARD}
                            title="Restore into editor"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setLaneB(v)} className="px-2 py-1 rounded-md text-xs" style={CARD} title="Open as Lane B">
                            <SplitIcon />
                          </button>
                          <button onClick={() => setTestVersion(v)} className="px-2 py-1 rounded-md text-xs" style={CARD} title="Test next message with this version">
                            Test
                          </button>
                        </div>
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
