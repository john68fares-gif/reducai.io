'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void; };

const ThemeCtx = createContext<Ctx>({ theme: 'dark', setTheme: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  // Load initial
  useEffect(() => {
    const saved = (localStorage.getItem('ui:theme') as Theme) || null;
    if (saved) {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
      return;
    }
    // fallback: prefer-color-scheme
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initial: Theme = prefersDark ? 'dark' : 'light';
    setThemeState(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('ui:theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
