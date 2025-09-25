'use client';

import React from 'react';
import { X, Globe, Loader2 } from 'lucide-react';

export default function ImportWebsiteModal({
  open,
  value,
  onChange,
  onCancel,
  onImport,
  importing,
}: {
  open: boolean;
  value: string;
  importing?: boolean;
  onChange: (v: string) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(8,10,12,.78)' }}
        onClick={onCancel}
      />

      {/* card */}
      <div
        className="relative w-[min(92vw,720px)] rounded-[12px] p-4"
        style={{
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-weak)',
          boxShadow: '0 20px 40px rgba(0,0,0,.28)',
          color: 'var(--text)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full"
                  style={{ background: 'rgba(89,217,179,.12)' }}>
              <Globe className="w-4 h-4" style={{ color: '#59d9b3' }} />
            </span>
            Import website
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 grid place-items-center rounded-[8px]"
            style={{ border: '1px solid var(--border-weak)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          Paste one or more URLs (space or newline separated). We’ll fetch and extract prompt-ready facts.
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[8px] px-3 py-2 bg-transparent outline-none"
          style={{ minHeight: 160, background: 'var(--panel-bg)', border: '1px solid var(--border-weak)' }}
          placeholder="https://example.com/about https://example.com/contact"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-[8px]"
            style={{ border: '1px solid var(--border-weak)' }}
          >
            Cancel
          </button>
          <button
            disabled={!!importing}
            onClick={onImport}
            className="px-3 py-1.5 text-sm rounded-[8px] inline-flex items-center gap-2"
            style={{
              background: '#59d9b3',
              color: '#0a0f0d',
              border: '1px solid rgba(255,255,255,.10)',
              opacity: importing ? 0.7 : 1,
            }}
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
