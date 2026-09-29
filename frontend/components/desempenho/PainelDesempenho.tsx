'use client';

// Desempenho unificado do setor: agentes de IA, suas intervenções, compromissos, propostas e uso
// das IAs, no mesmo período. Usado na tela /desempenho e na janela "Métricas da IA" do Escritório.
// Gráficos simples e legíveis: uma cor por gráfico, nome escrito em cada barra, valores visíveis,
// status sempre com ícone + texto, e tabela com os números.

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Dados = {
  periodo: { dias: number };
  agentes: { agente: string; nome: string; leads: number; contatados: number; responderam: number; efetivos: number; demos: number; sem_interesse: number; assumidas_por_pessoa: number; taxa_resposta: number; taxa_efetivo: number }[];
  intervencoes: { aprovadas_sem_mudar: number; editadas: number; refeitas: number; conversas_assumidas: number; automaticas: number; pendentes: number };
  compromissos: { marcados: number; realizados: number; nao_compareceu: number; cancelados: number; remarcados: number; pendentes: number };
  outras_atividades: { tipo: string; quantidade: number }[];
  propostas: { mudancas_de_status: number; por_status: { status: string; quantidade: number }[]; criadas: number };
  ia: { por_dia: { dia: string; openai: number; grok: number; laya: number }[]; total: { openai: number; grok: number; laya: number }; sem_custo_pct: number };
  laya: { acionada: number; confirmacoes: number };
};

const PERIODOS = [{ d: 7, r: '7 dias' }, { d: 30, r: '30 dias' }, { d: 90, r: '90 dias' }];
const STATUS_PROPOSTA: Record<string, string> = { ENVIADA: 'Enviada', VISUALIZADA: 'Visualizada', EM_NEGOCIACAO: 'Em negociação', ACEITA: 'Aceita', RECUSADA: 'Recusada', PERDIDA: 'Perdida', EXPIRADA: 'Expirada', RASCUNHO: 'Rascunho', CONTRATO_ENVIADO: 'Contrato enviado', CONTRATO_ASSINADO: 'Contrato assinado', CONTRATO_EM_GERACAO: 'Contrato em geração' };
const TIPO_ATV: Record<string, string> = { LIGACAO: 'Ligações', EMAIL: 'E-mails', WHATSAPP: 'WhatsApp', VISITA: 'Visitas', TAREFA: 'Tarefas', OUTRO: 'Outros' };

