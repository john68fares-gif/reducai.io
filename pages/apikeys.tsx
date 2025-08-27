'use client';

import { useEffect, useState } from 'react';
import { Key, Save, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { loadKeys, saveKeys, seedVoiceSettingsFromKeys, type StoredKeys } from '@/utils/apiKeys';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<StoredKeys>({
    openaiKey: '',
    vapiPublicKey: '',
    vapiAssistantId: '',
    twilioSid: '',
    twilioAuth: '',
  });

  const [show, setShow] = useState({
    openai: false,
    vapi: false,
    twilio: false,
  });

  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const k = loadKeys();
    setKeys((prev) => ({ ...prev, ...k }));
  }, []);

  function onSave() {
    saveKeys(keys);
    seedVoiceSettingsFromKeys(keys); // prefill /voice-agent widget fields
    setMsg('Saved locally. (Client-side only)');
    setTimeout(() => setMsg(null), 2500);
  }

  const labelStyle = 'mb-1 block text-xs text-white/70';
  const inputStyle =
    'input h-[42px] text-sm'; // uses your .input class from globals.css
  const cardStyle: React.CSSProperties = {
    background: 'rgba(16,19,20,0.92)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 16,
    boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: '#00ffc2', boxShadow: '0 0 14px rgba(0,255,194,0.45)' }}
          >
            <Key className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">API Keys</h1>
            <div className="text-white/70 text-sm">Stored in your browser (localStorage).</div>
          </div>
        </div>

        <button
          onClick={onSave}
          className="inline-flex items-center gap-2 px-4 h-[42px] rounded-[14px] font-semibold"
          style={{ background: '#59d9b3', color: 'white', boxShadow: '0 1px 0 rgba(0,0,0,0.18)' }}
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OpenAI */}
        <div style={cardStyle} className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#6af7d1]" />
            <div className="font-semibold">OpenAI</div>
          </div>
          <label className={labelStyle}>OpenAI API Key</label>
          <div className="relative">
            <input
              className={inputStyle}
              type={show.openai ? 'text' : 'password'}
              placeholder="sk-..."
              value={keys.openaiKey || ''}
              onChange={(e) => setKeys({ ...keys, openaiKey: e.target.value })}
            />
            <button
              type="button"
              aria-label="toggle"
              onClick={() => setShow((s) => ({ ...s, openai: !s.openai }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10"
            >
              {show.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Vapi */}
        <div style={cardStyle} className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#6af7d1]" />
            <div className="font-semibold">Vapi</div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelStyle}>Public Key</label>
              <div className="relative">
                <input
                  className={inputStyle}
                  type={show.vapi ? 'text' : 'password'}
                  placeholder="public key…"
                  value={keys.vapiPublicKey || ''}
                  onChange={(e) => setKeys({ ...keys, vapiPublicKey: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="toggle"
                  onClick={() => setShow((s) => ({ ...s, vapi: !s.vapi }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10"
                >
                  {show.vapi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelStyle}>Assistant ID</label>
              <input
                className={inputStyle}
                placeholder="assistant id…"
                value={keys.vapiAssistantId || ''}
                onChange={(e) => setKeys({ ...keys, vapiAssistantId: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Twilio (optional) */}
        <div style={cardStyle} className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#6af7d1]" />
            <div className="font-semibold">Twilio (optional)</div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelStyle}>Account SID</label>
              <input
                className={inputStyle}
                placeholder="ACxxxxxxxx"
                value={keys.twilioSid || ''}
                onChange={(e) => setKeys({ ...keys, twilioSid: e.target.value })}
              />
            </div>
            <div>
              <label className={labelStyle}>Auth Token</label>
              <div className="relative">
                <input
                  className={inputStyle}
                  type={show.twilio ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={keys.twilioAuth || ''}
                  onChange={(e) => setKeys({ ...keys, twilioAuth: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="toggle"
                  onClick={() => setShow((s) => ({ ...s, twilio: !s.twilio }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10"
                >
                  {show.twilio ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-white/60 mt-3">
            For phone features only. These stay in your browser unless you explicitly send them to an API.
          </p>
        </div>
      </div>

      {msg && (
        <div
          className="mt-6 rounded-[14px] px-4 py-3 text-sm"
          style={{
            background: 'rgba(16,19,20,0.92)',
            border: '1px solid rgba(0,255,194,0.35)',
            boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
