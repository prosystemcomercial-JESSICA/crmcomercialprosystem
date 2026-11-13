'use client';

// Quadro padrão do agente (10/11/2026): o mesmo formato para todos. Status, motivo do erro, o que fez
// (hoje, 7 e 30 dias), qualidade das mensagens, IA do mês, com quem trabalha, última ação e um botão por vez.

import type { AgenteTela, Quadro } from './tipos';
import { COR_STATUS, ROTULO_STATUS, haQuanto, reais } from './tipos';

const PAINEIS = ['rafael', 'mila', 'joana', 'luiz_felipe', 'julio', 'heitor', 'sofia', 'caroline', 'laya', 'otavio'];

export default function QuadroAgente({ a, q, selecionado, onAbrir, onConversar, onAgenda }: {
  a: AgenteTela; q?: Quadro; selecionado?: boolean;
  onAbrir: (id: string) => void; onConversar: (id: string) => void; onAgenda: (id: string) => void;
}) {
  const qual = q?.qualidade;
  const totalQual = qual ? qual.sozinha + qual.aprovada + qual.editada + qual.descartada : 0;
  const pct = (n: number) => (totalQual ? Math.round((n / totalQual) * 100) : 0);
  const borda = a.status === 'erro' ? COR_STATUS.erro : selecionado ? a.cor : 'var(--t-card-border)';
  return (
    <article className="esc-quadro" style={{ borderColor: borda, boxShadow: selecionado ? `0 0 0 2px ${a.cor}33` : undefined }} aria-label={`Quadro de ${a.nome}`}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span aria-hidden style={{ width: 28, height: 28, borderRadius: 999, background: a.cor, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, flex: '0 0 auto' }}>{a.nome[0]}</span>
        <span style={{ display: 'grid', minWidth: 0 }}>
          <b style={{ fontSize: 15, color: 'var(--t-text-primary)' }}>{a.nome}</b>
          <span style={{ fontSize: 12, color: 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.funcao}</span>
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: COR_STATUS[a.status], whiteSpace: 'nowrap' }}>● {ROTULO_STATUS[a.status]}</span>
      </header>

      {q?.erro && <p role="alert" style={{ fontSize: 12, color: COR_STATUS.erro, background: '#dc26260f', borderRadius: 8, padding: '6px 8px' }}><b>Por que parou:</b> {q.erro}</p>}
      {q?.precisa_de_voce && <p style={{ fontSize: 12, color: '#92400e', background: '#f59e0b1a', borderRadius: 8, padding: '6px 8px' }}><b>Precisa de você:</b> {q.precisa_de_voce}</p>}

      <div className="esc-quadro-numeros">
        {q?.mensagens
          ? ([['hoje', q.mensagens.hoje], ['7 dias', q.mensagens.d7], ['30 dias', q.mensagens.d30]] as const).map(([r, v]) => (
            <span key={r}><b>{v.toLocaleString('pt-BR')}</b><small>mensagens {r}</small></span>
          ))
          : a.numeros.slice(0, 3).map(n => <span key={n.rotulo}><b>{n.valor}</b><small>{n.rotulo}</small></span>)}
      </div>

      {qual && totalQual > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Como as mensagens saíram (30 dias, {totalQual})</span>
          <div role="img" aria-label={`${pct(qual.sozinha)}% sozinhas, ${pct(qual.aprovada)}% aprovadas, ${pct(qual.editada)}% editadas, ${pct(qual.descartada)}% descartadas`} style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--t-content-bg)' }}>
            <span style={{ width: `${pct(qual.sozinha)}%`, background: '#64748b' }} />
            <span style={{ width: `${pct(qual.aprovada)}%`, background: '#16a34a' }} />
            <span style={{ width: `${pct(qual.editada)}%`, background: '#ca8a04' }} />
            <span style={{ width: `${pct(qual.descartada)}%`, background: '#dc2626' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
            {qual.sozinha} sozinhas · {qual.aprovada} aprovadas · {qual.editada} editadas · {qual.descartada} descartadas{qual.segurada_laya ? ` · ${qual.segurada_laya} seguradas pela Laya` : ''}
          </span>
        </div>
      )}

      {q && (q.ia_mes.chamadas > 0 || q.ia_mes.falhas > 0) && (
        <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
          IA no mês: <b>{q.ia_mes.chamadas.toLocaleString('pt-BR')}</b> chamadas{q.ia_mes.falhas ? <>, <b style={{ color: q.ia_mes.falhas > q.ia_mes.chamadas / 4 ? COR_STATUS.erro : undefined }}>{q.ia_mes.falhas}</b> falhas</> : ''} · {reais(q.ia_mes.brl)}
        </span>
      )}

      {q && (q.recebe_de.length > 0 || q.entrega_para.length > 0) && (
        <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
          {q.recebe_de.length > 0 && <>Recebe de <b>{q.recebe_de.join(', ')}</b></>}
          {q.recebe_de.length > 0 && q.entrega_para.length > 0 && ' · '}
          {q.entrega_para.length > 0 && <>Entrega para <b>{q.entrega_para.join(', ')}</b></>}
        </span>
      )}

      <span style={{ fontSize: 12, color: 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {a.ultima ? `${a.ultima.texto} · ${haQuanto(a.ultima.em)}` : a.observacao || 'Aguardando a primeira tarefa'}
      </span>

      <footer className="esc-quadro-acoes">
        {PAINEIS.includes(a.id) && <button className="esc-btn primario esc-quadro-principal" style={{ background: a.cor }} onClick={() => onAbrir(a.id)}>{q?.erro ? 'Resolver no painel' : q?.precisa_de_voce ? 'Aprovar' : 'Abrir painel'}</button>}
        <button className="esc-btn" onClick={() => onAgenda(a.id)}>Agenda</button>
        <button className="esc-btn" onClick={() => onConversar(a.id)}>Conversar</button>
      </footer>
    </article>
  );
}
