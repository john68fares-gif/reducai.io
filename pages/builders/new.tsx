'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewBuilder() {
  const router = useRouter();
  const [kind, setKind] = useState<'text'|'voice'>('voice');
  const [name, setName] = useState('');

  function create() {
    const id = 'bot_' + Math.random().toString(36).slice(2,9);
    const bot = { id, name, language:'en-US', prompt:'', rawNotes:'' };
    try {
      const raw = localStorage.getItem('chatbots');
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(bot);
      localStorage.setItem('chatbots', JSON.stringify(arr));
    } catch {}
    router.push(`/builders/${id}?kind=${kind}`);
  }

  return (
    <main className="p-6 max-w-xl mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-4">Create Build</h1>
      <label className="text-sm text-white/70">Type
        <select className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg h-10 px-3" value={kind} onChange={e=>setKind(e.target.value as any)}>
          <option value="voice">Voice Agent</option>
          <option value="text">Text Bot</option>
        </select>
      </label>
      <label className="text-sm text-white/70 block mt-3">Name
        <input className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg h-10 px-3" value={name} onChange={e=>setName(e.target.value)} placeholder="Brand or Business"/>
      </label>
      <button onClick={create} className="mt-4 bg-emerald-500 rounded-lg px-4 py-2">Create</button>
    </main>
  );
}
