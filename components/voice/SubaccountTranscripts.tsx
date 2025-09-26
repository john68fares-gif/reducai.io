// FILE: components/voice/SubaccountTranscripts.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, ExternalLink, FileText, Loader2, Lock, Search, Share2, Trash2, Users, Check, Copy, CheckCircle, XCircle, RefreshCw, PlayCircle } from 'lucide-react';

/**
 * Drop this component into your Voice Studio page (e.g., /voice-agent or /dashboard).
 * It renders a Sub-Accounts section where teams can browse call transcripts,
 * filter/search, read the full conversation, download, and toggle a public share link.
 *
 * NOTE: This file assumes you have the following HTTP endpoints (adjust as needed):
 *  - GET  /api/subaccounts                                    -> SubAccount[]
 *  - GET  /api/voice/transcripts?subId=...&q=...&status=...   -> { items: Transcript[] }
 *  - GET  /api/voice/transcripts/:id                          -> Transcript (with full turns)
 *  - PATCH/POST /api/voice/transcripts/:id/share              -> { shared: boolean, url?: string }
 *  - DELETE /api/voice/transcripts/:id                        -> { ok: true }
 *
 * If you don't have them yet, the UI will still render but show "No data".
 */

/* ───────── theme tokens (light/dark) ───────── */
const Tokens = ({theme}:{theme:'dark'|'light'}) => (
  <style jsx global>{`
    :root {
      ${theme==='dark' ? `
        --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;
        --border:rgba(255,255,255,.10); --panel-soft:#0f1113;
        --accent:#59d9b3; --accent-weak:rgba(89,217,179,.12);
        --danger:#ef4444; --danger-weak:rgba(239,68,68,.14);
      ` : `
        --bg:#f6f8f9; --panel:#ffffff; --text:#0b1620; --text-muted:#50606a;
        --border:rgba(0,0,0,.10); --panel-soft:#fafbfd;
        --accent:#2abfa1; --accent-weak:rgba(42,191,161,.12);
        --danger:#dc2626; --danger-weak:rgba(220,38,38,.10);
      `}
      --ease:cubic-bezier(.22,.61,.36,1);
      --radius:10px; --ctl-h:38px; --gap:12px;
      --shadow:0 18px 36px rgba(0,0,0,.18);
    }
    .sa-card{ background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden; }
    .sa-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--border); }
    .sa-kbd{ padding:1px 6px; border:1px solid var(--border); border-bottom-width:2px; border-radius:6px; font-size:11px; }
    .row-hover:hover{ background:var(--panel-soft); }
  `}</style>
);

/* ───────── types ───────── */
type SubAccount = { id: string; name: string; ownerEmail?: string };
type TranscriptTurn = { id: string; role: 'user'|'assistant'|'system'|'tool'; text: string; at?: string };
type Transcript = {
  id: string;
  subId: string;
  startedAt: string;               // ISO
  durationSec?: number;
  status?: 'completed'|'missed'|'failed'|'in-progress';
  caller?: string;                  // e.g., +1415555…
  callee?: string;                  // your number/agent
  summary?: string;
  recordingUrl?: string;
  shared?: boolean;
  shareUrl?: string;
  turns?: TranscriptTurn[];         // optional in list; load full on select
};

