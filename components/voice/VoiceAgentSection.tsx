// components/voice/VoiceAgentSection.tsx
'use client';

import React from 'react';
import {
  Bot, FileText, Mic2, BookOpen, Phone, ListTree,
  Sparkles, AudioLines, Rocket, Plus, Pencil, Trash2, ChevronDown
} from 'lucide-react';

/* ===== Minimal tokens to match Improve (only primary buttons are green) ===== */
const GREEN = '#10b981';
const GREEN_HOVER = '#0ea371';

function LocalTokens() {
  return (
    <style>{`
      .va-wrap{ color:var(--text); }
      .va-section{ border:1px solid var(--border); background:var(--panel); border-radius:12px; }
      .va-head{ border-bottom:1px solid var(--border); }
      .va-dashed{ border:1px dashed var(--border); border-radius:12px; background:var(--card); }
      .btn{ height:40px; padding:0 .85rem; border-radius:10px;
        display:inline-flex; align-items:center; gap:.5rem;
        border:1px solid var(--border); background:var(--card); color:var(--text); font-weight:560; }
      .btn-primary{ height:40px; padding:0 .9rem; border-radius:10px;
        display:inline-flex; align-items:center; gap:.5rem;
        background:${GREEN}; color:#fff; border:1px solid ${GREEN};
        box-shadow:0 10px 24px rgba(16,185,129,.22); font-weight:700;
        transition:background .18s ease, transform .05s ease, box-shadow .18s ease; }
      .btn-primary:hover{ background:${GREEN_HOVER}; box-shadow:0 12px 28px rgba(16,185,129,.32); }
      .btn-primary:active{ transform:translateY(1px); }
      .picker, .input{
        height:40px; border-radius:10px; padding:0 .85rem; background:var(--card);
        border:1px solid var(--border); color:var(--text); }
      .muted{ color: color-mix(in oklab, var(--text) 60%, transparent); }
    `}</style>
  );
}

/* ===== Tiny section shell (title + icon + empty body) ===== */
function Section({
  title, icon, minH = 160,
}:{
  title: string; icon: React.ReactNode; minH?: number;
}) {
  return (
    <div className="va-section">
      <div className="va-head px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-grid place-items-center w-5 h-5 rounded-md"
                style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            {icon}
          </span>
          {title}
        </div>
        <ChevronDown size={16} className="muted" />
      </div>
      <div className="p-4">
        <div className="va-dashed w-full" style={{ minHeight: minH }} />
      </div>
    </div>
  );
}

/* ===== PAGE (layout-only) ===== */
export default function VoiceAgentSection() {
  return (
    <div className="va-wrap mx-auto w-full max-w-[1400px] px-4 py-6">
      <LocalTokens />

      {/* Top bar (matches Improve spacing, only primary buttons green) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bot size={18} /><span className="font-semibold">Voice Studio</span><span className="opacity-60">/</span>
          <select className="picker">
            <option>New Assistant</option>
          </select>
          <button className="btn"><Plus size={16}/> New</button>
          <button className="btn"><Pencil size={16}/> Rename</button>
          <button className="btn"><Trash2 size={16}/> Delete</button>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary"><Rocket size={16}/> Publish</button>
        </div>
      </div>

      {/* Stats row (empty) */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="va-section p-4">
          <div className="text-[12.5px] muted mb-1.5">Metric A</div>
          <div className="text-[19px] font-semibold">—</div>
        </div>
        <div className="va-section p-4">
          <div className="text-[12.5px] muted mb-1.5">Metric B</div>
          <div className="text-[19px] font-semibold">—</div>
        </div>
      </div>

      {/* Body grid like Improve (left column + right column) */}
      <div className="grid lg:grid-cols-[420px,1fr] gap-6">
        {/* LEFT column sections */}
        <div className="space-y-6">
          <Section title="Model" icon={<FileText size={14} />} minH={180} />
          <Section title="Voice" icon={<Mic2 size={14} />} minH={180} />
          <Section title="Transcriber" icon={<BookOpen size={14} />} minH={180} />
          <Section title="Telephony" icon={<Phone size={14} />} minH={180} />
        </div>

        {/* RIGHT column sections */}
        <div className="space-y-6">
          <Section title="System Prompt" icon={<Sparkles size={14} />} minH={300} />
          <Section title="Call Assistant (Web test)" icon={<AudioLines size={14} />} minH={220} />
          <Section title="Call Logs" icon={<ListTree size={14} />} minH={180} />
        </div>
      </div>
    </div>
  );
}
