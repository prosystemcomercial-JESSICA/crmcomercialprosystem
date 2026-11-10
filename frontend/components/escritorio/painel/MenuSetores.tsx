'use client';

// Menu do escritório por setores (10/11/2026): substitui a fileira de 14 botões. No celular vira abas roláveis.

import type { AgenteTela, Painel } from './tipos';

export type Vista = 'todos' | 'entrada' | 'vendas' | 'inteligencia' | 'clientes' | 'esperando' | 'consumo' | 'organograma' | 'treinos';

export default function MenuSetores({ vista, onVista, painel, agentes }: { vista: Vista; onVista: (v: Vista) => void; painel: Painel | null; agentes: AgenteTela[] | null }) {
  const doSetor = (ids: string[]) => (agentes || []).filter(a => ids.includes(a.id));
  const setores = painel?.setores || [];
  const item = (v: Vista, rotulo: string, extra?: React.ReactNode) => (
    <button key={v} onClick={() => onVista(v)} aria-current={vista === v ? 'page' : undefined} className={`esc-menu-item${vista === v ? ' ativo' : ''}`}>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{rotulo}</span>{extra}
    </button>
  );
  const ponto = (cor: string, titulo: string) => <span aria-label={titulo} title={titulo} style={{ width: 9, height: 9, borderRadius: 999, background: cor, flex: '0 0 auto' }} />;
  return (
    <nav className="esc-menu" aria-label="Setores do escritório">
      <span className="esc-menu-titulo">Setores</span>
      {item('todos', 'Escritório inteiro', <span className="esc-menu-num">{agentes?.length ?? ''}</span>)}
      {setores.map(s => {
        const as = doSetor(s.agentes);
        const erro = as.some(a => a.status === 'erro');
        const trab = as.filter(a => a.status === 'trabalhando').length;
        return item(s.id as Vista, s.nome, erro ? ponto('#dc2626', 'Agente com erro neste setor') : <span className="esc-menu-num" title="trabalhando agora">{trab}/{as.length}</span>);
      })}
      <span className="esc-menu-titulo" style={{ marginTop: 8 }}>Gestão</span>
      {item('esperando', 'Esperando você', painel?.saude.esperando ? <span className="esc-menu-badge">{painel.saude.esperando}</span> : null)}
      {item('consumo', 'Consumo de IA', painel && painel.consumo.nivel !== 'ok' && painel.consumo.nivel !== 'sem_teto' ? ponto(painel.consumo.nivel === 'estourou' ? '#dc2626' : '#ca8a04', 'Perto do teto') : null)}
      {item('organograma', 'Quem trabalha com quem')}
      {item('treinos', 'Treinamentos')}
    </nav>
  );
}
