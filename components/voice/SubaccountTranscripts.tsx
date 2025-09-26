// FILE: components/voice/SubaccountTranscripts.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Download, ExternalLink, FileText, Share2, Trash2,
  RefreshCw, PlayCircle, Check, Copy, Users, Wifi, WifiOff, Bot
} from 'lucide-react';

/* ───────── tokens to match VA + sidebar glow ───────── */
const CTA       = '#59d9b3';
const CTA_LINE  = 'rgba(89,217,179,.20)';
const CTA_WEAK  = 'rgba(89,217,179,.12)';
const R_SM = 8, R_MD = 10;

const Tokens = ({theme}:{theme:'dark'|'light'}) => (
  <style jsx global>{`
    :root{
      ${theme==='dark' ? `
        --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --muted:#9fb4ad;
        --soft:#101214; --border:rgba(255,255,255,.10);
      ` : `
        --bg:#f6f8f9; --panel:#ffffff; --text:#0b1620; --muted:#50606a;
        --soft:#f3f5f6; --border:rgba(0,0,0,.10);
      `}
      --ease:cubic-bezier(.22,.61,.36,1);
      --card-shadow: ${theme==='dark'
        ? `0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${CTA_LINE}`
        : `0 14px 28px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04) inset, 0 0 0 1px ${CTA_LINE}`};
    }
    .sa-shell{color:var(--text);}
    .sa-card{background:var(--panel); border:1px solid var(--border); border-radius:${R_MD}px; box-shadow:var(--card-shadow);}
    .sa-head{display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--border)}
    .pill{display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px; border-radius:${R_SM}px; font-size:12px; border:1px solid var(--border); background:var(--soft)}
    /* universal hover green overlay (like dropdowns) */
    .hover-glow{ position:relative; }
    .hover-glow::after{
      content:''; position:absolute; inset:0; border-radius:${R_MD}px; background:${CTA};
      mix-blend-mode:screen; opacity:0; pointer-events:none; transition:opacity .18s var(--ease);
    }
    .hover-glow:hover::after{ opacity:.18; }
    .hover-glow[data-active="true"]::after{ opacity:.32; }
  `}</style>
);

/* ───────── types ───────── */
type SubAccount = { id:string; name:string; ownerEmail?:string; online?:boolean };
type TranscriptTurn = { id:string; role:'user'|'assistant'|'system'|'tool'; text:string; at?:string };
type Transcript = {
  id:string; subId:string; startedAt:string; durationSec?:number;
  status?:'completed'|'missed'|'failed'|'in-progress';
  caller?:string; callee?:string; summary?:string; recordingUrl?:string;
  shared?:boolean; shareUrl?:string; turns?:TranscriptTurn[];
};

/* helpers */
const fmtTime = (iso?:string)=>{ if(!iso) return '—'; try{ return new Date(iso).toLocaleString(); }catch{ return iso; } };
const fmtDur = (s?:number)=> s==null ? '—' : `${Math.floor(s/60)}m ${s%60}s`;

