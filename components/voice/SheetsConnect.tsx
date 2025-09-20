'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Table, X, Link as LinkIcon, Check } from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const IS_CLIENT = typeof window !== 'undefined';

type Props = {
  agentId: string;
  onConnected?: (binding: { sheetId: string; sheetName?: string; url: string }) => void;
  onPromptMerge?: (promptChunk: string) => void; // optional: merge “facts” into system prompt
};

export default function SheetsConnect({ agentId, onConnected, onPromptMerge }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existing, setExisting] = useState<{ url: string; sheetId: string; sheetName?: string } | null>(null);

  useEffect(() => {
    if (!IS_CLIENT) return;
    (async () => {
      try {
        const store = await scopedStorage();
        await store.ensureOwnerGuard();
        const key = `sheets.binding:${agentId}`;
        const b = await store.getJSON<typeof existing>(key, null);
        if (b) { setExisting(b); setUrl(b.url); setSheetName(b.sheetName || ''); }
      } catch {}
    })();
  }, [agentId]);

  async function connect() {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    setBusy(true);
    try {
      const r = await fetch('/api/connectors/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, sheetName: sheetName || undefined, agentId })
      }).catch(() => null);
      if (!r?.ok) throw new Error('connect failed');
      const data = await r.json();

      // persist binding client-side so the UI remembers
      try {
        const store = await scopedStorage();
        await store.ensureOwnerGuard();
        const key = `sheets.binding:${agentId}`;
        await store.setJSON(key, { url: cleanUrl, sheetId: data.sheetId, sheetName: data.sheetName });
        setExisting({ url: cleanUrl, sheetId: data.sheetId, sheetName: data.sheetName });
      } catch {}

      if (onPromptMerge && data?.promptChunk) onPromptMerge(data.promptChunk);
      if (onConnected) onConnected({ sheetId: data.sheetId, sheetName: data.sheetName, url: cleanUrl });

      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 900);
    } catch {
      alert('Could not connect to Google Sheet. Check the URL and service-account sharing.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* trigger styled like your cards */}
      <div className="rounded-[12px] p-3" style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4" style={{ color: CTA }} />
            <div className="text-sm font-medium">Google Sheets</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="rounded-[10px] px-3 text-sm"
            style={{ height: 36, background: CTA, color: '#051412', fontWeight: 600 }}
          >
            {existing ? 'Manage' : 'Connect'}
          </button>
        </div>
        {existing ? (
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Connected to <span className="opacity-90">{existing.sheetName || 'Sheet1'}</span>
            <br />
            <a href={existing.url} target="_blank" rel="noreferrer" className="underline">Open Google Sheet</a>
          </div>
        ) : (
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Paste a Google Sheet link and I’ll read/write appointments with conflict checks.
          </div>
        )}
      </div>

      {/* overlay */}
      {open && IS_CLIENT ? createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 100000, background: 'rgba(6,8,10,.62)', backdropFilter: 'blur(6px)' }}
            onClick={() => !busy && setOpen(false)}
          />
          <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: 100001 }}>
            <div
              className="w-full max-w-[640px] rounded-[12px] overflow-hidden"
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: `1px solid ${GREEN_LINE}`,
                boxShadow: '0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${GREEN_LINE}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(89,217,179,.12)' }}>
                    <Table className="w-5 h-5" style={{ color: CTA }} />
                  </div>
                  <div className="text-lg font-semibold">Connect Google Sheet</div>
                </div>
                <button
                  onClick={() => !busy && setOpen(false)}
                  className="w-8 h-8 rounded-[8px] grid place-items-center"
                  style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.10)' }}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* body */}
              <div className="px-6 py-5 space-y-3">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Share your Sheet with the service account (see env vars below). Use this schema:
                </div>
                <pre
                  className="rounded-[10px] px-3 py-2 text-xs"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', whiteSpace: 'pre-wrap' }}
                >{`A1 headers (row 1):
Date | Start Time | End Time | Client Name | Phone | Email | Notes | Status

• Date: YYYY-MM-DD
• Start Time / End Time: HH:MM (24h)
• Status: "Booked" | "Cancelled" | "No-Show" (optional)
`}</pre>

                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  When the assistant books an appointment it checks for overlaps and appends a row.
                </div>

                <label className="text-sm">Google Sheet URL</label>
                <div
                  className="flex items-center gap-2 rounded-[10px] px-2"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                >
                  <LinkIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className="w-full bg-transparent outline-none text-sm py-2"
                    style={{ color: 'var(--text)' }}
                  />
                </div>

                <label className="text-sm">Sheet name (tab) — optional</label>
                <input
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Sheet1"
                  className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text)' }}
                />
              </div>

              {/* footer */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => !busy && setOpen(false)}
                  className="w-full h-[44px] rounded-[10px]"
                  style={{ background: 'var(--panel)', border: '1px solid var(--input-border)', color: 'var(--text)', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={connect}
                  disabled={!url.trim() || busy}
                  className="w-full h-[44px] rounded-[10px] font-semibold inline-flex items-center justify-center gap-2"
                  style={{ background: CTA, color: '#0a0f0d', opacity: (!url.trim() || busy) ? .6 : 1 }}
                >
                  {saved ? <Check className="w-4 h-4" /> : null}
                  {busy ? 'Connecting…' : (saved ? 'Connected' : 'Connect')}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}
    </>
  );
}
