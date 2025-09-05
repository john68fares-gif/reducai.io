'use client';

import React, { useEffect, useState } from 'react';

type ApiKey = {
  id: string;
  name: string;
  short: string;
  key: string;
};

const STORAGE_KEY = 'apiKeys';

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [projectName, setProjectName] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');

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
      { id: Date.now().toString(), name, short: value.slice(0, 4), key: value },
    ];
    persist(next);
    setProjectName('');
    setApiKeyValue('');
  };

  const removeKey = (id: string) => {
    persist(apiKeys.filter((k) => k.id !== id));
  };

  const copyKey = async (full: string) => {
    try {
      await navigator.clipboard.writeText(full);
      alert('API key copied to clipboard');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-white text-black dark:bg-[#0b0c10] dark:text-white px-6 py-10 md:pl-[260px]">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">API Keys</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Manage your OpenAI API keys for different projects. Keys are stored
          in your browser (localStorage).
        </p>

        {/* List */}
        <div className="bg-white dark:bg-[#0d0f11] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
          {apiKeys.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">
              No API keys saved yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {apiKeys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-[#14171b] border border-gray-200 dark:border-gray-700 rounded-xl p-3"
                >
                  <div className="truncate">
                    <div className="font-semibold">{k.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      ({k.short}***)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyKey(k.key)}
                      className="px-3 py-1.5 rounded-lg bg-green-400 text-black text-sm font-semibold hover:bg-green-300 transition"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => removeKey(k.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-sm hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30 transition"
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
        <div className="mt-6 bg-white dark:bg-[#0d0f11] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg mb-3 font-semibold">Add New Project API Key</h3>
          <input
            type="text"
            placeholder="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full mb-3 p-2 rounded-lg bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-700 text-black dark:text-white outline-none"
          />
          <input
            type="password"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
            className="w-full mb-4 p-2 rounded-lg bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-700 text-black dark:text-white outline-none"
          />
          <button
            onClick={addKey}
            className="w-full bg-green-400 text-black font-semibold py-2 rounded-lg hover:bg-green-300 transition"
          >
            Save API Key
          </button>
        </div>
      </div>
    </div>
  );
}
