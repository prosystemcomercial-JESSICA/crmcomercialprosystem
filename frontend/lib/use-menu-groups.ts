'use client';

import { useSyncExternalStore } from 'react';

// Estado desta aba: uma abertura/recarregamento começa com todos os grupos fechados.
// Menu lateral e Mais compartilham as escolhas apenas enquanto o CRM estiver aberto.
const initial: string[] = [];
let expanded: string[] = initial;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => expanded;
const serverSnapshot = () => initial;
function update(next: string[]) {
  expanded = next;
  listeners.forEach(listener => listener());
}

export function useMenuGroups() {
  const opened = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return {
    isClosed: (label: string) => !opened.includes(label),
    toggle: (label: string) => update(opened.includes(label) ? opened.filter(g => g !== label) : [...opened, label]),
    toggleAll: (labels: string[]) => update(labels.every(g => !opened.includes(g)) ? [...new Set([...opened, ...labels])] : opened.filter(g => !labels.includes(g))),
  };
}

// O caminho mais específico evita marcar /leads e /leads-sdr ao mesmo tempo.
export function activeMenuHref(pathname: string | null, hrefs: string[]) {
  return hrefs.filter(href => pathname === href || pathname?.startsWith(href + '/')).sort((a, b) => b.length - a.length)[0];
}
