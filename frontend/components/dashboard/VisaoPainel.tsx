'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient, GanhoMes } from '@/lib/api-client';
import { Visao, ROTULO_VISAO } from '@/lib/visoes';
import {
  Wallet, GitMerge, ClipboardList, FileCheck2, Trophy, CalendarCheck, Send, Users,
  Settings, Shield, DollarSign, BarChart2, Monitor, Database,
} from 'lucide-react';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/** Seletor "Como vendedora / Como supervisora / Administração" (só troca o que é exibido). */
export function VisaoSwitch({ visoes, atual, onChange }: { visoes: Visao[]; atual: Visao; onChange: (v: Visao) => void }) {
  if (visoes.length < 2) return null;
  return (
    <div role="tablist" aria-label="Visão do dashboard" className="inline-flex rounded-lg p-0.5 gap-0.5"
      style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
      {visoes.map(v => {
        const ativo = v === atual;
        return (
          <button key={v} role="tab" aria-selected={ativo} onClick={() => onChange(v)}
            className="h-7 px-3 rounded-md text-xs font-semibold transition-colors"
            style={ativo
              ? { background: 'var(--t-primary)', color: '#fff' }
              : { background: 'transparent', color: 'var(--t-text-secondary)' }}>
            {ROTULO_VISAO[v]}
          </button>
        );
      })}
    </div>
  );
}

/** Card fixo "Meu ganho no mês": comissão de venda + supervisão + bônus de cada papel. */
export function MeuGanhoCard() {
  const [g, setG] = useState<GanhoMes | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    apiClient.getMeuGanho()
      .then(r => setG(r.data?.data || null))
      .catch(() => setErro(true));
  }, []);

  const linhas: [string, number][] = g ? [
    ['Comissão de venda (15%)', g.vendedor],
    ['Comissão de supervisão (5%)', g.supervisao],
    ['Bônus de vendedora', g.bonus_vendedor],
    ['Bônus da supervisão', g.bonus_supervisao],
  ] : [];

  return (
    <div className="ps-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Wallet size={14} style={{ color: 'var(--t-primary)' }} />
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>
          Meu ganho no mês{g ? ` · ${g.mes.split('-').reverse().join('/')}` : ''}
        </p>
      </div>
      {erro ? (
        <p className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>Não foi possível carregar agora.</p>
      ) : !g ? (
        <div className="du-skeleton h-10 w-full" />
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <p className="text-2xl font-extrabold" style={{ color: 'var(--t-primary-dark)' }}>{brl(g.total)}</p>
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <p className="text-[10.5px]" style={{ color: 'var(--t-text-muted)' }}>{rotulo}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>{brl(valor)}</p>
            </div>
          ))}
          <Link href="/comissoes" className="ml-auto text-xs font-semibold" style={{ color: 'var(--t-primary)' }}>
            Ver comissões →
          </Link>
        </div>
      )}
    </div>
  );
}

type Atalho = { href: string; label: string; sub: string; icon: any };

const ATALHOS: Record<Visao, Atalho[]> = {
  vendedora: [
    { href: '/leads', label: 'Meus leads', sub: 'meu funil', icon: GitMerge },
    { href: '/propostas-comerciais', label: 'Minhas propostas', sub: 'em aberto e aceitas', icon: ClipboardList },
    { href: '/contratos', label: 'Meus contratos', sub: 'assinados e em geração', icon: FileCheck2 },
    { href: '/metas', label: 'Minha meta de vendas', sub: 'progresso do mês', icon: Trophy },
    { href: '/atividades', label: 'Minhas tarefas de hoje', sub: 'agenda e follow-ups', icon: CalendarCheck },
  ],
  supervisora: [
    { href: '/sdr/leads-para-distribuir', label: 'Leads para distribuir', sub: 'qualificados sem vendedor', icon: Send },
    { href: '/relatorio-comercial', label: 'Faturamento do setor', sub: 'relatório comercial', icon: BarChart2 },
    { href: '/metas', label: 'Metas da equipe', sub: 'progresso por pessoa', icon: Trophy },
    { href: '/leads-sdr', label: 'Desempenho da SDR', sub: 'funil da Ana Clara', icon: Users },
    { href: '/comissoes', label: 'Bônus trimestral', sub: 'meus 5% + bônus', icon: DollarSign },
    { href: '/tv', label: 'Painel TV', sub: 'prévia da TV comercial', icon: Monitor },
  ],
  admin: [
    { href: '/usuarios', label: 'Usuários e permissões', sub: 'contas, cargos, módulos', icon: Users },
    { href: '/configuracoes', label: 'Configurações', sub: 'integrações e sistema', icon: Settings },
    { href: '/comissoes', label: 'Regras de comissão', sub: 'percentuais e bônus', icon: DollarSign },
    { href: '/configuracoes', label: 'Backups', sub: 'status e restauração', icon: Database },
    { href: '/auditoria', label: 'Auditoria', sub: 'quem fez o quê', icon: Shield },
  ],
};

/** Atalhos da visão escolhida. Na visão vendedora o dashboard abaixo já vem filtrado nela. */
export function AtalhosVisao({ visao }: { visao: Visao }) {
  const itens = ATALHOS[visao];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {itens.map(a => {
        const Icon = a.icon;
        return (
          <Link key={`${a.href}-${a.label}`} href={a.href}
            className="ps-card rounded-xl p-3 flex items-start gap-2 transition-colors hover:opacity-90">
            <Icon size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--t-primary)' }} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold truncate" style={{ color: 'var(--t-text-primary)' }}>{a.label}</span>
              <span className="block text-[10.5px] truncate" style={{ color: 'var(--t-text-muted)' }}>{a.sub}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
