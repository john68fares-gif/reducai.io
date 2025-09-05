'use client';

import React, { useState } from 'react';
import { Home, Hammer, Bot, Rocket } from 'lucide-react';

type Props = {
  onNext: () => void;
};

export default function Step1AIType({ onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const cards = [
    {
      id: 'sales',
      title: 'Sales AI',
      desc: 'Convert visitors into customers with persuasive conversations.',
      icon: <Rocket className="w-6 h-6" style={{ color: 'var(--brand)' }} />,
    },
    {
      id: 'support',
      title: 'Support AI',
      desc: 'Answer FAQs, handle issues, and provide 24/7 assistance.',
      icon: <Hammer className="w-6 h-6" style={{ color: 'var(--brand)' }} />,
    },
    {
      id: 'blank',
      title: 'Start Blank',
      desc: 'Fully custom AI agent without predefined flow.',
      icon: <Bot className="w-6 h-6" style={{ color: 'var(--brand)' }} />,
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen px-6">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>
        Choose Your AI Type
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className="rounded-xl p-6 text-left transition transform active:scale-[0.98]"
            style={{
              background: 'var(--card)',
              border: `1px solid ${
                selected === c.id ? 'var(--brand)' : 'var(--border)'
              }`,
              boxShadow:
                selected === c.id ? '0 0 12px var(--ring)' : 'var(--shadow-card)',
              color: 'var(--text)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              {c.icon}
              <span className="text-lg font-semibold">{c.title}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {c.desc}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <button
          disabled={!selected}
          onClick={onNext}
          className="px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--brand)',
            color: '#fff',
            boxShadow: '0 0 10px var(--ring)',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
