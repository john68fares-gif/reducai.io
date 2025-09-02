// pages/support.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { MessageSquare, Send, Copy, Trash2, Share2 } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

const UI = {
  border: '1px solid rgba(255,255,255,0.10)',                 // thin borders
  cardShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 26px rgba(0,255,194,0.06)',
  bubbleAssistant: '#0f1314',
  bubbleUser: '#0e3e35',
  brand: '#00ffc2',
  brandHover: '#00e6af',
};

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Hi — I’m Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: 'user', content: text } as Msg];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      const r = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const j = await r.json();
      const reply: string = j?.reply || j?.message || 'Sorry—no reply. Try again.';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Network error. Please try again in a few seconds.' },
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
    setMessages(messages.slice(0, 1)); // keep the greeting
  }

  return (
    <>
      <Head><title>Support • reduc.ai</title></Head>

      {/* Page title */}
      <header className="px-6 pt-8 pb-2">
        <h1 className="font-movatif text-[26px] md:text-[30px] text-white/95 tracking-tight">
          Support Center
        </h1>
      </header>

      {/* top helper pill */}
      <div className="px-6 mb-6">
        <div
          className="mx-auto w-full max-w-[1220px] rounded-[18px] px-5 py-3 text-sm text-white/80 flex items-center gap-2 justify-center"
          style={{ background: 'rgba(10,13,14,0.70)', border: UI.border, boxShadow: '0 0 18px rgba(0,0,0,0.35)' }}
        >
          Ask our Support AI, or email&nbsp;
          <span className="text-[#6af7d1]">support@reduc.ai</span>
          <button
            onClick={() => navigator.clipboard.writeText('support@reduc.ai')}
            className="ml-2 px-2.5 py-1 rounded-[8px] text-xs hover:bg-white/10 inline-flex items-center gap-1"
            style={{ border: UI.border }}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
        </div>
      </div>

      {/* Chat card */}
      <main className="px-6 pb-16">
        <section
          className="mx-auto w-full max-w-[1220px] rounded-[16px] overflow-hidden"
          style={{ background: 'rgba(13,15,17,0.92)', border: UI.border, boxShadow: UI.cardShadow }}
        >
          {/* header bar inside the card */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: UI.border }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                style={{
                  background:
                    'radial-gradient(120% 120% at 50% 0%, rgba(0,255,194,0.08) 0%, rgba(0,0,0,0.0) 100%)',
                  border: UI.border,
                  boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
                }}
              >
                <MessageSquare className="w-4 h-4 text-[#6af7d1]" />
              </div>
              <div className="font-movatif text-[18px] text-white/95">
                Riley <span className="text-white/50">— Support</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="px-3 py-1.5 rounded-[10px] text-xs text-white/85 hover:bg-white/10"
                style={{ border: UI.border }}
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1.5" />
                Clear
              </button>
              <button
                className="px-3 py-1.5 rounded-[10px] text-xs text-white/85 hover:bg-white/10"
                style={{ border: UI.border }}
                title="Share (coming soon)"
              >
                <Share2 className="w-3.5 h-3.5 inline mr-1.5" />
                Share
              </button>
            </div>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="px-4 md:px-6 py-5 h-[68vh] min-h-[540px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="space-y-3">
              {messages.map((m, i) => {
                const mine = m.role === 'user';
                return (
                  <div key={i} className="flex">
                    <div
                      className={`max-w-[88%] text-[13.5px] leading-relaxed px-4 py-2.5 rounded-[18px] ${
                        mine ? 'text-[#d9fff5]' : 'text-white/92'
                      }`}
                      style={{
                        background: mine ? UI.bubbleUser : UI.bubbleAssistant,
                        border: UI.border,
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* composer */}
          <div className="px-4 md:px-6 py-4 flex items-center gap-3" style={{ borderTop: UI.border }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message..."
              className="flex-1 h-[46px] px-4 rounded-[24px] text-white bg-[#0f1314] outline-none"
              style={{ border: UI.border }}
            />

            {/* Single send button - like your Next buttons */}
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="inline-flex items-center gap-2 px-4 h-[46px] rounded-[22px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: UI.brand, color: '#000', boxShadow: '0 10px 24px rgba(0,255,194,0.25)' }}
              onMouseEnter={(e) => (((e.currentTarget as HTMLButtonElement).style.background = UI.brandHover))}
              onMouseLeave={(e) => (((e.currentTarget as HTMLButtonElement).style.background = UI.brand))}
            >
              <Send className="w-5 h-5 text-white" />
              Send
            </button>
          </div>
        </section>
      </main>

      <style jsx global>{`
        body { background:#0b0c10; }
      `}</style>
    </>
  );
}
