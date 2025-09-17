// apps/web/app/improve.tsx (single-file, client component)
// Updated: split testing lanes, versions sidebar, auto-naming, attachments, real(ish) chat calls.
// No neon/glow; consistent neutral styling.

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

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
  label: string;      // AI-ish short name of change
  name: string;
  model: string;
  temperature: number;
  system: string;
};

type ChatMsg = { role: 'user' | 'assistant' | 'system'; text: string };
type Lane = {
  id: string;
  versionId: string | null;
  title: string;             // auto label display (short)
  system: string;            // effective system prompt for this lane
  model: string;
  temperature: number;
  msgs: ChatMsg[];
  sending: boolean;
};

type AgentMeta = {
  pinned?: boolean;
  draft?: boolean;
  tags?: string[];
  notes?: string;
};

// ---------- simple utilities ----------
const PANEL = { background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 } as React.CSSProperties;
const CARD  = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10 } as React.CSSProperties;

const fmt = (d: number) => new Date(d).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));

const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey     = (o: string, a: string) => `meta:${o}:${a}`;
const lastStateKey= (o: string, a: string) => `improve:last:${o}:${a}`;

// heuristic short label for a system change (no server AI call here)
function autoLabel(prev: Partial<BotRow> | null, next: BotRow) {
  const parts: string[] = [];
  if (prev?.name !== next.name) parts.push(`name→${(next.name || '').slice(0, 20)}`);
  if (prev?.model !== next.model) parts.push(`model→${next.model}`);
  if ((prev?.temperature ?? -1) !== next.temperature) parts.push(`temp→${next.temperature}`);
  // compute difference in system length and pick salient phrases
  const clean = (s: string) => s.replace(/\*\*|__|`/g, '').trim();
  const newSys = clean(next.system);
  const oldSys = clean(prev?.system || '');
  if (newSys !== oldSys) {
    const delta = Math.abs(newSys.length - oldSys.length);
    // try find cue words
    const cues = ['yes', 'no', 'concise', 'json', 'markdown', 'formal', 'casual', 'step', 'explain', 'cite', 'short', 'long'];
    const hit = cues.find(c => new RegExp(`\\b${c}\\b`, 'i').test(newSys));
    parts.push(hit ? `rule:${hit}` : delta > 60 ? 'prompt edited (large)' : 'prompt edited');
  }
  const base = parts.length ? parts.join(' · ') : 'minor edit';
  return base.length > 64 ? base.slice(0, 64) + '…' : base;
}

// client-side "AI" title summarizer (lane header) — short, human-friendly
function summarizeTitle(system: string) {
  const s = (system || '').replace(/\*\*|__|`/g, '');
  const hints = [
    { r: /\byes\/?no\b|\bonly yes|only no/i, t: 'Yes/No Only' },
    { r: /\bjson\b/i, t: 'JSON Output' },
    { r: /\bconcise|short\b/i, t: 'Concise Answers' },
    { r: /\bformal\b/i, t: 'Formal Tone' },
    { r: /\bcasual\b/i, t: 'Casual Tone' },
    { r: /\bcite|source\b/i, t: 'Cites Sources' },
    { r: /\bmarkdown\b/i, t: 'Markdown Format' },
  ];
  for (const h of hints) if (h.r.test(s)) return h.t;
  return (s.split('\n')[0] || 'Variant').slice(0, 40);
}

// fake owner for local dev when no auth
const fallbackOwner = 'local-owner';

