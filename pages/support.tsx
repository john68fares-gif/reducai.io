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
      <div className="w-full max-w-3xl mx-auto bg-white dark:bg-[#0d0f11] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow" />
          Riley Support
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 min-h-[360px] max-h-[60vh] overflow-y-auto flex flex-col gap-3 p-2">
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap break-words text-sm
                ${m.role === 'user'
                  ? 'bg-green-100 text-black dark:bg-emerald-900/30 dark:border dark:border-emerald-600/40 dark:text-emerald-100'
                  : 'bg-gray-100 text-black dark:bg-gray-800/50 dark:border dark:border-gray-700 dark:text-gray-100'}`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-lg max-w-[80%] text-sm bg-gray-100 text-black dark:bg-gray-800/50 dark:text-gray-100">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2 pt-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask Riley…"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0b0c10] text-black dark:text-white outline-none"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg border border-green-400 bg-green-100 text-black font-medium hover:bg-green-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-800/50 transition disabled:opacity-50"
          >
            Send
          </button>
        </div>

        {/* Note */}
        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          Riley will never reveal or summarize code, file contents, or paths. If asked, Riley will refuse.
        </div>
      </div>
    </ContentWrapper>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 items-center" aria-label="Riley is thinking">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-200 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-200 animate-bounce [animation-delay:120ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-200 animate-bounce [animation-delay:240ms]" />
    </span>
  );
}
