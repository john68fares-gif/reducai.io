'use client';

import React, { useRef, useState } from 'react';
import { Globe2, MapPin, Upload, Download, Database } from 'lucide-react';
import { mergeBusinessFacts, extractBusinessFacts } from '@/lib/prompt-engine';

type Props = {
  currentPrompt: string;
  onPromptMerged: (merged: string, summary: string) => void;
};

export default function DataIntegrationsSection({ currentPrompt, onPromptMerged }: Props) {
  const [siteUrl, setSiteUrl] = useState('');
  const [mapsQuery, setMapsQuery] = useState('');
  const [busy, setBusy] = useState<'site'|'maps'|'files'|''>('');
  const fileRef = useRef<HTMLInputElement|null>(null);

  // Sheets config (just fields; persist however you like)
  const [sheetId, setSheetId] = useState('');
  const [readRange, setReadRange] = useState('Availability!A2:E');
  const [appendRange, setAppendRange] = useState('Bookings!A2');

  async function importWebsite() {
    if (!siteUrl.trim() || busy) return;
    setBusy('site');
    try {
      const r = await fetch('/api/connectors/website-import', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url: siteUrl.trim() })
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Import failed');
      const { merged, summary } = mergeBusinessFacts(currentPrompt, j.facts);
      onPromptMerged(merged, summary);
    } catch (e:any) {
      alert(e?.message || 'Website import failed');
    } finally {
      setBusy('');
    }
  }

  async function importMaps() {
    if (!mapsQuery.trim() || busy) return;
    setBusy('maps');
    try {
      const r = await fetch('/api/connectors/maps-import', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ query: mapsQuery.trim() })
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Maps import failed');
      const { merged, summary } = mergeBusinessFacts(currentPrompt, j.facts);
      onPromptMerged(merged, summary);
    } catch (e:any) {
      alert(e?.message || 'Maps import failed');
    } finally {
      setBusy('');
    }
  }

  async function importFiles(files: FileList | null) {
    if (!files || !files.length || busy) return;
    setBusy('files');
    try {
      const docs: { name?: string; text: string }[] = [];
      for (const f of Array.from(files)) {
        // client-side read only (works anywhere; not localhost-specific)
        const text = await f.text();
        docs.push({ name: f.name, text });
      }
      const facts = extractBusinessFacts(docs, { includeDocTags: true, maxFacts: 32 });
      const { merged, summary } = mergeBusinessFacts(currentPrompt, facts);
      onPromptMerged(merged, summary);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e:any) {
      alert(e?.message || 'File parse failed');
    } finally {
      setBusy('');
    }
  }

  const disabled = (k:'site'|'maps'|'files') => busy === k;

  return (
    <div className="va-card">
      <div className="va-head" style={{ minHeight: 56 }}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" style={{ color:'#59d9b3' }} />
          <span>Data & Integrations</span>
        </div>
        <div/>
      </div>

      <div className="p-4 space-y-6">
        {/* Website */}
        <div>
          <label className="block mb-2 text-[12.5px]">Business Website</label>
          <div className="flex gap-2">
            <input
              value={siteUrl}
              onChange={(e)=>setSiteUrl(e.target.value)}
              placeholder="https://exampleclinic.com"
              className="flex-1 rounded-[10px] px-3"
              style={{ height:44, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            />
            <button
              onClick={importWebsite}
              disabled={!siteUrl.trim() || disabled('site')}
              className="px-3 rounded-[10px] font-semibold disabled:opacity-60"
              style={{ height:44, background:'#59d9b3', color:'#0a0f0d' }}
            >
              {busy==='site' ? 'Import…' : (
                <span className="inline-flex items-center gap-2">
                  <Globe2 className="w-4 h-4"/> Import
                </span>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color:'var(--text-muted)' }}>
            We’ll extract hours, phones, services, policies, links and merge into [Business Facts].
          </p>
        </div>

        {/* Google Maps */}
        <div>
          <label className="block mb-2 text-[12.5px]">Google Maps Link or Query</label>
          <div className="flex gap-2">
            <input
              value={mapsQuery}
              onChange={(e)=>setMapsQuery(e.target.value)}
              placeholder="Paste Maps URL or 'BrightSmile Dental Austin'"
              className="flex-1 rounded-[10px] px-3"
              style={{ height:44, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            />
            <button
              onClick={importMaps}
              disabled={!mapsQuery.trim() || disabled('maps')}
              className="px-3 rounded-[10px] font-semibold disabled:opacity-60"
              style={{ height:44, background:'#59d9b3', color:'#0a0f0d' }}
            >
              {busy==='maps' ? 'Import…' : (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4"/> Import
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Files */}
        <div>
          <label className="block mb-2 text-[12.5px]">Upload Facts (export PDF/DOC to text for best results)</label>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".txt,.md,.csv,.rtf,.html,.htm,.json,.log,.ini,.yml,.yaml,.tsv"
              onChange={(e)=>importFiles(e.target.files)}
              className="hidden"
            />
            <button
              onClick={()=>fileRef.current?.click()}
              disabled={disabled('files')}
              className="px-3 rounded-[10px] font-semibold disabled:opacity-60"
              style={{ height:44, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            >
              <span className="inline-flex items-center gap-2">
                <Upload className="w-4 h-4" /> Choose files
              </span>
            </button>
            <span className="text-xs" style={{ color:'var(--text-muted)' }}>
              We’ll mine hours, services, prices, policies, contacts.
            </span>
          </div>
        </div>

        {/* Sheets */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block mb-2 text-[12.5px]">Google Sheet ID</label>
            <input
              value={sheetId}
              onChange={(e)=>setSheetId(e.target.value)}
              placeholder="1AbCxyz..."
              className="w-full rounded-[10px] px-3"
              style={{ height:44, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            />
          </div>
          <div>
            <label className="block mb-2 text-[12.5px]">Availability Range (read)</label>
            <input
              value={readRange}
              onChange={(e)=>setReadRange(e.target.value)}
              className="w-full rounded-[10px] px-3"
              style={{ height:44, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            />
          </div>
          <div>
            <label className="block mb-2 text-[12.5px]">Bookings Range (append)</label>
            <input
              value={appendRange}
              onChange={(e)=>setAppendRange(e.target.value)}
              className="w-full rounded-[10px] px-3"
              style={{ height:44, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={async ()=>{
              if (!sheetId || !readRange) return alert('Enter Sheet ID + read range');
              const qs = new URLSearchParams({ spreadsheetId: sheetId, range: readRange });
              const r = await fetch(`/api/connectors/sheets?${qs}`);
              const j = await r.json();
              if (!j?.ok) return alert(j?.error || 'Read failed');
              alert(`Loaded ${j.values?.length || 0} rows. (Wire this to a slot picker UI.)`);
            }}
            className="px-3 rounded-[10px]"
            style={{ height:44, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
          >
            <span className="inline-flex items-center gap-2">
              <Download className="w-4 h-4" /> Read Availability
            </span>
          </button>

          <button
            onClick={async ()=>{
              if (!sheetId || !appendRange) return alert('Enter Sheet ID + append range');
              // Example row; replace with real values from your booking flow
              const row = [new Date().toISOString().slice(0,10), '09:30', '30min', 'Dr. Smith', 'BOOKED', 'Caller Name', '555-123-4567', 'via Voice'];
              const r = await fetch('/api/connectors/sheets', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ spreadsheetId: sheetId, range: appendRange, values: row })
              });
              const j = await r.json();
              if (!j?.ok) return alert(j?.error || 'Append failed');
              alert('Appointment added ✔');
            }}
            className="px-3 rounded-[10px] font-semibold"
            style={{ height:44, background:'#59d9b3', color:'#0a0f0d' }}
          >
            Add Test Booking
          </button>
        </div>
      </div>
    </div>
  );
}
