// pages/voice-agent.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { Sparkles, RefreshCw, Check, X } from 'lucide-react';
import AssistantRail, { type AssistantLite } from '@/components/voice/AssistantRail';
import WebCallButton from '@/components/voice/WebCallButton';
import { useSettings } from '@/utils/settings';

/* ---- look tokens ---- */
const ACCENT = '#10b981';
const card = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.14)' };

/* ---- minimal types & storage ---- */
type Assistant = AssistantLite & {
  systemPrompt: string;
  firstMessage: string;
  model: 'gpt-4o'|'gpt-4o-mini'|'gpt-4.1'|'gpt-3.5-turbo';
  voiceLabel: string;
};

const LS = 'va:assistants.v2';

function readList(): Assistant[] {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}
function writeList(list: Assistant[]) {
  localStorage.setItem(LS, JSON.stringify(list));
}

/* ---- default prompt (used only when you want) ---- */
const BASE_PROMPT = `[Identity]
You are a helpful assistant that books appointments.

[Style]
- Friendly, concise, confirms critical details.

[System Behaviors]
- Ask for missing details one at a time.
- Summarize before finalizing.

[Data to Collect]
- Full Name
- Phone Number
- Email (optional)
- Appointment Date/Time

[Safety]
- No medical/legal/financial advice beyond high-level pointers.

[Handover]
- Provide a short summary and next steps.`;

/* ---- diff (LCS) for typing view: add=green, del=red ---- */
type Seg = { t: 'same'|'add'|'del'; s: string };

function diff(a: string, b: string): Seg[] {
  const A = [...a], B = [...b];
  const dp = Array(A.length+1).fill(0).map(()=>Array(B.length+1).fill(0));
  for (let i=A.length-1;i>=0;i--)
    for (let j=B.length-1;j>=0;j--)
      dp[i][j] = A[i]===B[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);

  const out: Seg[] = [];
  let i=0, j=0, buf='', mode:'same'|'add'|'del'='same';

  const flush = () => { if (buf) out.push({ t: mode, s: buf }); buf=''; };

  while (i<A.length && j<B.length) {
    if (A[i] === B[j]) {
      if (mode!=='same') { flush(); mode='same'; }
      buf += B[j]; i++; j++;
    } else if (dp[i+1][j] >= dp[i][j+1]) {
      if (mode!=='del') { flush(); mode='del'; }
      buf += A[i]; i++;
    } else {
      if (mode!=='add') { flush(); mode='add'; }
      buf += B[j]; j++;
    }
  }
  while (i<A.length) { if (mode!=='del') { flush(); mode='del'; } buf += A[i++]; }
  while (j<B.length) { if (mode!=='add') { flush(); mode='add'; } buf += B[j++]; }
  flush();
  return out;
}

function TypingDiff({ oldText, newText, onAccept, onDecline }:{
  oldText: string; newText: string; onAccept: ()=>void; onDecline: ()=>void;
}) {
  const segs = useMemo(()=>diff(oldText, newText), [oldText, newText]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    const timer = setInterval(()=> setIdx(i=> Math.min(i+1, segs.length)), 18);
    return () => clearInterval(timer);
  }, [oldText, newText]);

  return (
    <div>
      <div
        style={{
          ...card, borderRadius:16, padding:12, maxHeight:680, overflowY:'auto',
          fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', lineHeight:'1.45', whiteSpace:'pre-wrap'
        }}
      >
        {segs.slice(0, idx).map((g, i) => {
          if (g.t === 'same') return <span key={i}>{g.s}</span>;
          if (g.t === 'add')  return <ins key={i} style={{ background:'rgba(16,185,129,.18)', padding:'1px 2px', borderRadius:4 }}>{g.s}</ins>;
          return <del key={i} style={{ background:'rgba(239,68,68,.12)', color:'#fca5a5', textDecorationColor:'#ef4444', padding:'1px 2px', borderRadius:4 }}>{g.s}</del>;
        })}
        {idx < segs.length ? <span className="animate-pulse"> ▌</span> : null}
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
        <button onClick={onDecline} style={btnGhost}><X size={16} color="#aaa"/>&nbsp;Decline</button>
        <button onClick={onAccept} style={btnGreen}><Check size={16} color="#fff"/><span style={{color:'#fff'}}>Accept</span></button>
      </div>
    </div>
  );
}

