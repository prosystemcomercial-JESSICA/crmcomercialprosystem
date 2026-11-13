'use client';

// Diretoria dos agentes (pedido da Jessica, 13/11/2026). Um painel para os três:
//  - Vitória (CEO): plano da semana, providências (com "Desfazer") e metas do mês;
//  - Gustavo e Renata (gerentes): desempenho de cada agente, escada de cobrança e cobranças feitas;
//  - boletim semanal do Rafael com a Laya, que alimenta a Vitória.
// A Vitória tem liberdade total: aplica e avisa. Aqui a Jessica vê tudo e desfaz o que quiser.

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Texto } from './PainelRafael';

type Nivel = 'ok' | 'atencao' | 'critico';
type Agente = {
  id: string; nome: string; gerente: 'gustavo' | 'renata' | null; nivel: Nivel; sinais: string[]; tecnico: string | null; taxa_erro: number | null;
  mensagens: number; nota: number | null; melhorar: string | null; degrau: { nivel: 1 | 2 | 3; desde: string; motivo: string } | null;
};
type Prov = { i: number; tipo: string; descricao: string; aplicada: boolean; erro?: string; desfeita_em?: string | null };
type Plano = { id: string; tipo: string; titulo: string; conteudo: string; created_at: string; providencias: Prov[] };
type Dados = {
  agentes: Agente[]; boletim: { id: string; criado: string; resumo: string; agentes: { id: string; nota: number | null; motivo: string; melhorar: string | null }[] } | null;
  planos: Plano[]; cobrancas: { id: string; de: string; de_nome: string; para_nome: string; assunto: string; texto: string; created_at: string }[];
  metas_agentes: { agente: string; nome: string; rotulo: string; indicador: string; alvo: number; atual: number }[];
  metas_vendedoras: { id: string; nome: string; meta_contratos: number | null; meta_valor_total: number | null; valor_atual: number; da_vitoria: boolean }[];
  agenda: string[]; em_andamento: string[];
};
type Foco = 'vitoria' | 'gustavo' | 'renata';