// ---------- main component ----------
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
  const [tags, setTags] = useState<string[]>([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionFilter, setVersionFilter] = useState('');

  // lanes (split testing)
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [activeLaneId, setActiveLaneId] = useState<string | null>(null);
  const activeLane = lanes.find(l => l.id === activeLaneId) || null;

  // attachments for input (shared across lanes when sending to both)
  const [attachments, setAttachments] = useState<File[]>([]);

  // init user
  useEffect(() => {
    const storedUid = typeof window !== 'undefined' ? localStorage.getItem('dev:userId') : null;
    setUserId(storedUid || fallbackOwner);
  }, []);

  // fetch agents for user
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
      // local fallback: seed one agent
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

  // when select agent, load editor + versions + last state
  useEffect(() => {
    if (!selected || !userId) return;
    const uid = userId;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem((selected.system || '').replace(/\*\*/g, '')); // strip **
    setNotes('');
    setTags([]);
    try {
      const rawV = localStorage.getItem(versionsKey(uid, selected.id));
      setVersions(rawV ? (JSON.parse(rawV) as Version[]) : []);
    } catch { setVersions([]); }
    // restore lanes or start with 1 lane bound to current state
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
          system: (selected.system || '').replace(/\*\*/g, ''),
          model: selected.model || 'gpt-4o-mini',
          temperature: selected.temperature ?? 0.5,
          msgs: [], sending: false
        };
        setLanes([l]);
        setActiveLaneId(l.id);
      }
    } catch {
      const l: Lane = {
        id: `lane_${Date.now()}`,
        versionId: null,
        title: summarizeTitle(selected.system || ''),
        system: (selected.system || '').replace(/\*\*/g, ''),
        model: selected.model || 'gpt-4o-mini',
        temperature: selected.temperature ?? 0.5,
        msgs: [], sending: false
      };
      setLanes([l]);
      setActiveLaneId(l.id);
    }
    setDirty(false);
  }, [selectedId, selected, userId]);

  // persist lanes minimal state
  useEffect(() => {
    if (!selected || !userId) return;
    const payload = { lanes, activeLaneId };
    try { localStorage.setItem(lastStateKey(userId, selected.id), JSON.stringify(payload)); } catch {}
  }, [lanes, activeLaneId, selected, userId]);

  // warn on unload if dirty
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Save your project before leaving?';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // calculate dirty vs selected
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (system.replace(/\*\*/g,'') !== ((selected.system || '').replace(/\*\*/g,'')));
    setDirty(d);
  }, [name, model, temperature, system, selected]);

  // save edits + snapshot
  async function saveEdits() {
    if (!userId || !selected) return;
    try {
      // version snapshot (client)
      const prev = selected as BotRow;
      const candidate: BotRow = { ...prev, name, model, temperature, system };
      const v: Version = {
        id: `v_${Date.now()}`,
        ts: Date.now(),
        label: autoLabel(prev, candidate),
        name, model, temperature, system
      };
      const nextV = [v, ...(versions || [])].slice(0, 100);
      setVersions(nextV);
      localStorage.setItem(versionsKey(userId, selected.id), JSON.stringify(nextV));
      // server patch (best effort)
      try {
        await fetch(`/api/chatbots/${selected.id}?ownerId=${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
          body: JSON.stringify({ name, model, temperature, system })
        });
      } catch {}
      setDirty(false);
      // update lane 0 title/system to reflect
      setLanes(ls => ls.map((l,i) => i===0 ? { ...l, system, model, temperature, title: summarizeTitle(system) } : l));
    } catch (e) {
      alert('Failed to save');
    }
  }

  // create new lane by picking a version
  function openLaneFromVersion(v: Version) {
    const id = `lane_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const lane: Lane = {
      id, versionId: v.id,
      title: v.label || summarizeTitle(v.system),
      system: v.system.replace(/\*\*/g, ''),
      model: v.model, temperature: v.temperature,
      msgs: [], sending: false
    };
    setLanes(ls => [...ls, lane]);
    setActiveLaneId(id);
  }

  // remove lane
  function closeLane(id: string) {
    setLanes(ls => ls.filter(l => l.id !== id));
    if (activeLaneId === id) {
      const remain = lanes.filter(l => l.id !== id);
      setActiveLaneId(remain[0]?.id || null);
    }
  }

  // send message (to one or both lanes)
  async function sendMessage(text: string, target: 'active' | 'both') {
    const targets = target === 'both' ? lanes.map(l => l.id) : activeLaneId ? [activeLaneId] : [];
    if (targets.length === 0) return;
    const atts = attachments; // snapshot
    setAttachments([]);

    setLanes(ls => ls.map(l => targets.includes(l.id) ? ({ ...l, msgs: [...l.msgs, { role:'user', text }], sending: true }) : l));

    await Promise.all(targets.map(async (id) => {
      const lane = lanes.find(l => l.id === id);
      if (!lane) return;
      try {
        const res = await fetch('/api/assistants/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: lane.model,
            temperature: lane.temperature,
            system: lane.system,
            messages: [{ role: 'user', content: text }],
          })
        });
        let replyText = '';
        if (res.ok) {
          const json = await res.json();
          replyText = (json?.content || '').toString();
        } else {
          // simulate when API missing
          replyText = simulateReply(lane.system, text);
        }
        setLanes(ls => ls.map(l => l.id === id ? ({ ...l, msgs: [...l.msgs, { role:'assistant', text: replyText }], sending: false }) : l));
      } catch {
        const replyText = simulateReply(lane.system, text);
        setLanes(ls => ls.map(l => l.id === id ? ({ ...l, msgs: [...l.msgs, { role:'assistant', text: replyText }], sending: false }) : l));
      }
    }));
  }

  function simulateReply(sys: string, input: string) {
    // extremely light sim to reflect rules; not meant to replace real API
    const s = sys.toLowerCase();
    if (/only\s+yes|yes\/?no/.test(s)) {
      const yes = /^(is|are|do|does|did|can|will|would|should|could)\b/i.test(input.trim());
      return yes ? 'Yes.' : 'No.';
    }
    if (/\bjson\b/.test(s)) {
      return JSON.stringify({ answer: input.slice(0, 60), note: 'Mock reply (enable /api/assistants/chat for real output)' });
    }
    if (/\bconcise|short\b/.test(s)) {
      return input.length > 60 ? input.slice(0, 60) + '…' : 'Okay.';
    }
    return `Mock reply: ${input}`;
  }

  // add a rule line -> updates system (do not expose **)
  function applyRuleLine(line: string) {
    const clean = line.replace(/\*\*/g, '').trim();
    if (!clean) return;
    const next = `${system.trim()}\n- ${clean}`.trim();
    setSystem(next);
    setDirty(true);
    // also reflect in active lane system to feel "live"
    if (activeLane) setLanes(ls => ls.map(l => l.id === activeLane.id ? { ...l, system: next, title: summarizeTitle(next) } : l));
  }

  // attachments
  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    setAttachments(prev => [...prev, ...arr].slice(0, 8));
  }

  // UI helpers
  function SmallButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const { className, ...rest } = props;
    return <button {...rest} className={`px-2.5 py-1.5 text-xs rounded-md border border-white/10 hover:bg-white/5 ${className || ''}`} />;
  }

  return (
    <div className="min-h-screen" style={{ background:'#0b0d10', color:'#f1f5f9' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 px-4 py-3 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <div className="text-sm opacity-80">Improve</div>
          <div className="text-lg font-semibold">{selected ? (selected.name || 'Agent') : 'Agent'}</div>
          <span className="ml-2 text-[11px] px-2 py-[2px] rounded-full border border-white/10">
            {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SmallButton onClick={saveEdits} disabled={!dirty}>Save</SmallButton>
            <SmallButton onClick={() => userId && fetchBots(userId!)}>Refresh</SmallButton>
            <SmallButton onClick={() => setShowPrompt(s => !s)}>{showPrompt ? 'Hide Prompt' : 'Show Prompt'}</SmallButton>
          </div>
        </div>
      </header>

      {/* Canvas: fixed height panes, internal scroll */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: '300px 1fr' }}>
          {/* LEFT: Versions Sidebar */}
          <aside className="h-[calc(100vh-120px)] flex flex-col" style={PANEL}>
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <div className="font-medium">Versions</div>
              <input
                value={versionFilter}
                onChange={(e)=>setVersionFilter(e.target.value)}
                placeholder="Search…"
                className="ml-auto px-2 py-1 text-xs rounded-md bg-white/5 border border-white/10 outline-none"
              />
            </div>
            <div className="flex-1 overflow-auto p-2">
              {(!versions || versions.length===0) ? (
                <div className="text-xs opacity-70 p-3">No snapshots yet. Press <b>Save</b> to create one.</div>
              ) : (
                <ul className="space-y-2">
                  {versions
                    .filter(v => !versionFilter || v.label.toLowerCase().includes(versionFilter.toLowerCase()))
                    .map(v => (
                    <li key={v.id} className="p-2 rounded-md border border-white/10" style={CARD}>
                      <div className="text-sm truncate">{v.label || 'Untitled'}</div>
                      <div className="text-[11px] opacity-60">{fmt(v.ts)}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <SmallButton onClick={()=>{ setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system.replace(/\*\*/g,'')); setDirty(true);}}>Restore</SmallButton>
                        <SmallButton onClick={()=>openLaneFromVersion(v)}>Open Lane</SmallButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* agent list minimal */}
            <div className="border-t border-white/10 p-2">
              <div className="text-xs opacity-70 mb-1">Assistants</div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {loading ? <div className="text-xs opacity-70">Loading…</div> : list.map(b => (
                  <button key={b.id} onClick={()=>setSelectedId(b.id)} className={`w-full text-left text-xs px-2 py-1 rounded-md border ${selectedId===b.id?'bg-white/10':''}`} style={{ borderColor:'rgba(255,255,255,0.1)' }}>
                    {(b.name || 'Untitled')} · {b.model}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* RIGHT: Editor + Test area */}
          <section className="h-[calc(100vh-120px)] grid" style={{ gridTemplateRows:'auto 1fr' }}>
            {/* compact editor header */}
            <div className="p-3 flex items-center gap-3 border border-white/10 rounded-md" style={PANEL}>
              <div className="grid gap-2" style={{ gridTemplateColumns:'1.2fr 0.9fr 0.8fr' }}>
                <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Agent name"
                  className="px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none" />
                <select value={model} onChange={(e)=>setModel(e.target.value)} className="px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none">
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70 w-16">Temp</span>
                  <input type="range" min={0} max={1} step={0.01} value={temperature} onChange={(e)=>setTemperature(Number(e.target.value))} className="flex-1" />
                  <span className="text-xs opacity-80 w-10 text-right">{temperature.toFixed(2)}</span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <div className="px-2 py-1 rounded-md border border-white/10">est {estimateTokens(system)} tok</div>
                <SmallButton onClick={()=>setShowPrompt(s=>!s)}>{showPrompt?'Hide Prompt':'Show Prompt'}</SmallButton>
              </div>
            </div>

            {/* body: prompt + test lanes */}
            <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: showPrompt ? 'minmax(260px, 360px) 1fr' : '1fr' }}>
              {/* collapsible prompt editor */}
              {showPrompt && (
                <div className="h-[calc(100vh-170px)] flex flex-col" style={PANEL}>
                  <div className="p-3 border-b border-white/10 flex items-center justify-between">
                    <div className="text-sm font-medium">Prompt</div>
                    <SmallButton onClick={()=>setShowPrompt(false)}>Close</SmallButton>
                  </div>
                  <div className="p-3 space-y-2 overflow-auto">
                    <div className="text-xs opacity-70">Rules (add a single line, click Update)</div>
                    <div className="flex items-center gap-2">
                      <input id="ruleLine" placeholder="e.g., Respond only Yes or No unless asked to elaborate." className="flex-1 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none" />
                      <SmallButton onClick={()=>{
                        const el = document.getElementById('ruleLine') as HTMLInputElement | null;
                        if (!el) return; applyRuleLine(el.value); el.value='';
                      }}>Update</SmallButton>
                    </div>
                    <div className="text-xs opacity-70">System Prompt</div>
                    <textarea value={system} onChange={(e)=>setSystem(e.target.value.replace(/\*\*/g,''))}
                      className="w-full h-72 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none font-mono text-xs leading-5" />
                    <div className="flex items-center justify-between text-[11px] opacity-70">
                      <div>{system.length.toLocaleString()} chars</div>
                      <div>Tip: Keep it short; use bullets.</div>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-xs opacity-70">Notes (optional)</div>
                      <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="w-full h-24 px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {/* TEST AREA */}
              <div className="h-[calc(100vh-170px)] flex flex-col" style={PANEL}>
                <div className="p-3 border-b border-white/10 flex items-center gap-2">
                  <div className="font-medium">Test Sandbox</div>
                  <div className="text-xs opacity-70">Drag/open versions as lanes. Click a lane to target it. Use “Send to Both” to compare.</div>
                  <div className="ml-auto flex items-center gap-2">
                    <SmallButton onClick={()=>{
                      // open current working state as a lane
                      openLaneFromVersion({ id:`v_live_${Date.now()}`, ts: Date.now(), label: summarizeTitle(system), name, model, temperature, system });
                    }}>Open Current as Lane</SmallButton>
                  </div>
                </div>

                {/* lanes */}
                <div className="flex-1 overflow-hidden p-2">
                  <div className="grid gap-2 h-full" style={{ gridTemplateColumns: `repeat(${Math.max(1, lanes.length)}, minmax(280px, 1fr))` }}>
                    {lanes.map(l => (
                      <div key={l.id} className={`h-full flex flex-col rounded-md border ${activeLaneId===l.id?'border-emerald-500':'border-white/10'} bg-white/2`}>
                        <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
                          <button onClick={()=>setActiveLaneId(l.id)} className="text-left flex-1">
                            <div className="text-sm font-medium truncate">{l.title || 'Variant'}</div>
                            <div className="text-[11px] opacity-60 truncate">{l.model} · temp {l.temperature.toFixed(2)}</div>
                          </button>
                          <SmallButton onClick={()=>closeLane(l.id)}>Close</SmallButton>
                        </div>
                        <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
                          {l.msgs.length===0 ? (
                            <div className="text-xs opacity-60">No messages yet.</div>
                          ) : l.msgs.map((m,i)=>(
                            <div key={i} className={`text-sm whitespace-pre-wrap ${m.role==='user'?'':'opacity-85'}`}>
                              <b>{m.role==='user'?'You':'AI'}:</b> {m.text}
                            </div>
                          ))}
                          {l.sending && <div className="text-xs opacity-70">Thinking…</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* input */}
                <ChatInput
                  onSend={(t, mode)=>sendMessage(t, mode)}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  canSendBoth={lanes.length>1}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------- ChatInput (separate for clarity) ----------
function ChatInput({
  onSend,
  attachments,
  setAttachments,
  canSendBoth
}: {
  onSend: (text: string, target: 'active'|'both') => void;
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
    const onDragLeave= () => setDragOver(false);
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

  function send(target: 'active'|'both') {
    const t = text.trim();
    if (!t) return;
    onSend(t, target);
    setText('');
  }

  return (
    <div ref={dropRef} className={`border-t border-white/10 p-2 ${dragOver?'bg-white/5':''}`}>
      {/* attachments row (horizontal, small) */}
      {attachments.length>0 && (
        <div className="flex items-center gap-2 pb-2 overflow-x-auto">
          {attachments.map((f,idx)=>(
            <div key={idx} className="min-w-[120px] max-w-[160px] flex items-center gap-2 px-2 py-1 rounded-md border border-white/10 bg-white/5">
              <span className="text-[11px] truncate">{f.name}</span>
              <button className="text-[11px] opacity-70 hover:opacity-100" onClick={()=>setAttachments(prev => prev.filter((_,i)=>i!==idx))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <textarea
          value={text}
          onChange={(e)=>setText(e.target.value)}
          placeholder="Type a message… (drop files here)"
          rows={2}
          className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 outline-none resize-none"
          onKeyDown={(e)=>{
            if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send('active'); }
          }}
        />
        <input ref={fileRef} type="file" className="hidden" multiple onChange={(e)=>setAttachments(prev => [...prev, ...Array.from(e.target.files || [])].slice(0,8))} />
        <button onClick={()=>fileRef.current?.click()} className="px-2.5 py-2 text-xs rounded-md border border-white/10 hover:bg-white/5">Attach</button>
        {canSendBoth && <button onClick={()=>send('both')} className="px-2.5 py-2 text-xs rounded-md border border-white/10 hover:bg-white/5">Send to Both</button>}
        <button onClick={()=>send('active')} className="px-3 py-2 text-xs rounded-md border border-white/10 hover:bg-white/5">Send</button>
      </div>
      <div className="mt-1 text-[10px] opacity-50">Drop files here (hint text)</div>
    </div>
  );
}
