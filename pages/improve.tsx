// pages/improve.tsx
// Improve = tune / test / compare existing agents.
// Changes in this version:
// - Owner scoping: **Supabase user id** is the single source of truth. We pass it as header + query and set cookie.
// - Mobile footer: pictures/videos/files collapse into a single "+" unified picker.
// - "Show Prompt": story-style rundown preview (friendly narrative).
// - When a rule is added (Quick Rule or "Add rule" box), the preview animates with a scramble typing effect.

'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import Link from 'next/link';
import {
  Bot, Search, Loader2, Save, Trash2, RefreshCw, History, RotateCcw, X,
  Upload, Download, MessageSquare, Send, CornerDownRight, ChevronDown,
  Image as ImageIcon, Paperclip, Film, FileText, Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

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

/* UI styles */
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

/* Keys & utils */
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const memoryKey = (o: string, a: string) => `memory:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const stripMd = (t: string) =>
  (t || '').replace(/```[\s\S]*?```/g, '').replace(/[*_`>#-]/g, '').replace(/\s+/g, ' ').trim();
const sanitize = (text: string) =>
  (text || '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1');

/* Snapshot label heuristic */
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

/* Compose a structured, readable prompt (used internally when sending) */
function composeSystem(base: string, quickRules: string, pre: string, post: string, memory: string | null) {
  const blocks: string[] = [];
  if (pre.trim()) blocks.push(`### PRE\n${pre.trim()}`);
  if (memory && memory.trim()) blocks.push(`### MEMORY (local)\n${memory.trim()}`);
  let main = base.trim();
  if (quickRules.trim()) {
    const lines = quickRules.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length) main = `### RULES\n${lines.map((r, i) => `${i + 1}) ${r}`).join('\n')}\n\n${main}`;
  }
  blocks.push(`### SYSTEM (main)\n${main}`);
  if (post.trim()) blocks.push(`### POST\n${post.trim()}`);
  return blocks.join('\n\n').trim();
}

