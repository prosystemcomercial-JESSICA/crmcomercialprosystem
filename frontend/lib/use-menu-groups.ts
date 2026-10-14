'use client';

import { useEffect, useState } from 'react';

const KEY = 'ps_menu_closed_groups';
const EVENT = 'ps-menu-groups-change';
function readGroups(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch { return []; }
}

export function useMenuGroups() {
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setClosed(readGroups());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const save = (next: string[]) => {
    setClosed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch { /* O menu continua funcionando sem armazenamento. */ }
  };
  return {
    closed,
    toggle: (label: string) => save(closed.includes(label) ? closed.filter(g => g !== label) : [...closed, label]),
    toggleAll: (labels: string[]) => save(labels.every(g => closed.includes(g)) ? closed.filter(g => !labels.includes(g)) : [...new Set([...closed, ...labels])]),
  };
}

// O caminho mais específico evita marcar /leads e /leads-sdr ao mesmo tempo.
export function activeMenuHref(pathname: string | null, hrefs: string[]) {
  return hrefs.filter(href => pathname === href || pathname?.startsWith(href + '/')).sort((a, b) => b.length - a.length)[0];
}
