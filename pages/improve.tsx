// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ========================= Types ========================= */
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

type ChatMsg = { role: 'user' | 'assistant' | 'system'; text: string };

type Attachment = { id: string; name: string; mime: string; url?: string; size?: number };

type Lane = {
  id: string;
  versionId: string | null;
  title: string;
  system: string;
  model: string;
  temperature: number;
  msgs: ChatMsg[];
  sending: boolean;
  attachments?: Attachment[];
};

/* ========================= Theme & constants ========================= */
const ACCENT = '#00ffc2';
const fallbackOwner = 'local-owner';
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const lastStateKey = (o: string, a: string) => `improve:last:${o}:${a}`;

/* ========================= Utilities ========================= */
const clean = (s: string) => (s || '').replace(/\*\*|__|`/g, '').trim();
const fmt = (d: number) => new Date(d).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));

/* sanitize like support */
const sanitize = (text: string) =>
  (text || '').replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

/* Tiny typing dots */
function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center" style={{ fontFamily: 'inherit' }}>
      <span className="w-2 h-2 rounded-full animate-bounce opacity-60" />
      <span className="w-2 h-2 rounded-full animate-bounce opacity-60" style={{ animationDelay: '120ms' }} />
      <span className="w-2 h-2 rounded-full animate-bounce opacity-60" style={{ animationDelay: '240ms' }} />
    </span>
  );
}

/* derive a short title for lanes/versions */
function summarizeTitle(system: string) {
  const s = clean(system);
  const hints = [
    { r: /\byes\/?no\b|only\s+(yes|no)/i, t: 'Yes/No Only' },
    { r: /\bjson|structured output|schema/i, t: 'JSON Output' },
    { r: /\bconcise|brief|short/i, t: 'Concise Answers' },
    { r: /\bformal\b/i, t: 'Formal Tone' },
    { r: /\bcasual|friendly\b/i, t: 'Casual Tone' },
    { r: /\bmarkdown|code fence/i, t: 'Markdown Format' },
  ];
  for (const h of hints) if (h.r.test(s)) return h.t;
  return (s.split('\n')[0] || 'Variant').slice(0, 48);
}

/* auto label for snapshots */
function autoLabel(prev: Partial<BotRow> | null, next: BotRow) {
  const parts: string[] = [];
  if (prev?.name !== next.name) parts.push(`name→${(next.name || '').slice(0, 28)}`);
  if (prev?.model !== next.model) parts.push(`model→${next.model}`);
  if ((prev?.temperature ?? -1) !== next.temperature) parts.push(`temp→${next.temperature}`);
  const newSys = clean(next.system);
  const oldSys = clean(prev?.system || '');
  if (newSys !== oldSys) {
    const del = Math.abs(newSys.length - oldSys.length);
    const cues = [
      { r: /\byes\/?no\b|only\s+(yes|no)\b/i, t: 'rule:yes/no' },
      { r: /\bjson|structured output|schema\b/i, t: 'rule:json' },
      { r: /\bconcise|brief|short\b/i, t: 'rule:concise' },
      { r: /\bmarkdown\b/i, t: 'rule:markdown' },
      { r: /\bcite|source\b/i, t: 'rule:citation' },
      { r: /\bformal\b/i, t: 'rule:formal' },
      { r: /\bcasual|friendly\b/i, t: 'rule:casual' },
      { r: /\bstep[- ]by[- ]step|explain\b/i, t: 'rule:steps' },
    ];
    const hit = cues.find(c => c.r.test(newSys));
    parts.push(hit ? hit.t : del > 80 ? 'prompt edited (large)' : 'prompt edited');
  }
  const base = parts.length ? parts.join(' · ') : 'minor edit';
  return base.length > 64 ? base.slice(0, 64) + '…' : base;
}
/* ========================= Main Component ========================= */
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  // prompt split: pre / system / post + quick rules
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);
  const [prePrompt, setPrePrompt] = useState('');
  const [system, setSystem] = useState('');
  const [postPrompt, setPostPrompt] = useState('');
  const [quickRules, setQuickRules] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // ui
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [autoSnapshot, setAutoSnapshot] = useState(false);
  const [lastSavedInfo, setLastSavedInfo] = useState<string | null>(null);

  // versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionFilter, setVersionFilter] = useState('');

  // lanes
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [activeLaneId, setActiveLaneId] = useState<string | null>(null);
  const activeLane = lanes.find(l => l.id === activeLaneId) || null;

  // init user
  useEffect(() => {
    const storedUid = typeof window !== 'undefined' ? localStorage.getItem('dev:userId') : null;
    setUserId(storedUid || fallbackOwner);
  }, []);

  // fetch agents
  async function fetchBots(uid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, { headers: { 'x-owner-id': uid } });
      const json = await res.json();
      const rows: BotRow[] = json?.data || [];
      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      console.error(e);
      const fallback: BotRow = {
        id: 'dev-agent',
        ownerId: uid,
        name: 'Support Assistant',
        model: 'gpt-4o-mini',
        temperature: 0.5,
        system: 'Answer briefly and helpfully.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setList([fallback]); setSelectedId(fallback.id);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (userId) fetchBots(userId); }, [userId]); // eslint-disable-line

  // when selected changes: load editor, versions, lanes
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);

    // reset prompt split (if you previously only stored system, we just set system)
    setPrePrompt(''); setPostPrompt(''); setQuickRules([]);
    setSystem(clean(selected.system || ''));
    setNotes('');

    try {
      const rawV = localStorage.getItem(versionsKey(userId, selected.id));
      setVersions(rawV ? (JSON.parse(rawV) as Version[]) : []);
    } catch { setVersions([]); }

    // restore lanes or create one lane using current agent state
    try {
      const rawS = localStorage.getItem(lastStateKey(userId, selected.id));
      if (rawS) {
        const parsed = JSON.parse(rawS);
        setLanes(parsed.lanes || []);
        setActiveLaneId(parsed.activeLaneId || null);
      } else {
        const l: Lane = {
          id: `lane_${Date.now()}`,
          versionId: null,
          title: summarizeTitle(selected.system || ''),
          system: clean(selected.system || ''),
          model: selected.model || 'gpt-4o-mini',
          temperature: selected.temperature ?? 0.5,
          msgs: [{ role: 'assistant', text: 'Hi — try a message to test this agent.' }],
          sending: false,
          attachments: [],
        };
        setLanes([l]); setActiveLaneId(l.id);
      }
    } catch {
      const l: Lane = {
        id: `lane_${Date.now()}`,
        versionId: null,
        title: summarizeTitle(selected.system || ''),
        system: clean(selected.system || ''),
        model: selected.model || 'gpt-4o-mini',
        temperature: selected.temperature ?? 0.5,
        msgs: [{ role: 'assistant', text: 'Hi — try a message to test this agent.' }],
        sending: false,
        attachments: [],
      };
      setLanes([l]); setActiveLaneId(l.id);
    }
    setDirty(false);
  }, [selectedId, selected, userId]);

  // persist lanes (local)
  useEffect(() => {
    if (!selected || !userId) return;
    const payload = { lanes, activeLaneId };
    try { localStorage.setItem(lastStateKey(userId, selected.id), JSON.stringify(payload)); } catch {}
  }, [lanes, activeLaneId, selected, userId]);

  // before unload
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Save before leaving?';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // dirty tracking (basic)
  useEffect(() => {
    if (!selected) return;
    const d =
      name !== (selected.name || '') ||
      model !== (selected.model || 'gpt-4o-mini') ||
      Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9 ||
      clean(system) !== clean(selected.system || '');
    setDirty(d);
  }, [name, model, temperature, system, selected]);
  /* ---------- Save edits + create version snapshot ---------- */
  async function saveEdits() {
    if (!userId || !selected) return;
    try {
      const prev = selected as BotRow;
      // Build an effective system string from split parts + rules (simple join)
      const rules = quickRules.map(r => `- ${r}`).join('\n');
      const effectiveSystem = [prePrompt, system, rules, postPrompt].filter(Boolean).join('\n').trim();

      const candidate: BotRow = { ...prev, name, model, temperature, system: effectiveSystem };
      const v: Version = {
        id: `v_${Date.now()}`,
        ts: Date.now(),
        label: autoLabel(prev, candidate),
        name, model, temperature, system: effectiveSystem,
      };
      const nextV = [v, ...(versions || [])].slice(0, 200);
      setVersions(nextV);
      localStorage.setItem(versionsKey(userId, selected.id), JSON.stringify(nextV));

      // server patch (best effort)
      try {
        await fetch(`/api/chatbots/${selected.id}?ownerId=${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
          body: JSON.stringify({ name, model, temperature, system: effectiveSystem }),
        });
      } catch {}
      setDirty(false);
      // reflect in first lane (live)
      setLanes(ls => ls.map((l, i) =>
        i === 0 ? { ...l, system: effectiveSystem, model, temperature, title: summarizeTitle(effectiveSystem) } : l));
      setLastSavedInfo(`Saved snapshot @ ${fmt(Date.now())}`);
    } catch {
      alert('Failed to save');
    }
  }

  function saveSnapshotNearPrompt() {
    // convenience button near prompt — same as saveEdits but does not PATCH agent (only local snapshot)
    if (!userId || !selected) return;
    const prev = selected as BotRow;
    const rules = quickRules.map(r => `- ${r}`).join('\n');
    const effectiveSystem = [prePrompt, system, rules, postPrompt].filter(Boolean).join('\n').trim();

    const v: Version = {
      id: `v_${Date.now()}`,
      ts: Date.now(),
      label: autoLabel(prev, { ...prev, name, model, temperature, system: effectiveSystem }),
      name, model, temperature, system: effectiveSystem,
    };
    const nextV = [v, ...(versions || [])].slice(0, 200);
    setVersions(nextV);
    try { localStorage.setItem(versionsKey(userId, selected.id), JSON.stringify(nextV)); } catch {}
    setLastSavedInfo(`Snapshot created @ ${fmt(v.ts)}`);
  }

  /* Lanes */
  function openLaneFromVersion(v: Version) {
    const id = `lane_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const lane: Lane = {
      id, versionId: v.id,
      title: v.label || summarizeTitle(v.system),
      system: clean(v.system),
      model: v.model, temperature: v.temperature,
      msgs: [{ role: 'assistant', text: 'Variant loaded. Ask something to compare.' }],
      sending: false,
      attachments: [],
    };
    setLanes(ls => [...ls, lane]);
    setActiveLaneId(id);
  }

  function closeLane(id: string) {
    setLanes(ls => ls.filter(l => l.id !== id));
    if (activeLaneId === id) {
      const remain = lanes.filter(l => l.id !== id);
      setActiveLaneId(remain[0]?.id || null);
    }
  }

  /* Apply a new quick rule to the list (and live lane) */
  function addQuickRule(line?: string) {
    const val = clean(line || '');
    if (!val) return;
    setQuickRules(prev => {
      const next = [...prev, val];
      // reflect live in active lane title/system preview
      const rules = next.map(r => `- ${r}`).join('\n');
      const effective = [prePrompt, system, rules, postPrompt].filter(Boolean).join('\n').trim();
      if (activeLane) {
        setLanes(ls => ls.map(l => l.id === activeLane.id ? { ...l, system: effective, title: summarizeTitle(effective) } : l));
      }
      if (autoSnapshot) saveSnapshotNearPrompt();
      return next;
    });
  }

  function removeQuickRule(idx: number) {
    setQuickRules(prev => {
      const next = prev.filter((_, i) => i !== idx);
      const rules = next.map(r => `- ${r}`).join('\n');
      const effective = [prePrompt, system, rules, postPrompt].filter(Boolean).join('\n').trim();
      if (activeLane) {
        setLanes(ls => ls.map(l => l.id === activeLane.id ? { ...l, system: effective, title: summarizeTitle(effective) } : l));
      }
      return next;
    });
  }

  /* ===== Chat: SAME contract as Support (no streaming), per-lane version ===== */
  async function sendMessage(text: string, target: 'active' | 'both', files: Attachment[] = []) {
    const targets = target === 'both' ? lanes.map(l => l.id) : activeLaneId ? [activeLaneId] : [];
    if (targets.length === 0) return;

    // optimistic UI: add user message + assistant placeholder, store attachments in lane (preview)
    setLanes(ls => ls.map(l =>
      targets.includes(l.id)
        ? ({ ...l, attachments: [...(l.attachments || []), ...files], msgs: [...l.msgs, { role: 'user', text }, { role: 'assistant', text: '' }], sending: true })
        : l
    ));

    await Promise.all(targets.map(async (id) => {
      const lane = lanes.find(l => l.id === id);
      if (!lane) return;

      const payload: any = {
        message: text,
        agentId: selected?.id || null,
        versionId: lane.versionId || null, // backend resolves this snapshot if present
        // Prefer version on server; still pass lane config for transparency
        system: lane.system,
        model: lane.model,
        temperature: lane.temperature,
        attachments: (files || []).map(f => ({ id: f.id, name: f.name, mime: f.mime, url: f.url, size: f.size })),
      };

      try {
        const res = await fetch('/api/support/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        const botText = data?.ok && typeof data?.message === 'string'
          ? data.message
          : (data?.message ? String(data.message) : 'Something went wrong.');

        const sanitized = sanitize(botText);

        setLanes(ls => ls.map(l => {
          if (l.id !== id) return l;
          const msgs = [...l.msgs];
          msgs[msgs.length - 1] = { role: 'assistant', text: sanitized };
          return { ...l, msgs, sending: false };
        }));
      } catch {
        setLanes(ls => ls.map(l => {
          if (l.id !== id) return l;
          const msgs = [...l.msgs];
          msgs[msgs.length - 1] = { role: 'assistant', text: 'Failed to contact server.' };
          return { ...l, msgs, sending: false };
        }));
      }
    }));
  }

  /* Small button */
  function SmallButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const { className, ...rest } = props;
    return <button {...rest} className={`px-2.5 py-1.5 text-xs rounded-md border border-white/10 hover:bg-white/5 ${className || ''}`} />;
  }
  return (
    return (
    <div className="h-screen w-full overflow-hidden text-slate-100">
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 px-4 py-3 border-b border-white/10 bg-black/40 backdrop-blur"
        style={{ height: 56 }}
      >
        <div className="max-w-[1600px] mx-auto h-full flex items-center gap-3">
          <div className="text-sm opacity-80">Improve</div>
          <div className="text-lg font-semibold">{selected ? (selected.name || 'Agent') : 'Agent'}</div>
          <span
            className="ml-2 text-[11px] px-2 py-[2px] rounded-full border"
            style={{ borderColor: 'rgba(255,255,255,0.10)', color: dirty ? ACCENT : '#94a3b8' }}
          >
            {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SmallButton
              onClick={saveEdits}
              disabled={!dirty}
              style={{ borderColor: dirty ? ACCENT : 'rgba(255,255,255,0.10)' }}
            >
              Save Agent
            </SmallButton>
            <SmallButton onClick={() => userId && fetchBots(userId!)}>Refresh</SmallButton>
            <SmallButton onClick={() => setShowPrompt(s => !s)}>
              {showPrompt ? 'Hide Prompt' : 'Show Prompt'}
            </SmallButton>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="max-w-[1600px] mx-auto px-4" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: '300px 1fr', height: '100%' }}>
          {/* LEFT: Versions + Assistants */}
          <aside
            className="h-full flex flex-col"
            style={{ background: 'rgba(13,15,17,0.92)', border: '1px solid rgba(106,247,209,0.18)', borderRadius: 12 }}
          >
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <div className="font-medium">Versions</div>
              <input
                value={versionFilter}
                onChange={(e) => setVersionFilter(e.target.value)}
                placeholder="Search…"
                className="ml-auto px-2 py-1 text-xs rounded-md bg-white/5 border border-white/10 outline-none"
              />
            </div>
            <div className="flex-1 overflow-auto p-2">
              {(!versions || versions.length === 0) ? (
                <div className="text-xs opacity-70 p-3">
                  No snapshots yet. Use <b>Save snapshot</b> below to create one.
                </div>
              ) : (
                <ul className="space-y-2">
                  {versions
                    .filter(v => !versionFilter || v.label.toLowerCase().includes(versionFilter.toLowerCase()))
                    .map(v => (
                      <li
                        key={v.id}
                        className="p-2 rounded-md"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <div className="text-sm truncate" style={{ color: ACCENT }}>
                          {v.label || 'Untitled'}
                        </div>
                        <div className="text-[11px] opacity-60">{fmt(v.ts)}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <SmallButton
                            onClick={() => {
                              setName(v.name);
                              setModel(v.model);
                              setTemperature(v.temperature);
                              setSystem(clean(v.system));
                              setDirty(true);
                            }}
                          >
                            Restore
                          </SmallButton>
                          <SmallButton onClick={() => openLaneFromVersion(v)}>Open Lane</SmallButton>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="border-t border-white/10 p-2">
              <div className="text-xs opacity-70 mb-1">Assistants</div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {loading ? (
                  <div className="text-xs opacity-70">Loading…</div>
                ) : list.length === 0 ? (
                  <div className="text-xs opacity-70">No assistants.</div>
                ) : (
                  list.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedId(b.id)}
                      className="w-full text-left text-xs px-2 py-1 rounded-md border"
                      style={{
                        borderColor: selectedId === b.id ? ACCENT : 'rgba(255,255,255,0.10)',
                        background: selectedId === b.id ? 'rgba(0,255,194,0.08)' : 'transparent',
                      }}
                    >
                      {(b.name || 'Untitled')} · {b.model}
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT: Editor + Test Area */}
          <section className="h-full grid" style={{ gridTemplateRows: 'auto 1fr' }}>
            {/* Editor header */}
            <div
              className="p-3 flex items-center gap-3 border border-white/10 rounded-md"
              style={{ background: 'rgba(13,15,17,0.92)', borderColor: 'rgba(106,247,209,0.18)' }}
            >
              <div className="grid gap-2" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.8fr' }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Agent name"
                  className="px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none"
                />
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70 w-16">Temp</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs opacity-80 w-10 text-right">{temperature.toFixed(2)}</span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <div className="px-2 py-1 rounded-md border border-white/10">
                  est {estimateTokens([prePrompt, system, ...quickRules, postPrompt].join('\n'))} tok
                </div>
                <SmallButton onClick={() => setShowPrompt(s => !s)}>
                  {showPrompt ? 'Hide Prompt' : 'Show Prompt'}
                </SmallButton>
              </div>
            </div>

            {/* body: prompt + test lanes */}
            <div
              className="grid gap-3 mt-3"
              style={{ gridTemplateColumns: showPrompt ? 'minmax(260px, 380px) 1fr' : '1fr', height: 'calc(100% - 0px)' }}
            >
              {/* Prompt editor */}
              {showPrompt && (
                <div
                  className="h-full flex flex-col"
                  style={{ background: 'rgba(13,15,17,0.92)', border: '1px solid rgba(106,247,209,0.18)', borderRadius: 12 }}
                >
                  <div className="p-3 border-b border-white/10 flex items-center justify-between">
                    <div className="text-sm font-medium">Prompt</div>
                    <SmallButton onClick={() => setShowPrompt(false)}>Close</SmallButton>
                  </div>
                  <div className="p-3 space-y-3 overflow-auto">
                    <div className="text-xs opacity-70">Pre-prompt (optional) — inserted before user message</div>
                    <textarea
                      value={prePrompt}
                      onChange={(e) => {
                        setPrePrompt(e.target.value);
                        if (activeLane) {
                          const rules = quickRules.map(r => `- ${r}`).join('\n');
                          const eff = [e.target.value, system, rules, postPrompt].filter(Boolean).join('\n');
                          setLanes(ls => ls.map(l => l.id === activeLane.id ? { ...l, system: eff, title: summarizeTitle(eff) } : l));
                        }
                      }}
                      className="w-full h-20 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none font-mono text-xs"
                    />

                    <div className="text-xs opacity-70">System prompt — main instructions</div>
                    <textarea
                      value={system}
                      onChange={(e) => {
                        setSystem(e.target.value);
                        if (activeLane) {
                          const rules = quickRules.map(r => `- ${r}`).join('\n');
                          const eff = [prePrompt, e.target.value, rules, postPrompt].filter(Boolean).join('\n');
                          setLanes(ls => ls.map(l => l.id === activeLane.id ? { ...l, system: eff, title: summarizeTitle(eff) } : l));
                        }
                      }}
                      className="w-full h-40 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none font-mono text-xs"
                    />

                    <div className="text-xs opacity-70">Post-prompt (optional) — appended after user message</div>
                    <textarea
                      value={postPrompt}
                      onChange={(e) => {
                        setPostPrompt(e.target.value);
                        if (activeLane) {
                          const rules = quickRules.map(r => `- ${r}`).join('\n');
                          const eff = [prePrompt, system, rules, e.target.value].filter(Boolean).join('\n');
                          setLanes(ls => ls.map(l => l.id === activeLane.id ? { ...l, system: eff, title: summarizeTitle(eff) } : l));
                        }
                      }}
                      className="w-full h-20 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none font-mono text-xs"
                    />

                    <div className="text-xs opacity-70">Quick rules — short bullets added to system</div>
                    <div className="flex items-center gap-2">
                      <input
                        id="quickRule"
                        placeholder="e.g., Cite sources with links"
                        className="flex-1 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none text-xs"
                      />
                      <SmallButton onClick={() => {
                        const el = document.getElementById('quickRule') as HTMLInputElement | null;
                        if (!el) return; addQuickRule(el.value); el.value = '';
                      }}>
                        Add Rule
                      </SmallButton>
                    </div>
                    <ul className="space-y-1">
                      {quickRules.map((r, i) => (
                        <li
                          key={i}
                          className="text-xs flex items-center justify-between px-2 py-1 rounded-md bg-white/5 border border-white/10"
                        >
                          <span className="opacity-90">{r}</span>
                          <button onClick={() => removeQuickRule(i)} className="text-[11px] opacity-70 hover:opacity-100">
                            remove
                          </button>
                        </li>
                      ))}
                      {quickRules.length === 0 && (
                        <li className="text-[11px] opacity-60">No quick rules yet.</li>
                      )}
                    </ul>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={saveSnapshotNearPrompt}
                        className="px-2 py-1 rounded-md border"
                        style={{ borderColor: ACCENT, color: ACCENT }}
                      >
                        Save snapshot
                      </button>
                      <label className="text-xs opacity-80 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoSnapshot}
                          onChange={(e) => setAutoSnapshot(e.target.checked)}
                        />{' '}
                        Auto snapshot on rule add
                      </label>
                      {lastSavedInfo && (
                        <div className="text-[11px] opacity-60 ml-2">{lastSavedInfo}</div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <div className="text-xs opacity-70">Notes (optional)</div>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-20 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TEST AREA */}
              <div
                className="h-full flex flex-col"
                style={{ background: 'rgba(13,15,17,0.92)', border: '1px solid rgba(106,247,209,0.18)', borderRadius: 12 }}
              >
                <div className="p-3 border-b border-white/10 flex items-center gap-2">
                  <div className="font-medium">Test Sandbox</div>
                  <div className="text-xs opacity-70">
                    Compare lanes. Drag/open versions to test different snapshots.
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <SmallButton
                      onClick={() => {
                        const rules = quickRules.map(r => `- ${r}`).join('\n');
                        const sys = [prePrompt, system, rules, postPrompt].filter(Boolean).join('\n');
                        const v: Version = {
                          id: `v_live_${Date.now()}`,
                          ts: Date.now(),
                          label: summarizeTitle(sys),
                          name, model, temperature, system: sys
                        };
                        openLaneFromVersion(v);
                      }}
                    >
                      Open Current as Lane
                    </SmallButton>
                  </div>
                </div>

                {/* lanes */}
                <div className="flex-1 overflow-hidden p-2">
                  <div
                    className="grid gap-2 h-full"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, lanes.length)}, minmax(280px, 1fr))` }}
                  >
                    {lanes.map(l => (
                      <div
                        key={l.id}
                        className="h-full flex flex-col rounded-md border"
                        style={{
                          borderColor: activeLaneId === l.id ? ACCENT : 'rgba(255,255,255,0.10)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
                          <button onClick={() => setActiveLaneId(l.id)} className="text-left flex-1">
                            <div
                              className="text-sm font-medium truncate"
                              style={{ color: activeLaneId === l.id ? ACCENT : '#e2e8f0' }}
                            >
                              {l.title || 'Variant'}
                            </div>
                            <div className="text-[11px] opacity-60 truncate">
                              {l.model} · temp {l.temperature.toFixed(2)}
                            </div>
                          </button>
                          <SmallButton onClick={() => closeLane(l.id)}>Close</SmallButton>
                        </div>

                        {/* attachments preview (if any) */}
                        {!!(l.attachments && l.attachments.length) && (
                          <div className="px-3 pt-2 flex gap-2 overflow-x-auto">
                            {l.attachments!.map(att => (
                              <div
                                key={att.id}
                                className="min-w-[120px] max-w-[180px] rounded-md border border-white/10 bg-white/5 p-2 text-[11px]"
                              >
                                {att.url && att.mime.startsWith('image/') && (
                                  <img src={att.url} alt={att.name} className="w-full h-24 object-cover rounded" />
                                )}
                                {att.url && att.mime.startsWith('video/') && (
                                  <video className="w-full h-24 rounded" src={att.url} controls muted />
                                )}
                                {!att.url && (
                                  <div className="h-24 grid place-items-center opacity-60">file</div>
                                )}
                                <div className="mt-1 truncate">{att.name}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
                          {l.msgs.length === 0 ? (
                            <div className="text-xs opacity-60">No messages yet.</div>
                          ) : (
                            l.msgs.map((m, i) => (
                              <div
                                key={i}
                                className={`text-sm whitespace-pre-wrap ${m.role === 'user' ? '' : 'opacity-85'}`}
                              >
                                <b style={{ color: m.role === 'user' ? '#e2e8f0' : ACCENT }}>
                                  {m.role === 'user' ? 'You' : 'AI'}:
                                </b>{' '}
                                {m.text || (l.sending && i === l.msgs.length - 1 ? <TypingDots /> : '')}
                              </div>
                            ))
                          )}
                          {l.sending && <div className="text-xs opacity-70">Typing…</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* input */}
                <ChatInput
                  onSend={(t, mode, files) => sendMessage(t, mode, files)}
                  canSendBoth={lanes.length > 1}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ChatInput (attachments with previews; no server upload yet) ---------------- */
function ChatInput({
  onSend,
  canSendBoth
}: {
  onSend: (text: string, target: 'active'|'both', files: Attachment[]) => void;
  canSendBoth: boolean;
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // read a File as data URL for preview
  function fileToAttachment(file: File): Promise<Attachment> {
    return new Promise(resolve => {
      const id = `${file.name}_${file.size}_${crypto.randomUUID()}`;
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

  async function addFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const arr = Array.from(fileList).slice(0, 8);
    const atts = await Promise.all(arr.map(fileToAttachment));
    setAttachments(prev => [...prev, ...atts].slice(0, 12));
  }

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); setDragOver(false);
      addFiles(e.dataTransfer?.files || null);
    };
    el.addEventListener('dragover', onDragOver as any);
    el.addEventListener('dragleave', onDragLeave as any);
    el.addEventListener('drop', onDrop as any);
    return () => {
      el.removeEventListener('dragover', onDragOver as any);
      el.removeEventListener('dragleave', onDragLeave as any);
      el.removeEventListener('drop', onDrop as any);
    };
  }, []);

  function send(target: 'active'|'both') {
    const t = text.trim();
    if (!t) return;
    onSend(t, target, attachments);
    setText('');
    setAttachments([]);
  }

  return (
    <div ref={dropRef} className={`border-t border-white/10 p-2 ${dragOver ? 'bg-white/5' : ''}`}>
      {/* attachments row — horizontal */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 pb-2 overflow-x-auto">
          {attachments.map(att => (
            <div
              key={att.id}
              className="min-w-[120px] max-w-[180px] flex items-center gap-2 px-2 py-1 rounded-md border bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.10)' }}
            >
              {att.url && att.mime.startsWith('image/') && (
                <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" />
              )}
              {att.url && att.mime.startsWith('video/') && (
                <video className="w-10 h-10 rounded" src={att.url} muted />
              )}
              {!att.url && (
                <div className="w-10 h-10 grid place-items-center text-[10px] opacity-60">
                  file
                </div>
              )}
              <span className="text-[11px] truncate max-w-[120px]">{att.name}</span>
              <button
                className="text-[11px] opacity-70 hover:opacity-100"
                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message… (drop files here)"
          rows={1}
          className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 outline-none resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send('active'); } }}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="px-2.5 py-2 text-xs rounded-md border border-white/10 hover:bg-white/5"
        >
          Attach
        </button>
        {canSendBoth && (
          <button
            onClick={() => send('both')}
            className="px-2.5 py-2 text-xs rounded-md border border-white/10 hover:bg-white/5"
          >
            Send to Both
          </button>
        )}
        <button
          onClick={() => send('active')}
          className="px-3 py-2 text-xs rounded-md border"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          Send
        </button>
      </div>
      <div className="mt-1 text-[9px] opacity-40">drop files here</div>
    </div>
  );
}
