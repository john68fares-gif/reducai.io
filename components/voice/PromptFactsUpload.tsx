'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileText, Check, X } from 'lucide-react';
import { extractBusinessFacts, mergeBusinessFacts } from '@/lib/prompt-engine';

type Props = {
  currentPrompt: string;
  onPromptMerged: (merged: string, summary: string) => void; // call this to setField('systemPrompt') + toast
};

export default function PromptFactsUpload({ currentPrompt, onPromptMerged }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [filesMeta, setFilesMeta] = useState<{ name: string; size: number }[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      setFilesMeta(Array.from(files).map(f => ({ name: f.name, size: f.size })));

      // Read all files to text (client-only; no uploads).
      const docs = await Promise.all(
        Array.from(files).map(async (f) => {
          // best effort: text() works for txt/md/csv/rtf/html; for pdf/docx users can paste text (see below)
          let text = '';
          try { text = await f.text(); } catch {}
          return { name: f.name, text };
        })
      );

      // Extract facts → merge into [Business Facts]
      const facts = extractBusinessFacts(docs, { includeDocTags: true, maxFacts: 32 });
      const { merged, summary } = mergeBusinessFacts(currentPrompt, facts, { heading: 'Business Facts' });
      onPromptMerged(merged, summary);
    } catch (e: any) {
      alert(e?.message || 'Failed to read files');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handlePasteMerge() {
    const text = pasteText.trim();
    if (!text) return;
    setBusy(true);
    try {
      const facts = extractBusinessFacts({ name: 'Pasted Text', text }, { includeDocTags: true, maxFacts: 32 });
      const { merged, summary } = mergeBusinessFacts(currentPrompt, facts);
      onPromptMerged(merged, summary);
      setPasteOpen(false);
      setPasteText('');
    } catch (e: any) {
      alert(e?.message || 'Failed to parse pasted text');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="va-card">
      <div className="va-head" style={{ minHeight: 56 }}>
        <div className="flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Upload className="w-4 h-4" style={{ color: '#59d9b3' }} />
          <span>Upload facts to merge into <span className="font-semibold">[Business Facts]</span></span>
        </div>
        <div />
      </div>

      <div className="p-[var(--s-5)] space-y-3">
        {/* picker row */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.rtf,.html,.htm,.json,.log,.ini,.yml,.yaml,.tsv,.srt"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[10px] px-3 font-semibold disabled:opacity-60"
            style={{
              height: 40,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text)',
              boxShadow: 'var(--input-shadow)',
            }}
          >
            <Upload className="w-4 h-4" />
            Choose files
          </button>

          <button
            type="button"
            onClick={() => setPasteOpen((v) => !v)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[10px] px-3"
            style={{
              height: 40,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text)',
              boxShadow: 'var(--input-shadow)',
            }}
          >
            <FileText className="w-4 h-4" />
            Paste text
          </button>

          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Tip: export PDFs/Docs to <strong>.txt</strong> for best results. We auto-pull hours, contacts, services, pricing, policies, links.
          </span>
        </div>

        {/* selected files chips */}
        {filesMeta.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filesMeta.map((f, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-[10px]"
                style={{
                  background: 'rgba(89,217,179,.10)',
                  border: '1px solid rgba(89,217,179,.22)',
                  color: 'var(--text)',
                }}
              >
                <Check className="w-3.5 h-3.5" style={{ color: '#59d9b3' }} />
                <span className="truncate max-w-[220px]">{f.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* paste panel */}
        {pasteOpen && (
          <div
            className="rounded-[12px] p-2"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
          >
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste any text here (price list, policies, services, etc.)"
              className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
              style={{ minHeight: 140, color: 'var(--text)' }}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handlePasteMerge}
                disabled={!pasteText.trim() || busy}
                className="inline-flex items-center gap-2 rounded-[10px] px-3 font-semibold disabled:opacity-60"
                style={{ height: 36, background: '#59d9b3', color: '#0a0f0d' }}
              >
                Merge into Business Facts
              </button>
              <button
                onClick={() => { setPasteOpen(false); setPasteText(''); }}
                className="inline-flex items-center gap-2 rounded-[10px] px-3"
                style={{
                  height: 36,
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text)',
                  boxShadow: 'var(--input-shadow)',
                }}
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* busy hint */}
        {busy && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Parsing files and updating your prompt…
          </div>
        )}
      </div>
    </div>
  );
}
