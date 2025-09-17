// apps/web/app/improve.tsx
// Client component — real chat (streaming), split lanes, live prompt updates,
// tighter UI (no page scroll), horizontal attachments, tiny hint,
// theme aligned to #00ffc2, better version auto-naming.

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

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

type Lane = {
  id: string;
  versionId: string | null;
  title: string;
  system: string;
  model: string;
  temperature: number;
  msgs: ChatMsg[];
  sending: boolean;
};

const ACCENT = '#00ffc2';
const BG = '#0b0c10';

const PANEL: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  borderRadius: 12,
};
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
};

const fmt = (d: number) => new Date(d).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));
const cleanPrompt = (s: string) => (s || '').replace(/\*\*|__|`/g, '').trim();

const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const lastStateKey = (o: string, a: string) => `improve:last:${o}:${a}`;

function summarizeTitle(system: string) {
  const s = cleanPrompt(system);
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

function autoLabel(prev: Partial<BotRow> | null, next: BotRow) {
  const parts: string[] = [];
  if (prev?.name !== next.name) parts.push(`name→${(next.name || '').slice(0, 28)}`);
  if (prev?.model !== next.model) parts.push(`model→${next.model}`);
  if ((prev?.temperature ?? -1) !== next.temperature) parts.push(`temp→${next.temperature}`);
  const newSys = cleanPrompt(next.system);
  const oldSys = cleanPrompt(prev?.system || '');
  if (newSys !== oldSys) {
    const del = Math.abs(newSys.length - oldSys.length);
    const cues = [
      { r: /\byes\/?no|only\s+(yes|no)\b/i, t: 'rule:yes/no' },
      { r: /\bjson|structured output|schema\b/i, t: 'rule:json' },
      { r: /\bconcise|brief|short\b/i, t: 'rule:concise' },
      { r: /\bmarkdown\b/i, t: 'rule:markdown' },
      { r: /\bcite|source\b/i, t: 'rule:citation' },
      { r: /\bformal\b/i, t: 'rule:formal' },
      { r: /\bcasual|friendly\b/i, t: 'rule:casual' },
      { r: /\bstep[- ]by[- ]step|chain of thought|explain\b/i, t: 'rule:steps' },
    ];
    const hit = cues.find(c => c.r.test(newSys));
    parts.push(hit ? hit.t : del > 80 ? 'prompt edited (large)' : 'prompt edited');
  }
  const base = parts.length ? parts.join(' · ') : 'minor edit';
  return base.length > 64 ? base.slice(0, 64) + '…' : base;
}

const fallbackOwner = 'local-owner';

export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  // editor
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [notes, setNotes] = useState('');

  // ui
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionFilter, setVersionFilter] = useState('');

  // lanes
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [activeLaneId, setActiveLaneId] = useState<string | null>(null);
  const activeLane = lanes.find(l => l.id === activeLaneId) || null;

  // attachments across lanes when sending to both
  const [attachments, setAttachments] = useState<File[]>([]);

  // init user
  useEffect(() => {
    const storedUid = typeof window !== 'undefined' ? localStorage.getItem('dev:userId') : null;
    setUserId(storedUid || fallbackOwner);
  }, []);

  // fetch agents
  async function fetchBots(uid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, {
        headers: { 'x-owner-id': uid },
      });
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
      setList([fallback]);
      setSelectedId(fallback.id);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (userId) fetchBots(userId); }, [userId]); // eslint-disable-line

  // load selected
  useEffect(() => {
    if (!selected || !userId) return;
    const uid = userId;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(cleanPrompt(selected.system || ''));
    try {
      const rawV = localStorage.getItem(versionsKey(uid, selected.id));
      setVersions(rawV ? (JSON.parse(rawV) as Version[]) : []);
    } catch { setVersions([]); }

    // restore lanes or create one
    try {
      const rawS = localStorage.getItem(lastStateKey(uid, selected.id));
      if (rawS) {
        const parsed = JSON.parse(rawS);
        setLanes(parsed.lanes || []);
        setActiveLaneId(parsed.activeLaneId || null);
      } else {
        const l: Lane = {
          id: `lane_${Date.now()}`,
          versionId: null,
          title: summarizeTitle(selected.system || ''),
          system: cleanPrompt(selected.system || ''),
          model: selected.model || 'gpt-4o-mini',
          temperature: selected.temperature ?? 0.5,
          msgs: [],
          sending: false,
        };
        setLanes([l]);
        setActiveLaneId(l.id);
      }
    } catch {
      const l: Lane = {
        id: `lane_${Date.now()}`,
        versionId: null,
        title: summarizeTitle(selected.system || ''),
        system: cleanPrompt(selected.system || ''),
        model: selected.model || 'gpt-4o-mini',
        temperature: selected.temperature ?? 0.5,
        msgs: [],
        sending: false,
      };
      setLanes([l]);
      setActiveLaneId(l.id);
    }
    setDirty(false);
  }, [selectedId, selected, userId]);

  // persist lanes
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

  // dirty tracking
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (cleanPrompt(system) !== cleanPrompt(selected.system || ''));
    setDirty(d);
  }, [name, model, temperature, system, selected]);

  // save edits + snapshot
  async function saveEdits() {
    if (!userId || !selected) return;
    try {
      const prev = selected as BotRow;
      const candidate: BotRow = { ...prev, name, model, temperature, system: cleanPrompt(system) };
      const v: Version = {
        id: `v_${Date.now()}`,
        ts: Date.now(),
        label: autoLabel(prev, candidate),
        name, model, temperature, system: cleanPrompt(system),
      };
      const nextV = [v, ...(versions || [])].slice(0, 200);
      setVersions(nextV);
      localStorage.setItem(versionsKey(userId, selected.id), JSON.stringify(nextV));

      // server patch
      try {
        await fetch(`/api/chatbots/${selected.id}?ownerId=${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
          body: JSON.stringify({ name, model, temperature, system: cleanPrompt(system) }),
        });
      } catch {}
      setDirty(false);
      // lane 0 reflects working prompt immediately
      setLanes(ls => ls.map((l, i) =>
        i === 0 ? { ...l, system: cleanPrompt(system), model, temperature, title: summarizeTitle(system) } : l));
    } catch {
      alert('Failed to save');
    }
  }

  // open lane from version
  function openLaneFromVersion(v: Version) {
    const id = `lane_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const lane: Lane = {
      id, versionId: v.id,
      title: v.label || summarizeTitle(v.system),
      system: cleanPrompt(v.system),
      model: v.model, temperature: v.temperature,
      msgs: [], sending: false,
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

  // live rule line -> updates working system + active lane immediately
  function applyRuleLine(line: string) {
    const clean = cleanPrompt(line);
    if (!clean) return;
    const next = `${cleanPrompt(system)}\n- ${clean}`.trim();
    setSystem(next);
    setDirty(true);
    if (activeLane) {
      setLanes(ls => ls.map(l => l.id === activeLane.id ? { ...l, system: next, title: summarizeTitle(next) } : l));
    }
  }

  // STREAMING CHAT
  async function sendMessage(text: string, target: 'active' | 'both') {
    const targets = target === 'both' ? lanes.map(l => l.id) : activeLaneId ? [activeLaneId] : [];
    if (targets.length === 0) return;
    const files = attachments; // not sent in this sample; you can wire to your API
    setAttachments([]);

    // optimistic user message + start assistant placeholder
    setLanes(ls => ls.map(l =>
      targets.includes(l.id)
        ? {
            ...l,
            msgs: [...l.msgs, { role: 'user', text }, { role: 'assistant', text: '' }],
            sending: true,
          }
        : l
    ));

    await Promise.all(targets.map(async (id) => {
      const laneSnapshot = lanes.find(l => l.id === id);
      if (!laneSnapshot) return;

      try {
        const res = await fetch('/api/assistants/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: laneSnapshot.model,
            temperature: laneSnapshot.temperature,
            system: laneSnapshot.system, // LIVE system per lane
            messages: [{ role: 'user', content: text }],
            stream: true,                 // tell backend we want streaming
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder('utf-8');

        if (!reader) {
          // no stream, just one JSON
          const json = await res.json().catch(() => null);
          const content = (json?.content || '').toString();
          setLanes(ls => ls.map(l => {
            if (l.id !== id) return l;
            const msgs = [...l.msgs];
            // last item is assistant placeholder
            msgs[msgs.length - 1] = { role: 'assistant', text: content };
            return { ...l, msgs, sending: false };
          }));
          return;
        }

        // streaming loop — supports SSE or raw text chunks
        let done = false;
        while (!done) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            // If your backend is SSE, you may need to parse `data:` lines here.
            // This implementation just appends any text chunk to the last assistant message.
            setLanes(ls => ls.map(l => {
              if (l.id !== id) return l;
              const msgs = [...l.msgs];
              const last = msgs[msgs.length - 1];
              if (last && last.role === 'assistant') {
                last.text = (last.text || '') + chunk;
                msgs[msgs.length - 1] = { ...last };
              }
              return { ...l, msgs };
            }));
          }
        }

        setLanes(ls => ls.map(l => (l.id === id ? { ...l, sending: false } : l)));
      } catch (err) {
        // On error, finalize with a short message
        setLanes(ls => ls.map(l => {
          if (l.id !== id) return l;
          const msgs = [...l.msgs];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant' && !last.text) {
            last.text = '— failed to stream reply.';
            msgs[msgs.length - 1] = { ...last };
          }
          return { ...l, msgs, sending: false };
        }));
      }
    }));
  }

  // UI helper
  function SmallButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const { className, ...rest } = props;
    return (
      <button
        {...rest}
        className={`px-2.5 py-1.5 text-xs rounded-md border border-white/10 hover:bg-white/5 ${className || ''}`}
      />
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden" style={{ background: BG, color: '#f1f5f9' }}>
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
            <SmallButton onClick={saveEdits} disabled={!dirty} style={{ borderColor: dirty ? ACCENT : 'rgba(255,255,255,0.10)' }}>
              Save
            </SmallButton>
            <SmallButton onClick={() => userId && fetchBots(userId!)}>Refresh</SmallButton>
            <SmallButton onClick={() => setShowPrompt(s => !s)}>{showPrompt ? 'Hide Prompt' : 'Show Prompt'}</SmallButton>
          </div>
        </div>
      </header>

      {/* Main grid — no outer scroll; internal panes handle their own */}
      <div className="max-w-[1600px] mx-auto px-4" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: '300px 1fr', height: '100%' }}>
          {/* LEFT: Versions + Assistants */}
          <aside className="h-full flex flex-col" style={PANEL}>
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
                <div className="text-xs opacity-70 p-3">No snapshots yet. Press <b>Save</b> to create one.</div>
              ) : (
                <ul className="space-y-2">
                  {versions
                    .filter(v => !versionFilter || v.label.toLowerCase().includes(versionFilter.toLowerCase()))
                    .map(v => (
                      <li key={v.id} className="p-2 rounded-md" style={CARD}>
                        <div className="text-sm truncate" style={{ color: ACCENT }}>{v.label || 'Untitled'}</div>
                        <div className="text-[11px] opacity-60">{fmt(v.ts)}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <SmallButton
                            onClick={() => {
                              setName(v.name);
                              setModel(v.model);
                              setTemperature(v.temperature);
                              setSystem(cleanPrompt(v.system));
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
            {/* Assistants list */}
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
            {/* compact editor header */}
            <div className="p-3 flex items-center gap-3 border border-white/10 rounded-md" style={PANEL}>
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
                <div className="px-2 py-1 rounded-md border border-white/10">est {estimateTokens(system)} tok</div>
                <SmallButton onClick={() => setShowPrompt(s => !s)}>{showPrompt ? 'Hide Prompt' : 'Show Prompt'}</SmallButton>
              </div>
            </div>

            {/* body: prompt + test lanes */}
            <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: showPrompt ? 'minmax(260px, 360px) 1fr' : '1fr', height: 'calc(100% - 0px)' }}>
              {/* collapsible prompt editor */}
              {showPrompt && (
                <div className="h-full flex flex-col" style={PANEL}>
                  <div className="p-3 border-b border-white/10 flex items-center justify-between">
                    <div className="text-sm font-medium">Prompt</div>
                    <SmallButton onClick={() => setShowPrompt(false)}>Close</SmallButton>
                  </div>
                  <div className="p-3 space-y-2 overflow-auto">
                    <div className="text-xs opacity-70">Rules (add a line, then Update)</div>
                    <div className="flex items-center gap-2">
                      <input
                        id="ruleLine"
                        placeholder="e.g., Respond only Yes or No unless asked to elaborate."
                        className="flex-1 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none"
                      />
                      <SmallButton
                        onClick={() => {
                          const el = document.getElementById('ruleLine') as HTMLInputElement | null;
                          if (!el) return; applyRuleLine(el.value); el.value = '';
                        }}
                      >
                        Update
                      </SmallButton>
                    </div>
                    <div className="text-xs opacity-70">System Prompt</div>
                    <textarea
                      value={system}
                      onChange={(e) => {
                        const val = cleanPrompt(e.target.value);
                        setSystem(val);
                        // reflect live in active lane so next send uses it
                        if (activeLane) {
                          setLanes(ls => ls.map(l => l.id === activeLane.id
                            ? { ...l, system: val, title: summarizeTitle(val) }
                            : l));
                        }
                      }}
                      className="w-full h-72 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none font-mono text-xs leading-5"
                    />
                    <div className="flex items-center justify-between text-[11px] opacity-70">
                      <div>{system.length.toLocaleString()} chars</div>
                      <div>Tip: keep it short; use bullets.</div>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-xs opacity-70">Notes (optional)</div>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-24 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TEST AREA */}
              <div className="h-full flex flex-col" style={PANEL}>
                <div className="p-3 border-b border-white/10 flex items-center gap-2">
                  <div className="font-medium">Test Sandbox</div>
                  <div className="text-xs opacity-70">
                    Compare lanes. Click a lane to target it. “Send to Both” compares outputs.
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <SmallButton
                      onClick={() => {
                        const v: Version = {
                          id: `v_live_${Date.now()}`,
                          ts: Date.now(),
                          label: summarizeTitle(system),
                          name, model, temperature, system: cleanPrompt(system),
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
                  <div className="grid gap-2 h-full" style={{ gridTemplateColumns: `repeat(${Math.max(1, lanes.length)}, minmax(280px, 1fr))` }}>
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
                            <div className="text-sm font-medium truncate" style={{ color: activeLaneId === l.id ? ACCENT : '#e2e8f0' }}>
                              {l.title || 'Variant'}
                            </div>
                            <div className="text-[11px] opacity-60 truncate">{l.model} · temp {l.temperature.toFixed(2)}</div>
                          </button>
                          <SmallButton onClick={() => closeLane(l.id)}>Close</SmallButton>
                        </div>
                        <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
                          {l.msgs.length === 0 ? (
                            <div className="text-xs opacity-60">No messages yet.</div>
                          ) : l.msgs.map((m, i) => (
                            <div key={i} className={`text-sm whitespace-pre-wrap ${m.role === 'user' ? '' : 'opacity-85'}`}>
                              <b style={{ color: m.role === 'user' ? '#e2e8f0' : ACCENT }}>
                                {m.role === 'user' ? 'You' : 'AI'}:
                              </b>{' '}
                              {m.text}
                            </div>
                          ))}
                          {l.sending && <div className="text-xs opacity-70">Typing…</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* input */}
                <ChatInput
                  onSend={(t, mode) => sendMessage(t, mode)}
                  attachments={attachments}
                  setAttachments={setAttachments}
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

/* ---------------- ChatInput ---------------- */
function ChatInput({
  onSend,
  attachments,
  setAttachments,
  canSendBoth,
}: {
  onSend: (text: string, target: 'active' | 'both') => void;
  attachments: File[];
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  canSendBoth: boolean;
}) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length) {
        setAttachments(prev => [...prev, ...Array.from(files)].slice(0, 8));
      }
    };
    el.addEventListener('dragover', onDragOver as any);
    el.addEventListener('dragleave', onDragLeave as any);
    el.addEventListener('drop', onDrop as any);
    return () => {
      el.removeEventListener('dragover', onDragOver as any);
      el.removeEventListener('dragleave', onDragLeave as any);
      el.removeEventListener('drop', onDrop as any);
    };
  }, [setAttachments]);

  function send(target: 'active' | 'both') {
    const t = text.trim();
    if (!t) return;
    onSend(t, target);
    setText('');
  }

  return (
    <div ref={dropRef} className={`border-t border-white/10 p-2 ${dragOver ? 'bg-white/5' : ''}`}>
      {/* attachments row — horizontal */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 pb-2 overflow-x-auto">
          {attachments.map((f, idx) => (
            <div
              key={idx}
              className="min-w-[120px] max-w-[160px] flex items-center gap-2 px-2 py-1 rounded-md border bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.10)' }}
            >
              <span className="text-[11px] truncate">{f.name}</span>
              <button
                className="text-[11px] opacity-70 hover:opacity-100"
                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send('active'); }
          }}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => setAttachments(prev => [...prev, ...Array.from(e.target.files || [])].slice(0, 8))}
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
