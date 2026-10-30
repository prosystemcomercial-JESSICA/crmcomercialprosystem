'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export const THEME_COLORS = ['azul', 'laranja', 'verde', 'champagne', 'gelo', 'azul-intenso'] as const;
export type ThemeColor = typeof THEME_COLORS[number];
export type ThemeMode = 'claro' | 'escuro';

interface ThemeContextValue {
  color: ThemeColor;
  /** Modo em uso agora (no automático, o que o Windows/celular está usando). */
  mode: ThemeMode;
  /** true = segue o modo do sistema (padrão de quem nunca escolheu Claro ou Escuro). */
  automatico: boolean;
  setColor: (c: ThemeColor) => void;
  setMode: (m: ThemeMode) => void;
  usarAutomatico: () => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  color: 'azul',
  mode: 'claro',
  automatico: true,
  setColor: () => {},
  setMode: () => {},
  usarAutomatico: () => {},
  toggleMode: () => {},
});

const SISTEMA_ESCURO = '(prefers-color-scheme: dark)';
const modoDoSistema = (): ThemeMode => window.matchMedia?.(SISTEMA_ESCURO).matches ? 'escuro' : 'claro';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [color, setColorState] = useState<ThemeColor>('azul');
  const [mode, setModeState] = useState<ThemeMode>('claro');
  const [automatico, setAutomatico] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedColor = localStorage.getItem('ps-theme-color');
    const savedColor = THEME_COLORS.includes(storedColor as ThemeColor) ? storedColor as ThemeColor : 'azul';
    // Sem escolha salva (ps-theme-mode vazio), segue o modo do sistema.
    const storedMode = localStorage.getItem('ps-theme-mode');
    const auto = storedMode !== 'claro' && storedMode !== 'escuro';
    const savedMode: ThemeMode = auto ? modoDoSistema() : storedMode as ThemeMode;
    setColorState(savedColor);
    setModeState(savedMode);
    setAutomatico(auto);
    applyTheme(savedColor, savedMode);
    setMounted(true);
  }, []);

  // No automático, acompanha a troca do sistema na hora (ex.: Windows muda para escuro à noite).
  useEffect(() => {
    if (!automatico || !window.matchMedia) return;
    const mq = window.matchMedia(SISTEMA_ESCURO);
    const mudou = () => { const m = modoDoSistema(); setModeState(m); applyTheme(color, m); };
    mq.addEventListener('change', mudou);
    return () => mq.removeEventListener('change', mudou);
  }, [automatico, color]);

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
    setAutomatico(false);
    localStorage.setItem('ps-theme-mode', m);
    applyTheme(color, m);
  };

  const usarAutomatico = () => {
    const m = modoDoSistema();
    localStorage.removeItem('ps-theme-mode');
    setAutomatico(true);
    setModeState(m);
    applyTheme(color, m);
  };

  const toggleMode = () => setMode(mode === 'claro' ? 'escuro' : 'claro');

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ color, mode, automatico, setColor, setMode, usarAutomatico, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
