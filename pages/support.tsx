// pages/support.tsx — ONLY chat box visuals updated to match the screenshot
'use client';

import React, { useEffect, useRef, useState } from 'react';
import ContentWrapper from '@/components/layout/ContentWrapper';
import { Send, MessageSquareText } from 'lucide-react';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const sanitize = (text: string) =>
  text.replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: crypto.randomUUID(), role: 'assistant', text: 'Hi, please provide a detailed description of your issue' },
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
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await fetch('/api/support/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value }),
      });
      const data = await r.json();
      const botText =
        data?.ok && typeof data?.message === 'string'
          ? data.message
          : 'Sorry, I can’t comply with that request.';

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: sanitize(botText) },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send();
  };

  return (
    <ContentWrapper>
      {/* Centered “Demo” chat panel like the screenshot */}
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[980px] px-4">
          {/* Header row (Demo) */}
          <div className="flex items-center justify-start py-4">
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Demo</h2>
          </div>

          {/* Chat card */}
          <div
            className="support-chat mx-auto rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(10,13,14,.94) 0%, rgba(9,12,13,.94) 100%)',
              border: '1px solid rgba(0,255,194,.10)',
              boxShadow:
                '0 18px 60px rgba(0,0,0,.45), 0 2px 10px rgba(0,0,0,.35), 0 0 0 1px rgba(0,255,194,.04)',
              maxWidth: 860,
            }}
          >
            {/* Inner container (same padding/spacing as reference) */}
            <div className="p-4 sm:p-6">
              {/* Messages area */}
              <div
                ref={listRef}
                className="min-h-[420px] max-h-[60vh] overflow-y-auto"
              >
                {/* First assistant bubble shows a tiny icon + compact bubble like the screenshot */}
                {messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`mb-3 ${isUser ? 'flex justify-end' : 'flex items-start gap-2'}`}
                    >
                      {!isUser && (
                        <div
                          className="mt-0.5 w-7 h-7 rounded-full grid place-items-center shrink-0"
                          style={{
                            background: 'rgba(0,255,194,0.08)',
                            border: '1px solid rgba(0,255,194,0.14)',
                          }}
                        >
                          <MessageSquareText className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                        </div>
                      )}
                      <div
                        className="px-3 py-2 rounded-lg max-w-[80%] text-sm whitespace-pre-wrap break-words"
                        style={{
                          background: isUser ? 'rgba(0,255,194,0.10)' : 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'var(--text)',
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-0.5 w-7 h-7 rounded-full grid place-items-center shrink-0"
                      style={{
                        background: 'rgba(0,255,194,0.08)',
                        border: '1px solid rgba(0,255,194,0.14)',
                      }}
                    >
                      <MessageSquareText className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div
                      className="px-3 py-2 rounded-lg max-w-[80%] text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text)',
                      }}
                    >
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar pinned to the card bottom, pill style */}
              <div className="pt-4">
                <div
                  className="flex items-center gap-2 rounded-full pl-4 pr-2 h-[46px] border"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Type your message..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--text)' }}
                  />
                  <button
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="w-9 h-9 rounded-full grid place-items-center disabled:opacity-50"
                    style={{
                      background: 'rgba(0,255,194,0.14)',
                      border: '1px solid rgba(0,255,194,0.22)',
                    }}
                    aria-label="Send"
                  >
                    <Send className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* (Optional) small helper text below the card */}
          <div className="text-[11px] text-center opacity-70 mt-3" style={{ color: 'var(--text-muted)' }}>
            Riley will never reveal or summarize code, file contents, or paths. If asked, Riley will refuse.
          </div>
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