/* === Scramble / typing animation for the prompt preview === */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?@#$%&*+=-:. ';
function ScrambleText({ text, runKey = 0, fps = 60, durationMs = 900, className }: {
  text: string; runKey?: number; fps?: number; durationMs?: number; className?: string;
}) {
  const [out, setOut] = useState(text);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(text);

  useEffect(() => {
    fromRef.current = out; // start from whatever is visible
    cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();
    const steps = Math.max(12, Math.round((durationMs / 1000) * fps));

    function step(now: number) {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const target = text;
      const from = fromRef.current || '';
      const len = Math.max(from.length, target.length);
      let next = '';
      for (let i = 0; i < len; i++) {
        const pct = i / len;
        // characters earlier settle sooner; later chars scramble longer
        const settle = t * 1.1 - pct * 0.6;
        if (settle >= 1) {
          next += target[i] || '';
        } else if (settle <= 0) {
          next += (from[i] ?? '');
        } else {
          // mid-scramble
          const pick = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          // small chance to already show the right char
          next += Math.random() < settle * 0.6 ? (target[i] || '') : pick;
        }
      }
      setOut(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, text, fps, durationMs]);

  return <pre className={className}>{out}</pre>;
}

/* Component */
export default function Improve() {
  /* --------- Identity: Supabase user id everywhere --------- */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const supaId = data?.user?.id || null;
      setUserId(supaId);
      // Keep cookie fallback aligned with the same id so API's cookie path matches too.
      if (supaId) {
        try {
          document.cookie = `ra_uid=${encodeURIComponent(supaId)}; path=/; max-age=31536000`;
        } catch {}
      }
    })();
  }, []);

  /* List + selection */
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  // Editor state
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [prePrompt, setPrePrompt] = useState('');
  const [postPrompt, setPostPrompt] = useState('');
  const [quickRule, setQuickRule] = useState('');
  const [showPromptBlock, setShowPromptBlock] = useState(false);

  // Memory
  const [useMemory, setUseMemory] = useState(true);
  const [memoryText, setMemoryText] = useState('');

  // Versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoSnapshot, setAutoSnapshot] = useState(true);

  // Live test lanes
  const [laneB, setLaneB] = useState<Version | null>(null);
  const [sendBoth, setSendBoth] = useState(false);
  const [activeLane, setActiveLane] = useState<'A' | 'B'>('A');
  const [msgsA, setMsgsA] = useState<ChatMsg[]>([]);
  const [msgsB, setMsgsB] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');

  // Tabs + attachments (desktop)
  type Tab = 'text' | 'pics' | 'vids' | 'files';
  const [tab, setTab] = useState<Tab>('text');

  const [pics, setPics] = useState<Attachment[]>([]);
  const [vids, setVids] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const picsRef = useRef<HTMLInputElement | null>(null);
  const vidsRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);

  // Unified mobile picker
  const unifiedRef = useRef<HTMLInputElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Auto-open “once per tab enter”
  const [tabOpenNonce, setTabOpenNonce] = useState<{ pics: number; vids: number; files: number }>({ pics: 0, vids: 0, files: 0 });

  // Footer drop state
  const [dropActive, setDropActive] = useState(false);
  const [testVersion, setTestVersion] = useState<Version | null>(null);

  // Scramble animation nonce (bump to re-run)
  const [scrambleRun, setScrambleRun] = useState(0);

  /* Load agents with Supabase user id */
  const fetchBots = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, {
        headers: { 'x-owner-id': uid },
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      const rows: BotRow[] = Array.isArray(json?.data) ? json.data : [];
      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      console.error('[Improve] fetchBots failed:', e);
      setList([]);
      setSelectedId(null);
    }
  }, [selectedId]);

  useEffect(() => { if (userId) void fetchBots(userId); }, [userId, fetchBots]);

  /* Load selection state */
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    setPrePrompt(''); setPostPrompt(''); setQuickRule('');
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

  /* Unsaved guard */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (!dirty) return; e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /* Dirty tracking */
  useEffect(() => {
    if (!selected) return;
    const d =
      name !== (selected.name || '') ||
      model !== (selected.model || 'gpt-4o') ||
      Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9 ||
      system !== (selected.system || '') ||
      prePrompt !== '' || postPrompt !== '' || quickRule !== '';
    setDirty(d);
  }, [name, model, temperature, system, prePrompt, postPrompt, quickRule, selected]);

  /* Filter/sort left rail */
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

  /* Helpers */
  const copyId = async () => { if (!selected) return; await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(() => setCopied(false), 900); };
  const fmtTok = (s: string) => Math.max(1, Math.round((s || '').length / 4));

  /* Snapshot helper */
  function makeSnapshot(prev?: BotRow) {
    if (!selectedId || !userId) return;
    const label = autoLabel(prev?.system || '', system);
    const v: Version = { id: `v_${Date.now()}`, ts: Date.now(), label, name, model, temperature, system };
    const next = [v, ...versions].slice(0, 80);
    setVersions(next);
    try { localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(next)); } catch {}
  }

  /* Save back to API */
  async function saveEdits() {
    if (!userId || !selectedId) return;
    try {
      setSaving(true);
      const prev = list.find(b => b.id === selectedId);
      makeSnapshot(prev);
      await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        credentials: 'include',
        body: JSON.stringify({ name, model, temperature, system }),
      });
      // refresh display-only fields
      setList(cur => cur.map(b => b.id === selectedId ? { ...b, name, model, temperature, system, updatedAt: new Date().toISOString() } : b));
      setDirty(false);
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!userId || !selectedId) return;
    if (!confirm('Delete this assistant?')) return;
    try {
      await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'x-owner-id': userId },
        credentials: 'include',
      });
      setList(cur => cur.filter(b => b.id !== selectedId));
      setSelectedId(null);
    } catch {
      alert('Failed to delete');
    }
  }

  /* Quick Rule → merge visually into System + animate preview */
  function applyQuickRule() {
    if (!quickRule.trim()) return;
    const merged = composeSystem(system, quickRule, '', '', null);
    setSystem(merged);
    setQuickRule('');
    setDirty(true);
    setScrambleRun(n => n + 1); // trigger scramble animation in preview
    if (autoSnapshot) {
      const prev = list.find(b => b.id === selectedId!);
      makeSnapshot(prev);
    }
  }

  /* "Add rule" helper used in story preview panel */
  function addRuleLine(line: string) {
    if (!line.trim()) return;
    const merged = composeSystem(system, line, '', '', null);
    setSystem(merged);
    setDirty(true);
    setScrambleRun(n => n + 1);
  }

  /* Memory update (heuristic) */
  function updateLocalMemory(from: ChatMsg[]) {
    if (!useMemory || !userId || !selected) return;
    const last = from.slice(-12).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${stripMd(m.content)}`).join(' | ');
    const mem = `User prefs & style (heuristic): ${last}`.slice(0, 1000);
    setMemoryText(mem);
    try { localStorage.setItem(memoryKey(userId, selected.id), mem); } catch {}
  }

  /* Attachments helpers */
  const currentAttachments = useCallback(() => [...pics, ...vids, ...files], [pics, vids, files]);

  function resetPickerValue(inp: HTMLInputElement | null) {
    if (!inp) return;
    try { inp.value = ''; } catch {}
  }

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

  // Unified handler (mobile "+")
  async function addUnified(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files;
    if (!fl || !fl.length) return;
    const arr = Array.from(fl).slice(0, 16);
    for (const f of arr) {
      const att = await fileToAttachment(f);
      if (att.mime.startsWith('image/')) setPics(prev => [...prev, att].slice(0, 16));
      else if (att.mime.startsWith('video/')) setVids(prev => [...prev, att].slice(0, 8));
      else setFiles(prev => [...prev, att].slice(0, 16));
    }
    resetPickerValue(unifiedRef.current);
  }

  /* Chat send */
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
      const effectiveSystem = composeSystem(laneVersion.system, '', prePrompt, postPrompt, memory);

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
          body: JSON.stringify({
            message: text || '',
            agentId: selected?.id || null,
            versionId: laneVersion.versionId,
            system: effectiveSystem,
            model: laneVersion.model,
            temperature: laneVersion.temperature,
            attachments: attachments.map(a => ({
              id: a.id, name: a.name, mime: a.mime, url: a.url, size: a.size
            })),
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

  async function sendPrompt() {
    if (busy) return;
    const t = (input || '').trim();
    const atts = currentAttachments();
    if (!t && atts.length === 0) return;

    setInput('');
    setPics([]); setVids([]); setFiles([]);

    if (testVersion) {
      const lane = activeLane;
      const memory = useMemory ? memoryText : '';
      const effectiveSystem = composeSystem(testVersion.system, '', prePrompt, postPrompt, memory);
      const userMsg = t || (atts.length ? `(sent ${atts.length} attachment${atts.length > 1 ? 's' : ''})` : '');
      if (lane === 'A') setMsgsA(cur => [...cur, { role: 'user', content: userMsg }]);
      else setMsgsB(cur => [...cur, { role: 'user', content: userMsg }]);

      setBusy(true);
      try {
        const res = await fetch('/api/support/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            : data?.message ? String(data.message) : 'Something went wrong.';

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

  /* Footer drop: versions */
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

  /* Footer drop: files */
  const onFooterFileDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    const filesArr = Array.from(e.dataTransfer.files);
    const img = filesArr.filter(f => f.type.startsWith('image/'));
    const vid = filesArr.filter(f => f.type.startsWith('video/'));
    const oth = filesArr.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));
    if (img.length) {
      const atts = await Promise.all(img.map(fileToAttachment));
      setPics(prev => [...prev, ...atts].slice(0, 16));
    }
    if (vid.length) {
      const atts = await Promise.all(vid.map(fileToAttachment));
      setVids(prev => [...prev, ...atts].slice(0, 8));
    }
    if (oth.length) {
      const atts = await Promise.all(oth.map(fileToAttachment));
      setFiles(prev => [...prev, ...atts].slice(0, 16));
    }
  };

  /* Auto-open pickers once per tab enter (desktop only) */
  useEffect(() => {
    if (isMobile) return; // unified picker on mobile
    const openSoon = (fn: () => void) => setTimeout(fn, 30);
    if (tab === 'pics') {
      if (tabOpenNonce.pics === 0) openSoon(() => { resetPickerValue(picsRef.current); picsRef.current?.click(); });
      setTabOpenNonce(n => ({ ...n, pics: n.pics + 1 }));
    } else if (tab === 'vids') {
      if (tabOpenNonce.vids === 0) openSoon(() => { resetPickerValue(vidsRef.current); vidsRef.current?.click(); });
      setTabOpenNonce(n => ({ ...n, vids: n.vids + 1 }));
    } else if (tab === 'files') {
      if (tabOpenNonce.files === 0) openSoon(() => { resetPickerValue(filesRef.current); filesRef.current?.click(); });
      setTabOpenNonce(n => ({ ...n, files: n.files + 1 }));
    }
  }, [isMobile, tab, tabOpenNonce.pics, tabOpenNonce.vids, tabOpenNonce.files]);

  /* Compiled system for API; separate from the "story preview" text below */
  const compiledPrompt = useMemo(
    () => composeSystem(system, quickRule ? quickRule : '', prePrompt, postPrompt, useMemory ? memoryText : ''),
    [system, quickRule, prePrompt, postPrompt, useMemory, memoryText]
  );
  const compiledTok = useMemo(() => Math.max(1, Math.round((compiledPrompt || '').length / 4)), [compiledPrompt]);

  /* Narrative story preview (friendly) */
  function storyPreview(): string {
    const tLabel = temperature <= 0.25 ? 'precise' : temperature >= 0.75 ? 'creative' : 'balanced';
    const rules =
      (quickRule || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    const baseName = name || 'test';
    const intro = `Hi, I’m ${baseName} — your AI copilot. I think with the ${model} model and prefer a ${tLabel} tone.`;
    const whatIDo = `My job is to help you iterate on prompts, compare versions, and quickly test ideas. I keep context short and tidy unless you ask me to expand.`;
    const ruleLines = rules.length
      ? `Here’s how I currently behave:\n${rules.map(r => `• ${r}`).join('\n')}`
      : `You haven’t added any fresh rules yet — I’ll follow the base system instructions you’ve written.`;
    const endings = `If something’s ambiguous, I’ll ask a quick clarifying question. Drop files or snapshots on the test footer, and I’ll handle them without extra text.`;
    return [intro, whatIDo, ruleLines, endings].join('\n\n');
  }

  /* UI */
  return (
    <div className="h-screen w-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{`
        .fade-swap { transition: opacity .18s ease, transform .18s ease; }
        .fade-enter { opacity: 0.001; transform: translateY(3px); }
        .fade-enter-active { opacity: 1; transform: translateY(0); }
      `}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-20 backdrop-blur border-b px-6 py-3"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--bg) 92%, transparent)' }}>
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <MessageSquare className="w-5 h-5" />
          <h1 className="text-[18px] font-semibold">{selected ? (selected.name || 'Assistant') : 'Agent Tuning'}</h1>

          <span className="text-xs px-2 py-[2px] rounded-full" style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)', border: '1px solid var(--border)' }}>
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓'}
          </span>

          <label className="ml-2 text-xs inline-flex items-center gap-2 px-2 py-1 rounded-md" style={{ ...CARD }}>
            <input type="checkbox" checked={autoSnapshot} onChange={e => setAutoSnapshot(e.target.checked)} />
            Auto-snapshot on Quick Rule
            <Info className="w-3.5 h-3.5 opacity-60" title="When ON, applying a Quick Rule also creates a snapshot." />
          </label>

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
                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="px-2 py-1 rounded-md text-xs" style={CARD}>
                  <option value="updated_desc">Recent</option>
                  <option value="name_asc">Name</option>
                </select>
              </div>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 90px)' }}>
              {!userId ? (
                <div className="text-sm opacity-80 py-8">
                  Please sign in to load your agents (we use your Supabase user id for owner scoping).
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
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${active ? 'ring-1' : ''}`}
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.06)', border: '1px solid var(--border)' }}>
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{b.name || 'Untitled'}</div>
                            <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0, 8)}</div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(b.id); setCopied(true); setTimeout(() => setCopied(false), 900); }}
                            className="text-[10px] px-2 py-1 rounded-md"
                            style={CARD}
                            title="Copy ID"
                          >
                            {copied ? 'Copied ✓' : 'Copy ID'}
                          </button>
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

              {/* Quick Rule + Prompt visibility + Memory */}
              <div className="mt-3 grid gap-2 items-center" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
                <input
                  value={quickRule}
                  onChange={(e) => setQuickRule(e.target.value)}
                  placeholder='Quick rule (e.g., "Only answer Yes/No") – Update merges into System'
                  className="px-3 py-2 rounded-md text-sm"
                  style={CARD}
                />
                <button onClick={applyQuickRule} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  <CornerDownRight className="inline w-4 h-4 mr-1" /> Update
                </button>
                <button onClick={() => { setShowPromptBlock(s => !s); setScrambleRun(n => n + 1); }} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  <ChevronDown className="inline w-4 h-4 mr-1" /> {showPromptBlock ? 'Hide prompt' : 'Show prompt'}
                </button>
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} /> Use local memory
                </label>
              </div>

              {showPromptBlock && (
                <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Pre Prompt <span className="opacity-50">(prepends)</span></div>
                    <textarea value={prePrompt} onChange={(e) => setPrePrompt(e.target.value)} rows={5}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                      placeholder="Optional: role, goals, boundaries…" />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Post Prompt <span className="opacity-50">(appends)</span></div>
                    <textarea value={postPrompt} onChange={(e) => setPostPrompt(e.target.value)} rows={5}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                      placeholder="Optional: formatting, checks, constraints…" />
                  </div>

                  {/* Story-style Prompt Preview with scramble animation */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs opacity-70">Prompt Preview (story style)</div>
                      <div className="text-[11px] opacity-60">est {compiledTok} tok</div>
                    </div>
                    <ScrambleText
                      key={scrambleRun}
                      runKey={scrambleRun}
                      text={storyPreview()}
                      durationMs={1100}
                      className="fade-swap fade-enter whitespace-pre-wrap text-[13px] leading-6 px-3 py-2 rounded-md font-mono"
                      style={CARD as any}
                    />
                    {/* Add rule box within preview */}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        placeholder="Add rule (press Enter)…"
                        onKeyDown={(e: any) => { if (e.key === 'Enter') { addRuleLine((e.target.value || '').trim()); e.target.value = ''; } }}
                        className="px-3 py-2 rounded-md text-sm flex-1"
                        style={CARD}
                      />
                      <button onClick={() => setScrambleRun(n => n + 1)} className="px-2 py-2 rounded-md text-sm" style={CARD}>Re-animate</button>
                    </div>
                  </div>
                </div>
              )}
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
                <div className="flex flex-col rounded-md border" style={{
                  ...CARD, ...(activeLane === 'A'
                    ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 2px color-mix(in oklab, var(--brand) 40%, transparent) inset' }
                    : {})
                }}>
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
                  <div className="flex flex-col rounded-md border" style={{
                    ...CARD, ...(activeLane === 'B'
                      ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 2px color-mix(in oklab, var(--brand) 40%, transparent) inset' }
                      : {})
                  }}>
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

              {/* Footer: input + tabs (desktop) / unified + (mobile) + drop target */}
              <div
                className="space-y-2 rounded-md"
                onDragOver={(e) => { footerDragOver(e); }}
                onDragLeave={footerDragLeave}
                onDrop={(e) => { footerDrop(e); onFooterFileDrop(e as any); }}
                style={{
                  border: dropActive ? '1px dashed var(--brand)' : '1px dashed transparent',
                  padding: 8
                }}
              >
                {/* Test pill */}
                {testVersion && (
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className="px-2 py-1 rounded-md" style={{ ...CARD, borderColor: 'var(--brand)' }}>
                      Testing next message with <b className="ml-1" style={{ color: 'var(--brand)' }}>{testVersion.label}</b>
                    </span>
                    <button className="text-xs px-2 py-1 rounded-md" style={CARD} onClick={() => setTestVersion(null)}><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}

                {/* Desktop tabs */}
                {!isMobile && (
                  <>
                    <div className="flex items-center gap-2 text-xs">
                      <button onClick={() => { setTab('text'); setTabOpenNonce({ pics: 0, vids: 0, files: 0 }); }} className={`px-2 py-1 rounded ${tab === 'text' ? 'ring-1' : ''}`} style={{ ...CARD, borderColor: tab === 'text' ? 'var(--brand)' : 'var(--border)' }}>Text</button>
                      <button onClick={() => { setTab('pics'); setTabOpenNonce({ pics: 0, vids: 0, files: 0 }); }} className={`px-2 py-1 rounded ${tab === 'pics' ? 'ring-1' : ''}`} style={{ ...CARD, borderColor: tab === 'pics' ? 'var(--brand)' : 'var(--border)' }}><ImageIcon className="inline w-3.5 h-3.5 mr-1" />Pictures</button>
                      <button onClick={() => { setTab('vids'); setTabOpenNonce({ pics: 0, vids: 0, files: 0 }); }} className={`px-2 py-1 rounded ${tab === 'vids' ? 'ring-1' : ''}`} style={{ ...CARD, borderColor: tab === 'vids' ? 'var(--brand)' : 'var(--border)' }}><Film className="inline w-3.5 h-3.5 mr-1" />Videos</button>
                      <button onClick={() => { setTab('files'); setTabOpenNonce({ pics: 0, vids: 0, files: 0 }); }} className={`px-2 py-1 rounded ${tab === 'files' ? 'ring-1' : ''}`} style={{ ...CARD, borderColor: tab === 'files' ? 'var(--brand)' : 'var(--border)' }}><FileText className="inline w-3.5 h-3.5 mr-1" />Files</button>
                      <div className="ml-auto text-[10px] opacity-50">Tip: drop a version card here to test once · drop files to attach</div>
                    </div>

                    {/* TEXT */}
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
                          disabled={busy || (!input.trim() && currentAttachments().length === 0)}
                          className="px-3 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
                          style={{ background: 'var(--brand)', color: '#00120a' }}
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                        </button>
                      </div>
                    )}

                    {/* PICTURES */}
                    {tab === 'pics' && (
                      <div className="flex items-center gap-2">
                        <input
                          ref={picsRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onClick={() => resetPickerValue(picsRef.current)}
                          onChange={(e) => addFiles(e.target.files, 'pics')}
                        />
                        <div className="flex-1 overflow-x-auto flex gap-2">
                          {pics.length === 0 && (
                            <div className="text-xs opacity-60 px-2">No pictures selected. <button className="underline" onClick={() => { resetPickerValue(picsRef.current); picsRef.current?.click(); }}>Re-open picker</button></div>
                          )}
                          {pics.map(att => (
                            <div key={att.id} className="min-w-[120px] max-w-[160px] flex items-center gap-2 px-2 py-1 rounded-md border" style={{ ...CARD }}>
                              {att.url ? <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 bg-black/10 rounded" />}
                              <span className="text-[11px] truncate max-w-[120px]">{att.name}</span>
                              <button className="text-[11px] opacity-70 hover:opacity-100" onClick={() => setPics(prev => prev.filter(a => a.id !== att.id))}>✕</button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => void sendPrompt()} disabled={busy || (currentAttachments().length === 0 && !input.trim())} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background: 'var(--brand)', color: '#00120a' }}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                        </button>
                      </div>
                    )}

                    {/* VIDEOS */}
                    {tab === 'vids' && (
                      <div className="flex items-center gap-2">
                        <input
                          ref={vidsRef}
                          type="file"
                          accept="video/*"
                          multiple
                          className="hidden"
                          onClick={() => resetPickerValue(vidsRef.current)}
                          onChange={(e) => addFiles(e.target.files, 'vids')}
                        />
                        <div className="flex-1 overflow-x-auto flex gap-2">
                          {vids.length === 0 && (
                            <div className="text-xs opacity-60 px-2">No videos selected. <button className="underline" onClick={() => { resetPickerValue(vidsRef.current); vidsRef.current?.click(); }}>Re-open picker</button></div>
                          )}
                          {vids.map(att => (
                            <div key={att.id} className="min-w-[140px] max-w-[200px] flex items-center gap-2 px-2 py-1 rounded-md border" style={{ ...CARD }}>
                              {att.url ? <video src={att.url} className="w-14 h-10 rounded" muted /> : <div className="w-14 h-10 bg-black/10 rounded" />}
                              <span className="text-[11px] truncate max-w-[120px]">{att.name}</span>
                              <button className="text-[11px] opacity-70 hover:opacity-100" onClick={() => setVids(prev => prev.filter(a => a.id !== att.id))}>✕</button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => void sendPrompt()} disabled={busy || (currentAttachments().length === 0 && !input.trim())} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background: 'var(--brand)', color: '#00120a' }}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                        </button>
                      </div>
                    )}

                    {/* FILES */}
                    {tab === 'files' && (
                      <div className="flex items-center gap-2">
                        <input
                          ref={filesRef}
                          type="file"
                          multiple
                          className="hidden"
                          onClick={() => resetPickerValue(filesRef.current)}
                          onChange={(e) => addFiles(e.target.files, 'files')}
                        />
                        <div className="flex-1 overflow-x-auto flex gap-2">
                          {files.length === 0 && (
                            <div className="text-xs opacity-60 px-2">No files selected. <button className="underline" onClick={() => { resetPickerValue(filesRef.current); filesRef.current?.click(); }}>Re-open picker</button></div>
                          )}
                          {files.map(att => (
                            <div key={att.id} className="min-w-[140px] max-w-[220px] flex items-center gap-2 px-2 py-1 rounded-md border" style={{ ...CARD }}>
                              <Paperclip className="w-4 h-4" />
                              <span className="text-[11px] truncate max-w-[160px]">{att.name}</span>
                              <button className="text-[11px] opacity-70 hover:opacity-100" onClick={() => setFiles(prev => prev.filter(a => a.id !== att.id))}>✕</button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => void sendPrompt()} disabled={busy || (currentAttachments().length === 0 && !input.trim())} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background: 'var(--brand)', color: '#00120a' }}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Mobile unified "+" */}
                {isMobile && (
                  <>
                    <div className="flex items-center gap-2 text-xs">
                      <button onClick={() => setTab('text')} className={`px-2 py-1 rounded ${tab === 'text' ? 'ring-1' : ''}`} style={{ ...CARD, borderColor: tab === 'text' ? 'var(--brand)' : 'var(--border)' }}>Text</button>
                      <button
                        onClick={() => { resetPickerValue(unifiedRef.current); unifiedRef.current?.click(); }}
                        className="px-2 py-1 rounded ring-1"
                        style={{ ...CARD, borderColor: 'var(--brand)' }}
                        aria-label="Add attachments"
                        title="Add attachments"
                      >
                        +
                      </button>
                      <div className="ml-auto text-[10px] opacity-50">Drop files or snapshots here</div>
                    </div>

                    {/* Hidden unified input */}
                    <input
                      ref={unifiedRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={addUnified}
                    />

                    {/* TEXT area remains the same */}
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
                        disabled={busy || (!input.trim() && currentAttachments().length === 0)}
                        className="px-3 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
                        style={{ background: 'var(--brand)', color: '#00120a' }}
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                      </button>
                    </div>

                    {/* Show selected attachments chips (any type) */}
                    {(pics.length + vids.length + files.length) > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {[...pics, ...vids, ...files].map(att => (
                          <span key={att.id} className="text-[11px] px-2 py-1 rounded border" style={{ ...CARD }}>
                            {att.name}
                            <button className="ml-1 opacity-70" onClick={() => {
                              setPics(prev => prev.filter(a => a.id !== att.id));
                              setVids(prev => prev.filter(a => a.id !== att.id));
                              setFiles(prev => prev.filter(a => a.id !== att.id));
                            }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="text-[9px] opacity-40 text-center">Drop files or a version card here</div>
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
                    <div key={v.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', v.id)}
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
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M4 4h6v16H4zM14 4h6v16h-6z" /></svg>
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
