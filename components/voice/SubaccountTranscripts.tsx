// FILE: components/voice/SubaccountHub.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Bot, Phone, FileText, Download, Share2, Trash2,
  ExternalLink, Search, XCircle, PlayCircle, RefreshCw
} from 'lucide-react';

/**
 * SubaccountHub (clean split UX)
 * ------------------------------------------------------------
 * • FIRST: a grid of big rectangular CARDS — one per AI/Sub-Account.
 * • When you click a card, the lower “workspace” appears:
 *      LEFT  = Call Logs
 *      RIGHT = Transcript Viewer
 * • Styled to match VoiceAgentSection (CTA glow, rounded-8, light/dark).
 *
 * Endpoints expected:
 *  - GET    /api/subaccounts
 *  - GET    /api/voice/transcripts?subId=...&q=...&status=...
 *  - GET    /api/voice/transcripts/:id
 *  - PATCH  /api/voice/transcripts/:id/share
 *  - DELETE /api/voice/transcripts/:id
 */

type SubAccount = { id: string; name: string; ownerEmail?: string };
type TranscriptTurn = { id: string; role: 'user'|'assistant'|'system'|'tool'; text: string; at?: string };
type Transcript = {
  id: string;
  subId: string;
  startedAt: string;
  durationSec?: number;
  status?: 'completed'|'missed'|'failed'|'in-progress';
  caller?: string;
  callee?: string;
  summary?: string;
  recordingUrl?: string;
  shared?: boolean;
  shareUrl?: string;
  turns?: TranscriptTurn[];
};

const CTA      = '#59d9b3';
const CTA_WEAK = 'rgba(89,217,179,.12)';
const CTA_LINE = 'rgba(89,217,179,.20)';
const EASE     = 'cubic-bezier(.22,.61,.36,1)';

const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};
const fmtDur = (s?: number) => (s==null ? '—' : `${Math.floor(s/60)}m ${s%60}s`);