function Numero({ rotulo, valor, sub }: { rotulo: string; valor: string | number; sub?: string }) {
  return (
    <div className="ps-card" style={{ padding: '12px 14px', borderRadius: 12, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)', fontWeight: 600 }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>{sub}</div>}
    </div>
  );
}

/** Barras horizontais de uma série só: nome à esquerda, barra com ponta arredondada, valor escrito. */
function Barras({ titulo, itens, cor = '#2563eb', sufixo = '' }: { titulo: string; itens: { rotulo: string; valor: number; dica?: string }[]; cor?: string; sufixo?: string }) {
  const max = Math.max(1, ...itens.map(i => i.valor));
  return (
    <div className="ps-card" style={{ padding: 14, borderRadius: 12, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 10 }}>{titulo}</div>
      {itens.length === 0 && <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada no período.</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {itens.map(i => (
          <div key={i.rotulo} title={i.dica || `${i.rotulo}: ${i.valor}${sufixo}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 32%) 1fr auto', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.rotulo}</span>
            <div style={{ height: 14, background: 'var(--t-content-bg)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(i.valor / max) * 100}%`, minWidth: i.valor ? 4 : 0, height: '100%', background: cor, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>{i.valor}{sufixo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Colunas por dia (uma série: chamadas à IA paga), com o valor ao passar o mouse. */
function ColunasDia({ titulo, pontos, cor }: { titulo: string; pontos: { dia: string; valor: number }[]; cor: string }) {
  const max = Math.max(1, ...pontos.map(p => p.valor));
  return (
    <div className="ps-card" style={{ padding: 14, borderRadius: 12, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 10 }}>{titulo}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
        {pontos.map(p => (
          <div key={p.dia} title={`${p.dia.split('-').reverse().slice(0, 2).join('/')}: ${p.valor}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: `${(p.valor / max) * 100}%`, minHeight: p.valor ? 2 : 0, background: cor, borderRadius: '3px 3px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
        <span>{pontos[0]?.dia.split('-').reverse().slice(0, 2).join('/')}</span><span>hoje</span>
      </div>
    </div>
  );
}

export default function PainelDesempenho({ compacto = false }: { compacto?: boolean }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setErro(null);
    apiClient.relatorioDesempenho(dias).then(r => setD(r.data.data)).catch(e => setErro(e?.response?.status === 403 ? 'Só a gestão vê o desempenho.' : 'Não foi possível carregar agora.'));
  }, [dias]);

  const grade = (min: number): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap: 10 });
  const totalIntervencoes = d ? d.intervencoes.editadas + d.intervencoes.refeitas + d.intervencoes.conversas_assumidas : 0;
  const decididas = d ? d.intervencoes.aprovadas_sem_mudar + d.intervencoes.editadas + d.intervencoes.refeitas : 0;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} role="tablist" aria-label="Período">
        {PERIODOS.map(p => (
          <button key={p.d} role="tab" aria-selected={dias === p.d} onClick={() => setDias(p.d)}
            style={{ minHeight: 34, padding: '0 14px', borderRadius: 17, fontSize: 13, fontWeight: 600, border: '1px solid var(--t-card-border)', background: dias === p.d ? 'var(--t-primary)' : 'var(--t-card-bg)', color: dias === p.d ? '#fff' : 'var(--t-text-secondary)' }}>
            Últimos {p.r}
          </button>
        ))}
      </div>
      {erro && <div style={{ color: '#dc2626', fontSize: 13 }}>{erro}</div>}
      {!d && !erro && <div style={{ color: 'var(--t-text-muted)', fontSize: 13 }}>Carregando…</div>}
      {d && (
        <>
          <section style={grade(150)}>
            <Numero rotulo="Leads com os agentes" valor={d.agentes.reduce((s, a) => s + a.leads, 0)} sub={`${d.agentes.reduce((s, a) => s + a.contatados, 0)} contatados`} />
            <Numero rotulo="Efetivos" valor={d.agentes.reduce((s, a) => s + a.efetivos, 0)} sub="demo, vendedora ou nota ≥ 60" />
            <Numero rotulo="Demonstrações marcadas" valor={d.compromissos.marcados} sub={`${d.compromissos.realizados} realizadas · ${d.compromissos.nao_compareceu} não compareceu`} />
            <Numero rotulo="Suas intervenções" valor={totalIntervencoes} sub={`${d.intervencoes.editadas} editadas · ${d.intervencoes.refeitas} refeitas · ${d.intervencoes.conversas_assumidas} assumidas`} />
            <Numero rotulo="Laya acionada" valor={d.laya.acionada} sub={`${d.laya.confirmacoes} confirmações suas`} />
            <Numero rotulo="IA sem custo" valor={`${d.ia.sem_custo_pct}%`} sub={`${d.ia.total.openai} chamadas à OpenAI (paga)`} />
          </section>

          <section style={grade(300)}>
            <Barras titulo="Leads que responderam, por agente" itens={d.agentes.map(a => ({ rotulo: a.nome, valor: a.responderam, dica: `${a.nome}: ${a.responderam} de ${a.contatados} contatados (${a.taxa_resposta}%)` }))} />
            <Barras titulo="Leads efetivos, por agente" cor="#16a34a" itens={d.agentes.map(a => ({ rotulo: a.nome, valor: a.efetivos, dica: `${a.nome}: ${a.efetivos} efetivos (${a.taxa_efetivo}% dos contatados)` }))} />
            <Barras titulo="Compromissos marcados: o que aconteceu" cor="#7c3aed" itens={[
              { rotulo: '✅ Realizados', valor: d.compromissos.realizados },
              { rotulo: '⚠️ Não compareceu', valor: d.compromissos.nao_compareceu },
              { rotulo: '🔁 Remarcados', valor: d.compromissos.remarcados },
              { rotulo: '❌ Cancelados', valor: d.compromissos.cancelados },
              { rotulo: '⏳ Pendentes', valor: d.compromissos.pendentes },
            ]} />
            <Barras titulo="Propostas: mudanças de status" cor="#ea580c" itens={d.propostas.por_status.slice(0, 8).map(p => ({ rotulo: STATUS_PROPOSTA[p.status] || p.status, valor: p.quantidade }))} />
            {!compacto && <Barras titulo="Outras atividades registradas" cor="#0891b2" itens={d.outras_atividades.map(o => ({ rotulo: TIPO_ATV[o.tipo] || o.tipo, valor: o.quantidade }))} />}
            <Barras titulo="Mensagens dos agentes: sua decisão" cor="#475569" itens={[
              { rotulo: 'Aprovadas sem mudar', valor: d.intervencoes.aprovadas_sem_mudar },
              { rotulo: 'Editadas por você', valor: d.intervencoes.editadas },
              { rotulo: 'Refeitas', valor: d.intervencoes.refeitas },
              { rotulo: 'Enviadas sozinhas', valor: d.intervencoes.automaticas },
            ]} />
          </section>

          <section style={grade(300)}>
            <ColunasDia titulo="Chamadas à IA paga (OpenAI) por dia" cor="#2563eb" pontos={d.ia.por_dia.map(p => ({ dia: p.dia, valor: p.openai }))} />
            <ColunasDia titulo="Laya (grátis) acionada por dia" cor="#db2777" pontos={d.ia.por_dia.map(p => ({ dia: p.dia, valor: p.laya }))} />
          </section>

          <details className="ps-card" style={{ padding: 12, borderRadius: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>Ver os números em tabela</summary>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead><tr style={{ color: 'var(--t-text-muted)', textAlign: 'left' }}>
                  {['Agente', 'Leads', 'Contatados', 'Responderam', '% resposta', 'Efetivos', '% efetivo', 'Demos', 'Sem interesse', 'Assumidas por pessoa'].map(h => <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>{d.agentes.map(a => (
                  <tr key={a.agente} style={{ borderTop: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{a.nome}</td><td style={{ padding: '6px 8px' }}>{a.leads}</td><td style={{ padding: '6px 8px' }}>{a.contatados}</td>
                    <td style={{ padding: '6px 8px' }}>{a.responderam}</td><td style={{ padding: '6px 8px' }}>{a.taxa_resposta}%</td><td style={{ padding: '6px 8px' }}>{a.efetivos}</td>
                    <td style={{ padding: '6px 8px' }}>{a.taxa_efetivo}%</td><td style={{ padding: '6px 8px' }}>{a.demos}</td><td style={{ padding: '6px 8px' }}>{a.sem_interesse}</td><td style={{ padding: '6px 8px' }}>{a.assumidas_por_pessoa}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