/* ───────── new three-pane layout ───────── */
export default function SubaccountTranscripts(){
  /* theme + online accent boost */
  const [theme,setTheme] = useState<'light'|'dark'>(()=>{
    if(typeof document==='undefined') return 'dark';
    const ds=document.documentElement.dataset.theme;
    return (ds==='light'||ds==='dark')?ds:'dark';
  });
  useEffect(()=>{ if(typeof document!=='undefined') document.documentElement.dataset.theme=theme; },[theme]);

  const [subs,setSubs]=useState<SubAccount[]>([]);
  const [subsLoading,setSubsLoading]=useState(true);
  const [activeSubId,setActiveSubId]=useState('');

  const [search,setSearch]=useState('');
  const [status,setStatus]=useState<'all'|'completed'|'missed'|'failed'|'in-progress'>('all');
  const [refreshKey,setRefreshKey]=useState(0);

  const [logs,setLogs]=useState<Transcript[]>([]);
  const [loadingLogs,setLoadingLogs]=useState(false);

  const [selectedId,setSelectedId]=useState('');
  const selected = logs.find(x=>x.id===selectedId);

  /* fetch subs */
  useEffect(()=>{ let alive=true;(async()=>{
    setSubsLoading(true);
    try{
      const r = await fetch('/api/subaccounts').catch(()=>null as any);
      const j = r?.ok? await r.json(): [];
      const clean:SubAccount[] = Array.isArray(j)?j:(Array.isArray(j?.items)?j.items:[]);
      if(!alive) return;
      setSubs(clean);
      if(!activeSubId && clean[0]?.id) setActiveSubId(clean[0].id);
    }finally{ if(alive) setSubsLoading(false); }
  })(); return()=>{alive=false};},[]);

  /* fetch logs */
  useEffect(()=>{ if(!activeSubId) { setLogs([]); setSelectedId(''); return; }
    let alive=true;(async()=>{
      setLoadingLogs(true);
      try{
        const qs=new URLSearchParams({ subId:activeSubId });
        if(status!=='all') qs.set('status',status);
        if(search.trim()) qs.set('q',search.trim());
        const r = await fetch(`/api/voice/transcripts?${qs.toString()}`).catch(()=>null as any);
        const j = r?.ok? await r.json(): null;
        const items:Transcript[] = Array.isArray(j?.items)?j.items:(Array.isArray(j)?j:[]);
        items.sort((a,b)=> new Date(b.startedAt).getTime()-new Date(a.startedAt).getTime());
        if(!alive) return;
        setLogs(items);
        if(items[0]?.id) setSelectedId(items[0].id);
      }finally{ if(alive) setLoadingLogs(false); }
    })(); return()=>{alive=false}; },[activeSubId,status,refreshKey]);

  /* fetch full transcript if needed */
  useEffect(()=>{ if(!selectedId) return; const idx=logs.findIndex(x=>x.id===selectedId); if(idx<0) return;
    if(logs[idx]?.turns?.length) return;
    let alive=true;(async()=>{
      try{
        const r= await fetch(`/api/voice/transcripts/${selectedId}`).catch(()=>null as any);
        const j:Transcript|null = r?.ok? await r.json(): null;
        if(!alive||!j) return;
        setLogs(prev=> prev.map(x=> x.id===selectedId ? { ...x, ...j } : x));
      }catch{}
    })(); return ()=>{alive=false}; },[selectedId,logs]);

  const filteredLogs = useMemo(()=>{
    const q=search.trim().toLowerCase();
    const byStatus=(t:Transcript)=> status==='all'?true:t.status===status;
    const byQ=(t:Transcript)=> !q ? true :
      [t.caller,t.callee,t.summary,t.id].some(v=>(v||'').toLowerCase().includes(q));
    return logs.filter(t=>byStatus(t)&&byQ(t));
  },[logs,search,status]);

  /* actions */
  const toggleShare = async(t:Transcript)=>{
    try{
      const r= await fetch(`/api/voice/transcripts/${t.id}/share`,{
        method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ shared:!t.shared })
      }).catch(()=>null as any);
      const j= r?.ok? await r.json(): null;
      setLogs(prev=> prev.map(x=> x.id===t.id ? { ...x, shared:!!j?.shared, shareUrl:j?.url||x.shareUrl } : x));
    }catch{}
  };
  const removeTranscript = async(t:Transcript)=>{
    if(!confirm('Delete this transcript?')) return;
    try{
      await fetch(`/api/voice/transcripts/${t.id}`,{ method:'DELETE' }).catch(()=>null as any);
      setLogs(prev=> prev.filter(x=>x.id!==t.id));
      if(selectedId===t.id) setSelectedId('');
    }catch{}
  };
  const downloadJSON=(t:Transcript)=>{ const blob=new Blob([JSON.stringify(t,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`transcript_${t.id}.json`; a.click(); URL.revokeObjectURL(a.href);};
  const downloadTXT=(t:Transcript)=>{ const lines=[
      `Call ID: ${t.id}`, `Sub-Account: ${t.subId}`, `Started: ${fmtTime(t.startedAt)}`,
      `Duration: ${fmtDur(t.durationSec)}`, `Status: ${t.status||'—'}`, `Caller: ${t.caller||'—'}`,
      `Callee: ${t.callee||'—'}`, `Summary: ${t.summary||'—'}`, '', '--- Transcript ---',
      ...(t.turns||[]).map(turn=>`[${turn.role}] ${turn.text}`)
    ].join('\n');
    const blob=new Blob([lines],{type:'text/plain'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`transcript_${t.id}.txt`; a.click(); URL.revokeObjectURL(a.href); };

  /* UI */
  const activeSub = subs.find(s=>s.id===activeSubId);
  const online = !!activeSub?.online;
  const [copied,setCopied]=useState(false);
  const copy = async(txt:string)=>{ try{ await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(()=>setCopied(false),900); }catch{} };

  return (
    <section className="sa-shell">
      <Tokens theme={theme} />

      {/* Top bar — section name = AI/Subaccount name */}
      <div className="sa-card" style={{ marginBottom: 12 }}>
        <div className="sa-head">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="w-8 h-8 rounded-[8px] grid place-items-center" style={{ background:CTA, boxShadow:'0 10px 22px rgba(89,217,179,.28)' }}>
              <Bot className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="text-[16px] font-semibold">
                {activeSub?.name ? activeSub.name : 'Subaccounts'}
              </div>
              <div className="text-[11px]" style={{ color:'var(--muted)' }}>
                {activeSub?.name ? 'Call logs & transcripts' : 'Pick a subaccount'}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="pill" style={{ background: online ? CTA_WEAK : 'var(--soft)', borderColor: online ? CTA_LINE : 'var(--border)' }}>
              {online ? <Wifi className="w-4 h-4" style={{ color:CTA }} /> : <WifiOff className="w-4 h-4" style={{ color:'var(--muted)' }} />}
              <b style={{ color: online ? CTA : 'var(--muted)' }}>{online ? 'Online' : 'Offline'}</b>
            </span>
            <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} className="pill">Theme: {theme}</button>
            <button onClick={()=>setRefreshKey(k=>k+1)} className="pill"><RefreshCw className="w-4 h-4" /> Reload</button>
          </div>
        </div>

        {/* Filters row */}
        <div style={{ padding:12, display:'grid', gridTemplateColumns:'320px 1fr 220px', gap:12 }}>
          <div style={{ position:'relative' }}>
            <input
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder="Search id, caller, callee, summary…"
              style={{ width:'100%', height:38, border:'1px solid var(--border)', background:'var(--panel)', borderRadius:R_SM, padding:'0 34px' }}
            />
            <Search className="w-4 h-4" style={{ position:'absolute', left:10, top:10, color:'var(--muted)' }} />
          </div>
          <div />
          <select
            value={status}
            onChange={(e)=>setStatus(e.target.value as any)}
            style={{ height:38, border:'1px solid var(--border)', background:'var(--panel)', borderRadius:R_SM, padding:'0 10px' }}
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="failed">Failed</option>
            <option value="in-progress">In progress</option>
          </select>
        </div>
      </div>

      {/* Three panes */}
      <div style={{ display:'grid', gridTemplateColumns:'280px 420px 1fr', gap:14, minHeight:520 }}>
        {/* LEFT: Sub-accounts mini-sidebar as rectangles (cards) */}
        <aside className="sa-card" style={{ overflow:'hidden auto' }}>
          <div className="sa-head" style={{ borderBottom:'1px dashed var(--border)' }}>
            <div className="flex items-center gap-2"><Users className="w-4 h-4" /><b>Sub-accounts</b></div>
          </div>

          <div style={{ padding:12, display:'grid', gap:10 }}>
            {subsLoading && <div className="text-sm" style={{ color:'var(--muted)' }}>Loading…</div>}
            {!subsLoading && subs.length===0 && <div className="text-sm" style={{ color:'var(--muted)' }}>No sub-accounts.</div>}

            {subs.map(s=>(
              <button
                key={s.id}
                onClick={()=>{ setActiveSubId(s.id); setSelectedId(''); }}
                className="hover-glow"
                data-active={s.id===activeSubId}
                style={{
                  textAlign:'left',
                  background:s.id===activeSubId ? CTA_WEAK : 'var(--panel)',
                  border:`1px solid ${s.id===activeSubId ? CTA_LINE : 'var(--border)'}`,
                  borderRadius:R_MD, padding:10
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className="w-9 h-9 rounded-[8px] grid place-items-center" style={{ background:CTA, boxShadow:'0 10px 22px rgba(89,217,179,.28)' }}>
                    <Bot className="w-4 h-4 text-black" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-[11px] truncate" style={{ color:'var(--muted)' }}>{s.ownerEmail || s.id}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* MIDDLE: Call logs list */}
        <section className="sa-card" style={{ overflow:'hidden auto' }}>
          <div className="sa-head" style={{ borderBottom:'1px dashed var(--border)' }}>
            <b>Call Logs</b>
            <span className="text-sm" style={{ color:'var(--muted)' }}>
              {loadingLogs ? 'Loading…' : `${filteredLogs.length} result${filteredLogs.length===1?'':'s'}`}
            </span>
          </div>

          <div style={{ padding:12, display:'grid', gap:10 }}>
            {!loadingLogs && filteredLogs.length===0 && (
              <div className="text-sm" style={{ color:'var(--muted)' }}>No calls yet.</div>
            )}

            {filteredLogs.map(t=>(
              <button
                key={t.id}
                onClick={()=>setSelectedId(t.id)}
                className="hover-glow"
                data-active={t.id===selectedId}
                style={{
                  textAlign:'left',
                  background:t.id===selectedId ? CTA_WEAK : 'var(--panel)',
                  border:`1px solid ${t.id===selectedId ? CTA_LINE : 'var(--border)'}`,
                  borderRadius:R_MD, padding:10
                }}
              >
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10 }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-8">
                      <b className="truncate">{t.caller || 'Unknown caller'}</b>
                      <span className="text-[11px] px-1.5 py-0.5 rounded border" style={{
                        borderColor:'var(--border)',
                        background:
                          t.status==='completed' ? 'rgba(34,197,94,.12)' :
                          t.status==='missed'    ? 'rgba(245,158,11,.16)' :
                          t.status==='failed'    ? 'rgba(239,68,68,.14)' : 'rgba(59,130,246,.14)',
                        color:
                          t.status==='completed' ? '#22c55e' :
                          t.status==='missed'    ? '#d97706' :
                          t.status==='failed'    ? '#ef4444' : '#3b82f6'
                      }}>
                        {t.status || '—'}
                      </span>
                    </div>
                    <div className="truncate text-[12px]" style={{ color:'var(--muted)', marginTop:2 }}>{t.summary || 'No summary'}</div>
                    <div className="text-[12px]" style={{ color:'var(--muted)' }}>
                      {fmtTime(t.startedAt)} • {fmtDur(t.durationSec)} • to {t.callee || '—'}
                    </div>
                  </div>
                  <div style={{ display:'grid', gap:6 }}>
                    <button onClick={(e)=>{e.stopPropagation(); downloadTXT(t);}} className="pill"><FileText className="w-4 h-4" /> .txt</button>
                    <button onClick={(e)=>{e.stopPropagation(); downloadJSON(t);}} className="pill"><Download className="w-4 h-4" /> .json</button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT: Transcript detail */}
        <section className="sa-card" style={{ overflow:'hidden auto' }}>
          <div className="sa-head">
            <b>Transcript</b>
            {selected && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {selected.shareUrl && (
                  <a href={selected.shareUrl} target="_blank" rel="noreferrer" className="pill" style={{ color:CTA }}>
                    Open <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={()=>downloadTXT(selected)} className="pill"><FileText className="w-4 h-4" /> .txt</button>
                <button onClick={()=>downloadJSON(selected)} className="pill"><Download className="w-4 h-4" /> .json</button>
                <button onClick={()=>toggleShare(selected)} className="pill" style={{ background:selected.shared?CTA_WEAK:undefined }}>
                  <Share2 className="w-4 h-4" /> {selected.shared?'Unshare':'Share'}
                </button>
                <button onClick={()=>removeTranscript(selected)} className="pill" style={{ background:'rgba(239,68,68,.14)' }}>
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>

          {!selected ? (
            <div className="p-5 text-sm" style={{ color:'var(--muted)' }}>Pick a call on the middle column.</div>
          ) : (
            <div style={{ padding:14, display:'grid', gap:12 }}>
              {/* meta row */}
              <div className="sa-card" style={{ border:'1px dashed var(--border)' }}>
                <div style={{ padding:12, display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:10 }}>
                  <Meta label="Started" value={fmtTime(selected.startedAt)} />
                  <Meta label="Duration" value={fmtDur(selected.durationSec)} />
                  <Meta label="Status"   value={selected.status || '—'} />
                  <Meta label="Caller"   value={selected.caller || '—'} />
                  <Meta label="Callee"   value={selected.callee || '—'} />
                  <Meta
                    label="Share"
                    value={selected.shared ? 'Public' : 'Private'}
                    extra={selected.shared && selected.shareUrl ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                        <a href={selected.shareUrl} target="_blank" className="text-xs" style={{ color:CTA }}>Open link <ExternalLink className="w-3 h-3" /></a>
                        <button onClick={()=>copy(selected.shareUrl!)} className="pill" style={{ height:24 }}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy
                        </button>
                      </div>
                    ) : <div className="text-xs" style={{ color:'var(--muted)', marginTop:6 }}>{selected.shared?'No URL':'Not shared'}</div>}
                  />
                </div>
              </div>

              {/* recording */}
              {selected.recordingUrl && (
                <div className="sa-card" style={{ border:'1px dashed var(--border)' }}>
                  <div className="sa-head" style={{ borderBottom:'1px dashed var(--border)' }}>
                    <div className="flex items-center gap-2"><PlayCircle className="w-4 h-4" /><b>Recording</b></div>
                  </div>
                  <div style={{ padding:12 }}>
                    <audio controls style={{ width:'100%' }}><source src={selected.recordingUrl} /></audio>
                  </div>
                </div>
              )}

              {/* turns */}
              <div className="sa-card">
                <div className="sa-head"><b>Conversation</b></div>
                <div style={{ padding:12, display:'grid', gap:10, maxHeight:520, overflow:'auto' }}>
                  {(selected.turns || []).map(turn=>(
                    <div key={turn.id} style={{ display:'grid', gap:6 }}>
                      <div className="text-xs" style={{ color:'var(--muted)' }}>
                        [{turn.role}{turn.at?` • ${fmtTime(turn.at)}`:''}]
                      </div>
                      <div style={{
                        background: turn.role==='assistant' ? CTA_WEAK : 'transparent',
                        border:'1px solid var(--border)', borderRadius:R_SM, padding:'10px 12px', whiteSpace:'pre-wrap'
                      }}>
                        {turn.text}
                      </div>
                    </div>
                  ))}
                  {(!selected.turns || !selected.turns.length) && (
                    <div className="text-sm" style={{ color:'var(--muted)' }}>No transcript turns for this call.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

/* small meta cell */
function Meta({ label, value, extra }:{ label:string; value:string; extra?:React.ReactNode }){
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
      <div className="text-xs" style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      <div className="text-sm">{value}</div>
      {extra}
    </div>
  );
}
