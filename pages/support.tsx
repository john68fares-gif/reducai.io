'use client';

import React, { useEffect, useRef, useState } from 'react';
import ContentWrapper from '@/components/layout/ContentWrapper';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const sanitize = (text: string) =>
  text.replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: crypto.randomUUID(), role: 'assistant', text: "Hi, I’m Riley. How can I help you today?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const value = input.trim();
    if (!value || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', text: value };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await fetch('/api/support/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value }),
      });
      const data = await r.json();
      const botText = (data?.ok && typeof data?.message === 'string')
        ? data.message
        : 'Sorry, I can’t comply with that request.';

      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: sanitize(botText) }]);
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send();
  };

  return (
    <ContentWrapper>
      <div
        className="w-full max-w-[920px] mx-auto rounded-2xl flex flex-col gap-3 p-4"
        style={{
          background: 'var(--panel)',
          border: '1px dashed var(--brand-weak)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* header */}
        <div className="flex items-center gap-3 text-lg font-medium" style={{ color: 'var(--text)' }}>
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: 'var(--brand)', boxShadow: `0 0 12px var(--brand)` }}
          />
          Riley Support
        </div>

        {/* messages */}
        <div
          ref={listRef}
          className="flex-1 min-h-[360px] max-h-[60vh] overflow-y-auto p-2 flex flex-col gap-2"
        >
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className="px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap break-words text-sm"
                style={{
                  background:
                    m.role === 'user'
                      ? 'var(--brand-weak)'
                      : 'var(--card)',
                  border: `1px solid var(--border)`,
                  color: 'var(--text)',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className="px-3 py-2 rounded-lg max-w-[80%] text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* input */}
        <div className="flex gap-2 pt-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask Riley…"
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg font-medium"
            style={{
              background: 'var(--brand)',
              color: '#fff',
              opacity: loading || !input.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </div>

        <div className="text-xs text-center pt-1" style={{ color: 'var(--text-muted)' }}>
          Riley will never reveal or summarize code, file contents, or paths. If asked, Riley will refuse.
        </div>
      </div>
    </ContentWrapper>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)' }} />
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '120ms' }} />
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '240ms' }} />
    </span>
  );
}
