// components/voice/PromptReview.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import PrettyPrompt from '@/components/voice/PrettyPrompt';

type Props = {
  basePrompt: string;          // the current/old prompt
  proposedPrompt: string;      // the newly generated prompt
  onAccept: (finalPrompt: string) => void;
  onDiscard: () => void;
  onEdit?: () => void;         // optional: jump back to editor/overlay
  summary?: string;            // optional short summary "Applied tone=..., tasks=..."
};

export default function PromptReview({
  basePrompt,
  proposedPrompt,
  onAccept,
  onDiscard,
  onEdit,
  summary,
}: Props) {
  // run typing only once when the component mounts
  const [typing, setTyping] = useState(true);
  useEffect(() => { setTyping(true); }, [proposedPrompt]);

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{
        background: 'var(--panel, #0d0f11)',
        border: '1px solid rgba(255,255,255,.10)',
        boxShadow: '0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset',
      }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background:
            'linear-gradient(90deg,var(--panel, #0d0f11) 0%,color-mix(in oklab,var(--panel, #0d0f11) 97%, white 3%) 50%,var(--panel, #0d0f11) 100%)',
          borderBottom: '1px solid rgba(255,255,255,.08)',
          color: 'var(--text, #e6f1ef)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Review generated prompt</span>
          {summary ? (
            <span
              className="text-[11px] px-2 py-0.5 rounded-[8px]"
              style={{ background: 'rgba(89,217,179,.12)', boxShadow: '0 0 0 1px rgba(89,217,179,.18) inset', color: 'var(--text)' }}
            >
              {summary}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {onEdit ? (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-[10px] px-3 h-9 text-sm"
              style={{
                background: 'var(--panel, #0d0f11)',
                border: '1px solid var(--input-border, rgba(255,255,255,.14))',
                color: 'var(--text, #e6f1ef)',
              }}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          ) : null}
          <button
            onClick={() => onDiscard()}
            className="inline-flex items-center gap-2 rounded-[10px] px-3 h-9 text-sm"
            style={{
              background: 'rgba(239,68,68,.14)',
              color: '#fff',
              border: '1px solid rgba(239,68,68,.35)',
            }}
          >
            <X className="w-4 h-4" />
            Discard
          </button>
          <button
            onClick={() => onAccept(proposedPrompt)}
            className="inline-flex items-center gap-2 rounded-[10px] px-3 h-9 text-sm font-semibold"
            style={{
              background: '#59d9b3',
              color: '#0a0f0d',
              boxShadow: '0 10px 22px rgba(89,217,179,.20)',
              border: '1px solid rgba(255,255,255,.08)',
            }}
          >
            <Check className="w-4 h-4" />
            Accept changes
          </button>
        </div>
      </div>

      {/* body: pretty renderer with typing */}
      <div className="p-4">
        <PrettyPrompt text={proposedPrompt} typing={typing} onDone={() => setTyping(false)} />
      </div>

      {/* subtle footer showing what will be replaced */}
      <div
        className="px-4 py-3 text-xs"
        style={{ color: 'var(--text-muted, #9fb4ad)', borderTop: '1px dashed rgba(255,255,255,.10)' }}
      >
        Accepting will replace your current system prompt ({basePrompt.length.toLocaleString()} chars).
      </div>
    </div>
  );
}