/* ───────── helpers ───────── */
const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return iso; }
};
const fmtDur = (s?: number) => (s==null ? '—' : `${Math.floor(s/60)}m ${s%60}s`);
const clamp = (n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/* ───────── main component ───────── */
export default function SubaccountTranscripts() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    if (typeof document==='undefined') return 'dark';
    const ds = document.documentElement.dataset.theme;
    return (ds==='light'||ds==='dark') ? ds : 'dark';
  });
  useEffect(()=>{ if (typeof document!=='undefined') document.documentElement.dataset.theme = theme; },[theme]);

  const [subs, setSubs] = useState<SubAccount[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [activeSubId, setActiveSubId] = useState<string>('');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all'|'completed'|'missed'|'failed'|'in-progress'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const [list, setList] = useState<Transcript[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = list.find(t => t.id === selectedId);

  /* fetch subs */
  useEffect(() => {
    let alive = true;
    (async () => {
      setSubsLoading(true);
      try {
        const r = await fetch('/api/subaccounts').catch(()=>null as any);
        const j = r?.ok ? await r.json() : [];
        if (!alive) return;
        const clean: SubAccount[] = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
        setSubs(clean);
        if (!activeSubId && clean[0]?.id) setActiveSubId(clean[0].id);
      } catch { if (alive) setSubs([]); }
      finally { if (alive) setSubsLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  /* fetch transcripts list */
  useEffect(() => {
    if (!activeSubId) { setList([]); return; }
    let alive = true;
    (async () => {
      setListLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set('subId', activeSubId);
        if (q.trim()) qs.set('q', q.trim());
        if (status!=='all') qs.set('status', status);
        const r = await fetch(`/api/voice/transcripts?${qs.toString()}`).catch(()=>null as any);
        const j = r?.ok ? await r.json() : null;
        if (!alive) return;
        const items: Transcript[] = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []);
        // sort newest first
        items.sort((a,b)=> (new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
        setList(items);
        // auto-select first
        if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
      } catch { if (alive) setList([]); }
      finally { if (alive) setListLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubId, status, refreshKey]);

  /* fetch full transcript on select (if turns missing) */
  useEffect(() => {
    if (!selectedId) return;
    const idx = list.findIndex(x=>x.id===selectedId);
    if (idx<0) return;
    if (list[idx]?.turns && list[idx].turns!.length) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/voice/transcripts/${selectedId}`).catch(()=>null as any);
        const j: Transcript | null = r?.ok ? await r.json() : null;
        if (!alive || !j) return;
        setList(prev => {
          const copy = [...prev];
          const i = copy.findIndex(t=>t.id===selectedId);
          if (i>=0) copy[i] = { ...copy[i], ...j };
          return copy;
        });
      } catch {}
    })();
    return ()=>{ alive=false; };
  }, [selectedId, list]);

  /* derived */
  const filtered = useMemo(() => {
    const byStatus = (t:Transcript) => status==='all' ? true : (t.status===status);
    const byQ = (t:Transcript) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return [
        t.caller, t.callee, t.summary, t.id
      ].some(v => (v||'').toLowerCase().includes(needle));
    };
    return list.filter(t => byStatus(t) && byQ(t));
  }, [list, q, status]);

  /* actions */
  const toggleShare = async (t: Transcript) => {
    try {
      const r = await fetch(`/api/voice/transcripts/${t.id}/share`, {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ shared: !t.shared })
      }).catch(()=>null as any);
      const j = r?.ok ? await r.json() : null;
      setList(prev => prev.map(x => x.id===t.id ? { ...x, shared: !!j?.shared, shareUrl: j?.url || x.shareUrl } : x));
    } catch {}
  };
  const removeTranscript = async (t: Transcript) => {
    if (!confirm('Delete this transcript? This cannot be undone.')) return;
    try {
      await fetch(`/api/voice/transcripts/${t.id}`, { method: 'DELETE' }).catch(()=>null as any);
      setList(prev => prev.filter(x => x.id !== t.id));
      if (selectedId===t.id) setSelectedId(prev => (prev===t.id ? '' : prev));
    } catch {}
  };
  const copyToClipboard = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(()=>setCopied(false), 900); } catch {}
  };
  const [copied, setCopied] = useState(false);

  /* exports */
  const downloadJSON = (t: Transcript) => {
    const blob = new Blob([JSON.stringify(t, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript_${t.id}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const downloadTXT = (t: Transcript) => {
    const lines = [
      `Call ID: ${t.id}`,
      `Sub-Account: ${t.subId}`,
      `Started: ${fmtTime(t.startedAt)}`,
      `Duration: ${fmtDur(t.durationSec)}`,
      `Status: ${t.status || '—'}`,
      `Caller: ${t.caller || '—'}`,
      `Callee: ${t.callee || '—'}`,
      `Summary: ${t.summary || '—'}`,
      '',
      '--- Transcript ---',
      ...(t.turns||[]).map(turn => `[${turn.role}] ${turn.text}`)
    ].join('\n');
    const blob = new Blob([lines], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript_${t.id}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <section style={{ color:'var(--text)' }}>
      <Tokens theme={theme} />
      <header className="sa-card" style={{ marginBottom: 12 }}>
        <div className="sa-head">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Users className="w-4 h-4" />
            <strong>Sub Accounts — Call Transcripts</strong>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button
              onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}
              className="px-2 py-1 rounded border"
              style={{ borderColor:'var(--border)' }}
            >
              Theme: {theme}
            </button>
            <button
              onClick={()=>setRefreshKey(k=>k+1)}
              title="Reload"
              className="px-2 py-1 rounded border"
              style={{ borderColor:'var(--border)' }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div style={{ padding:12, display:'grid', gridTemplateColumns:'280px 1fr 220px', gap:12 }}>
          {/* Sub select */}
          <div style={{ display:'grid', gap:6 }}>
            <label className="text-xs" style={{ color:'var(--text-muted)' }}>Sub-Account</label>
            <div style={{ position:'relative' }}>
              <select
                value={activeSubId}
                onChange={(e)=>{ setActiveSubId(e.target.value); setSelectedId(''); }}
                className="w-full"
                style={{ height:'var(--ctl-h)', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:8, padding:'0 10px' }}
              >
                {subsLoading ? <option>Loading…</option> : null}
                {!subsLoading && subs.length===0 ? <option value="">No sub-accounts</option> : null}
                {!subsLoading && subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {/* Search */}
          <div style={{ display:'grid', gap:6 }}>
            <label className="text-xs" style={{ color:'var(--text-muted)' }}>Search</label>
            <div style={{ position:'relative' }}>
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="Search id, caller, callee, summary…"
                style={{ width:'100%', height:'var(--ctl-h)', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:8, padding:'0 34px 0 34px' }}
              />
              <Search className="w-4 h-4" style={{ position:'absolute', left:10, top:10, color:'var(--text-muted)' }} />
              {!!q && (
                <button onClick={()=>setQ('')} title="Clear" style={{ position:'absolute', right:8, top:6 }} className="px-2 py-1 rounded border">
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {/* Status */}
          <div style={{ display:'grid', gap:6 }}>
            <label className="text-xs" style={{ color:'var(--text-muted)' }}>Status</label>
            <select
              value={status}
              onChange={(e)=>setStatus(e.target.value as any)}
              style={{ height:'var(--ctl-h)', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:8, padding:'0 10px' }}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="failed">Failed</option>
              <option value="in-progress">In progress</option>
            </select>
          </div>
        </div>
      </header>

      <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:14 }}>
        {/* left: list */}
        <div className="sa-card" style={{ minHeight: 420 }}>
          <div className="sa-head" style={{ justifyContent:'flex-start', gap:10 }}>
            <span className="text-sm" style={{ color:'var(--text-muted)' }}>
              {listLoading ? 'Loading…' : `${filtered.length} call${filtered.length===1?'':'s'}`}
            </span>
          </div>
          <div>
            {listLoading && <div className="p-4 flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading transcripts…</div>}
            {!listLoading && filtered.length===0 && <div className="p-4 text-sm" style={{ color:'var(--text-muted)' }}>No transcripts yet.</div>}
            {!listLoading && filtered.map(t => (
              <button
                key={t.id}
                onClick={()=>setSelectedId(t.id)}
                className={`w-full text-left px-3 py-3 row-hover ${t.id===selectedId ? 'bg-[var(--accent-weak)]' : ''}`}
                style={{ borderTop:'1px solid var(--border)' }}
              >
                <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <strong className="truncate">{t.caller || 'Unknown caller'}</strong>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{
                        background: t.status==='completed' ? 'rgba(34,197,94,.12)'
                                  : t.status==='missed' ? 'rgba(245,158,11,.16)'
                                  : t.status==='failed' ? 'rgba(239,68,68,.14)'
                                  : 'rgba(59,130,246,.14)',
                        color: t.status==='completed' ? '#22c55e'
                              : t.status==='missed' ? '#d97706'
                              : t.status==='failed' ? '#ef4444'
                              : '#3b82f6',
                        border:'1px solid var(--border)'
                      }}>{t.status || '—'}</span>
                    </div>
                    <div className="truncate text-xs" style={{ color:'var(--text-muted)' }}>{t.summary || 'No summary'}</div>
                    <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                      {fmtTime(t.startedAt)} • {fmtDur(t.durationSec)} • to {t.callee || '—'}
                    </div>
                  </div>
                  <div style={{ display:'grid', gap:6 }}>
                    <button
                      onClick={(e)=>{e.stopPropagation(); downloadTXT(t);}}
                      className="px-2 py-1 rounded border text-xs"
                      style={{ borderColor:'var(--border)' }}
                      title="Download .txt"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e)=>{e.stopPropagation(); downloadJSON(t);}}
                      className="px-2 py-1 rounded border text-xs"
                      style={{ borderColor:'var(--border)' }}
                      title="Download .json"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* right: detail */}
        <div className="sa-card" style={{ minHeight: 420 }}>
          <div className="sa-head">
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span className="text-sm" style={{ color:'var(--text-muted)' }}>
                {selected ? `Call ${selected.id.slice(0,8)}…` : 'Select a call'}
              </span>
            </div>
            {selected && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button
                  onClick={()=>selected && downloadTXT(selected)}
                  className="px-2 py-1 rounded border"
                  style={{ borderColor:'var(--border)' }}
                  title="Download .txt"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                  onClick={()=>selected && downloadJSON(selected)}
                  className="px-2 py-1 rounded border"
                  style={{ borderColor:'var(--border)' }}
                  title="Download .json"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={()=>selected && toggleShare(selected)}
                  className="px-2 py-1 rounded border"
                  style={{ borderColor:'var(--border)', background: selected.shared ? 'var(--accent-weak)' : undefined }}
                  title={selected.shared ? 'Unshare' : 'Share publicly'}
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={()=>selected && removeTranscript(selected)}
                  className="px-2 py-1 rounded border"
                  style={{ borderColor:'var(--border)', background:'var(--danger-weak)' }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {!selected ? (
            <div className="p-5 text-sm" style={{ color:'var(--text-muted)' }}>Choose a transcript on the left to view details.</div>
          ) : (
            <div style={{ padding:14, display:'grid', gap:12 }}>
              {/* meta */}
              <div className="sa-card" style={{ border:'1px dashed var(--border)' }}>
                <div style={{ padding:12, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <Meta label="Started" value={fmtTime(selected.startedAt)} />
                  <Meta label="Duration" value={fmtDur(selected.durationSec)} />
                  <Meta label="Status" value={selected.status || '—'} />
                  <Meta label="Caller" value={selected.caller || '—'} />
                  <Meta label="Callee" value={selected.callee || '—'} />
                  <Meta
                    label="Share"
                    value={selected.shared ? 'Public' : 'Private'}
                    extra={selected.shared && selected.shareUrl ? (
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
                        <a href={selected.shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color:'var(--accent)' }}>
                          Open link <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={()=>copyToClipboard(selected.shareUrl!)}
                          className="px-2 py-1 rounded border text-xs"
                          style={{ borderColor:'var(--border)' }}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color:'var(--text-muted)', marginTop:6 }}>
                        {selected.shared ? 'No URL' : 'Not shared'}
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* recording */}
              {selected.recordingUrl && (
                <div className="sa-card" style={{ border:'1px dashed var(--border)' }}>
                  <div className="sa-head" style={{ borderBottom:'1px dashed var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4" />
                      <b>Recording</b>
                    </div>
                  </div>
                  <div style={{ padding:12 }}>
                    <audio controls style={{ width:'100%' }}>
                      <source src={selected.recordingUrl} />
                    </audio>
                  </div>
                </div>
              )}

              {/* summary */}
              <div className="sa-card">
                <div className="sa-head">
                  <b>Summary</b>
                </div>
                <div style={{ padding:12, whiteSpace:'pre-wrap' }}>
                  {selected.summary || <span className="text-sm" style={{ color:'var(--text-muted)' }}>No summary available.</span>}
                </div>
              </div>

              {/* transcript */}
              <div className="sa-card">
                <div className="sa-head">
                  <b>Transcript</b>
                </div>
                <div style={{ padding:12, display:'grid', gap:10, maxHeight: 520, overflow:'auto' }}>
                  {(selected.turns || []).map(turn => (
                    <div key={turn.id} style={{ display:'grid', gap:6 }}>
                      <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                        [{turn.role}{turn.at ? ` • ${fmtTime(turn.at)}` : ''}]
                      </div>
                      <div
                        style={{
                          background: turn.role==='assistant' ? 'var(--accent-weak)' : 'transparent',
                          border:'1px solid var(--border)',
                          borderRadius:10, padding:'10px 12px', whiteSpace:'pre-wrap'
                        }}
                      >
                        {turn.text}
                      </div>
                    </div>
                  ))}
                  {(!selected.turns || !selected.turns.length) && (
                    <div className="text-sm" style={{ color:'var(--text-muted)' }}>
                      No transcript turns found for this call.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* small meta cell */
function Meta({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
      <div className="text-xs" style={{ color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
      <div className="text-sm">{value}</div>
      {extra}
    </div>
  );
}
