// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, ChevronRight, Rocket, Plus, Pencil, Trash2,
  Bot, FileText, Mic2, BookOpen, Phone, Wrench, Sparkles, AudioLines, ListTree
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* THEME + LAYOUT TOKENS (Cosmic Night-like)                                  */
/* -------------------------------------------------------------------------- */
const SCOPE = 'va-scope';
const EDGE_GUTTER = 24;
const MAX_LANE_W = 1560;

function StyleBlock() {
  const css = `
.${SCOPE}{
  --fw-regular: 500;
  --fw-medium: 560;
  --radius: 12px;

  /* Dark tokens from your screenshots */
  --background: oklch(0.1743 0.0227 283.0);
  --foreground: oklch(0.9185 0.0257 285.0);

  --card:       oklch(0.2284 0.0384 282.0);
  --card-fg:    var(--foreground);

  --primary:    oklch(0.7162 0.1597 290.3962);
  --primary-fg: oklch(0.1743 0.0227 283.0);

  --border:     oklch(0.3261 0.0597 282.5832);
  --muted:      oklch(0.2710 0.0621 281.4);

  --bg: var(--background);
  --text: var(--foreground);
  --text-muted: color-mix(in oklab, var(--foreground) 60%, transparent);

  --shadow: 0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.40);

  font-weight: var(--fw-regular);
  letter-spacing: .005em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
}

/* Light mode mapping (kept for completeness) */
:root:not([data-theme="dark"]) .${SCOPE}{
  --background: oklch(0.9730 0.0133 286.0);
  --foreground: oklch(0.3015 0.0572 282.0);
  --card:       white;
  --border:     oklch(0.9115 0.0216 285.9625);
  --primary:    oklch(0.5417 0.1790 288.0332);
  --primary-fg: white;
  --text-muted: color-mix(in oklab, var(--foreground) 55%, transparent);
}

.${SCOPE} .lane{
  padding: 14px var(--edge);
  --edge: ${EDGE_GUTTER}px;
  margin: 0 auto;
  max-width: min(${MAX_LANE_W}px, 100vw - var(--edge)*2);
}

.${SCOPE} .toolbar{
  position: sticky; top: calc(var(--app-header-h, 64px) + 8px);
  z-index: 2; display:flex; align-items:center; justify-content:space-between;
  gap: 14px; padding-bottom: 10px;
}

.${SCOPE} .btn{
  height:40px; padding:0 .85rem; border-radius: var(--radius);
  display:inline-flex; align-items:center; gap:.5rem;
  border:1px solid var(--border); background: var(--card); color:var(--text);
  font-weight: var(--fw-medium);
}
.${SCOPE} .btn--primary{ background: var(--primary); color: var(--primary-fg); }
.${SCOPE} .btn:disabled{ opacity:.6; cursor:not-allowed; }

.${SCOPE} .select{
  height:40px; min-width: 220px; padding:0 2.1rem 0 .85rem; border-radius: var(--radius);
  background: var(--card); color:var(--text); border:1px solid var(--border);
  -webkit-appearance:none; appearance:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23A8B3BE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat:no-repeat; background-position:right .6rem center;
  font-size:14.5px;
}

.${SCOPE} .grid{ display:grid; gap:14px; }
.${SCOPE} .grid.cols-2{ grid-template-columns: repeat(2, minmax(260px,1fr)); }

.${SCOPE} .section{
  background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
  border:1px solid var(--border); border-radius:16px; box-shadow: var(--shadow);
}
.${SCOPE} .section__head{
  display:flex; align-items:center; justify-content:space-between;
  padding: 12px 16px; border-bottom:1px solid var(--border); font-weight:560;
}
.${SCOPE} .section__title{ display:flex; align-items:center; gap:8px; font-size:14px; }
.${SCOPE} .section__body{ padding: 18px; }
.${SCOPE} .section__placeholder{
  height: 120px; border:1px dashed color-mix(in oklab, var(--border) 75%, transparent);
  border-radius:12px; background: color-mix(in oklab, var(--muted) 10%, transparent);
}
`;
  return <style>{css}</style>;
}

