// components/builder/Step2ModelSettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

type Props = {
  onNext: (data: {
    name: string;
    industry: string;
    language: string;
    model: string;
    temperature: number;
    apiKeyId: string;
  }) => void;
  onBack: () => void;
};

export default function Step2ModelSettings({ onNext, onBack }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [language, setLanguage] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.7);
  const [apiKeyId, setApiKeyId] = useState('');
  const [keys, setKeys] = useState<{ id: string; name: string }[]>([]);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('apiKeys.v1');
    if (stored) {
      try {
        setKeys(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    setValid(
      name.trim() !== '' &&
        industry.trim() !== '' &&
        language.trim() !== '' &&
        apiKeyId.trim() !== ''
    );
  }, [name, industry, language, apiKeyId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0c10]">
      <div className="w-full max-w-2xl bg-[#0d0f11] border border-[#00ffc220] rounded-2xl p-8 space-y-6">
        <h2 className="text-2xl font-bold text-white text-center">Step 2: Model Settings</h2>
        <p className="text-gray-400 text-center mb-6">Define your AI agent’s identity and configuration</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">AI Name</label>
            <input
              className="w-full bg-[#0b0c10] border border-[#00ffc2] rounded-lg px-3 py-2 text-white focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Industry</label>
            <input
              className="w-full bg-[#0b0c10] border border-[#00ffc2] rounded-lg px-3 py-2 text-white focus:outline-none"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Language</label>
          <input
            className="w-full bg-[#0b0c10] border border-[#00ffc2] rounded-lg px-3 py-2 text-white focus:outline-none"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Model</label>
          <select
            className="w-full bg-[#0b0c10] border border-[#00ffc2] rounded-lg px-3 py-2 text-white focus:outline-none"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o mini</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Temperature</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-[#00ffc2]"
          />
          <div className="text-sm text-gray-400 mt-1">Creativity: {temperature}</div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">API Key</label>
          <select
            className="w-full bg-[#0b0c10] border border-[#00ffc2] rounded-lg px-3 py-2 text-white focus:outline-none"
            value={apiKeyId}
            onChange={(e) => setApiKeyId(e.target.value)}
          >
            <option value="">Select a saved key</option>
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b0c10] border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            disabled={!valid}
            onClick={() => onNext({ name, industry, language, model, temperature, apiKeyId })}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition ${
              valid
                ? 'bg-[#00ffc2] text-black hover:bg-[#00e6b0]'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Next <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
