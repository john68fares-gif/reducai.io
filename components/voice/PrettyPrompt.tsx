// components/voice/PrettyPrompt.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * PrettyPrompt
 * - Renders a system prompt with styled [Sections]
 * - Optional typing effect for visuals (no backend impact)
 *
 * Props:
 *  text:        string           // full prompt
 *  typing?:     boolean          // enable typing effect
 *  speedMs?:    number           // chars per tick (ms), default 12
 *  onDone?:     () => void       // called when typing finishes
 *  className?:  string
 */
export default function PrettyPrompt({
  text,
  typing = false,
  speedMs = 12,
  onDone,
  className
}: {
  text: string;
  typing?: boolean;
  speedMs?: number;
  onDone?: () => void;
  className?: string;
}) {
  // Normalize \r\n and trim trailing spaces to keep layout stable
  const clean = useMemo(() => (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim(), [text]);

  // Split into sections by headers like [Identity], [Style], etc.
  const sections = useMemo(() => {
    const rx = /^\s*\[([^\]]+)\]\s*$/m;
    const lines = clean.split('\n');
    const out: Array<{ title: string; body: string[] }> = [];
    let current: { title: string; body: string[] } | null = null;

    for (const line of lines) {
      const m = line.match(/^\s*\[([^\]]+)\]\s*$/);
      if (m) {
        if (current) out.push(current);
        current = { title: m[1], body: [] };
      } else {
        if (!current) current = { title: 'Prompt', body: [] };
        current.body.push(line);
      }
    }
    if (current) out.push(current);
    return out;
  }, [clean]);

  // Typing effect
  const [typed, setTyped] = useState('');
  const iRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!typing) { setTyped(clean); return; }
    setTyped('');
    iRef.current = 0;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      iRef.current += 1;
      const next = clean.slice(0, iRef.current);
      setTyped(next);
      if (next.length >= clean.length) {
        timerRef.current && clearInterval(timerRef.current);
        timerRef.current = null;
        onDone?.();
      }
    }, speedMs);
    return () => { timerRef.current && clearInterval(timerRef.current); };
  }, [clean, typing, speedMs, onDone]);

  // Copy
  const [copied, setCopied] = useState(false);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  }

  // Render text source (either typed or full)
  const source = typing ? typed : clean;

  // Split the CURRENT visible text into sections again so typing respects blocks
  const visibleSections = useMemo(() => {
    if (!typing) return sections;
    // Re-parse the visible chunk so headers appear as they’re revealed
    const rx = /^\s*\[([^\]]+)\]\s*$/m;
    const lines = source.split('\n');
    const out: Array<{ title: string; body: string[] }> = [];
    let current: { title: string; body: string[] } | null = null;
    for (const line of lines) {
      const m = line.match(/^\s*\[([^\]]+)\]\s*$/);
      if (m) {
        if (current) out.push(current);
        current = { title: m[1], body: [] };
      } else {
        if (!current) current = { title: 'Prompt', body: [] };
        current.body.push(line);
      }
    }
    if (current) out.push(current);
    return out;
  }, [sections, source, typing]);

  return (
    <div
      className={className}
      style={{
        borderRadius: 12,
        background: 'var(--input-bg, #101314)',
        border: '1px solid var(--input-border, rgba(255,255,255,.14))',
        color: 'var(--text, #e6f1ef)',
        boxShadow: 'var(--input-shadow, inset 0 1px 0 rgba(255,255,255,.04))',
        overflow: 'hidden'
      }}
    >
      <Header onCopy={doCopy} copied={copied} />

      <div className="px-4 py-3">
        {visibleSections.map((sec, idx) => (
          <SectionBlock key={idx} title={sec.title} body={sec.body.join('\n')} showCaret={typing && idx === visibleSections.length - 1} />
        ))}
      </div>
    </div>
  );
}

/* ───────────────── subcomponents ───────────────── */

function Header({ onCopy, copied }: { onCopy: () => void; copied: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        background:
          'linear-gradient(90deg, var(--panel, #0d0f11) 0%, color-mix(in oklab, var(--panel, #0d0f11) 97%, white 3%) 50%, var(--panel, #0d0f11) 100%)',
        borderBottom: '1px solid rgba(255,255,255,.08)'
      }}
    >
      <div className="text-xs" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
        Frontend Prompt (visual)
      </div>
      <button
        onClick={onCopy}
        className="inline-flex items-center gap-2 text-xs rounded-[8px] px-2.5 py-1"
        style={{
          background: 'rgba(89,217,179,.10)',
          boxShadow: '0 0 0 1px rgba(89,217,179,.16) inset',
          color: 'var(--text, #e6f1ef)'
        }}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function SectionBlock({ title, body, showCaret }: { title: string; body: string; showCaret: boolean }) {
  const isHeader = title && title.toLowerCase() !== 'prompt';
  const lines = useMemo(() => (body || '').split('\n'), [body]);

  return (
    <div className="mb-4 last:mb-0">
      {isHeader && (
        <div className="mb-2 inline-flex items-center gap-2 px-2 py-1 rounded-[8px]"
             style={{ background: 'rgba(89,217,179,.10)', boxShadow: '0 0 0 1px rgba(89,217,179,.16) inset' }}>
          <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--text, #e6f1ef)' }}>
            {title}
          </span>
        </div>
      )}

      <pre
        className={`rounded-[10px] px-3 py-2 text-sm ${showCaret ? 'pp-caret' : ''}`}
        style={{
          background: 'transparent',
          border: '1px dashed rgba(255,255,255,.12)',
          color: 'var(--text, #e6f1ef)',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.55,
          fontFamily:
            'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace'
        }}
      >
        {lines.map((ln, i) => (
          <span key={i}>
            {ln || ' '}
            {'\n'}
          </span>
        ))}
      </pre>

      {/* typing caret style */}
      <style jsx>{`
        @keyframes pp-blink { 0%, 49% {opacity: 1;} 50%, 100% {opacity: 0;} }
        .pp-caret::after{
          content:'';
          display:inline-block;
          width:8px; height:18px; margin-left:4px;
          background: currentColor; opacity:.9; border-radius:2px;
          animation: pp-blink 1s step-end infinite;
          transform: translateY(3px);
        }
      `}</style>
    </div>
  );
}
