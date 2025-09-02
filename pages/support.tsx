// pages/support.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { MessageSquare, Send } from 'lucide-react';

/** —— Shared palette (same vibe as your builder) —— */
const MINT = '#00ffc2';
const CARD_BG = 'rgba(13,15,17,0.95)';
const THIN_BORDER = '1px solid rgba(255,255,255,0.10)';
const SHADOW =
  '0 20px 60px rgba(0,0,0,0.55), 0 0 24px rgba(0,255,194,0.04), inset 0 0 20px rgba(0,0,0,0.35)';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "Hi — I’m Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?",
    },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setText('');
    const next = [...messages, { role: 'user', content } as Msg];
    setMessages(next);
    setBusy(true);

    try {
      const r = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const j = await r.json();
      const reply: string =
        j?.reply ||
        j?.message ||
        'Something went wrong. Please try again or check your API key on the API Keys page.';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Network error. Please try again in a moment.' },
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

  return (
    <>
      <Head>
        <title>Riley — Support • reduc.ai</title>
      </Head>

      <main className="min-h-screen px-6 2xl:px-12 py-8 font-movatif" style={{ background: '#0b0c10' }}>
        {/* Page title */}
        <div className="max-w-[1240px] mx-auto mb-6 flex items-center gap-4">
          {/* Title icon (rounded square with chat bubble) */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, rgba(0,255,194,0.08), rgba(0,0,0,0.12))',
              border: THIN_BORDER,
              boxShadow: 'inset 0 0 18px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <MessageSquare className="w-6 h-6" style={{ color: '#2dbb9c' }} />
          </div>

          <div className="min-w-0">
            <h1 className="text-white/95 tracking-tight" style={{ fontSize: 34, fontWeight: 500 }}>
              <span>Riley</span>
              <span className="text-white/55"> — Support</span>
            </h1>
            <p className="text-white/60 text-sm">
              Ask our Support AI, or email
              {' '}
              <a className="text-[#59d9b3] hover:underline" href="mailto:support@reduc.ai">
                support@reduc.ai
              </a>
              .
            </p>
          </div>
        </div>

        {/* Chat card */}
        <section className="max-w-[1240px] mx-auto">
          <div
            className="rounded-[20px] overflow-hidden"
            style={{ background: CARD_BG, border: THIN_BORDER, boxShadow: SHADOW }}
          >
            {/* Messages area (solid bubbles, thin borders) */}
            <div
              ref={boxRef}
              className="h-[66vh] min-h-[440px] max-h-[76vh] overflow-y-auto p-6 md:p-8"
              style={{
                background:
                  'radial-gradient(1200px 600px at 20% 10%, rgba(0,255,194,0.06), transparent 60%)',
              }}
            >
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <Bubble key={i} role={m.role} text={m.content} />
                ))}
              </div>
            </div>

            {/* Composer — single pill button (no extra icon button) */}
            <div
              className="p-3 md:p-4 flex items-center gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type your message..."
                className="flex-1 h-[48px] md:h-[52px] px-4 md:px-5 text-white outline-none"
                style={{
                  background: '#0f1314',            // solid
                  border: '1px solid rgba(255,255,255,0.12)', // thin
                  borderRadius: 22,                 // much more rounded
                }}
              />
              <button
                onClick={send}
                disabled={busy || !text.trim()}
                className="inline-flex items-center gap-2 px-5 md:px-6 h-[48px] md:h-[52px] rounded-full font-semibold transition-transform active:scale-[0.99] disabled:opacity-60"
                style={{
                  background: MINT,
                  color: '#07110f',
                  boxShadow: '0 6px 18px rgba(0,255,194,0.28)',
                }}
              >
                <Send className="w-4 h-4" style={{ color: '#ffffff' }} />
                Send
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/** —— Message bubble (solid backgrounds) —— */
function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user';
  const bg = isUser ? '#0f4136' : '#0f1314'; // solid, not transparent
  const border = isUser ? '1px solid rgba(0,255,194,0.22)' : '1px solid rgba(255,255,255,0.12)';
  return (
    <div className={isUser ? 'flex justify-start' : 'flex justify-start'}>
      <div
        className="max-w-[880px] text-[14px] leading-relaxed text-white/92 px-4 py-3"
        style={{
          background: bg,
          border,
          borderRadius: 18, // rounded bubbles
          boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
        }}
      >
        {text}
      </div>
    </div>
  );
}
