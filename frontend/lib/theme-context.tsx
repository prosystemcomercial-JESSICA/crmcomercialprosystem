'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeColor = 'azul' | 'laranja' | 'verde';
export type ThemeMode = 'claro' | 'escuro';

interface ThemeContextValue {
  color: ThemeColor;
  mode: ThemeMode;
  setColor: (c: ThemeColor) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  color: 'azul',
  mode: 'claro',
  setColor: () => {},
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [color, setColorState] = useState<ThemeColor>('azul');
  const [mode, setModeState] = useState<ThemeMode>('claro');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedColor = (localStorage.getItem('ps-theme-color') as ThemeColor) || 'azul';
    const savedMode = (localStorage.getItem('ps-theme-mode') as ThemeMode) || 'claro';
    setColorState(savedColor);
    setModeState(savedMode);
    applyTheme(savedColor, savedMode);
    setMounted(true);
  }, []);

  const applyTheme = (c: ThemeColor, m: ThemeMode) => {
    const html = document.documentElement;
    html.setAttribute('data-theme', c);
    if (m === 'escuro') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  const setColor = (c: ThemeColor) => {
    setColorState(c);
    localStorage.setItem('ps-theme-color', c);
    applyTheme(c, mode);
  };

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('ps-theme-mode', m);
    applyTheme(color, m);
  };

  const toggleMode = () => setMode(mode === 'claro' ? 'escuro' : 'claro');

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ color, mode, setColor, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
