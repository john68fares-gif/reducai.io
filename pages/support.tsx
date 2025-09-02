// pages/support.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { Send, Trash2, Share2, MessageSquare } from 'lucide-react';

/* ——— Shared style tokens (kept close to the rest of your app) ——— */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '1px solid rgba(106,247,209,0.18)', // thinner line
  boxShadow: '0 0 24px rgba(0,0,0,0.55), inset 0 0 16px rgba(0,0,0,0.35)',
  borderRadius: 16, // less rounded per request
};

const BTN_PRIMARY = '#59d9b3';
const BTN_PRIMARY_HOVER = '#54cfa9';

type Msg = { role: 'user' | 'assistant'; content: string };

const GREETING =
  'Hi — I’m Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?';

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // keep the panel scrolled to bottom
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);

    try {
      const r = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, { role: 'user', content: text }] }),
      });
      const j = await r.json().catch(() => ({} as any));
      const reply: string =
        j?.reply ||
        j?.message ||
        'Hmm, I couldn’t reach the model. Check your API key on the **API Keys** page and try again.';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Request failed. Please try again in a moment.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([{ role: 'assistant', content: GREETING }]);
  }

  function shareChat() {
    try {
      const text = messages.map((m) => (m.role === 'user' ? `You: ${m.content}` : `Riley: ${m.content}`)).join('\n\n');
      navigator.clipboard.writeText(text);
    } catch {}
  }

  return (
    <>
      <Head><title>Riley — Support • reduc.ai</title></Head>

      <main className="px-6 py-8">
        {/* page title bar (same family as your other pages, not bold) */}
        <div className="mx-auto w-full max-w-[1240px] mb-5">
          <div className="flex items-center justify-center">
            <div
              className="w-full rounded-[14px] px-5 py-3 text-center font-movatif"
              style={{
                border: '1px solid rgba(106,247,209,0.22)',
                boxShadow: '0 0 10px rgba(106,247,209,0.08)',
                background: 'rgba(8,10,11,0.75)',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Ask our Support AI or email <span className="text-[#6af7d1]">support@reduc.ai</span>
            </div>
          </div>
        </div>

        {/* chat card */}
        <div className="mx-auto w-full max-w-[1240px]" style={FRAME}>
          {/* header */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="flex items-center gap-2 font-movatif">
              <MessageSquare className="w-4 h-4 text-[#6af7d1]" />
              <div className="text-[20px] md:text-[22px] text-white/95">Riley — <span className="text-white/80">Support</span></div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[10px] text-sm text-white/85 hover:bg-white/5"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                title="Clear"
              >
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              <button
                onClick={shareChat}
                className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[10px] text-sm text-white/85 hover:bg-white/5"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                title="Copy conversation"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>

          {/* messages */}
          <div
            ref={scrollerRef}
            className="px-5 py-5 overflow-y-auto"
            style={{ height: '68vh', scrollbarWidth: 'thin' }}
          >
            <div className="space-y-3">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.content} />
              ))}
            </div>
          </div>

          {/* input */}
          <div
            className="flex items-center gap-3 px-4 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message..."
              className="flex-1 h-[48px] px-4 rounded-[24px] text-white outline-none"
              style={{
                background: '#0f1314', // solid
                border: '1px solid rgba(255,255,255,0.20)', // thinner
              }}
            />

            {/* Primary "Next"-style button */}
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="h-[48px] px-5 rounded-[24px] font-semibold disabled:opacity-50"
              style={{
                background: BTN_PRIMARY,
                color: '#0b0c10',
                boxShadow: '0 0 10px rgba(106,247,209,0.30)',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_PRIMARY_HOVER)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_PRIMARY)}
            >
              Send
            </button>

            {/* Optional plane icon (matches your screenshots) */}
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="w-[44px] h-[44px] rounded-full grid place-items-center disabled:opacity-50"
              title="Send"
              style={{ background: 'rgba(26,64,57,0.85)', border: '1px solid rgba(106,247,209,0.25)' }}
            >
              <Send className="w-4 h-4 text-[#6af7d1]" />
            </button>
          </div>
        </div>
      </main>

      <style jsx global>{`
        body { background: #0b0c10; }
        .fadeIn {
          animation: fadeInUp 220ms ease forwards;
          opacity: 0;
          transform: translateY(4px);
        }
        @keyframes fadeInUp {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/* ——— Message bubble (solid backgrounds) ——— */
function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user';
  const bg = isUser ? '#0f4136' : '#101314'; // solid
  const border = isUser ? '1px solid rgba(0,255,194,0.22)' : '1px solid rgba(255,255,255,0.10)';
  const color = isUser ? '#d9fff5' : 'rgba(255,255,255,0.92)';

  return (
    <div className={isUser ? 'text-right' : 'text-left'}>
      <div
        className="inline-block max-w-[1000px] px-4 py-2 fadeIn"
        style={{
          background: bg,
          border,
          borderRadius: 16, // more rounded for bubbles
          color,
        }}
      >
        {text}
      </div>
    </div>
  );
}
