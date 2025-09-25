'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Globe, X } from 'lucide-react';

export default function ImportWebsiteModal({
  open, onCancel, onImport
}:{
  open: boolean;
  onCancel: () => void;
  onImport: (urls: string[]) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement|null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  useEffect(() => { if (open) setTimeout(()=>boxRef.current?.focus(), 0); }, [open]);

  if (!open) return null;

  const urls = text.split(/\s+/).map(s=>s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.55)' }} onClick={onCancel} />
      <div
        className="relative w-[min(720px,90vw)] rounded-2xl p-5"
        style={{ background: 'var(--panel-bg, #0d0f11)', border: '1px solid var(--border-weak, rgba(255,255,255,.14))', boxShadow: '0 30px 80px rgba(0,0,0,.40)' }}
      >
        <button
          onClick={onCancel}
          className="absolute right-3 top-3 w-9 h-9 grid place-items-center rounded-full"
          style={{ border: '1px solid var(--border-weak, rgba(255,255,255,.14))' }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-base font-semibold mb-3">Import website facts</div>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted, #9fb4ad)' }}>
          Paste one or more URLs (space or newline separated). We’ll extract short, reliable bullets.
        </p>

        <textarea
          ref={boxRef}
          value={text}
          onChange={(e)=>setText(e.target.value)}
          className="w-full rounded-xl bg-transparent outline-none text-sm p-3"
          style={{ minHeight:120, border:'1px solid var(--border-weak, rgba(255,255,255,.14))' }}
          placeholder="https://example.com  https://example.com/pricing  https://example.com/contact"
        />

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs" style={{ color:'var(--text-muted, #9fb4ad)' }}>
            {urls.length ? `${urls.length} URL${urls.length>1?'s':''} ready` : 'No URLs yet'}
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-2 rounded-xl text-sm" style={{ border:'1px solid var(--border-weak, rgba(255,255,255,.14))' }}>
              Cancel
            </button>
            <button
              disabled={!urls.length || busy}
              onClick={async ()=>{
                if (!urls.length) return;
                setBusy(true);
                try { await onImport(urls); } finally { setBusy(false); }
              }}
              className="px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2 disabled:opacity-60"
              style={{ background:'#59d9b3', color:'#0a0f0d', boxShadow:'0 12px 30px rgba(89,217,179,.30)' }}
            >
              <Globe className="w-4 h-4" /> {busy ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