/* ---- page ---- */
export default function VoiceAgentPage() {
  const { openaiKey, phoneE164 } = useSettings(); // ← imported from your API Key section
  const [list, setList] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // hydrate
  useEffect(() => {
    const l = readList();
    setList(l);
    if (l.length) setActiveId(l[0].id);
  }, []);

  // helpers
  const active = useMemo(()=> list.find(a => a.id === activeId) || null, [list, activeId]);
  const updateActive = (mut: (a: Assistant)=>Assistant) => {
    if (!active) return;
    const next = mut(active);
    const newer = list.map(x => x.id === active.id ? next : x);
    setList(newer); writeList(newer);
  };

  // create = EMPTY as requested
  const onCreate = () => {
    const a: Assistant = {
      id: `agent_${Math.random().toString(36).slice(2,8)}`,
      name: 'New Assistant',
      folder: 'Unfiled',
      updatedAt: Date.now(),
      systemPrompt: '',         // ← empty
      firstMessage: '',         // ← empty
      model: 'gpt-4o',
      voiceLabel: 'Alloy (OpenAI)',
    };
    const newer = [...list, a];
    setList(newer); writeList(newer);
    setActiveId(a.id);
  };
  const onSelect  = (id: string) => setActiveId(id);
  const onRename  = (id: string, name: string) => {
    const newer = list.map(a => a.id===id ? { ...a, name, updatedAt: Date.now() } : a);
    setList(newer); writeList(newer);
  };
  const onDelete  = (id: string) => {
    const newer = list.filter(a => a.id !== id);
    setList(newer); writeList(newer);
    if (activeId === id) setActiveId(newer[0]?.id || '');
  };

  // Generate overlay (with typing diff)
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [diffTarget, setDiffTarget] = useState<{ oldText: string; newText: string } | null>(null);

  function applyGenerate() {
    if (!active) return;
    const oldText = active.systemPrompt || '';
    const input = (genText || '').trim();
    if (!input) { setGenOpen(false); return; }

    // quick modes:
    const m = input.match(/^first\s*message\s*:\s*(.+)$/i);
    if (m) {
      updateActive(a => ({ ...a, firstMessage: m[1].trim(), updatedAt: Date.now() }));
      setGenOpen(false); setGenText('');
      return;
    }

    // simple improve/append rule
    let next = oldText;
    if (!oldText) {
      // starting empty? make a compact base using your BASE_PROMPT
      next = BASE_PROMPT;
    }
    const bullet = `- ${input.replace(/\n+/g,' ').replace(/\s{2,}/g,' ')}`;
    if (/\[Refinements\]/i.test(next)) next = next.replace(/\[Refinements\][\s\S]*$/i, s => s + `\n${bullet}`);
    else next = `${next}\n\n[Refinements]\n${bullet}\n`;

    setDiffTarget({ oldText, newText: next });
    setGenOpen(false);
    setGenText('');
  }

  function acceptDiff() {
    if (!active || !diffTarget) return;
    updateActive(a => ({ ...a, systemPrompt: diffTarget.newText, updatedAt: Date.now() }));
    setDiffTarget(null);
  }

  return (
    <>
      <Head><title>Voice Agent</title></Head>

      {/* Assistant sidebar (your component) */}
      <AssistantRail
        assistants={list.map(({ id, name, folder, updatedAt }) => ({ id, name, folder, updatedAt }))}
        activeId={activeId}
        onSelect={onSelect}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />

      <div
        style={{
          minHeight:'100vh', background:'#0b0c10', color:'#eef2f5',
          paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
          marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
          paddingRight:'clamp(20px, 4vw, 40px)', paddingBottom:88
        }}
      >
        {!active ? (
          <div style={{ opacity:.7, padding:24 }}>Create your first assistant.</div>
        ) : (
          <div className="grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
            {/* Top action row: Start call + settings status */}
            <div className="col-span-12" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:12 }}>
                <WebCallButton
                  greet={active.firstMessage || 'Hello. How may I help you today?'}
                  voiceLabel={active.voiceLabel}
                  systemPrompt={active.systemPrompt || BASE_PROMPT}
                  model={active.model}
                  onTurn={(role, text) => {
                    // simple live transcript sink (you can store if you want)
                    console.log(role.toUpperCase(), text);
                  }}
                  // patched to use the voice endpoint + send key
                  // (make sure your WebCallButton posts to /api/va-chat with { key } – see earlier file)
                />
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:12 }}>
                <StatusPill ok={!!openaiKey} label={openaiKey ? 'OpenAI key loaded' : 'OpenAI key missing'} />
                <StatusPill ok={!!phoneE164} label={phoneE164 ? `Phone ${phoneE164}` : 'Phone missing'} />
              </div>
            </div>

            {/* Model + First message */}
            <div className="col-span-12" style={{ ...card, borderRadius:16, padding:16, boxShadow:'0 20px 60px rgba(0,0,0,.35)' }}>
              <div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(4, minmax(220px, 1fr))' }}>
                <Field label="Model">
                  <select
                    value={active.model}
                    onChange={(e)=> updateActive(a => ({ ...a, model: e.target.value as Assistant['model'], updatedAt: Date.now() }))}
                    style={inp}
                  >
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o mini</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </Field>
                <Field label="First Message">
                  <input
                    value={active.firstMessage}
                    onChange={(e)=> updateActive(a => ({ ...a, firstMessage: e.target.value, updatedAt: Date.now() }))}
                    placeholder="(empty = default greeting)"
                    style={inp}
                  />
                </Field>
                <Field label="Voice">
                  <input
                    value={active.voiceLabel}
                    onChange={(e)=> updateActive(a => ({ ...a, voiceLabel: e.target.value, updatedAt: Date.now() }))}
                    placeholder="Alloy (OpenAI)"
                    style={inp}
                  />
                </Field>
              </div>

              {/* System prompt header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:8, color:ACCENT }}>
                  <Sparkles size={16} color={ACCENT}/> System Prompt
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=> updateActive(a => ({ ...a, systemPrompt: BASE_PROMPT, updatedAt: Date.now() }))} style={btnGhost}>
                    <RefreshCw size={16} color={ACCENT}/>Reset
                  </button>
                  <button onClick={()=> setGenOpen(true)} style={btnGreen}>
                    <Sparkles size={16} color="#fff"/><span style={{color:'#fff'}}>Generate / Edit</span>
                  </button>
                </div>
              </div>

              {/* either plain textarea or diff-typing overlay */}
              {!diffTarget ? (
                <textarea
                  rows={22}
                  value={active.systemPrompt}
                  onChange={(e)=> updateActive(a => ({ ...a, systemPrompt: e.target.value, updatedAt: Date.now() }))}
                  placeholder="(empty)"
                  style={{
                    ...inp, minHeight:420, lineHeight:'1.45', fontSize:14,
                    fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                  }}
                />
              ) : (
                <TypingDiff
                  oldText={diffTarget.oldText}
                  newText={diffTarget.newText}
                  onAccept={acceptDiff}
                  onDecline={()=> setDiffTarget(null)}
                />
              )}
            </div>

            {/* Generate overlay */}
            {genOpen && (
              <div style={{
                position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'grid', placeItems:'center', zIndex:9999, padding:16
              }}>
                <div style={{ width:'100%', maxWidth:640, ...card, borderRadius:14, background:'#0f1315' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
                    <div style={{ fontWeight:600, fontSize:14, display:'flex', gap:8, alignItems:'center', color:ACCENT }}>
                      <Sparkles size={16} color={ACCENT}/>Generate / Edit Prompt
                    </div>
                    <button onClick={()=> setGenOpen(false)} style={{ ...btnGhost, padding:'6px 10px' }}>Close</button>
                  </div>
                  <div style={{ padding:14 }}>
                    <input
                      value={genText}
                      onChange={(e)=> setGenText(e.target.value)}
                      placeholder={`Examples:
- assistant
- collect full name, phone, date
- [Identity] AI Sales Agent for roofers
- first message: Hey—quick question to get you booked…`}
                      style={{ ...inp, minHeight:48 }}
                    />
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
                      <button onClick={()=> setGenOpen(false)} style={btnGhost}>Cancel</button>
                      <button onClick={applyGenerate} style={btnGreen}><span style={{color:'#fff'}}>Generate</span></button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ---- tiny atoms ---- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:'grid', gap:6 }}>
      <span style={{ fontSize:13, fontWeight:600 }}>{label}</span>
      {children}
    </label>
  );
}
function StatusPill({ ok, label }:{ ok: boolean; label: string }) {
  return (
    <span style={{
      fontSize:12, padding:'4px 10px', borderRadius:999,
      border: `1px solid ${ok ? 'rgba(16,185,129,.5)' : 'rgba(239,68,68,.5)'}`,
      background: ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
      color: ok ? '#a7f3d0' : '#fecaca'
    }}>{label}</span>
  );
}

const inp: React.CSSProperties = {
  width:'100%', borderRadius:12, padding:'12px 12px', background:'rgba(255,255,255,.03)',
  border:'1px solid rgba(255,255,255,.14)', outline:'none', color:'#eef2f5', fontSize:14,
  boxShadow:'inset 0 1px 0 rgba(255,255,255,.06)'
};
const btnBase: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12,
  border:'1px solid rgba(255,255,255,.14)', background:'rgba(255,255,255,.03)', color:'#eef2f5',
  boxShadow:'0 12px 26px rgba(0,0,0,.35)', cursor:'pointer'
};
const btnGhost = btnBase;
const btnGreen: React.CSSProperties = { ...btnBase, background:ACCENT, borderColor:ACCENT, boxShadow:'0 10px 24px rgba(16,185,129,.22)' };
