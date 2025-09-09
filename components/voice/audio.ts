// components/voice/audio.ts
let audioUnlocked = false;
const sharedAudio: HTMLAudioElement | null =
  typeof window !== 'undefined' ? new Audio() : null;

/** Must be called from a click (e.g., Start Web Call) before first TTS. */
export async function unlockAudioOnce() {
  if (audioUnlocked || !sharedAudio) return;
  try {
    sharedAudio.muted = true;
    sharedAudio.src = 'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA'; // tiny header
    await sharedAudio.play().catch(() => {});
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
    sharedAudio.muted = false;
    audioUnlocked = true;
  } catch {}
}

/** Call your ElevenLabs route (the one you pasted). */
export async function ttsElevenLabs(text: string, voiceId: string) {
  const r = await fetch('/api/tts/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);

  if (!sharedAudio) {
    const a = new Audio(url);
    await a.play();
    a.onended = () => URL.revokeObjectURL(url);
    return;
  }
  sharedAudio.src = url;
  try {
    await sharedAudio.play();
  } catch {
    await unlockAudioOnce();
    await sharedAudio.play();
  }
  sharedAudio.onended = () => URL.revokeObjectURL(url);
}

/** Safe browser TTS fallback (force en-US if possible). */
export async function ttsFallback(text: string) {
  const s = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  const vs = s.getVoices();
  u.voice = vs.find(v => /en-US|US English/i.test(`${v.name} ${v.lang}`)) || vs[0];
  s.cancel();
  s.speak(u);
}

/** Unified speak */
export async function speak(text: string, provider: 'elevenlabs' | 'browser', voiceId: string) {
  try {
    if (provider === 'elevenlabs') {
      await ttsElevenLabs(text, voiceId);
      return;
    }
  } catch (e) {
    console.warn('TTS error, using fallback:', e);
  }
  await ttsFallback(text);
}

/** Simple SR wrapper */
export function makeRecognizer(onFinal: (t: string) => void) {
  const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';
  r.onresult = (e: any) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
    }
    if (final.trim()) onFinal(final.trim());
  };
  return r;
}
