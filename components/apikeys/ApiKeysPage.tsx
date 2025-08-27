'use client';

import React, { useEffect, useState } from 'react';

type ApiKey = {
  id: string;
  name: string;   // project name
  short: string;  // first 4 chars for preview
  key: string;    // full key (kept in localStorage only)
};

const STORAGE_KEY = 'apiKeys';

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [projectName, setProjectName] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');

  // Load on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setApiKeys(saved);
    } catch {}
  }, []);

  const persist = (next: ApiKey[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setApiKeys(next);
  };

  const addKey = () => {
    const name = projectName.trim();
    const value = apiKeyValue.trim();
    if (!name || !value) return;

    const next: ApiKey[] = [
      ...apiKeys,
      {
        id: Date.now().toString(),
        name,
        short: value.slice(0, 4),
        key: value,
      },
    ];
    persist(next);
    setProjectName('');
    setApiKeyValue('');
  };

  const removeKey = (id: string) => {
    persist(apiKeys.filter(k => k.id !== id));
  };

  const copyKey = async (full: string) => {
    try {
      await navigator.clipboard.writeText(full);
      // quick UX ping — optional
      alert('API key copied to clipboard');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white px-6 py-10 md:pl-[260px]">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-[#00ffc2] drop-shadow-[0_0_10px_#00ffc2]">
          API Keys
        </h1>
        <p className="text-white/70 mb-8">
          Manage your OpenAI API keys for different projects. Keys are stored in your browser (localStorage).
        </p>

        {/* List */}
        <div className="bg-[#0d0f11] border border-[#00ffc240] rounded-2xl shadow-[0_0_20px_#00ffc230] p-6">
          {apiKeys.length === 0 ? (
            <p className="text-center text-white/60">No API keys saved yet.</p>
          ) : (
            <ul className="space-y-3">
              {apiKeys.map(k => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 bg-[#14171b] border border-[#00ffc220] rounded-xl p-3"
                >
                  <div className="truncate">
                    <div className="font-semibold">{k.name}</div>
                    <div className="text-sm text-white/60">({k.short}***)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyKey(k.key)}
                      className="px-3 py-1.5 rounded-lg bg-[#00ffc2] text-black text-sm font-semibold shadow-[0_0_10px_#00ffc2] hover:shadow-[0_0_18px_#00ffc2]"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => removeKey(k.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add Form */}
        <div className="mt-6 bg-[#0d0f11] border border-[#00ffc240] rounded-2xl shadow-[0_0_15px_#00ffc230] p-6">
          <h3 className="text-lg mb-3 text-[#00ffc2]">Add New Project API Key</h3>
          <input
            type="text"
            placeholder="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full mb-3 p-2 rounded-lg bg-[#0a0a0a] border border-[#333] text-white"
          />
          <input
            type="password"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
            className="w-full mb-4 p-2 rounded-lg bg-[#0a0a0a] border border-[#333] text-white"
          />
          <button
            onClick={addKey}
            className="w-full bg-[#00ffc2] text-black font-semibold py-2 rounded-lg shadow-[0_0_10px_#00ffc2] hover:shadow-[0_0_20px_#00ffc2]"
          >
            Save API Key
          </button>
        </div>
      </div>
    </div>
  );
}
