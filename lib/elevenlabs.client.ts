// lib/elevenlabs.client.ts
// Import this once on the client (e.g., in pages/_app.tsx: `import '@/lib/elevenlabs.client'`)
'use client';

/**
 * Minimal ElevenLabs integration for your VoiceAgentSection.
 * - Listen to "voiceagent:import-11labs" -> ask for API key (once), fetch voices, let user pick one
 * - Expose window.elevenlabsSpeak(text, voiceId) used by your UI to speak with ElevenLabs
 * - Fallback to Web Speech TTS if no API key
 *
 * How to use:
 * 1) In your browser console (or code), set your API key (once):   window.setElevenLabsApiKey('ELEVEN_API_KEY')
 *    - Or just click your existing "Import from ElevenLabs" button; it will prompt you.
 * 2) Click "Import from ElevenLabs" in the UI -> pick a voice -> we remember the selected voiceId.
 * 3) Your UI calls window.elevenlabsSpeak(text, config.voice.voiceId). We override with your chosen one if present.
 */

type ELVoice = {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
};

const LS_KEY = {
  apiKey: 'va:11labs:key',
  voiceId: 'va:11labs:selectedVoiceId',
  voiceName: 'va:11labs:selectedVoiceName',
};

function getKey(): string | null {
  try { return localStorage.getItem(LS_KEY.apiKey); } catch { return null; }
}
function setKey(k: string) {
  try { localStorage.setItem(LS_KEY.apiKey, k); } catch {}
}
function setSelectedVoice(voiceId: string, name?: string) {
  try {
    localStorage.setItem(LS_KEY.voiceId, voiceId);
    if (name) localStorage.setItem(LS_KEY.voiceName, name);
  } catch {}
}
function getSelectedVoice(): { id?: string; name?: string } {
  try {
    return { id: localStorage.getItem(LS_KEY.voiceId) || undefined, name: localStorage.getItem(LS_KEY.voiceName) || undefined };
  } catch { return {}; }
}

async function fetchVoices(apiKey: string): Promise<ELVoice[]> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`ElevenLabs /voices failed: ${res.status}`);
  const data = await res.json();
  // API returns { voices: [...] }
  return Array.isArray(data?.voices) ? data.voices as ELVoice[] : [];
}

/**
 * Speak with ElevenLabs (REST streaming) or fallback to browser TTS.
 * We *prefer* a user-selected override voiceId from localStorage if present.
 */
async function elevenlabsSpeak(text: string, voiceId?: string) {
  const key = getKey();
  const override = getSelectedVoice().id;
  const finalVoice = override || voiceId; // local override takes precedence

  if (!key || !finalVoice) {
    // Fallback to Web Speech
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1; u.volume = 1;
    synth.cancel(); synth.speak(u);
    return;
  }

  // Low-latency REST "stream" endpoint -> returns audio bytes immediately
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(finalVoice)}/stream`;

  // NOTE: You can change model_id to the exact one you prefer from your ElevenLabs plan.
  const body = {
    text,
    model_id: 'eleven_multilingual_v2', // common default; choose what you own
    voice_settings: { stability: 0.4, similarity_boost: 0.7 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.warn('ElevenLabs speak error:', res.status, await safeText(res));
    // fallback
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    synth.cancel(); synth.speak(u);
    return;
  }

  // Play the MP3 from the streamed bytes
  const arrayBuffer = await res.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
  const urlObj = URL.createObjectURL(blob);
  try {
    const audio = new Audio();
    audio.src = urlObj;
    await audio.play();
  } finally {
    // Revoke a bit later to avoid interfering with playback on some browsers
    setTimeout(() => URL.revokeObjectURL(urlObj), 15000);
  }
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ''; }
}

/* --------------------- Global hooks & helpers --------------------- */

// Let your app set/store the API key once
;(window as any).setElevenLabsApiKey = function setElevenLabsApiKeyPublic(key: string) {
  setKey(key);
  console.info('ElevenLabs API key saved.');
};

// Let your app override the voiceId easily
;(window as any).setElevenLabsVoice = function setElevenLabsVoicePublic(voiceId: string, name?: string) {
  setSelectedVoice(voiceId, name);
  console.info('ElevenLabs voice set:', voiceId, name || '');
};

// The function your VoiceAgentSection already tries to call
;(window as any).elevenlabsSpeak = async function elevenlabsSpeakPublic(text: string, voiceId?: string) {
  try { await elevenlabsSpeak(text, voiceId); }
  catch (e) { console.warn('elevenlabsSpeak failed:', e); }
};

// Also fire an event for folks who prefer listening instead of calling a global
window.addEventListener('elevenlabs:tts', (e: Event) => {
  const detail = (e as CustomEvent).detail || {};
  elevenlabsSpeak(String(detail.text || ''), String(detail.voiceId || undefined));
});

/**
 * Wire up your existing "Import from ElevenLabs" button.
 * Your component dispatches:  window.dispatchEvent(new CustomEvent('voiceagent:import-11labs'))
 * We listen here, gather the API key, fetch the voices, and let the user pick one.
 */
window.addEventListener('voiceagent:import-11labs', async () => {
  try {
    let key = getKey();
    if (!key) {
      key = prompt('Enter your ElevenLabs API Key (saved locally in this browser):') || '';
      if (!key) return;
      setKey(key);
    }

    const voices = await fetchVoices(key);
    if (!voices.length) { alert('No voices found on this ElevenLabs account.'); return; }

    // Make a quick pick list using prompt() for simplicity.
    // (Replace with your own modal/picker if you want.)
    const list = voices.slice(0, 25).map(v => `${v.name}  —  ${v.voice_id}`).join('\n');
    const chosen = prompt(
      'Pick a voice. Copy a voice_id from the list below and paste it here:\n\n' + list + '\n\nvoice_id:'
    );
    if (!chosen) return;

    const picked = voices.find(v => v.voice_id === chosen.trim());
    setSelectedVoice(chosen.trim(), picked?.name || undefined);

    alert(`Selected ElevenLabs voice: ${picked?.name || chosen}`);
  } catch (err:any) {
    console.error(err);
    alert('Failed to import voices from ElevenLabs. Check the console and your API key.');
  }
});

/* --------------------- (Optional) Realtime WS Starter --------------------- */
/**
 * If you want ultra-low-latency streaming, use ElevenLabs Realtime API (WebSocket).
 * This is a stub you can extend. It’s OPTIONAL and not used by the rest of this file.
 *
 * Example usage (advanced):
 *   const close = await openRealtime(VOICE_ID);
 *   close(); // when you want to end
 */
// async function openRealtime(voiceId: string) {
//   const key = getKey();
//   if (!key) throw new Error('No API key set');
//   const url = `wss://api.elevenlabs.io/v1/real-time/ws?voice_id=${encodeURIComponent(voiceId)}&model_id=eleven_turbo_v2`;
//   const ws = new WebSocket(url, [], { headers: { 'xi-api-key': key } as any });
//   ws.onopen = () => console.log('EL realtime connected');
//   ws.onmessage = (ev) => { /* receive audio chunks + play via AudioWorklet/WebAudio */ };
//   ws.onerror = (e) => console.warn('EL realtime error', e);
//   ws.onclose = () => console.log('EL realtime closed');
//   return () => ws.close();
// }