export default function SubaccountHub() {
  /* inject minimal tokens to match VA */
  useEffect(() => {
    const el = document.createElement('style');
    el.innerHTML = `
      :root{ --ease:${EASE}; --cta:${CTA}; --cta-weak:${CTA_WEAK}; --cta-line:${CTA_LINE}; }
      .sa-card{border-radius:8px;border:1px solid var(--border-weak,rgba(0,0,0,.10));background:var(--panel-bg,#fff);box-shadow:var(--card-shadow,0 14px 28px rgba(0,0,0,.08));}
      .sa-head{min-height:56px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border-weak,rgba(0,0,0,.10))}
      .sa-ctl{height:38px;border-radius:8px;border:1px solid var(--border-weak,rgba(0,0,0,.10));background:var(--panel-bg,#fff);padding:0 12px;outline:none}
      .sa-pill{width:42px;height:42px;border-radius:8px;display:grid;place-items:center;background:var(--cta);box-shadow:0 10px 22px rgba(89,217,179,.28)}
      .ai-card{position:relative;display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:var(--panel-bg,#fff);border:1px solid var(--border-weak,rgba(0,0,0,.10));transition:transform .16s var(--ease), box-shadow .16s var(--ease)}
      .ai-card:hover{transform:translateY(-2px);box-shadow:0 16px 28px rgba(0,0,0,.16), 0 0 0 1px var(--cta-line) inset}
      .ai-card[data-active="true"]{box-shadow:0 16px 28px rgba(89,217,179,.28), 0 0 0 1px var(--cta-line) inset;background:var(--cta-weak)}
      .ai-card .halo{position:absolute;inset:-6px;border-radius:16px;background:radial-gradient(60% 60% at 50% 50%, var(--cta) 0%, transparent 70%);filter:blur(10px);opacity:0;transition:opacity .18s var(--ease)}
      .ai-card:hover .halo{opacity:.6}
      .log-row{position:relative;text-align:left;padding:10px 12px;border-top:1px solid var(--border-weak,rgba(0,0,0,.10));transition:transform .14s var(--ease)}
      .log-row:hover{transform:translateX(2px)}
      .log-row::after{content:'';position:absolute;inset:0;border-radius:8px;background:var(--cta);opacity:0;pointer-events:none;transition:opacity .16s var(--ease);mix-blend-mode:screen}
      .log-row:hover::after{opacity:.12}
      .log-row.active{background:var(--cta-weak)}
      @media (max-width:1024px){ .ws-grid{grid-template-columns:1fr} }
      @media (min-width:1025px){ .ws-grid{grid-template-columns:420px 1fr} }
    `;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch {} };
  }, []);

  /* data */
  const [subs, setSubs] = useState<SubAccount[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [activeSubId, setActiveSubId] = useState('');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all'|'completed'|'missed'|'failed'|'in-progress'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const [logs, setLogs] = useState<Transcript[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [selectedId, setSelectedId] = useState('');
  const selected = logs.find(t => t.id === selectedId);

  /* fetch sub-accounts (AIs) */
  useEffect(() => {
    let alive = true;
    (async () => {
      setSubsLoading(true);
      try {
        const r = await fetch('/api/subaccounts').catch(()=>null as any);
        const j = r?.ok ? await r.json() : [];
        const arr: SubAccount[] = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
        if (!alive) return;
        setSubs(arr);
      } catch { if (alive) setSubs([]); }
      finally { if (alive) setSubsLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  /* fetch logs when a sub is chosen */
  useEffect(() => {
    if (!activeSubId) { setLogs([]); setSelectedId(''); return; }
    let alive = true;
    (async () => {
      setLogsLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set('subId', activeSubId);
        if (q.trim()) qs.set('q', q.trim());
        if (status!=='all') qs.set('status', status);
        const r = await fetch(`/api/voice/transcripts?${qs.toString()}`).catch(()=>null as any);
        const j = r?.ok ? await r.json() : null;
        if (!alive) return;
        const items: Transcript[] = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []);
        items.sort((a,b)=> (new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
        setLogs(items);
        setSelectedId(items[0]?.id || '');
      } catch { if (alive) setLogs([]); }
      finally { if (alive) setLogsLoading(false); }
    })();
    return () => { alive = false; };
  }, [activeSubId, status, refreshKey]); // q is “client-side” filter below

  /* lazy fetch full transcript */
  useEffect(() => {
    if (!selectedId) return;
    const base = logs.find(x => x.id === selectedId);
    if (!base || (base.turns && base.turns.length)) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/voice/transcripts/${selectedId}`).catch(()=>null as any);
        const j: Transcript | null = r?.ok ? await r.json() : null;
        if (!alive || !j) return;
        setLogs(prev => prev.map(x => x.id === selectedId ? { ...x, ...j } : x));
      } catch {}
    })();
    return () => { alive = false; };
  }, [selectedId, logs]);

  /* derived */
  const filteredLogs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byQ = (t:Transcript) =>
      !needle || [t.caller, t.callee, t.summary, t.id].some(v => (v||'').toLowerCase().includes(needle));
    const byS = (t:Transcript) => status==='all' ? true : t.status===status;
    return logs.filter(t => byQ(t) && byS(t));
  }, [logs, q, status]);

  /* actions */
  async function toggleShare(t: Transcript) {
    try {
      const r = await fetch(`/api/voice/transcripts/${t.id}/share`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ shared: !t.shared })
      }).catch(()=>null as any);
      const j = r?.ok ? await r.json() : null;
      setLogs(prev => prev.map(x => x.id===t.id ? { ...x, shared: !!j?.shared, shareUrl: j?.url || x.shareUrl } : x));
    } catch {}
  }
  async function removeTranscript(t: Transcript) {
    if (!confirm('Delete this transcript? This cannot be undone.')) return;
    try {
      await fetch(`/api/voice/transcripts/${t.id}`, { method:'DELETE' }).catch(()=>null as any);
      setLogs(prev => prev.filter(x => x.id !== t.id));
      if (selectedId === t.id) setSelectedId('');
    } catch {}
  }
  function downloadJSON(t: Transcript) {
    const blob = new Blob([JSON.stringify(t, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `transcript_${t.id}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  function downloadTXT(t: Transcript) {
    const lines = [
      `Call ID: ${t.id}`,
      `Sub-Account: ${t.subId}`,
      `Started: ${fmtTime(t.startedAt)}`,
      `Duration: ${fmtDur(t.durationSec)}`,
      `Status: ${t.status || '—'}`,
      `Caller: ${t.caller || '—'}`,
      `Callee: ${t.callee || '—'}`,
      `Summary: ${t.summary || '—'}`,
      '', '--- Transcript ---',
      ...(t.turns||[]).map(turn => `[${turn.role}${turn.at?` @ ${fmtTime(turn.at)}`:''}] ${turn.text}`)
    ].join('\n');
    const blob = new Blob([lines], { type:'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `transcript_${t.id}.txt`; a.click(); URL.revokeObjectURL(a.href);
  }

  /* UI */

  return (
    <section className="grid gap-4" style={{ color:'var(--text)' }}>
      {/* 1) AI CARDS STRIP */}
      <div className="sa-card">
        <div className="sa-head">
          <div className="flex items-center gap-3">
            <div className="sa-pill"><Bot className="w-5 h-5 text-black" /></div>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold leading-tight">Choose an AI / Sub-Account</div>
              <div className="text-xs" style={{ color:'var(--text-muted,#64748b)' }}>
                Click a card to open its call workspace
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={()=>setRefreshKey(k=>k+1)}
              className="sa-ctl grid place-items-center"
              title="Reload"
              aria-label="Reload"
              style={{ width:38, padding:0 }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3">
          {subsLoading && <div className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>Loading AIs…</div>}
          {!subsLoading && subs.length===0 && (
            <div className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>No sub-accounts yet.</div>
          )}
          {!subsLoading && subs.length>0 && (
            <div className="grid gap-3"
                 style={{ gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {subs.map(s => (
                <button
                  key={s.id}
                  className="ai-card"
                  data-active={s.id===activeSubId}
                  onClick={()=>{ setActiveSubId(s.id); setSelectedId(''); }}
                >
                  <span className="halo" />
                  <div className="w-10 h-10 rounded-[8px] grid place-items-center"
                       style={{ background: CTA, boxShadow:'0 10px 22px rgba(89,217,179,.28)' }}>
                    <Users className="w-5 h-5 text-black" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold truncate">{s.name}</div>
                    <div className="text-[11px] truncate" style={{ color:'var(--text-muted,#64748b)' }}>
                      {s.ownerEmail || '—'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2) WORKSPACE appears ONLY AFTER a card is selected */}
      {!activeSubId ? null : (
        <div className="ws-grid grid gap-4">
          {/* LEFT: CALL LOGS */}
          <div className="sa-card">
            <div className="sa-head">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <b>Call Logs</b>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    value={q}
                    onChange={(e)=>setQ(e.target.value)}
                    placeholder="Search id, caller, callee, summary…"
                    className="sa-ctl"
                    style={{ width:280, paddingLeft:34, paddingRight:34 }}
                  />
                  <Search className="w-4 h-4" style={{ position:'absolute', left:10, top:8, color:'var(--text-muted,#64748b)' }} />
                  {!!q && (
                    <button onClick={()=>setQ('')} title="Clear" className="absolute" style={{ right:6, top:4 }}>
                      <span className="sa-ctl grid place-items-center" style={{ width:30, height:30, padding:0 }}>
                        <XCircle className="w-4 h-4" />
                      </span>
                    </button>
                  )}
                </div>
                <select
                  value={status}
                  onChange={(e)=>setStatus(e.target.value as any)}
                  className="sa-ctl"
                >
                  <option value="all">All</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                  <option value="failed">Failed</option>
                  <option value="in-progress">In progress</option>
                </select>
              </div>
            </div>

            {logsLoading && <div className="p-4 text-sm" style={{ color:'var(--text-muted,#64748b)' }}>Loading transcripts…</div>}
            {!logsLoading && filteredLogs.length===0 && <div className="p-4 text-sm" style={{ color:'var(--text-muted,#64748b)' }}>No calls.</div>}

            {!logsLoading && filteredLogs.map(t => {
              const chipBg =
                t.status==='completed' ? 'rgba(34,197,94,.12)'
              : t.status==='missed'    ? 'rgba(245,158,11,.16)'
              : t.status==='failed'    ? 'rgba(239,68,68,.14)'
              :                           'rgba(59,130,246,.14)';
              const chipFg =
                t.status==='completed' ? '#22c55e'
              : t.status==='missed'    ? '#d97706'
              : t.status==='failed'    ? '#ef4444'
              :                           '#3b82f6';

              return (
                <button
                  key={t.id}
                  onClick={()=>setSelectedId(t.id)}
                  className={`log-row ${t.id===selectedId ? 'active' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="truncate">{t.caller || 'Unknown caller'}</strong>
                        <span className="text-[11px] px-1.5 py-0.5 rounded"
                              style={{ background:chipBg, color:chipFg, border:'1px solid var(--border-weak,rgba(0,0,0,.10))' }}>
                          {t.status || '—'}
                        </span>
                      </div>
                      <div className="truncate text-xs" style={{ color:'var(--text-muted,#64748b)' }}>
                        {t.summary || 'No summary'}
                      </div>
                      <div className="text-xs" style={{ color:'var(--text-muted,#64748b)' }}>
                        {fmtTime(t.startedAt)} • {fmtDur(t.durationSec)} • to {t.callee || '—'}
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <button
                        onClick={(e)=>{e.stopPropagation(); downloadTXT(t);}}
                        className="sa-ctl text-xs grid place-items-center"
                        style={{ height:28 }}
                        title="Download .txt"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e)=>{e.stopPropagation(); downloadJSON(t);}}
                        className="sa-ctl text-xs grid place-items-center"
                        style={{ height:28 }}
                        title="Download .json"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT: TRANSCRIPT VIEWER */}
          <div className="sa-card">
            <div className="sa-head">
              <div className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>
                {selected ? `Call ${selected.id.slice(0,8)}…` : 'Select a call'}
              </div>
              {selected && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>downloadTXT(selected)}
                    className="sa-ctl grid place-items-center"
                    style={{ width:36, padding:0 }}
                    title="Download .txt"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={()=>downloadJSON(selected)}
                    className="sa-ctl grid place-items-center"
                    style={{ width:36, padding:0 }}
                    title="Download .json"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={()=>toggleShare(selected)}
                    className="sa-ctl grid place-items-center"
                    style={{ width:36, padding:0, background: selected.shared ? CTA_WEAK : undefined }}
                    title={selected.shared ? 'Unshare' : 'Share publicly'}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={()=>removeTranscript(selected)}
                    className="sa-ctl grid place-items-center"
                    style={{ width:36, padding:0, background:'rgba(239,68,68,.14)' }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-5 text-sm" style={{ color:'var(--text-muted,#64748b)' }}>
                Choose a call to read its transcript here.
              </div>
            ) : (
              <div className="p-3 grid gap-3">
                {/* meta */}
                <div className="sa-card" style={{ border:'1px dashed var(--border-weak,rgba(0,0,0,.10))' }}>
                  <div className="p-3 grid gap-3" style={{ gridTemplateColumns:'repeat(3,minmax(0,1fr))' }}>
                    <Meta label="Started"  value={fmtTime(selected.startedAt)} />
                    <Meta label="Duration" value={fmtDur(selected.durationSec)} />
                    <Meta label="Status"   value={selected.status || '—'} />
                    <Meta label="Caller"   value={selected.caller || '—'} />
                    <Meta label="Callee"   value={selected.callee || '—'} />
                    {selected.shared ? (
                      <Meta
                        label="Share"
                        value="Public"
                        extra={selected.shareUrl && (
                          <a href={selected.shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color:CTA }}>
                            Open link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      />
                    ) : (
                      <Meta label="Share" value="Private" />
                    )}
                  </div>
                </div>

                {/* recording */}
                {selected.recordingUrl && (
                  <div className="sa-card" style={{ border:'1px dashed var(--border-weak,rgba(0,0,0,.10))' }}>
                    <div className="sa-head" style={{ borderStyle:'dashed' }}>
                      <div className="flex items-center gap-2">
                        <PlayCircle className="w-4 h-4" />
                        <b>Recording</b>
                      </div>
                    </div>
                    <div className="p-3">
                      <audio controls style={{ width:'100%' }}>
                        <source src={selected.recordingUrl} />
                      </audio>
                    </div>
                  </div>
                )}

                {/* summary */}
                <div className="sa-card">
                  <div className="sa-head"><b>Summary</b></div>
                  <div className="p-3 whitespace-pre-wrap">
                    {selected.summary || <span className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>No summary available.</span>}
                  </div>
                </div>

                {/* transcript */}
                <div className="sa-card">
                  <div className="sa-head"><b>Transcript</b></div>
                  <div className="p-3 grid gap-2 max-h-[520px] overflow-auto">
                    {(selected.turns||[]).map(turn => (
                      <div key={turn.id} className="grid gap-1.5">
                        <div className="text-xs" style={{ color:'var(--text-muted,#64748b)' }}>
                          [{turn.role}{turn.at ? ` • ${fmtTime(turn.at)}` : ''}]
                        </div>
                        <div
                          style={{
                            background: turn.role==='assistant' ? CTA_WEAK : 'transparent',
                            border:'1px solid var(--border-weak,rgba(0,0,0,.10))',
                            borderRadius:8, padding:'10px 12px', whiteSpace:'pre-wrap'
                          }}
                        >
                          {turn.text}
                        </div>
                      </div>
                    ))}
                    {(!selected.turns || !selected.turns.length) && (
                      <div className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>
                        No transcript turns found for this call.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* meta cell */
function Meta({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="p-3" style={{ border:'1px dashed var(--border-weak,rgba(0,0,0,.10))', borderRadius:8 }}>
      <div className="text-xs" style={{ color:'var(--text-muted,#64748b)', marginBottom:4 }}>{label}</div>
      <div className="text-sm">{value}</div>
      {extra}
    </div>
  );
}
