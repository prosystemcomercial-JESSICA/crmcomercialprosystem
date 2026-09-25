'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Painel da Caroline (SDR): passar leads da campanha, aprovar/editar as mensagens
// dela, acompanhar o termômetro e confirmar a temperatura (ensina a Laya).

type Config = { ativa: boolean; aprovar: boolean; limite: number; ativada_em: string | null; pausada_motivo: string | null };
type Lead = { id: string; nome: string | null; empresa: string | null; numero: string; segmento: string | null; campanha: string | null; status: string; tentativas: number; nota: number | null; nota_motivo: string | null; temperatura: string | null; temperatura_confirmada: string | null; dados: any };
type Pendente = { id: string; sdrId: string; texto: string; meta: any; lead: string | null; empresa: string | null; criado_em: string };
type Uso = { dia: string; openai: number; grok: number; laya: number };
type Painel = { uso_ia?: Uso[]; config: Config; por_status: Record<string, number>; leads: Lead[]; pendentes: Pendente[] };
type Previa = { nome: string | null; empresa: string | null; numero: string | null; telefone: string | null; segmento: string | null; campanha: string | null; avisos: string[]; pode: boolean };

const COR = '#be123c';
const STATUS: Record<string, string> = { FILA: 'Na fila', AGUARDANDO: 'Esperando resposta', CONVERSANDO: 'Conversando', DEMO: 'Demonstração', VENDEDORA: 'Com a vendedora', SEM_INTERESSE: 'Sem interesse', SEM_RESPOSTA: 'Sem resposta', HUMANO: 'Uma pessoa assumiu', SAIU: 'Pediu para sair' };
const TEMP: Record<string, { nome: string; cor: string }> = {
  MUITO_QUENTE: { nome: '🔥 Muito quente', cor: '#dc2626' }, QUENTE: { nome: '🟠 Quente', cor: '#ea580c' },
  MORNO: { nome: '🟡 Morno', cor: '#ca8a04' }, FRIO: { nome: '🔵 Frio', cor: '#2563eb' },
};
const ACAO: Record<string, string> = { continuar: 'segue conversando', oferecer_demo: 'vai oferecer demonstração', passar_vendedora: 'vai passar para a vendedora', sem_interesse: 'vai encerrar (sem interesse)', duvida_fora_material: 'dúvida fora do material: vai te avisar' };

const caixa = { border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 } as const;
const botao = (cheio = true) => ({ padding: '7px 14px', borderRadius: 8, border: `1px solid ${COR}`, background: cheio ? COR : 'transparent', color: cheio ? '#fff' : COR, fontWeight: 700, fontSize: 13, cursor: 'pointer' }) as const;

