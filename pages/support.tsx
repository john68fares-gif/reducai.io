'use client';

import React, { useEffect, useRef, useState } from 'react';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const sanitize = (text: string) =>
  text.replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: "Hi, I’m Riley. How can I help you today?",
    },
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

      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: sanitize(botText),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send();
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <div className="w-3 h-3 rounded-full bg-[#00ffc2] shadow-[0_0_8px_#00ffc2]" />
        Riley Support
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto rounded-xl border border-white/10 p-4 bg-black/20">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`px-3 py-2 rounded-lg max-w-[80%] ${
                m.role === 'user'
                  ? 'bg-[#00ffc233] border border-[#00ffc244] text-white'
                  : 'bg-white/10 border border-white/20 text-white'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask Riley…"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-[#00ffc2] text-black font-semibold disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="w-2 h-2 rounded-full bg-white/80 animate-bounce" />
      <span className="w-2 h-2 rounded-full bg-white/80 animate-bounce delay-150" />
      <span className="w-2 h-2 rounded-full bg-white/80 animate-bounce delay-300" />
    </span>
  );
}
