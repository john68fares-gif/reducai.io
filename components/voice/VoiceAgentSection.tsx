// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, ChevronRight, Rocket, Plus, Pencil, Trash2,
  Bot, FileText, Mic2, BookOpen, Phone, Wrench, Sparkles,
  AudioLines, ListTree
} from 'lucide-react';

/* ============================================================================
   THEME (Green, v0-style structure) + LAYOUT
============================================================================ */
const SCOPE = 'va-scope';

function StyleBlock() {
  const css = `
.${SCOPE}{
  /* Typography */
  --fw-regular: 500;
  --fw-medium: 560;
  --radius: 12px;

  /* ---------------- GREEN PALETTE (dark) ----------------
     Mirrors your purple tokens but in green hues.
     Tweak the oklch lightness if you want brighter/darker. */
  --background: oklch(0.17 0.02 170);           /* deep near-black with green hue */
  --foreground: oklch(0.92 0.02 180);           /* light text */

  --card:       oklch(0.205 0.03 170);          /* panels */
  --card-fg:    var(--foreground);

  --primary:    oklch(0.78 0.12 150);           /* brand green (buttons, rings) */
  --primary-fg: white;

  --secondary:  oklch(0.30 0.05 170);
  --muted:      oklch(0.25 0.04 170);
  --border:     oklch(0.34 0.06 170);

  --bg: var(--background);
  --text: var(--foreground);
  --text-muted: color-mix(in oklab, var(--foreground) 60%, transparent);

  --shadow: 0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.40);

  background: var(--bg);
  color: var(--text);
  font-weight: var(--fw-regular);
  letter-spacing: .005em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* FULL WIDTH – no centered container/max-width anywhere */
  width: 100vw;
  min-height: 100dvh;
  overflow-x: hidden;
}

/* Light mapping (kept for completeness) */
:root:not([data-theme="dark"]) .${SCOPE}{
  --background: oklch(0.97 0.01 180);
  --foreground: oklch(0.30 0.05 180);
  --card:       white;
  --primary:    oklch(0.80 0.12 150);
  --primary-fg: white;
  --border:     oklch(0.90 0.02 180);
  --text-muted: color-mix(in oklab, var(--foreground) 55%, transparent);
}

/* Toolbar */
.${SCOPE} .toolbar{
  position: sticky; top: calc(var(--app-header-h, 64px) + 8px);
  z-index: 2; display:flex; align-items:center; justify-content:space-between;
  gap: 14px; padding: 12px 16px 8px 16px;
  background: linear-gradient(180deg, color-mix(in oklab, var(--background) 90%, transparent) 0%, transparent 100%);
  backdrop-filter: blur(6px);
}

/* Controls */
.${SCOPE} .btn{
  height:40px; padding:0 .9rem; border-radius: var(--radius);
  display:inline-flex; align-items:center; gap:.5rem;
  border:1px solid var(--border); background: var(--card);
  color: white; /* force white text in buttons per your requirement */
  font-weight: var(--fw-medium);
}
.${SCOPE} .btn--primary{ background: var(--primary); border-color: color-mix(in oklab, var(--primary) 50%, var(--border)); color: var(--primary-fg); }
.${SCOPE} .btn:disabled{ opacity:.6; cursor:not-allowed; }

.${SCOPE} .select{
  height:40px; min-width: 220px; padding:0 2.1rem 0 .85rem; border-radius: var(--radius);
  background: var(--card); color: var(--text); border:1px solid var(--border);
  -webkit-appearance:none; appearance:none; font-size:14.5px;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23A8B3BE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat:no-repeat; background-position:right .6rem center;
}

/* Grid + sections */
.${SCOPE} .grid{ display:grid; gap:16px; padding: 0 16px 88px 16px; }
.${SCOPE} .grid.cols-2{ grid-template-columns: repeat(2, minmax(320px,1fr)); }

.${SCOPE} .section{
  background: linear-gradient(180deg, color-mix(in oklab, var(--card) 100%, transparent) 0%, color-mix(in oklab, var(--card) 92%, transparent) 100%);
  border:1px solid var(--border); border-radius:16px; box-shadow: var(--shadow);
}
.${SCOPE} .section__head{
  display:flex; align-items:center; justify-content:space-between;
  padding: 12px 16px; border-bottom:1px solid var(--border); color: var(--text);
  font-weight:560;
}
.${SCOPE} .section__title{ display:flex; align-items:center; gap:8px; font-size:14px; }
.${SCOPE} .section__body{ padding: 18px; }
.${SCOPE} .section__placeholder{
  height: 120px; border:1px dashed color-mix(in oklab, var(--border) 70%, transparent);
  border-radius:12px; background: color-mix(in oklab, var(--muted) 10%, transparent);
}

/* Make the whole app feel edge-to-edge */
.${SCOPE} .full-bleed{ width:100vw; }
`;
  return <style>{css}</style>;
}