const COR: Record<Foco, string> = { vitoria: '#0f172a', gustavo: '#334155', renata: '#9f1239' };
const NIVEL: Record<Nivel, { r: string; c: string; f: string }> = {
  ok: { r: 'Em dia', c: '#166534', f: '#dcfce7' }, atencao: { r: 'Atenção', c: '#92400e', f: '#fef3c7' }, critico: { r: 'Crítico', c: '#991b1b', f: '#fee2e2' },
};
const DEGRAU = { 1: 'Cobrado', 2: 'Treinado', 3: 'Com a Vitória' } as const;
const dataBr = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function PainelDiretoria({ foco = 'vitoria' }: { foco?: Foco }) {
  const [d, setD] = useState<Dados | null>(null);
  const [aba, setAba] = useState(foco === 'vitoria' ? 'plano' : 'desempenho');
  const [msg, setMsg] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const carregar = useCallback(() => apiClient.diretoria().then(r => setD(r.data.data)).catch(() => setMsg('Não deu para carregar a diretoria agora.')), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);
  const acao = async (fn: () => Promise<any>) => { try { const r = await fn(); setMsg(r.data?.message || 'Pronto.'); } catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo.'); } carregar(); };

  const cor = COR[foco];
  const btn = (fundo: string, c = '#fff'): React.CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: fundo, color: c, fontSize: 13, fontWeight: 700, cursor: 'pointer' });
  const card: React.CSSProperties = { border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 8, minWidth: 0 };
  const muted: React.CSSProperties = { fontSize: 12, color: 'var(--t-text-muted)' };
  const rodando = (q: string) => d?.em_andamento.includes(q);
  const equipe = (d?.agentes || []).filter(a => foco === 'vitoria' || a.gerente === foco);
  const problemas = equipe.filter(a => a.nivel !== 'ok').length;
  const ABAS = [
    { k: 'plano', r: '🎯 Plano e providências' }, { k: 'desempenho', r: `📊 Desempenho${problemas ? ` (${problemas})` : ''}` },
    { k: 'metas', r: '🏁 Metas do mês' }, { k: 'boletim', r: '📝 Boletim' }, { k: 'cobrancas', r: '📣 Cobranças' },
  ];

  return (
    <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${cor}`, borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>
          {foco === 'vitoria' ? 'Vitória · CEO dos agentes' : foco === 'gustavo' ? 'Gustavo · Gerente de Entrada de leads e Vendas' : 'Renata · Gerente de Clientes e Inteligência'}
        </b>
        <p style={muted}>
          {foco === 'vitoria'
            ? 'Define as metas e o plano comercial, lê os resultados no contexto geral e decide as providências. Tem liberdade total: aplica na hora e avisa você no WhatsApp. Qualquer providência pode ser desfeita aqui.'
            : `Confere os números de cada agente ${foco === 'gustavo' ? 'de Entrada de leads e Vendas' : 'de Clientes e Inteligência'} nos dias úteis. Quem erra muito sobe uma escada: cobrança por escrito, treino e, se não melhorar, vai para a Vitória.`}
        </p>
        {d && <p style={{ ...muted, marginTop: 4 }}>{d.agenda.join(' · ')}</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => acao(() => apiClient.diretoriaRodar('vitoria'))} disabled={rodando('vitoria')} style={btn(COR.vitoria)}>🎯 {rodando('vitoria') ? 'Vitória em reunião…' : 'Reunião da Vitória agora'}</button>
        <button onClick={() => acao(() => apiClient.diretoriaRodar('gerentes'))} disabled={rodando('gerentes')} style={btn(COR.gustavo)}>👔 {rodando('gerentes') ? 'Conferindo…' : 'Gerentes conferirem agora'}</button>
        <button onClick={() => acao(() => apiClient.diretoriaRodar('boletim'))} disabled={rodando('boletim')} style={btn('#1e40af')}>📝 {rodando('boletim') ? 'Montando…' : 'Boletim do Rafael e da Laya agora'}</button>
      </div>
      {msg && <div role="status" style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist">
        {ABAS.map(t => (
          <button key={t.k} role="tab" aria-selected={aba === t.k} onClick={() => setAba(t.k)}
            style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: aba === t.k ? cor : 'var(--t-card-bg)', color: aba === t.k ? '#fff' : 'var(--t-text-secondary)', cursor: 'pointer' }}>
            {t.r}
          </button>
        ))}
      </div>

      {!d ? <div style={muted}>Carregando…</div> : (
        <>
          {aba === 'plano' && (d.planos.length === 0
            ? <div style={muted}>A Vitória ainda não fez a primeira reunião. Ela faz toda segunda às 8h, ou clique em &quot;Reunião da Vitória agora&quot;.</div>
            : <div style={{ display: 'grid', gap: 8 }}>
                {d.planos.map((p, k) => {
                  const ver = aberto === p.id || (aberto === null && k === 0);
                  return (
                    <div key={p.id} style={card}>
                      <button onClick={() => setAberto(ver ? '' : p.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, minWidth: 0 }}>
                        <b style={{ fontSize: 14, color: 'var(--t-text-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>{p.titulo}</b>
                        <span style={{ ...muted, marginLeft: 'auto', flexShrink: 0 }}>{dataBr(p.created_at)} {ver ? '▲' : '▼'}</span>
                      </button>
                      {ver && (
                        <>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {p.providencias.map(x => (
                              <div key={x.i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', fontSize: 13, color: 'var(--t-text-primary)', opacity: x.desfeita_em ? 0.55 : 1 }}>
                                <span aria-hidden>{x.desfeita_em ? '↩️' : x.aplicada ? '✅' : '⚠️'}</span>
                                <span style={{ flex: '1 1 240px', minWidth: 0, overflowWrap: 'anywhere', textDecoration: x.desfeita_em ? 'line-through' : 'none' }}>
                                  {x.descricao}{x.erro ? <em style={muted}> (não aplicada: {x.erro})</em> : null}{x.desfeita_em ? <em style={muted}> (desfeita)</em> : null}
                                </span>
                                {x.aplicada && !x.desfeita_em && x.tipo !== 'treinar' && (
                                  <button onClick={() => acao(() => apiClient.diretoriaDesfazer(p.id, x.i))} style={btn('var(--t-content-bg)', '#dc2626')}>Desfazer</button>
                                )}
                              </div>
                            ))}
                          </div>
                          <Texto md={p.conteudo.replace(/^# .*\n+/, '').replace(/\n## Providências[\s\S]*$/, '')} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>)}

          {aba === 'desempenho' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--t-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  <th style={{ padding: 8 }}>Agente</th><th style={{ padding: 8 }}>Situação</th><th style={{ padding: 8 }}>Nota</th><th style={{ padding: 8 }}>Escada</th><th style={{ padding: 8 }}>O que pesou (7 dias)</th>
                </tr></thead>
                <tbody>
                  {[...equipe].sort((a, b) => ['critico', 'atencao', 'ok'].indexOf(a.nivel) - ['critico', 'atencao', 'ok'].indexOf(b.nivel)).map(a => (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--t-card-border)', verticalAlign: 'top', color: 'var(--t-text-primary)' }}>
                      <td style={{ padding: 8, whiteSpace: 'nowrap' }}><b>{a.nome}</b>{foco === 'vitoria' && a.gerente && <div style={muted}>{a.gerente === 'gustavo' ? 'Gustavo' : 'Renata'}</div>}</td>
                      <td style={{ padding: 8 }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: NIVEL[a.nivel].c, background: NIVEL[a.nivel].f }}>{NIVEL[a.nivel].r}</span></td>
                      <td style={{ padding: 8, fontVariantNumeric: 'tabular-nums' }}>{a.nota ?? '—'}</td>
                      <td style={{ padding: 8 }}>{a.degrau ? `${DEGRAU[a.degrau.nivel]} desde ${dataBr(a.degrau.desde).slice(0, 5)}` : '—'}</td>
                      <td style={{ padding: 8, minWidth: 220 }}>
                        {a.sinais.length ? a.sinais.join('; ') : <span style={muted}>{a.mensagens ? `${a.mensagens} mensagens a clientes, sem problema acima do limite` : 'sem problema acima do limite'}</span>}
                        {a.tecnico && <div style={{ ...muted, marginTop: 4 }}>⚙️ Técnico (não é culpa do agente): {a.tecnico}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ ...muted, marginTop: 8 }}>Limites: mais de 25% das mensagens corrigidas ou descartadas (a mensagem segurada pela Laya só conta se o Rafael descartar) é atenção; mais de 40% é crítico. Nota abaixo de 6 no boletim é atenção; abaixo de 4, crítico. São precisas pelo menos 8 mensagens na semana para medir.</p>
            </div>
          )}

          {aba === 'metas' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={card}>
                <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Metas dos agentes</b>
                {d.metas_agentes.length === 0 ? <span style={muted}>A Vitória ainda não definiu metas para os agentes neste mês.</span> : d.metas_agentes.map(m => {
                  const pc = Math.min(100, Math.round((100 * m.atual) / (m.alvo || 1)));
                  return (
                    <div key={`${m.agente}-${m.indicador}`} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--t-text-primary)', flexWrap: 'wrap' }}>
                        <b>{m.nome}</b><span style={{ minWidth: 0 }}>{m.rotulo}</span>
                        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{m.atual}{m.indicador === 'acerto_pct' ? '%' : ''} de {m.alvo}{m.indicador === 'acerto_pct' ? '%' : ''}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: 'var(--t-content-bg)', overflow: 'hidden' }} aria-label={`${pc}% da meta`}>
                        <div style={{ width: `${pc}%`, height: '100%', background: pc >= 100 ? '#16a34a' : cor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={card}>
                <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Metas das vendedoras</b>
                {d.metas_vendedoras.length === 0 ? <span style={muted}>Nenhuma meta de vendedora neste mês.</span> : d.metas_vendedoras.map(m => (
                  <div key={m.id} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--t-text-primary)', flexWrap: 'wrap' }}>
                    <b>{m.nome}</b>
                    <span>{[m.meta_contratos && `${m.meta_contratos} contrato(s)`, m.meta_valor_total && `R$ ${Number(m.meta_valor_total).toLocaleString('pt-BR')}`].filter(Boolean).join(' · ') || '—'}</span>
                    <span style={{ ...muted, marginLeft: 'auto' }}>{m.da_vitoria ? 'definida pela Vitória' : 'lançada por você (a Vitória não altera)'}</span>
                  </div>
                ))}
                <span style={muted}>As metas das vendedoras também aparecem na tela de Metas.</span>
              </div>
            </div>
          )}

          {aba === 'boletim' && (!d.boletim
            ? <div style={muted}>Ainda não há boletim nesta semana. O Rafael e a Laya fazem toda sexta às 16h, ou clique em &quot;Boletim do Rafael e da Laya agora&quot;.</div>
            : <div style={card}>
                <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Boletim de {dataBr(d.boletim.criado)}</b>
                <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{d.boletim.resumo}</p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {d.boletim.agentes.map(b => (
                    <div key={b.id} style={{ fontSize: 13, color: 'var(--t-text-primary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ minWidth: 90 }}>{d.agentes.find(a => a.id === b.id)?.nome || b.id}</b>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{b.nota ?? '—'}</span>
                      <span style={{ flex: '1 1 240px', minWidth: 0 }}>{b.motivo}{b.melhorar ? <span style={muted}> · melhorar: {b.melhorar}</span> : null}</span>
                    </div>
                  ))}
                </div>
              </div>)}

          {aba === 'cobrancas' && (() => {
            const lista = d.cobrancas.filter(c => foco === 'vitoria' || c.de === foco);
            return lista.length === 0 ? <div style={muted}>Nenhuma cobrança nos últimos 14 dias.</div> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {lista.map(c => (
                  <div key={c.id} style={card}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--t-text-primary)' }}>
                      <b>{c.de_nome} → {c.para_nome}</b><span>{c.assunto}</span><span style={{ ...muted, marginLeft: 'auto' }}>{dataBr(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.texto}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
