'use client';

// Casca de app de iPhone para o CRM no celular (só abaixo de 768px; no computador nada muda).
// Segue o guia de interface da Apple: barra de abas embaixo (5 seções), material translúcido,
// alvos de toque de 44pt, área segura (notch / barra de início) e folha "Mais" com lista
// agrupada (estilo Ajustes). Títulos grandes de cada tela entram nas próximas etapas.

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { activeMenuHref, useMenuGroups } from '@/lib/use-menu-groups';
import { MessageSquare, GitMerge, ClipboardList, LayoutDashboard, MoreHorizontal, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, X, BarChart3, TrendingUp } from 'lucide-react';

export type ItemMenu = { href: string; icon: any; label: string; externoComToken?: boolean };
export type GrupoMenu = { label: string; items: ItemMenu[] };

// As 5 abas escolhidas: WhatsApp · Leads · Propostas · Dashboard · Mais
const ABAS = [
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { href: '/leads', label: 'Leads', icon: GitMerge },
  { href: '/propostas-comerciais', label: 'Propostas', icon: ClipboardList },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];
// CEO (conta de consulta): números do negócio primeiro. Painel · Análise · Previsão · Leads · Mais
const ABAS_CEO = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/analise-comercial', label: 'Análise', icon: BarChart3 },
  { href: '/previsao', label: 'Previsão', icon: TrendingUp },
  { href: '/leads', label: 'Leads', icon: GitMerge },
];
const abasDo = (ceo?: boolean) => (ceo ? ABAS_CEO : ABAS);

const ativo = (pathname: string | null, href: string) => pathname === href || (!!pathname && pathname.startsWith(href + '/'));

export function BarraAbasIOS({ pathname, permitidos, maisAberto, onMais, ceo }: {
  pathname: string | null; permitidos: Set<string>; maisAberto: boolean; onMais: () => void; ceo?: boolean;
}) {
  const abas = abasDo(ceo).filter(a => permitidos.has(a.href));
  const emAlgumaAba = abas.some(a => ativo(pathname, a.href));
  return (
    <nav className="ios-tabbar md:hidden" aria-label="Seções principais">
      {abas.map(a => {
        const on = ativo(pathname, a.href) && !maisAberto;
        const Icon = a.icon;
        return (
          <Link key={a.href} href={a.href} className={`ios-tab ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon size={24} strokeWidth={on ? 2.3 : 1.8} aria-hidden />
            <span>{a.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMais} className={`ios-tab ${maisAberto || !emAlgumaAba ? 'on' : ''}`} aria-expanded={maisAberto}>
        <MoreHorizontal size={24} strokeWidth={maisAberto || !emAlgumaAba ? 2.3 : 1.8} aria-hidden />
        <span>Mais</span>
      </button>
    </nav>
  );
}

/** Folha "Mais": sobe de baixo, lista agrupada com todas as telas liberadas para a pessoa. */
export function FolhaMaisIOS({ aberta, onFechar, grupos, pathname, onAbrirExterno, ceo }: {
  aberta: boolean; onFechar: () => void; grupos: GrupoMenu[]; pathname: string | null; onAbrirExterno: (item: ItemMenu) => void; ceo?: boolean;
}) {
  const { closed, toggle, toggleAll } = useMenuGroups();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!aberta) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, [aberta]);
  useEffect(() => { if (aberta) onFechar(); /* fecha ao trocar de tela */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  if (!aberta) return null;
  const abas = new Set(abasDo(ceo).map(a => a.href));
  const labels = grupos.filter(g => g.items.some(i => !abas.has(i.href))).map(g => g.label);
  const allClosed = labels.every(g => closed.includes(g));
  const current = activeMenuHref(pathname, grupos.flatMap(g => g.items.map(i => i.href)));
  return (
    <div className="md:hidden fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Mais" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onFechar(); }
      if (event.key === 'Tab') {
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')).filter(el => el.getClientRects().length > 0);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="absolute inset-0 ios-scrim" onClick={onFechar} />
      <div className="ios-sheet">
        <div className="ios-grabber" aria-hidden />
        <div className="ios-sheet-head">
          <h2>Mais</h2>
          <button ref={closeRef} type="button" onClick={onFechar} className="ios-close" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="ios-sheet-body">
          <button type="button" className="ios-menu-all" onClick={() => toggleAll(labels)}>{allClosed ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}{allClosed ? 'Expandir grupos' : 'Recolher grupos'}</button>
          {grupos.map((g, index) => {
            const itens = g.items.filter(i => !abas.has(i.href));
            if (!itens.length) return null;
            return (
              <section key={g.label}>
                <button type="button" className="ios-group-label ios-menu-heading" aria-expanded={!closed.includes(g.label)} aria-controls={"ios-menu-group-" + index} onClick={() => toggle(g.label)}>{g.label}<ChevronDown size={14} aria-hidden="true" /></button>
                <div id={"ios-menu-group-" + index} className="ios-group" hidden={closed.includes(g.label)}>
                  {itens.map(i => {
                    const Icon = i.icon;
                    const conteudo = (<><span className="ios-row-icon"><Icon size={17} aria-hidden /></span><span className="ios-row-label">{i.label}</span><ChevronRight size={16} className="ios-chevron" aria-hidden /></>);
                    return i.externoComToken
                      ? <button key={i.label} type="button" className="ios-row" onClick={() => onAbrirExterno(i)}>{conteudo}</button>
                      : <Link key={i.href} href={i.href} className="ios-row" aria-current={i.href === current ? "page" : undefined} onClick={onFechar}>{conteudo}</Link>;
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