/* ============================================================================
   TYPES + STORAGE
============================================================================ */
type Assistant = { id: string; name: string; published?: boolean; updatedAt: number };
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ============================================================================
   REUSABLE SECTION WRAPPER
============================================================================ */
function Section({
  title, icon, defaultOpen = true, minH = 120,
}: { title: string; icon: React.ReactNode; defaultOpen?: boolean; minH?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <div className="section__head">
        <div className="section__title">
          {icon}
          <span>{title}</span>
        </div>
        <button className="btn" onClick={() => setOpen(v => !v)} aria-label="toggle section">
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
            <div className="section__placeholder" style={{ minHeight: minH }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================================
   PAGE
============================================================================ */
export default function VoiceAgentSection() {
  const [isClient, setIsClient] = useState(false);
  const [list, setList] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isClient) return;
    const stored = readLS<Assistant[]>(LS_LIST) || [];
    if (!stored.length) {
      const seed: Assistant = { id: 'bot_1', name: 'New Assistant', published: false, updatedAt: Date.now() };
      writeLS(ak(seed.id), seed);
      writeLS(LS_LIST, [seed]);
      setList([seed]); setActiveId(seed.id);
    } else {
      setList(stored); setActiveId(stored[0]?.id || '');
    }
  }, [isClient]);

  const active = list.find(a => a.id === activeId) || null;

  const createBot = () => {
    const id = `bot_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = { id, name: 'New Assistant', published: false, updatedAt: Date.now() };
    writeLS(ak(id), a);
    const next = [...list, a]; writeLS(LS_LIST, next);
    setList(next); setActiveId(id);
  };
  const renameBot = () => {
    if (!active) return;
    const name = window.prompt('Rename assistant', active.name)?.trim();
    if (!name) return;
    const upd = { ...active, name, updatedAt: Date.now() };
    writeLS(ak(active.id), upd);
    const next = list.map(b => (b.id === active.id ? upd : b));
    writeLS(LS_LIST, next); setList(next);
  };
  const deleteBot = () => {
    if (!active) return;
    if (!window.confirm(`Delete "${active.name}"?`)) return;
    localStorage.removeItem(ak(active.id));
    const next = list.filter(b => b.id !== active.id);
    writeLS(LS_LIST, next); setList(next); setActiveId(next[0]?.id || '');
  };
  const togglePublish = () => {
    if (!active) return;
    const upd = { ...active, published: !active.published, updatedAt: Date.now() };
    writeLS(ak(active.id), upd);
    const next = list.map(b => (b.id === active.id ? upd : b));
    writeLS(LS_LIST, next); setList(next);
  };

  if (!isClient) {
    return (
      <div className={SCOPE}>
        <StyleBlock />
        <div className="toolbar"><div className="btn">Loading…</div></div>
      </div>
    );
  }

  return (
    <div className={`${SCOPE} full-bleed`}>
      <StyleBlock />

      {/* Toolbar */}
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            className="select"
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            aria-label="Select assistant"
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

      {/* Sections (empty for now) */}
      <div className="grid">
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
  );
}
