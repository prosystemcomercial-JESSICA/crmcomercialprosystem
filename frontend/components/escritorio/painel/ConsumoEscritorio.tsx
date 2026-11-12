'use client';

// Consumo de IA no escritório (10/11/2026): gasto do mês contra o teto definido pela Jessica (aviso no
// WhatsApp a partir de 80%), chamadas e falhas por dia, estado de cada IA agora e quem consome mais.
// O detalhe em reais por dia continua em Desempenho › IA.

import { Fragment, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { AgenteTela, Consumo, Provedor } from './tipos';
import { NOME_PROVEDOR, reais } from './tipos';

const COR_NIVEL = { sem_teto: '#64748b', ok: '#16a34a', atencao: '#ca8a04', estourou: '#dc2626' } as const;
const ESTADO_IA = { ok: ['Respondendo', '#16a34a'], pausado: ['Em pausa', '#dc2626'], sem_uso: ['Sem uso desde o último reinício', '#64748b'], sem_chave: ['Sem chave', '#94a3b8'] } as const;

export default function ConsumoEscritorio({ c, provedores, agentes, onSalvo }: { c: Consumo; provedores: Provedor[]; agentes: AgenteTela[]; onSalvo: () => void }) {
  const [teto, setTeto] = useState(c.teto ? String(c.teto) : '');
  const [msg, setMsg] = useState<string | null>(null);
  const [dica, setDica] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const salvar = async () => {
    const v = Number(teto.replace(/\./g, '').replace(',', '.')) || 0;
    try { const r = await apiClient.salvarTetoIa(v); setMsg(r.data?.message || 'Salvo.'); onSalvo(); }
    catch (e) { setMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Não deu para salvar.'); }
  };
  const max = Math.max(c.teto || 0, c.previsao, c.brl, 1);
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const dias = c.por_dia.slice(-31);
  const picoDia = Math.max(1, ...dias.map(d => d.chamadas));
  const totalFalhas = dias.reduce((s, d) => s + d.falhas, 0), totalCham = dias.reduce((s, d) => s + d.chamadas, 0);
  const nome = (id: string) => agentes.find(a => a.id === id)?.nome || id;
  const ranking = Object.entries(c.por_agente).sort((a, b) => b[1].brl - a[1].brl || b[1].chamadas - a[1].chamadas).slice(0, 8);
  const provs = ['openai', 'groq', 'openrouter', 'gemini', 'grok'];
  const falhasProv = c.falhas_provedor.slice(-10);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>Consumo de IA</h2>
        <a href="/desempenho" style={{ fontSize: 13, color: 'var(--t-link)' }}>Detalhe em reais por dia (Desempenho)</a>
      </div>

      <section className="esc-cartao" aria-label="Gasto do mês e teto">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
          <span style={{ display: 'grid' }}><small style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Gasto no mês</small><b style={{ fontSize: 26, color: 'var(--t-text-primary)' }}>{reais(c.brl)}</b></span>
          <span style={{ display: 'grid' }}><small style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Previsão até o fim do mês</small><b style={{ fontSize: 18, color: c.previsao_estoura ? '#dc2626' : 'var(--t-text-primary)' }}>{reais(c.previsao)}</b></span>
          <span style={{ display: 'grid' }}><small style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Teto</small><b style={{ fontSize: 18, color: COR_NIVEL[c.nivel] }}>{c.teto ? `${reais(c.teto)} · ${Math.round(c.usado * 100)}% usado` : 'sem teto'}</b></span>
          {c.teto > 0 && c.previsao_estoura && c.nivel === 'ok' && <span role="status" style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#f59e0b1a', borderRadius: 8, padding: '4px 8px' }}>No ritmo atual, o mês fecha acima do teto</span>}
        </div>
        <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'var(--t-content-bg)', marginTop: 12 }} role="img" aria-label={`Gasto ${reais(c.brl)}, previsão ${reais(c.previsao)}${c.teto ? `, teto ${reais(c.teto)}` : ''}`}>
          <span style={{ position: 'absolute', inset: 0, width: pos(c.previsao), borderRadius: 7, background: COR_NIVEL[c.nivel], opacity: 0.22 }} />
          <span style={{ position: 'absolute', inset: 0, width: pos(c.brl), borderRadius: 7, background: COR_NIVEL[c.nivel] }} />
          {c.teto > 0 && <span title={`Teto ${reais(c.teto)}`} style={{ position: 'absolute', top: -4, bottom: -4, left: pos(c.teto), width: 2, background: 'var(--t-text-primary)' }} />}
          {c.teto > 0 && <span title="80% do teto: aviso no WhatsApp" style={{ position: 'absolute', top: -2, bottom: -2, left: pos(c.teto * 0.8), width: 1, background: 'var(--t-text-muted)' }} />}
        </div>
        <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 6 }}>Barra cheia: gasto até hoje. Faixa clara: previsão. Traço escuro: teto; traço fino: 80% do teto, quando o aviso chega no seu WhatsApp. Cotação usada: {reais(c.cotacao)} por dólar.</p>
        <form onSubmit={e => { e.preventDefault(); void salvar(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <label htmlFor="teto-ia" style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>Teto mensal (R$)</label>
          <input id="teto-ia" inputMode="decimal" value={teto} onChange={e => setTeto(e.target.value)} placeholder="ex.: 150" style={{ width: 120, minHeight: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
          <button type="submit" className="esc-btn primario" style={{ background: '#2563eb' }}>Salvar teto</button>
          {msg && <span role="status" style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{msg}</span>}
        </form>
      </section>

      <section className="esc-cartao" aria-label="IAs agora">
        <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Cada IA agora</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 8 }}>
          {provedores.map(p => {
            const [rot, cor] = ESTADO_IA[p.estado];
            return (
              <div key={p.provedor} style={{ border: `1px solid ${p.estado === 'pausado' ? cor : 'var(--t-card-border)'}`, borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 2 }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: cor }} /><b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{NOME_PROVEDOR[p.provedor] || p.provedor}</b></span>
                <span style={{ fontSize: 12, color: cor }}>{rot}{p.estado === 'pausado' ? `: volta em ${p.volta_em_min} min` : ''}</span>
                {p.ultimo_erro && <span style={{ fontSize: 11, color: 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.ultimo_erro}>Último erro: {p.ultimo_erro}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="esc-cartao" aria-label="Chamadas e falhas por dia">
        <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>{totalCham ? `${Math.round((totalFalhas / Math.max(1, totalCham)) * 100)}% das chamadas falharam neste mês` : 'Chamadas e falhas por dia'}</b>
        <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Cinza: chamadas às IAs. Vermelho: falhas. Passe o mouse ou toque numa barra.</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, marginTop: 8 }} onMouseLeave={() => setDica(null)}>
          {dias.map(d => (
            <button key={d.dia} aria-label={`${d.dia.split('-').reverse().join('/')}: ${d.chamadas} chamadas, ${d.falhas} falhas, ${reais(d.brl)}`}
              onMouseEnter={() => setDica(`${d.dia.split('-').reverse().slice(0, 2).join('/')}: ${d.chamadas.toLocaleString('pt-BR')} chamadas, ${d.falhas.toLocaleString('pt-BR')} falhas, ${reais(d.brl)}`)}
              onFocus={() => setDica(`${d.dia.split('-').reverse().slice(0, 2).join('/')}: ${d.chamadas} chamadas, ${d.falhas} falhas, ${reais(d.brl)}`)}
              style={{ flex: 1, minWidth: 6, height: '100%', position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(d.chamadas / picoDia) * 100}%`, background: '#94a3b8', borderRadius: '3px 3px 0 0' }} />
              <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(Math.min(d.falhas, d.chamadas || d.falhas) / picoDia) * 100}%`, background: '#dc2626', opacity: 0.85, borderRadius: '3px 3px 0 0' }} />
            </button>
          ))}
        </div>
        <p role="status" style={{ fontSize: 12, color: 'var(--t-text-secondary)', minHeight: 18 }}>{dica || (dias.length ? `${dias[0].dia.split('-').reverse().slice(0, 2).join('/')} a ${dias[dias.length - 1].dia.split('-').reverse().slice(0, 2).join('/')}` : 'Sem dados neste mês ainda.')}</p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <section className="esc-cartao" aria-label="Quem mais consome">
          <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Quem mais consome no mês</b>
          <table className="esc-tabela">
            <thead><tr><th>Agente</th><th>Chamadas</th><th>Falhas</th><th>R$</th></tr></thead>
            <tbody>{ranking.map(([id, v]) => {
              const motivos = c.erros_por_agente?.[id] || [];
              const cor = v.falhas > v.chamadas / 4 ? '#dc2626' : undefined;
              return (
                <Fragment key={id}>
                  <tr>
                    <td>{nome(id)}</td><td>{v.chamadas.toLocaleString('pt-BR')}</td>
                    <td>{v.falhas > 0 ? (
                      <button type="button" aria-expanded={aberto === id} onClick={() => setAberto(aberto === id ? null : id)}
                        title="Ver o motivo das falhas" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: cor || 'inherit', textDecoration: 'underline dotted', font: 'inherit' }}>
                        {v.falhas.toLocaleString('pt-BR')}
                      </button>
                    ) : 0}</td>
                    <td>{reais(v.brl)}</td>
                  </tr>
                  {aberto === id && (
                    <tr><td colSpan={4} style={{ background: 'var(--t-content-bg)' }}>
                      {motivos.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>O motivo de cada falha passou a ser gravado em 12/11/2026. As falhas anteriores ficaram só no contador.</span>
                      ) : (
                        <ul style={{ display: 'grid', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                          {motivos.map(m => (
                            <li key={`${m.provedor}-${m.motivo}`} style={{ fontSize: 12, display: 'grid', gap: 1, minWidth: 0 }}>
                              <span style={{ color: 'var(--t-text-primary)' }}><b>{m.n.toLocaleString('pt-BR')}×</b> {m.texto} · {NOME_PROVEDOR[m.provedor] || m.provedor}{m.modelo ? ` (${m.modelo})` : ''}</span>
                              <span style={{ color: 'var(--t-text-muted)' }}>{m.dias > 1 ? `Em ${m.dias} dias, de ${dataHora(m.primeiro)} a ${dataHora(m.ultimo)}` : `De ${dataHora(m.primeiro)} a ${dataHora(m.ultimo)}`}</span>
                              <span style={{ color: 'var(--t-text-muted)', overflowWrap: 'anywhere' }} title={m.exemplo}>Última mensagem: {m.exemplo}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              );
            })}</tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 6 }}>Toque no número de falhas para ver o motivo.</p>
        </section>
        <section className="esc-cartao" aria-label="Falhas por IA">
          <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Falhas por IA (últimos dias)</b>
          {falhasProv.length === 0 ? <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 6 }}>A contagem por IA começou em 10/11/2026; aparece aqui a partir das próximas falhas.</p> : (
            <table className="esc-tabela">
              <thead><tr><th>Dia</th>{provs.map(p => <th key={p}>{NOME_PROVEDOR[p]}</th>)}</tr></thead>
              <tbody>{falhasProv.slice().reverse().map(f => (
                <tr key={f.dia}><td>{f.dia.split('-').reverse().slice(0, 2).join('/')}</td>{provs.map(p => <td key={p} style={{ color: Number(f[p]) ? '#dc2626' : 'var(--t-text-muted)' }}>{Number(f[p]) || 0}</td>)}</tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
