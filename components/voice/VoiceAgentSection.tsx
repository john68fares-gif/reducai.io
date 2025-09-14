// components/voice/VoiceAgentSection.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Bot, Code2, Play, MessagesSquare, Phone } from 'lucide-react';

const AssistantRail = dynamic(
  () => import('@/components/voice/AssistantRail').then(m => m.default ?? m),
  { ssr: false }
);

class RailBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  constructor(p:any){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(){ return {hasError:true}; }
  render(){ return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* minimal tokens just for this page */
const GREEN = '#10b981', GREEN_HOVER = '#0ea473';
const Tokens = () => (
  <style>{`
    .va{ color:#E9FBF5; font-size:13px; }
    .pill{ height:32px; padding:0 .85rem; border-radius:12px; border:1px solid rgba(106,247,209,.18);
           background:transparent; display:inline-flex; align-items:center; gap:.5rem; font-weight:700; font-size:14px; }
    .tab{ height:38px; padding:0 18px; border-radius:12px; border:1px solid rgba(106,247,209,.18);
          display:inline-flex; align-items:center; font-weight:700; font-size:18px; }
    .btn{ height:34px; padding:0 .75rem; border-radius:12px; border:1px solid rgba(106,247,209,.18);
          background:transparent; display:inline-flex; align-items:center; gap:.5rem; font-weight:600; font-size:13px; }
    .btn-primary{ height:36px; padding:0 .95rem; border-radius:12px; background:${GREEN}; border:1px solid ${GREEN};
                  color:#0b1210; font-weight:800; box-shadow:0 8px 20px rgba(16,185,129,.20); }
    .btn-primary:hover{ background:${GREEN_HOVER}; box-shadow:0 10px 24px rgba(16,185,129,.28); }
    .ico{ width:16px; height:16px; }
  `}</style>
);

export default function VoiceAgentSection() {
  return (
    <div className="va w-full" style={{ background:'var(--bg)' }}>
      <Tokens />

      {/* 1px breathing room on right side */}
      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns:'312px 1fr' }}>
        {/* LEFT rail */}
        <div className="border-r" style={{ borderColor:'var(--border)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* RIGHT: header + tabs only */}
        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]">
          {/* header */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="pill"><Bot className="ico" /> Voice Studio</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn"><Code2 className="ico" /> Code</button>
              <button className="btn"><Play className="ico" /> Test</button>
              <button className="btn"><MessagesSquare className="ico" /> Chat</button>
              <button className="btn-primary"><Phone className="ico" /> Talk to Assistant</button>
            </div>
          </div>

          {/* tabs */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="tab">Model</span>
            <span className="tab">Voice</span>
            <span className="tab">Transcriber</span>
            <span className="tab">Tools</span>
            <span className="tab">Analysis</span>
            <span className="tab">Advanced</span>
            <span className="tab">Widget</span>
            <span className="text-lg ml-2" style={{ color:'var(--text-muted)' }}>Web</span>
          </div>
        </div>
      </div>
    </div>
  );
}