/* -------------------------------------------------------------------------- */
/* TYPES + STORAGE HELPERS                                                     */
/* -------------------------------------------------------------------------- */
type Assistant = { id: string; name: string; published?: boolean; updatedAt: number };
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* -------------------------------------------------------------------------- */
/* REUSABLE SECTION WRAPPER                                                    */
/* -------------------------------------------------------------------------- */
function Section({
  title, icon, defaultOpen = true, minH = 120, children,
}: { title: string; icon: React.ReactNode; defaultOpen?: boolean; minH?: number; children?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <div className="section__head">
        <div className="section__title">
          {icon}
          <span>{title}</span>
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn" aria-label="toggle section">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="section__body"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}
          >
            {/* EMPTY placeholder box for now */}
            <div className="section__placeholder" style={{ minHeight: minH }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                        */
/* -------------------------------------------------------------------------- */
export default function VoiceAgentSection() {
  const [isClient, setIsClient] = useState(false);
  const [list, setList] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isClient) return;
    const stored = readLS<Assistant[]>(LS_LIST) || [];
    if (!stored.length) {
      const seed: Assistant = { id: 'bot_1', name: 'My First Bot', published: false, updatedAt: Date.now() };
      writeLS(ak(seed.id), seed);
      writeLS(LS_LIST, [seed]);
      setList([seed]); setActiveId(seed.id);
    } else {
      setList(stored); setActiveId(stored[0]?.id || '');
    }
  }, [isClient]);

  const active = list.find(a => a.id === activeId) || null;

  /* ---------- toolbar actions ---------- */
  const createBot = () => {
    const id = `bot_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = { id, name: 'New Bot', published: false, updatedAt: Date.now() };
    writeLS(ak(id), a);
    const next = [...list, a];
    writeLS(LS_LIST, next);
    setList(next);
    setActiveId(id);
  };

  const renameBot = () => {
    if (!active) return;
    // eslint-disable-next-line no-alert
    const name = window.prompt('Rename bot', active.name)?.trim();
    if (!name) return;
    const upd = { ...active, name, updatedAt: Date.now() };
    writeLS(ak(active.id), upd);
    const next = list.map(b => (b.id === active.id ? upd : b));
    writeLS(LS_LIST, next);
    setList(next);
  };

  const deleteBot = () => {
    if (!active) return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm(`Delete "${active.name}"? This removes it from local storage.`);
    if (!ok) return;
    localStorage.removeItem(ak(active.id));
    const next = list.filter(b => b.id !== active.id);
    writeLS(LS_LIST, next);
    setList(next);
    setActiveId(next[0]?.id || '');
  };

  const togglePublish = () => {
    if (!active) return;
    const upd = { ...active, published: !active.published, updatedAt: Date.now() };
    writeLS(ak(active.id), upd);
    const next = list.map(b => (b.id === active.id ? upd : b));
    writeLS(LS_LIST, next);
    setList(next);
  };

  if (!isClient) {
    return (
      <div className={SCOPE}>
        <StyleBlock />
        <div className="lane"><div className="text-sm opacity-70 py-10">Loading…</div></div>
      </div>
    );
  }

  return (
    <div className={SCOPE}>
      <StyleBlock />

      <div className="lane">
        {/* ------------------------------------------------------------------ */}
        {/* TOOLBAR                                                            */}
        {/* ------------------------------------------------------------------ */}
        <div className="toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Bot selector */}
            <select
              className="select"
              value={activeId}
              onChange={(e) => setActiveId(e.target.value)}
              aria-label="Select chatbot"
            >
              {list.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <button className="btn" onClick={createBot}><Plus className="w-4 h-4" /> New</button>
            <button className="btn" onClick={renameBot} disabled={!active}><Pencil className="w-4 h-4" /> Rename</button>
            <button className="btn" onClick={deleteBot} disabled={!active}><Trash2 className="w-4 h-4" /> Delete</button>
          </div>

          <button className="btn btn--primary" onClick={togglePublish} disabled={!active}>
            <Rocket className="w-4 h-4" />
            {active?.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECTIONS – EMPTY BOXES ONLY                                        */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid" style={{ gap: 16 }}>
          <Section title="Overview" icon={<Bot className="w-4 h-4" />} minH={100} />
          <div className="grid cols-2">
            <Section title="Model" icon={<FileText className="w-4 h-4" />} />
            <Section title="Voice" icon={<Mic2 className="w-4 h-4" />} />
          </div>
          <div className="grid cols-2">
            <Section title="Transcriber" icon={<BookOpen className="w-4 h-4" />} />
            <Section title="Telephony" icon={<Phone className="w-4 h-4" />} />
          </div>
          <div className="grid cols-2">
            <Section title="Tools" icon={<Wrench className="w-4 h-4" />} />
            <Section title="System Prompt" icon={<Sparkles className="w-4 h-4" />} />
          </div>
          <Section title="Testing" icon={<AudioLines className="w-4 h-4" />} minH={160} />
          <Section title="Logs" icon={<ListTree className="w-4 h-4" />} minH={180} />
        </div>
      </div>
    </div>
  );
}
