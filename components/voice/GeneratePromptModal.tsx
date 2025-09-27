'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, X, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerate: (userDescription: string) => Promise<void> | void;
  zBackdrop?: number; // default 100000
  zModal?: number;    // default 100001
  ctaColor?: string;  // default '#59d9b3'
  borderGlow?: string;// default 'rgba(89,217,179,.20)'
};

export default function GeneratePromptModal({
  open,
  onClose,
  onGenerate,
  zBackdrop = 100000,
  zModal = 100001,
  ctaColor = '#59d9b3',
  borderGlow = 'rgba(89,217,179,.20)',
}: Props) {
  const [composerText, setComposerText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open || typeof document === 'undefined') return null;

  const handleGenerate = async () => {
    if (!composerText.trim() || busy) return;
    try {
      setBusy(true);
      const payload = composerText.trim();
      await onGenerate(payload);
      setComposerText(''); // clear after submit
      onClose();           // parent will open diff
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: zBackdrop, background: 'rgba(0,0,0,.72)' }}
        onClick={busy ? undefined : () => { setComposerText(''); onClose(); }}
        aria-hidden
      />
      <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: zModal }}>
        <div
          className="w-full max-w-[640px] rounded-[12px] overflow-hidden"
          style={{
            background: 'var(--panel-bg)',
            color: 'var(--text)',
            border: `1px solid ${borderGlow}`,
            maxHeight: '86vh',
            boxShadow: '0 24px 64px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)',
            animation: 'vaModalIn 280ms cubic-bezier(.22,.61,.36,1) both',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Generate prompt"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{
              background:
                'linear-gradient(90deg,var(--panel-bg) 0%,color-mix(in oklab,var(--panel-bg) 97%, white 3%) 50%,var(--panel-bg) 100%)',
              borderBottom: `1px solid ${borderGlow}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: 'rgba(89,217,179,.12)' }}>
                <span style={{ color: ctaColor }}>
                  <Wand2 className="w-5 h-5" />
                </span>
              </div>
              <div className="text-lg font-semibold">Describe how to update the prompt</div>
            </div>
            <button
              onClick={busy ? undefined : () => { setComposerText(''); onClose(); }}
              className="w-8 h-8 rounded-[6px] grid place-items-center"
              style={{ background: 'var(--panel-bg)', border: `1px solid ${borderGlow}`, opacity: busy ? 0.6 : 1 }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-3">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Tip: “assistant for a dental clinic; tone friendly; handle booking and FAQs”.
            </div>
            <div
              className="rounded-[8px] p-2"
              style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-weak)' }}
            >
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                className="w-full bg-transparent outline-none rounded-[6px] px-3 py-2"
                placeholder="Describe changes…"
                style={{ minHeight: 160, maxHeight: '40vh', color: 'var(--text)', resize: 'vertical' }}
                disabled={busy}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => { if (!busy) { setComposerText(''); onClose(); } }}
              className="w-full h-[40px] rounded-[8px]"
              style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-weak)', color: 'var(--text)', fontWeight: 600, opacity: busy ? 0.7 : 1 }}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={busy || !composerText.trim()}
              className="w-full h-[40px] rounded-[8px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: ctaColor, color: '#ffffff', opacity: busy || !composerText.trim() ? 0.7 : 1 }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {busy ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
