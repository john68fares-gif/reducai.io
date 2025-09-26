// FILE: components/voice/SubaccountTranscripts.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Bot, RefreshCw, Search, XCircle, FileText, Download,
  Share2, Trash2, ExternalLink, PlayCircle, Check, Copy
} from 'lucide-react';

/**
 * SubaccountTranscripts — VA-style (VoiceAgentSection) UI
 *
 * - Shows a BIG GUARD-style hero card on open.
 * - The hero title dynamically uses:
 *     props.title ?? props.aiName ?? active subaccount name ?? 'Guard'
 * - Visual language matches the VA (tokens, rounded-8, CTA glow).
 * - Light/Dark inherits from document.documentElement.dataset.theme.
 *
 * Expected endpoints (adjust to your backend):
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

function fmtTime(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function fmtDur(s?: number) {
  if (s == null) return '—';
  const m = Math.floor(s/60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

export default function SubaccountTranscripts({
  title,
  aiName,
}:{
  /** Optional fixed title for the hero. Falls back to aiName → active sub → 'Guard' */
  title?: string;
  /** Optional AI name to display in the hero if title not provided */
  aiName?: string;
}) {
  // ───────── theme (inherits VA tokens) ─────────
  useEffect(() => {
    // If your app already sets dataset.theme, we just rely on it.
    // These tokens harmonize visuals with the VA page.
    const style = document.createElement('style');
    style.innerHTML = `
      :root {
        --va-cta:#59d9b3;
        --va-cta-weak: rgba(89,217,179,.12);
        --va-cta-line: rgba(89,217,179,.20);
      }
      .sa-card{border-radius:8px;border:1px solid var(--border-weak, rgba(0,0,0,.10));background:var(--panel-bg,#fff);box-shadow:var(--card-shadow,0 14px 28px rgba(0,0,0,.08))}
      .sa-head{min-height:58px;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border-weak, rgba(0,0,0,.10))}
      .sa-pill{width:42px;height:42px;border-radius:8px;display:grid;place-items:center;background:var(--va-cta);box-shadow:0 10px 22px rgba(89,217,179,.28)}
      .sa-ctl{height:38px;border-radius:8px;border:1px solid var(--border-weak, rgba(0,0,0,.10));background:var(--panel-bg,#fff);padding:0 12px;outline:none}
      .sa-row{position:relative;text-align:left;padding:10px 12px;border-top:1px solid var(--border-weak, rgba(0,0,0,.10));transition:transform .16s var(--ease, cubic-bezier(.22,.61,.36,1))}
      .sa-row:hover{transform:translateX(2px)}
      .sa-row::after{content:'';position:absolute;inset:0;border-radius:8px;background:var(--va-cta);opacity:0;pointer-events:none;transition:opacity .18s var(--ease);mix-blend-mode:screen}
      .sa-row:hover::after{opacity:.16}
      .sa-row.active{background:var(--va-cta-weak)}
      .sa-meta{border:1px dashed var(--border-weak, rgba(0,0,0,.10));border-radius:8px}
    `;
    document.head.appendChild(style);
    return () => { try { document.head.removeChild(style); } catch {} };
  }, []);

  // ───────── data state ─────────
  const [subs, setSubs] = useState<SubAccount[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [activeSubId, setActiveSubId] = useState('');
  const activeSub = subs.find(s => s.id === activeSubId) || null;

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all'|'completed'|'missed'|'failed'|'in-progress'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const [list, setList] = useState<Transcript[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [selectedId, setSelectedId] = useState('');
  const selected = list.find(t => t.id === selectedId);

  // ───────── fetch subs ─────────
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
        if (!activeSubId && arr[0]?.id) setActiveSubId(arr[0].id);
      } catch {
        if (alive) setSubs([]);
      } finally {
        if (alive) setSubsLoading(false);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────── fetch list (sub/status/refresh) ─────────
  useEffect(() => {
    if (!activeSubId) { setList([]); return; }
    let alive = true;
    (async () => {
      setListLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set('subId', activeSubId);
        if (q.trim()) qs.set('q', q.trim());
        if (status !== 'all') qs.set('status', status);
        const r = await fetch(`/api/voice/transcripts?${qs.toString()}`).catch(()=>null as any);
        const j = r?.ok ? await r.json() : null;
        if (!alive) return;
        const items: Transcript[] = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []);
        items.sort((a,b)=> (new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
        setList(items);
        if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
      } catch {
        if (alive) setList([]);
      } finally {
        if (alive) setListLoading(false);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubId, status, refreshKey]);

  // ───────── fetch full transcript if needed ─────────
  useEffect(() => {
    if (!selectedId) return;
    const t = list.find(x => x.id === selectedId);
    if (!t || (t.turns && t.turns.length)) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/voice/transcripts/${selectedId}`).catch(()=>null as any);
        const j: Transcript | null = r?.ok ? await r.json() : null;
        if (!alive || !j) return;
        setList(prev => prev.map(x => x.id === selectedId ? { ...x, ...j } : x));
      } catch {}
    })();
    return () => { alive = false; };
  }, [selectedId, list]);

  // ───────── derived view ─────────
  const filtered = useMemo(() => {
    const byStatus = (t:Transcript) => status === 'all' ? true : t.status === status;
    const needle = q.trim().toLowerCase();
    const byQ = (t:Transcript) => !needle || [
      t.caller, t.callee, t.summary, t.id
    ].some(v => (v || '').toLowerCase().includes(needle));
    return list.filter(t => byStatus(t) && byQ(t));
  }, [list, q, status]);

  // ───────── actions ─────────
  async function toggleShare(t: Transcript) {
    try {
      const r = await fetch(`/api/voice/transcripts/${t.id}/share`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ shared: !t.shared })
      }).catch(()=>null as any);
      const j = r?.ok ? await r.json() : null;
      setList(prev => prev.map(x => x.id === t.id ? { ...x, shared: !!j?.shared, shareUrl: j?.url || x.shareUrl } : x));
    } catch {}
  }
  async function removeTranscript(t: Transcript) {
    if (!confirm('Delete this transcript? This cannot be undone.')) return;
    try {
      await fetch(`/api/voice/transcripts/${t.id}`, { method:'DELETE' }).catch(()=>null as any);
      setList(prev => prev.filter(x => x.id !== t.id));
      if (selectedId === t.id) setSelectedId('');
    } catch {}
  }
  const [copied, setCopied] = useState(false);
  async function copyToClipboard(s: string) {
    try { await navigator.clipboard.writeText(s); setCopied(true); setTimeout(()=>setCopied(false), 900); } catch {}
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
      '',
      '--- Transcript ---',
      ...(t.turns||[]).map(turn => `[${turn.role}${turn.at?` @ ${fmtTime(turn.at)}`:''}] ${turn.text}`)
    ].join('\n');
    const blob = new Blob([lines], { type:'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `transcript_${t.id}.txt`; a.click(); URL.revokeObjectURL(a.href);
  }

  // ───────── hero title (Guard) ─────────
  const heroTitle = title || aiName || activeSub?.name || 'Guard';
  const heroSub   = activeSub ? `Subaccount • ${activeSub.name}` : 'Call transcripts';

  return (
    <section className="sa-root" style={{ color:'var(--text)' }}>
      {/* HERO — “big guard” card */}
      <div className="sa-card" style={{ marginBottom: 12 }}>
        <div className="sa-head" style={{ borderBottom:'1px solid var(--border-weak, rgba(0,0,0,.10))' }}>
          <div className="flex items-center gap-3">
            <div className="sa-pill">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold leading-tight truncate">{heroTitle}</div>
              <div className="text-xs" style={{ color:'var(--text-muted,#64748b)' }}>{heroSub}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={()=>setRefreshKey(k=>k+1)}
              className="sa-ctl grid place-items-center"
              title="Reload list"
              aria-label="Reload"
              style={{ width:38, padding:0 }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Controls row (VA style) */}
        <div className="p-3 grid gap-3" style={{ gridTemplateColumns:'minmax(220px,280px) 1fr 220px' }}>
          {/* Subaccount */}
          <div className="grid gap-1.5">
            <label className="text-[12px]" style={{ color:'var(--text-muted,#64748b)' }}>Sub-Account</label>
            <select
              value={activeSubId}
              onChange={(e)=>{ setActiveSubId(e.target.value); setSelectedId(''); }}
              className="sa-ctl"
            >
              {subsLoading && <option>Loading…</option>}
              {!subsLoading && subs.length===0 && <option value="">No sub-accounts</option>}
              {!subsLoading && subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="grid gap-1.5 relative">
            <label className="text-[12px]" style={{ color:'var(--text-muted,#64748b)' }}>Search</label>
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Search id, caller, callee, summary…"
              className="sa-ctl"
              style={{ paddingLeft:34, paddingRight:34 }}
            />
            <Search className="w-4 h-4" style={{ position:'absolute', left:10, top:34, color:'var(--text-muted,#64748b)' }} />
            {!!q && (
              <button
                onClick={()=>setQ('')}
                title="Clear"
                className="absolute"
                style={{ right:8, top:30 }}
              >
                <span className="sa-ctl grid place-items-center" style={{ width:30, height:30, padding:0 }}>
                  <XCircle className="w-4 h-4" />
                </span>
              </button>
            )}
          </div>

          {/* Status */}
          <div className="grid gap-1.5">
            <label className="text-[12px]" style={{ color:'var(--text-muted,#64748b)' }}>Status</label>
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
      </div>

      {/* BODY */}
      <div className="grid gap-3" style={{ gridTemplateColumns:'360px 1fr' }}>
        {/* LEFT: list */}
        <div className="sa-card" style={{ minHeight: 420 }}>
          <div className="sa-head" style={{ justifyContent:'flex-start', gap:10 }}>
            <Users className="w-4 h-4" />
            <span className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>
              {listLoading ? 'Loading…' : `${filtered.length} call${filtered.length===1?'':'s'}`}
            </span>
          </div>

          {listLoading && (
            <div className="p-4 text-sm" style={{ color:'var(--text-muted,#64748b)' }}>Fetching transcripts…</div>
          )}

          {!listLoading && filtered.length===0 && (
            <div className="p-4 text-sm" style={{ color:'var(--text-muted,#64748b)' }}>No transcripts yet.</div>
          )}

          {!listLoading && filtered.map(t => {
            const chipBg =
              t.status==='completed' ? 'rgba(34,197,94,.12)'
              : t.status==='missed' ? 'rgba(245,158,11,.16)'
              : t.status==='failed' ? 'rgba(239,68,68,.14)'
              : 'rgba(59,130,246,.14)';
            const chipFg =
              t.status==='completed' ? '#22c55e'
              : t.status==='missed' ? '#d97706'
              : t.status==='failed' ? '#ef4444'
              : '#3b82f6';
            return (
              <button
                key={t.id}
                onClick={()=>setSelectedId(t.id)}
                className={`sa-row ${t.id===selectedId ? 'active' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate">{t.caller || 'Unknown caller'}</strong>
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                            style={{ background:chipBg, color:chipFg, border:'1px solid var(--border-weak, rgba(0,0,0,.10))' }}>
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

        {/* RIGHT: detail */}
        <div className="sa-card" style={{ minHeight: 420 }}>
          <div className="sa-head">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>
                {selected ? `Call ${selected.id.slice(0,8)}…` : 'Select a call'}
              </span>
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
                  style={{ width:36, padding:0, background: selected.shared ? 'var(--va-cta-weak)' : undefined }}
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
              Choose a transcript on the left to view details.
            </div>
          ) : (
            <div className="p-3 grid gap-3">
              {/* META */}
              <div className="sa-card sa-meta">
                <div className="p-3 grid gap-3" style={{ gridTemplateColumns:'repeat(3,minmax(0,1fr))' }}>
                  <Meta label="Started"   value={fmtTime(selected.startedAt)} />
                  <Meta label="Duration"  value={fmtDur(selected.durationSec)} />
                  <Meta label="Status"    value={selected.status || '—'} />
                  <Meta label="Caller"    value={selected.caller || '—'} />
                  <Meta label="Callee"    value={selected.callee || '—'} />
                  <Meta
                    label="Share"
                    value={selected.shared ? 'Public' : 'Private'}
                    extra={selected.shared && selected.shareUrl ? (
                      <div className="flex items-center gap-2 mt-2">
                        <a href={selected.shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color:'var(--va-cta)' }}>
                          Open link <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={()=>copyToClipboard(selected.shareUrl!)}
                          className="sa-ctl text-xs grid place-items-center"
                          style={{ height:28 }}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs mt-2" style={{ color:'var(--text-muted,#64748b)' }}>
                        {selected.shared ? 'No URL' : 'Not shared'}
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* RECORDING */}
              {selected.recordingUrl && (
                <div className="sa-card sa-meta">
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

              {/* SUMMARY */}
              <div className="sa-card">
                <div className="sa-head">
                  <b>Summary</b>
                </div>
                <div className="p-3 whitespace-pre-wrap">
                  {selected.summary || <span className="text-sm" style={{ color:'var(--text-muted,#64748b)' }}>No summary available.</span>}
                </div>
              </div>

              {/* TRANSCRIPT */}
              <div className="sa-card">
                <div className="sa-head">
                  <b>Transcript</b>
                </div>
                <div className="p-3 grid gap-2 max-h-[520px] overflow-auto">
                  {(selected.turns || []).map(turn => (
                    <div key={turn.id} className="grid gap-1.5">
                      <div className="text-xs" style={{ color:'var(--text-muted,#64748b)' }}>
                        [{turn.role}{turn.at ? ` • ${fmtTime(turn.at)}` : ''}]
                      </div>
                      <div
                        style={{
                          background: turn.role==='assistant' ? 'var(--va-cta-weak)' : 'transparent',
                          border:'1px solid var(--border-weak, rgba(0,0,0,.10))',
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
    </section>
  );
}

/* small meta cell */
function Meta({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="p-3" style={{ border:'1px dashed var(--border-weak, rgba(0,0,0,.10))', borderRadius:8 }}>
      <div className="text-xs" style={{ color:'var(--text-muted,#64748b)', marginBottom:4 }}>{label}</div>
      <div className="text-sm">{value}</div>
      {extra}
    </div>
  );
}