export default function PainelCaroline() {
  const [p, setP] = useState<Painel | null>(null);
  const [texto, setTexto] = useState('');
  const [abertura, setAbertura] = useState(true);
  const [previa, setPrevia] = useState<Previa[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(() => { apiClient.getCaroline().then(r => setP(r.data.data)).catch(() => {}); }, []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 20_000); return () => clearInterval(t); }, [carregar]);

  const falhou = (e: any, padrao: string) => setMsg({ ok: false, texto: e?.response?.data?.message || padrao });

  const verPrevia = async () => {
    setMsg(null); setOcupado(true);
    try { setPrevia((await apiClient.previaCaroline(texto)).data.data); } catch (e) { falhou(e, 'Não consegui ler os leads.'); } finally { setOcupado(false); }
  };
  const confirmar = async () => {
    setOcupado(true);
    try {
      const r = await apiClient.passarLeadsCaroline(texto, abertura);
      setMsg({ ok: true, texto: r.data.message }); setTexto(''); setPrevia(null); carregar();
    } catch (e) { falhou(e, 'Não consegui passar os leads.'); } finally { setOcupado(false); }
  };
  const config = async (d: Partial<Config>) => {
    try { await apiClient.configCaroline(d); carregar(); } catch (e) { falhou(e, 'Não consegui salvar.'); }
  };
  const decidir = async (m: Pendente, aprovar: boolean) => {
    setOcupado(true);
    try {
      // Aprovar envia o texto (com ajuste, se houver); Refazer manda o "o que mudar?" e ela reescreve na hora.
      const r = await apiClient.decidirMensagemCaroline(m.id, aprovar, aprovar ? (edicao[m.id] ?? null) : (motivo[m.id] || null));
      setMsg({ ok: true, texto: r.data.message }); carregar();
      if (!aprovar) { setTimeout(carregar, 8000); setTimeout(carregar, 20000); }
    } catch (e) { falhou(e, 'Não consegui enviar.'); } finally { setOcupado(false); }
  };
  const confirmarTemp = async (l: Lead, t: string) => {
    try { const r = await apiClient.confirmarTemperaturaCaroline(l.id, t); setMsg({ ok: true, texto: r.data.message }); carregar(); } catch (e) { falhou(e, 'Não consegui confirmar.'); }
  };

  if (!p) return null;
  const c = p.config;
  return (
    <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${COR}`, borderRadius: 14, padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: '1 1 300px' }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>🎧 Caroline · SDR</b>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
            Primeiro contato com os leads das campanhas pelo WhatsApp da empresa. Busca a dor principal, dá a nota de interesse e termina em demonstração ou vendedora. Uma pessoa assumiu a conversa → ela sai.
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: c.ativa ? '#15803d' : 'var(--t-text-muted)' }}>
          <input type="checkbox" checked={c.ativa} onChange={e => config({ ativa: e.target.checked })} /> {c.ativa ? 'Ligada' : 'Desligada'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-text-secondary)' }}>
          <input type="checkbox" checked={c.aprovar} onChange={e => config({ aprovar: e.target.checked })} /> Aprovar antes de enviar
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-text-secondary)' }}>
          Primeiros contatos/dia
          <select value={c.limite} onChange={e => config({ limite: Number(e.target.value) })} style={{ padding: 4, borderRadius: 6 }}>
            {[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {c.pausada_motivo && <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 700 }}>⚠️ Pausou sozinha: {c.pausada_motivo}. Confira e religue.</div>}
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
        Segurança do número: nas 2 primeiras semanas no máximo 15 primeiros contatos por dia (somados às campanhas), um a cada 4 a 9 minutos, só em horário comercial, com "digitando…". Responder quem já conversa não entra no limite.
      </div>
      {msg && <span style={{ fontSize: 13, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</span>}

      {p.uso_ia && p.uso_ia.length > 0 && (() => {
        const hoje = p.uso_ia[0];
        const semana = p.uso_ia.reduce((a, d) => ({ openai: a.openai + d.openai, grok: a.grok + d.grok, laya: a.laya + d.laya }), { openai: 0, grok: 0, laya: 0 });
        const total = semana.openai + semana.grok + semana.laya;
        const pctGratis = total ? Math.round(((semana.laya) / total) * 100) : 0;
        return (
          <div style={{ ...caixa, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div><div style={{ fontSize: 11, color: 'var(--t-text-muted)', textTransform: 'uppercase' }}>OpenAI (paga) hoje</div><b style={{ fontSize: 18, color: 'var(--t-text-primary)' }}>{hoje.openai}</b> <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>· 7 dias: {semana.openai}</span></div>
            <div><div style={{ fontSize: 11, color: 'var(--t-text-muted)', textTransform: 'uppercase' }}>Grok hoje</div><b style={{ fontSize: 18, color: 'var(--t-text-primary)' }}>{hoje.grok}</b> <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>· 7 dias: {semana.grok}</span></div>
            <div><div style={{ fontSize: 11, color: 'var(--t-text-muted)', textTransform: 'uppercase' }}>Laya (grátis) hoje</div><b style={{ fontSize: 18, color: '#15803d' }}>{hoje.laya}</b> <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>· 7 dias: {semana.laya}</span></div>
            <div><div style={{ fontSize: 11, color: 'var(--t-text-muted)', textTransform: 'uppercase' }}>Feito sem custo (7 dias)</div><b style={{ fontSize: 18, color: '#15803d' }}>{pctGratis}%</b> <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>das chamadas de IA</span></div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(p.por_status).map(([s, n]) => (
          <span key={s} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: '#fff1f2', color: COR, fontWeight: 700 }}>{STATUS[s] || s}: {n}</span>
        ))}
      </div>

      {p.pendentes.length > 0 && (
        <div style={caixa}>
          <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>✋ Para você aprovar ({p.pendentes.length})</b>
          <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Ajuste o texto se quiser: cada ajuste ensina o seu jeito para a Caroline. Linha em branco separa em duas mensagens.</span>
          {p.pendentes.map(m => (
            <div key={m.id} style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 8, display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
                <b>{m.lead || 'Lead'}</b>{m.empresa ? ` · ${m.empresa}` : ''} · nota {m.meta?.nota ?? '—'} · {ACAO[m.meta?.acao] || 'segue conversando'}
                {m.meta?.nota_motivo ? <span style={{ color: 'var(--t-text-muted)' }}> ({m.meta.nota_motivo})</span> : null}
              </span>
              <textarea value={edicao[m.id] ?? m.texto} onChange={e => setEdicao(x => ({ ...x, [m.id]: e.target.value }))} rows={Math.min(8, 2 + Math.ceil(m.texto.length / 90))}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button disabled={ocupado} style={botao()} onClick={() => decidir(m, true)}>{edicao[m.id] !== undefined && edicao[m.id] !== m.texto ? 'Enviar com meu ajuste' : 'Aprovar e enviar'}</button>
                <input value={motivo[m.id] || ''} onChange={e => setMotivo(x => ({ ...x, [m.id]: e.target.value }))}
                  placeholder="O que mudar? (opcional) ex.: mais curta, fale do Simples, menos formal"
                  style={{ flex: '1 1 260px', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }} />
                <button disabled={ocupado} style={botao(false)} onClick={() => decidir(m, false)}>🔄 Refazer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={caixa}>
        <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>📥 Passar leads para a Caroline</b>
        <textarea value={texto} onChange={e => { setTexto(e.target.value); setPrevia(null); }} rows={5}
          placeholder={'Cole aqui um ou vários leads como vêm da plataforma:\nLead se Cadastrou em 13/08/2026 21:58:33 na campanha facebook - ...\nNome: João\nEmpresa: Farmácia Exemplo\nTelefone: (27) 99999-0001 ...'}
          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13, fontFamily: 'inherit' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-text-secondary)' }}>
          <input type="checkbox" checked={abertura} onChange={e => setAbertura(e.target.checked)} /> Eu já mandei a mensagem de abertura pelo celular (a Caroline retoma a partir dela)
        </label>
        {!previa && <div><button disabled={ocupado || texto.trim().length < 10} style={botao(false)} onClick={verPrevia}>Conferir</button></div>}
        {previa && (
          <div style={{ display: 'grid', gap: 6 }}>
            {previa.length === 0 && <span style={{ fontSize: 13, color: '#dc2626' }}>Não achei nenhum lead nesse texto. Ele precisa ter a linha "Telefone:".</span>}
            {previa.map((l, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--t-text-secondary)', opacity: l.pode ? 1 : 0.6 }}>
                {l.pode ? '✅' : '⛔'} <b>{l.nome || '—'}</b>{l.empresa ? ` · ${l.empresa}` : ''} · {l.telefone || 'sem telefone'}{l.segmento ? ` · ${l.segmento}` : ''}{l.campanha ? ` · ${l.campanha}` : ''}
                {l.avisos.map((a, k) => <div key={k} style={{ fontSize: 12, color: 'var(--t-text-muted)', marginLeft: 22 }}>{a}</div>)}
              </div>
            ))}
            {previa.some(l => l.pode) && <div><button disabled={ocupado} style={botao()} onClick={confirmar}>Confirmar {previa.filter(l => l.pode).length} lead(s)</button></div>}
          </div>
        )}
      </div>

      {p.leads.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--t-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: 6 }}>Lead</th><th style={{ padding: 6 }}>Situação</th><th style={{ padding: 6 }}>Termômetro</th><th style={{ padding: 6 }}>Dor principal</th><th style={{ padding: 6 }}>Confirmar temperatura (ensina a Laya)</th>
              </tr>
            </thead>
            <tbody>
              {p.leads.map(l => {
                const t = l.temperatura ? TEMP[l.temperatura] : null;
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                    <td style={{ padding: 6 }}><b style={{ color: 'var(--t-text-primary)' }}>{l.nome || l.numero}</b>{l.empresa ? <div style={{ fontSize: 12 }}>{l.empresa}</div> : null}</td>
                    <td style={{ padding: 6 }}>{STATUS[l.status] || l.status}{['AGUARDANDO', 'SEM_RESPOSTA'].includes(l.status) ? ` (${l.tentativas}/3)` : ''}</td>
                    <td style={{ padding: 6 }}>
                      {l.nota != null ? <span style={{ fontWeight: 800, color: t?.cor }}>{l.nota} · {t?.nome}</span> : '—'}
                      {l.nota_motivo ? <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{l.nota_motivo}</div> : null}
                    </td>
                    <td style={{ padding: 6, fontSize: 12 }}>{l.dados?.dor_principal || '—'}</td>
                    <td style={{ padding: 6 }}>
                      {l.nota == null ? <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>depois da conversa</span> : (
                        <select value={l.temperatura_confirmada || ''} onChange={e => e.target.value && confirmarTemp(l, e.target.value)} style={{ padding: 4, borderRadius: 6, fontSize: 12 }}>
                          <option value="">{l.temperatura_confirmada ? '' : 'Está certo?'}</option>
                          {Object.entries(TEMP).map(([k, v]) => <option key={k} value={k}>{v.nome}{k === l.temperatura ? ' (dela)' : ''}</option>)}
                        </select>
                      )}
                      {l.temperatura_confirmada ? <span style={{ fontSize: 11, color: '#15803d', marginLeft: 6 }}>✔ confirmado</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
