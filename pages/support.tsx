// pages/support.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, CornerDownLeft } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
type AskResponse = { reply?: string; citations?: string[]; error?: string };

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "Hi — I'm Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?"
    }
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setText('');
    setMessages(m => [...m, { role: 'user', content }]);
    setBusy(true);

    try {
      const r = await fetch('/api/support/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: content })
      });

      let reply = '';
      let citations: string[] = [];

      // Prefer JSON; fall back to text so real errors show up in-chat
      try {
        const j: AskResponse = await r.json();
        reply = j?.reply || j?.error || '';
        citations = Array.isArray(j?.citations) ? j.citations : [];
      } catch {
        const txt = await r.text().catch(() => '');
        reply = `Server returned non-JSON (${r.status}). ${txt.slice(0, 200) || 'No details.'}`;
      }

      if (!reply) reply = r.ok ? 'No answer.' : `Server error (${r.status}).`;

      const suffix = citations.length ? `\n\nSources: ${citations.join(', ')}` : '';
      setMessages(m => [...m, { role: 'assistant', content: reply + suffix }]);
    } catch (e: any) {
      setMessages(m => [
        ...m,
        { role: 'assistant', content: `Network error. ${String(e).slice(0, 120)}` }
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
    setMessages([
      {
        role: 'assistant',
        content:
          "Hi — I'm Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?"
      }
    ]);
  }

  return (
    <main className="px-6 py-10" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-[#6af7d1]" /> Support
        </h1>
        <button
          onClick={clearChat}
          className="text-xs px-3 py-1 rounded-lg border border-white/10 bg-black/30 text-white/80"
          title="Clear conversation"
        >
          Clear
        </button>
      </div>

      <div
        ref={boxRef}
        className="h-[480px] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 space-y-2"
      >
        {messages.map((m, i) => (
          <div key={i} className="flex">
            <div
              className={`max-w-[86%] whitespace-pre-wrap text-sm px-3 py-2 rounded-lg ${
                m.role === 'user'
                  ? 'bg-[#0f4136] text-[#d9fff5]'
                  : 'bg-[#0f1314] text-white/90 border border-white/10'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 p-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your question…"
          className="flex-1 h-[44px] rounded-[12px] border border-white/20 bg-black/40 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
        <button
          onClick={send}
          disabled={busy}
          className="inline-flex items-center gap-2 h-[44px] px-4 rounded-[12px]"
          style={{ background: '#59d9b3', color: '#0b0c10', opacity: busy ? 0.7 : 1 }}
          title={busy ? 'Sending…' : 'Send'}
        >
          <CornerDownLeft className="w-4 h-4" /> Send
        </button>
      </div>
    </main>
  );
}
