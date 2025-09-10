// utils/settings.ts
type Settings = {
  openaiKey: string;
  phoneE164: string;
};

const KEY = 'settings:v1';

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { openaiKey: '', phoneE164: '' };
    const j = JSON.parse(raw);
    return {
      openaiKey: j.openaiKey || '',
      phoneE164: j.phoneE164 || '',
    };
  } catch {
    return { openaiKey: '', phoneE164: '' };
  }
}

function write(next: Partial<Settings>) {
  const cur = read();
  const merged = { ...cur, ...next };
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('settings:changed', { detail: merged }));
}

export function setOpenAIKey(k: string) { write({ openaiKey: k }); }
export function setPhoneE164(p: string) { write({ phoneE164: p }); }

export function getSettings(): Settings { return read(); }

/** React hook (client) */
import { useEffect, useState } from 'react';
export function useSettings(): Settings {
  const [s, setS] = useState<Settings>({ openaiKey: '', phoneE164: '' });
  useEffect(() => {
    setS(read());
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as Settings | undefined;
      if (d) setS(d);
      else setS(read());
    };
    window.addEventListener('settings:changed', on as EventListener);
    window.addEventListener('storage', () => setS(read()));
    return () => {
      window.removeEventListener('settings:changed', on as EventListener);
      window.removeEventListener('storage', () => setS(read()));
    };
  }, []);
  return s;
}
