'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export const THEME_COLORS = ['azul', 'laranja', 'verde', 'champagne', 'gelo'] as const;
export type ThemeColor = typeof THEME_COLORS[number];
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
    const storedColor = localStorage.getItem('ps-theme-color');
    const savedColor = THEME_COLORS.includes(storedColor as ThemeColor) ? storedColor as ThemeColor : 'azul';
    const savedMode: ThemeMode = localStorage.getItem('ps-theme-mode') === 'escuro' ? 'escuro' : 'claro';
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
