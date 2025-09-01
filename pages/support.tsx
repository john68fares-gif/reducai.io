// pages/support.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import {
  HelpCircle, BookOpen, MessageSquare, ChevronDown, FileText, Video, Shield, Send
} from 'lucide-react';

/* ---------- Simple styles to fit your dark / glow UI ---------- */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 24,
};
const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 18,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 10px 40px rgba(0,0,0,0.35)',
};

/* ---------- Tiny Accordion ---------- */
function AccordionItem({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement | null>(null);

  return (
    <div style={CARD} className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          {icon} <span>{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-white/80 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        ref={contentRef}
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          display: 'grid',
          transition: 'grid-template-rows 240ms ease',
        }}
      >
        <div className="min-h-0">
          <div className="px-5 pb-5 pt-1 text-white/85 text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Support Page ---------- */
export default function SupportPage() {
  // Helpline keys (load from voice backup if present)
  const [assistantId, setAssistantId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [mounted, setMounted] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setMounted(true);
    try {
      // load from support-specific keys
      const aid = localStorage.getItem('support:assistantId');
      const pk = localStorage.getItem('support:publicKey');
      if (aid) setAssistantId(aid);
      if (pk) setPublicKey(pk);

      // fallback: load from voice backup (if you saved there previously)
      if (!aid || !pk) {
        const vs = localStorage.getItem('voice:settings:backup');
        if (vs) {
          const j = JSON.parse(vs || '{}');
          if (!aid && j?.assistantId) setAssistantId(j.assistantId);
          if (!pk && j?.publicKey) setPublicKey(j.publicKey);
        }
      }
    } catch {}
  }, []);

  // Mount widget whenever both keys exist
  useEffect(() => {
    if (!mounted) return;
    if (!assistantId || !publicKey) return;

    const scId = 'vapi-widget-script';
    if (!document.getElementById(scId)) {
      const sc = document.createElement('script');
      sc.id = scId;
      sc.src = 'https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js';
      sc.async = true;
      sc.type = 'text/javascript';
      document.body.appendChild(sc);
    }

    const slot = document.getElementById('support-widget-slot');
    if (slot && slot.childElementCount === 0) {
      const el = document.createElement('vapi-widget');
      el.setAttribute('assistant-id', assistantId);
      el.setAttribute('public-key', publicKey);
      // keep messages short & tidy is handled by your assistant’s prompt/config
      slot.appendChild(el);
    }
  }, [assistantId, publicKey, mounted]);

  function saveKeys() {
    localStorage.setItem('support:assistantId', assistantId);
    localStorage.setItem('support:publicKey', publicKey);
    setSavedMsg('Saved. Reloading widget…');
    setTimeout(() => setSavedMsg(''), 1500);
    // soft re-mount (remove old, re-add)
    const slot = document.getElementById('support-widget-slot');
    if (slot) slot.innerHTML = '';
    // trigger effect
    setTimeout(() => {
      const evt = new Event('rebuild');
      window.dispatchEvent(evt);
      // effect will run due to state still same; force by tiny toggle
      setAssistantId(prev => prev + '');
    }, 10);
  }

  /* Help Form (local only for now) */
  const [hfEmail, setHfEmail] = useState('');
  const [hfSubject, setHfSubject] = useState('');
  const [hfMsg, setHfMsg] = useState('');
  const [hfSaved, setHfSaved] = useState('');

  function saveHelpForm() {
    const rec = {
      at: new Date().toISOString(),
      email: hfEmail.trim(),
      subject: hfSubject.trim(),
      message: hfMsg.trim(),
    };
    const key = 'support:helpFormDrafts';
    let arr: any[] = [];
    try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    arr.unshift(rec);
    localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)));
    setHfSaved('Saved locally. (Add backend/email later.)');
    setTimeout(() => setHfSaved(''), 1800);
    setHfMsg('');
  }

  return (
    <>
      <Head><title>Support • reduc.ai</title></Head>

      <main className="px-6 py-10" style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <HelpCircle className="w-6 h-6 text-[#6af7d1]" /> Support
        </h1>

        <div style={FRAME} className="p-5 space-y-4">

          {/* GUIDE */}
          <AccordionItem
            title="Guide (how the site works)"
            icon={<BookOpen className="w-5 h-5 text-[#6af7d1]" />}
            defaultOpen
          >
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li><b>Builder</b>: create your AI (Sales / Support / Blank). Fill Personality & Knowledge.</li>
              <li><b>Voice Agent</b>: choose a build → add Twilio SID/Token → select/attach number.</li>
              <li><b>Improve</b>: edit the prompt, keep replies short, ask one question at a time.</li>
              <li><b>Test</b>: use Quick Tests or the widget to try real queries.</li>
              <li><b>Launch</b>: share the link / connect to your calls.</li>
            </ol>
            <div className="mt-3 text-white/70 text-sm italic">add this later</div>
          </AccordionItem>

          {/* AI HELPLINE */}
          <AccordionItem
            title="AI Helpline (chat with our site assistant)"
            icon={<MessageSquare className="w-5 h-5 text-[#6af7d1]" />}
          >
            <p className="text-white/80 text-sm mb-3">
              Short, tidy answers. Knows the product (you’ll wire the prompt). If keys are set, widget loads below.
            </p>

            {/* Keys */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
              <input
                value={assistantId}
                onChange={(e)=>setAssistantId(e.target.value)}
                placeholder="assistant-id"
                className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-white outline-none focus:border-[#6af7d1]"
              />
              <input
                value={publicKey}
                onChange={(e)=>setPublicKey(e.target.value)}
                placeholder="public-key"
                className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-white outline-none focus:border-[#6af7d1]"
              />
              <button
                onClick={saveKeys}
                className="inline-flex items-center justify-center gap-2 px-4 h-[38px] rounded-[12px] text-sm md:col-span-2"
                style={{ background:'#59d9b3', color:'#fff' }}
              >
                Save & Load Widget
              </button>
            </div>
            {!!savedMsg && <div className="text-xs text-white/60 mb-2">{savedMsg}</div>}

            {/* Widget Slot */}
            <div id="support-widget-slot" className="min-h-[80px] rounded-xl border border-white/15 bg-black/20 p-3" />

            {/* “Still stuck?” line (placeholder) */}
            <div className="mt-3 text-white/70 text-sm">
              Still stuck? Email: <span className="italic">add this later</span>
            </div>
          </AccordionItem>

          {/* FAQ */}
          <AccordionItem
            title="FAQ"
            icon={<FileText className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="space-y-2 text-sm">
              <p className="text-white/70 italic">add this later</p>
            </div>
          </AccordionItem>

          {/* HELP FORM */}
          <AccordionItem
            title="Help form (quick message to us)"
            icon={<Send className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <input
                value={hfEmail}
                onChange={(e)=>setHfEmail(e.target.value)}
                placeholder="your email (optional)"
                className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-white outline-none focus:border-[#6af7d1]"
              />
              <input
                value={hfSubject}
                onChange={(e)=>setHfSubject(e.target.value)}
                placeholder="subject"
                className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-white outline-none focus:border-[#6af7d1]"
              />
              <textarea
                value={hfMsg}
                onChange={(e)=>setHfMsg(e.target.value)}
                placeholder="describe the issue (short & clear)"
                rows={5}
                className="md:col-span-2 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#6af7d1] resize-y"
              />
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  onClick={saveHelpForm}
                  className="inline-flex items-center justify-center gap-2 px-4 h-[38px] rounded-[12px] text-sm"
                  style={{ background:'#59d9b3', color:'#fff' }}
                >
                  Save (local for now)
                </button>
                {!!hfSaved && <span className="text-xs text-white/60">{hfSaved}</span>}
                <span className="text-xs text-white/50 ml-auto">
                  (Hook this to email/DB later.)
                </span>
              </div>
            </div>
          </AccordionItem>

          {/* VIDEO TUTORIAL */}
          <AccordionItem
            title="Video tutorial"
            icon={<Video className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="text-sm text-white/80">
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <div className="text-white/70 italic">add this later</div>
                {/* Later: drop in an iframe or video player. */}
              </div>
            </div>
          </AccordionItem>

          {/* POLICY */}
          <AccordionItem
            title="Policy"
            icon={<Shield className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="text-sm text-white/80">
              <p className="text-white/70 italic">add this later</p>
            </div>
          </AccordionItem>

        </div>
      </main>

      <style jsx global>{`
        body { background:#0b0c10; }
      `}</style>
    </>
  );
}
