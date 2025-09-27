'use client';

import React, { useRef, useState } from 'react';
import { Wand2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

/* ========= tiny utils ========= */
const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms));
const safe = (s:string) => (s ?? '').replace(/\u200b/g,'');

/* ========= character diff (LCS) ========= */
type Op = { t:'same'|'add'|'rem'; ch:string };
function diffCharsLCS(a: string, b: string): Op[] {
  const A = Array.from(a || ''); const B = Array.from(b || '');
  const n=A.length, m=B.length, dp = Array.from({length:n+1},()=>Array(m+1).fill(0));
  for (let i=1;i<=n;i++) for (let j=1;j<=m;j++)
    dp[i][j] = A[i-1]===B[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops:Op[]=[]; let i=n, j=m;
  while (i>0 && j>0){
    if (A[i-1]===B[j-1]) { ops.push({t:'same', ch:A[i-1]}); i--; j--; }
    else if (dp[i-1][j] >= dp[i][j-1]) { ops.push({t:'rem', ch:A[i-1]}); i--; }
    else { ops.push({t:'add', ch:B[j-1]}); j--; }
  }
  while(i>0){ ops.push({t:'rem', ch:A[i-1]}); i--; }
  while(j>0){ ops.push({t:'add', ch:B[j-1]}); j--; }
  ops.reverse(); return ops;
}

/* ========= inline diff box with Accept/Decline ========= */
function DiffBox({
  base, next, onAccept, onDecline,
}:{
  base: string; next: string; onAccept: ()=>void; onDecline: ()=>void;
}) {
  const ops = diffCharsLCS(base, next);
  return (
    <div className="rounded-[8px] px-3 py-[10px]"
         style={{ minHeight: 320, background:'var(--panel, #0d0f11)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text, #e6f1ef)' }}>
      <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', lineHeight:'1.55', margin:0 }}>
        {ops.map((o, i) => {
          if (o.t==='same') return <span key={i}>{o.ch}</span>;
          if (o.t==='add')  return <span key={i} style={{ background:'rgba(16,185,129,.14)', color:'#10b981' }}>{o.ch}</span>;
          return <span key={i} style={{ background:'rgba(239,68,68,.18)', color:'#ef4444', textDecoration:'line-through' }}>{o.ch}</span>;
        })}
      </pre>
      <div className="mt-3 flex gap-2">
        <button onClick={onAccept} className="h-9 px-3 rounded-[8px] font-semibold" style={{ background:'#10b981', color:'#fff' }}>Accept</button>
        <button onClick={onDecline} className="h-9 px-3 rounded-[8px] font-semibold" style={{ background:'#ef4444', color:'#fff' }}>Decline</button>
      </div>
    </div>
  );
}

/* ========= minimal “Generate” overlay ========= */
function GenerateOverlay({
  open, value, onChange, onClose,
  onGenerate,
}:{
  open:boolean; value:string; onChange:(v:string)=>void; onClose:()=>void;
  onGenerate:(desc:string)=>Promise<void>|void;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex:100000, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
           onClick={onClose}/>
      <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex:100001 }}>
        <div className="w-full max-w-[640px] rounded-[8px] overflow-hidden"
             style={{ background:'var(--panel, #0d0f11)', color:'var(--text, #e6f1ef)', border:'1px solid rgba(89,217,179,.20)' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(89,217,179,.20)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background:'rgba(89,217,179,.12)' }}>
                <span style={{ color:'#59d9b3' }}><Wand2 className="w-5 h-5" /></span>
              </div>
              <div className="text-lg font-semibold">Describe how to update the prompt</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-[6px] grid place-items-center"
                    style={{ border:'1px solid rgba(89,217,179,.20)' }} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-3">
            <div className="text-xs" style={{ color:'var(--text-muted, #9fb4ad)' }}>
              Tip: “assistant for a dental clinic; friendly; handle booking and FAQs”.
            </div>
            <div className="rounded-[8px] p-2" style={{ border:'1px solid rgba(255,255,255,.10)' }}>
              <textarea value={value} onChange={(e)=>onChange(e.target.value)}
                        className="w-full bg-transparent outline-none rounded-[6px] px-3 py-2"
                        placeholder="Describe changes…" style={{ minHeight:160, maxHeight:'40vh', resize:'vertical' }}/>
            </div>
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="w-full h-[40px] rounded-[8px]"
                    style={{ border:'1px solid rgba(255,255,255,.10)', fontWeight:600 }}>
              Cancel
            </button>
            <button onClick={async ()=>{ const t = value.trim(); if (!t) return; await onGenerate(t); onClose(); }}
                    disabled={!value.trim()}
                    className="w-full h-[40px] rounded-[8px] font-semibold"
                    style={{ background:'#59d9b3', color:'#fff', opacity: value.trim()?1:.6 }}>
              Generate
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ========= MAIN DROP-IN =========
   Props:
   - value:        current prompt string (textarea value)
   - onChange:     called when user accepts generated prompt (or types manually)
   - compile?:     optional function that returns { frontendText, backendString }
   - onBackend?:   optional callback with backendString (to mirror to your backend)
*/
export default function PromptBox({
  value, onChange, compile, onBackend,
}:{
  value: string;
  onChange: (next:string)=>void;
  compile?: (basePrompt:string, userDesc:string) => { frontendText:string; backendString:string };
  onBackend?: (backendString:string)=>void;
}) {
  // overlay + composer
  const [showGen, setShowGen] = useState(false);
  const [composer, setComposer] = useState('');

  // typing into prompt
  const [typing, setTyping] = useState(false);
  const [candidate, setCandidate] = useState('');
  const baseRef = useRef<string>('');
  const rafRef = useRef<number | null>(null);

  // start typing effect from base → candidate
  const startTyping = async (target: string) => {
    baseRef.current = value || '';
    setTyping(true);
    setCandidate('');
    if (rafRef.current) cancelAnimationFrame(rafRef.current as any);
    let i = 0;
    const step = () => {
      i += Math.max(1, Math.round(target.length / 140));
      setCandidate(target.slice(0, i));
      if (i < target.length) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const accept = () => {
    const chosen = safe(candidate || value);
    onChange(chosen);
    setTyping(false);
    setCandidate('');
  };
  const decline = () => {
    setTyping(false);
    setCandidate('');
  };

  // Generate → compile → type
  const handleGenerate = async (desc:string) => {
    try {
      const base = value || '';
      let front = base, back = base;
      if (compile) {
        const out = compile(base, desc);
        front = out.frontendText || front;
        back  = out.backendString || back;
        if (onBackend) onBackend(back);
      } else {
        // fallback: just append a Context block if no compiler is provided
        front = `${base}\n\n[Context]\n${desc}`.trim();
        back  = front;
        if (onBackend) onBackend(back);
      }
      setShowGen(false);
      await sleep(80);
      await startTyping(front);
    } catch {
      // swallow; UI stays as-is
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium" style={{ fontSize:'12.5px' }}>System Prompt</div>
        <button
          className="inline-flex items-center gap-2 rounded-[8px] text-sm"
          style={{ height:34, padding:'0 12px', background:'#59d9b3', color:'#fff', border:'1px solid rgba(255,255,255,.08)' }}
          onClick={()=>{ setComposer(''); setShowGen(true); }}
        >
          <Wand2 className="w-4 h-4" /> Generate
        </button>
      </div>

      {!typing ? (
        <textarea
          className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[10px]"
          style={{ minHeight:320, background:'var(--panel, #0d0f11)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text, #e6f1ef)' }}
          value={value}
          onChange={(e)=> onChange(e.target.value)}
        />
      ) : (
        <DiffBox base={baseRef.current} next={candidate || value} onAccept={accept} onDecline={decline} />
      )}

      <GenerateOverlay
        open={showGen}
        value={composer}
        onChange={setComposer}
        onClose={()=> setShowGen(false)}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
