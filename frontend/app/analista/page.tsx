'use client';

// Analista de Resultados (pedido da Jessica, 21/10/2026): o relatório de sexta como página do CRM, com números,
// leads por temperatura (cada um abre a conversa), propostas para reativar, ranking dos retornos, decisores,
// sistemas citados, leitura das conversas pela IA e as ações da próxima semana. Os dados vêm de
// GET /comercial/analista (gerado toda sexta às 16h; "Gerar agora" refaz com os dados do momento).

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

type Num = { contatados: number; responderam: number; humanos: number; avancaram: number; demonstracoes: Record<string, number>; propostas: number; contratos: number; mensalidade_contratos: number };
type Rk = { chave: string; contatados: number; responderam: number; avancaram: number; taxa_resposta: number; taxa_avanco: number };
type Lead = { id: string; empresa: string; segmento: string | null; cidade: string | null; agente: string; status: string; temperatura: 'QUENTE' | 'MORNO' | 'FRIO'; nota: number | null;
  sistemas: string[]; interlocutor: string | null; decisor: string | null; computadores: string | number | null; resumo: string | null; ultima_cliente: string | null; conversaId: string | null;
  chance: 'alta' | 'media' | 'baixa' | null; por_que: string | null; proximo_passo: string | null };
type Acao = { acao: string; responsavel: string; quando: string; meta: string; origem: 'dados' | 'ia' };
type Relatorio = {
  semana: string; gerado_em: string; numeros: { semana: Num; mes: Num }; fila: number; ja_clientes_contatados: number;
  ranking: Record<string, Rk[]>; por_temperatura: Record<'QUENTE' | 'MORNO' | 'FRIO', number>; leads: Lead[];
  propostas_paradas: { empresa: string; cidade: string | null; segmento: string | null; status: string; plano: string | null; mensalidade: number; implantacao: number | null; vendedor: string; atualizada: string | null }[];
  mensalidade_parada: number; sistemas: { sistema: string; leads: number; avancaram: number; onde: string[] }[]; sistema_conhecido: { com: number; total: number; pct: number };
  decisores: { indicados: { empresa: string; cidade: string | null; em: string | null; status: string; respondeu: boolean; conversaId: string | null }[]; falando_com_decisor: number; decisor_identificado: number; pedimos_contato: number;
    retornos_atrasados: { empresa: string | null; combinado: string | null; para: string | null; conversaId: string | null }[] };
  demonstracoes: { titulo: string; status: string; data: string | null }[]; dados_faltando: { item: string; quantos: number }[];
  analise_ia: null | { principal: string; padroes: string[]; engajamento: string[]; ate_proposta: string[]; como_converter: string[]; campanhas: string[] };
  proxima_semana?: { de: string; ate: string; acoes: Acao[] };
};

const SECOES = [['numeros', 'Números'], ['acoes', 'Ações da próxima semana'], ['leads', 'Leads por temperatura'], ['propostas', 'Propostas'], ['ranking', 'Ranking'],
  ['decisores', 'Decisores'], ['sistemas', 'Sistemas'], ['conversas', 'Análise das conversas'], ['dados', 'Dados que faltam']] as const;
const RANKINGS: [string, string][] = [['quem_respondeu', 'Quem respondeu'], ['agente', 'Agente'], ['segmento', 'Segmento'], ['cidade', 'Cidade'], ['dia_semana', 'Dia do 1º contato'], ['hora', 'Hora do 1º contato'], ['campanha', 'Campanha']];
const COR_TEMP = { QUENTE: '#dc2626', MORNO: '#d97706', FRIO: '#64748b' } as const;
const NOME_TEMP = { QUENTE: 'Quentes', MORNO: 'Mornos', FRIO: 'Frios' } as const;
const NOME_AGENTE: Record<string, string> = { caroline: 'Caroline', julio: 'Julio', luiz_felipe: 'Luiz Felipe' };
const COR_CHANCE = { alta: '#16a34a', media: '#d97706', baixa: '#64748b' } as const;
const brl = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const dataBr = (s: string | null) => (s ? s.split('-').reverse().slice(0, 2).join('/') : '–');
const linkConversa = (id: string | null) => (id ? `/whatsapp?conversa=${id}` : null);

const card = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 } as const;
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' } as const;
const td = { padding: '8px 10px', fontSize: 13, color: 'var(--t-text-secondary)', verticalAlign: 'top' } as const;
const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const;

function Secao({ id, titulo, resumo, children }: { id: string; titulo: string; resumo?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`t-${id}`} style={{ ...card, display: 'grid', gap: 12, scrollMarginTop: 72 }}>
      <div>
        <h2 id={`t-${id}`} style={{ fontSize: 17, fontWeight: 800, color: 'var(--t-text-primary)' }}>{titulo}</h2>
        {resumo && <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', marginTop: 4, maxWidth: 860 }}>{resumo}</p>}
      </div>
      {children}
    </section>
  );
}

function Tabela({ cab, children, min = 640 }: { cab: (string | [string, 'r'])[]; children: React.ReactNode; min?: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: min }}>
        <thead><tr>{cab.map(c => Array.isArray(c) ? <th key={c[0]} style={{ ...th, textAlign: 'right' }}>{c[0]}</th> : <th key={c} style={th}>{c}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const Linha = ({ children }: { children: React.ReactNode }) => <tr style={{ borderTop: '1px solid var(--t-card-border)' }}>{children}</tr>;

function Kpi({ rotulo, semana, mes, destaque }: { rotulo: string; semana: number | string; mes: number | string; destaque?: boolean }) {
  return (
    <div style={{ ...card, padding: 12, borderColor: destaque ? '#dc2626' : 'var(--t-card-border)' }}>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: destaque ? '#dc2626' : 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{semana}</div>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>no mês: <b style={{ color: 'var(--t-text-secondary)' }}>{mes}</b></div>
    </div>
  );
}

function Barra({ valor, max, cor = '#2563eb' }: { valor: number; max: number; cor?: string }) {
  return (
    <div style={{ background: 'var(--t-card-border)', borderRadius: 4, height: 8, minWidth: 80 }} aria-hidden>
      <div style={{ width: `${max ? Math.min(100, (valor / max) * 100) : 0}%`, height: 8, borderRadius: 4, background: cor }} />
    </div>
  );
}

type RkSort = 'taxa_avanco' | 'contatados' | 'responderam' | 'avancaram';
const MEDALHA = ['🥇', '🥈', '🥉'];

function RankingInterativo({ linhas }: { linhas: Rk[] }) {
  const [sort, setSort] = useState<RkSort>('taxa_avanco');
  const [desc, setDesc] = useState(true);
  const [hover, setHover] = useState<string | null>(null);

  const sorted = useMemo(() => [...linhas].sort((a, b) => {
    const d = desc ? -1 : 1;
    const diff = (a[sort] - b[sort]) * d;
    return diff || (b.contatados - a.contatados);
  }), [linhas, sort, desc]);

  const maxContatados = Math.max(1, ...linhas.map(r => r.contatados));
  const totalContatados = linhas.reduce((s, r) => s + r.contatados, 0);
  const totalResponderam = linhas.reduce((s, r) => s + r.responderam, 0);
  const totalAvancaram = linhas.reduce((s, r) => s + r.avancaram, 0);
  const melhor = sorted[0];
  const taxaGeral = totalContatados ? Math.round((totalAvancaram / totalContatados) * 1000) / 10 : 0;

  const toggleSort = (col: RkSort) => {
    if (sort === col) setDesc(d => !d);
    else { setSort(col); setDesc(true); }
  };
  const sortIcon = (col: RkSort) => sort === col ? (desc ? ' ▾' : ' ▴') : '';

  const cabStyle = (col: RkSort): React.CSSProperties => ({
    ...th, textAlign: 'right' as const, cursor: 'pointer', userSelect: 'none' as const,
    color: sort === col ? '#2563eb' : 'var(--t-text-muted)',
    transition: 'color .15s',
  });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <style>{`
        @keyframes rkBarGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .rk-row { transition: background .15s, transform .15s; cursor: default; }
        .rk-row:hover { background: color-mix(in srgb, var(--t-card-border) 40%, transparent) !important; }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <div style={{ ...card, padding: '10px 14px', borderLeft: '3px solid #2563eb' }}>
          <div style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>Contatados</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{totalContatados}</div>
        </div>
        <div style={{ ...card, padding: '10px 14px', borderLeft: '3px solid #8b5cf6' }}>
          <div style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>Responderam</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{totalResponderam}</div>
          <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{totalContatados ? Math.round((totalResponderam / totalContatados) * 100) : 0}% dos contatados</div>
        </div>
        <div style={{ ...card, padding: '10px 14px', borderLeft: '3px solid #16a34a' }}>
          <div style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>Avançaram</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{totalAvancaram}</div>
          <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{taxaGeral}% de avanço</div>
        </div>
        {melhor && (
          <div style={{ ...card, padding: '10px 14px', borderLeft: '3px solid #f59e0b', background: 'color-mix(in srgb, #f59e0b 6%, var(--t-card-bg))' }}>
            <div style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>🏆 Melhor avanço</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t-text-primary)', marginTop: 2 }}>{melhor.chave}</div>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>{melhor.taxa_avanco}%</div>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 36 }}>#</th>
              <th style={th}>Grupo</th>
              <th style={cabStyle('contatados')} onClick={() => toggleSort('contatados')}>Contatados{sortIcon('contatados')}</th>
              <th style={cabStyle('responderam')} onClick={() => toggleSort('responderam')}>Responderam{sortIcon('responderam')}</th>
              <th style={cabStyle('avancaram')} onClick={() => toggleSort('avancaram')}>Avançaram{sortIcon('avancaram')}</th>
              <th style={cabStyle('taxa_avanco')} onClick={() => toggleSort('taxa_avanco')}>% avanço{sortIcon('taxa_avanco')}</th>
              <th style={{ ...th, width: 200 }}>Funil</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const pos = i + 1;
              const pctResp = r.contatados ? Math.round((r.responderam / r.contatados) * 100) : 0;
              const pctAvanco = r.contatados ? Math.round((r.avancaram / r.contatados) * 100) : 0;
              const isHover = hover === r.chave;
              return (
                <tr key={r.chave} className="rk-row"
                  style={{ borderTop: '1px solid var(--t-card-border)', transform: isHover ? 'scale(1.005)' : 'none' }}
                  onMouseEnter={() => setHover(r.chave)} onMouseLeave={() => setHover(null)}>
                  <td style={{ ...td, textAlign: 'center', fontSize: 15 }}>
                    {pos <= 3 ? MEDALHA[pos - 1] : <span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>{pos}</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--t-text-primary)', fontWeight: 700 }}>
                    {r.chave}
                  </td>
                  <td style={{ ...tdNum, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--t-card-border)', overflow: 'hidden' }}>
                        <div style={{ width: `${(r.contatados / maxContatados) * 100}%`, height: '100%', borderRadius: 3, background: '#93c5fd', animation: 'rkBarGrow .6s ease-out', transformOrigin: 'left' }} />
                      </div>
                      {r.contatados}
                    </div>
                  </td>
                  <td style={tdNum}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {r.responderam}
                      <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: pctResp >= 50 ? 'color-mix(in srgb, #16a34a 15%, transparent)' : 'color-mix(in srgb, var(--t-text-muted) 12%, transparent)', color: pctResp >= 50 ? '#16a34a' : 'var(--t-text-muted)' }}>
                        {pctResp}%
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdNum, fontWeight: 700, color: r.avancaram > 0 ? '#16a34a' : 'var(--t-text-muted)' }}>
                    {r.avancaram}
                  </td>
                  <td style={{ ...tdNum, fontWeight: 800, fontSize: 15 }}>
                    <span style={{ color: r.taxa_avanco >= 20 ? '#16a34a' : r.taxa_avanco >= 10 ? '#d97706' : 'var(--t-text-secondary)' }}>
                      {r.taxa_avanco}%
                    </span>
                  </td>
                  <td style={{ ...td, width: 200, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} title={`Responderam ${pctResp}% · Avançaram ${pctAvanco}%`}>
                      <div style={{ height: 7, borderRadius: 4, background: 'var(--t-card-border)', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4, width: `${pctResp}%`, background: 'linear-gradient(90deg, #818cf8, #a78bfa)', animation: 'rkBarGrow .5s ease-out', transformOrigin: 'left' }} />
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: 'var(--t-card-border)', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4, width: `${pctAvanco}%`, background: 'linear-gradient(90deg, #34d399, #16a34a)', animation: 'rkBarGrow .7s ease-out', transformOrigin: 'left' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--t-text-muted)' }}>
                        <span>responderam</span>
                        <span>avançaram</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>{titulo}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
        {itens.map((t, i) => <li key={i} style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{t}</li>)}
      </ul>
    </div>
  );
}

export default function AnalistaPage() {
  return <Suspense fallback={null}><Analista /></Suspense>;
}

function Analista() {
  const params = useSearchParams();
  const [semana, setSemana] = useState<string | null>(params.get('semana'));
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [semanas, setSemanas] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [temp, setTemp] = useState<'QUENTE' | 'MORNO' | 'FRIO'>('QUENTE');
  const [rk, setRk] = useState('quem_respondeu');
  const [feitas, setFeitas] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    try {
      const r = await apiClient.getAnalistaResultados(semana);
      const d = r.data?.data || {};
      setRel(d.relatorio || null); setSemanas(d.semanas || []); setGerando(!!d.gerando); setEstado('ok');
    } catch { setEstado('erro'); }
  }, [semana]);
  useEffect(() => { carregar(); }, [carregar]);
  // Enquanto gera (1 a 3 min por causa da IA), confere a cada 15 s.
  useEffect(() => { if (!gerando) return; const i = setInterval(carregar, 15_000); return () => clearInterval(i); }, [gerando, carregar]);

  const chaveFeitas = rel ? `analista.acoes.${rel.semana}` : null;
  useEffect(() => {
    if (!chaveFeitas) return;
    try { setFeitas(JSON.parse(localStorage.getItem(chaveFeitas) || '{}')); } catch { setFeitas({}); }
  }, [chaveFeitas]);
  const marcar = (k: string) => setFeitas(f => {
    const n = { ...f, [k]: !f[k] };
    try { if (chaveFeitas) localStorage.setItem(chaveFeitas, JSON.stringify(n)); } catch { /* sem armazenamento: vale só nesta tela */ }
    return n;
  });

  const gerar = async () => { setGerando(true); try { await apiClient.gerarAnaliseResultados(); } catch { setGerando(false); } };
  const leadsDaTemp = useMemo(() => (rel?.leads || []).filter(l => l.temperatura === temp), [rel, temp]);
  const linhasRk = rel?.ranking?.[rk] || [];
  const s = rel?.numeros.semana, m = rel?.numeros.mes;
  const demos = (n?: Num) => (n ? Object.entries(n.demonstracoes || {}).filter(([k]) => ['REALIZADA', 'CONCLUIDA'].includes(k)).reduce((t, [, v]) => t + v, 0) : 0);

  return (
    <DashboardLayout>
      <div className="ios-tela analista-relatorio" style={{ padding: '0 0 32px', display: 'grid', gap: 14 }}>
        <style>{'@media print { .analista-nao-imprimir { display: none !important; } .analista-relatorio section { break-inside: avoid; } }'}</style>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 className="ios-large-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Analista de Resultados</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>
              {rel ? <>Semana de {dataBr(rel.semana)} · gerado em {new Date(rel.gerado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })} · sai sozinho toda sexta às 16h</> : 'Relatório da prospecção, toda sexta às 16h.'}
            </p>
          </div>
          <div className="analista-nao-imprimir" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {semanas.length > 0 && (
              <select aria-label="Semana" value={semana || rel?.semana || ''} onChange={e => setSemana(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }}>
                {semanas.map(x => <option key={x} value={x}>Semana de {dataBr(x)}</option>)}
              </select>
            )}
            <button onClick={() => window.print()} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Imprimir ou salvar PDF</button>
            <button onClick={gerar} disabled={gerando} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: gerando ? '#94a3b8' : '#1d4ed8', color: '#fff', fontSize: 13, fontWeight: 700, cursor: gerando ? 'wait' : 'pointer' }}>
              {gerando ? 'Gerando… (1 a 3 min)' : 'Gerar agora com os dados de hoje'}
            </button>
          </div>
        </header>

        {estado === 'carregando' && <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</p>}
        {estado === 'erro' && <p style={{ fontSize: 13, color: '#dc2626' }}>Não foi possível carregar o relatório. Confira se você está com o perfil da gestão e tente de novo.</p>}
        {estado === 'ok' && !rel && <div style={card}><p style={{ fontSize: 14, color: 'var(--t-text-secondary)' }}>Ainda não há relatório. Clique em <b>Gerar agora</b> para montar o primeiro.</p></div>}

        {rel && s && m && (<>
          <nav aria-label="Seções do relatório" className="analista-nao-imprimir" style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 0', background: 'var(--t-content-bg)' }}>
            {SECOES.map(([id, nome]) => <a key={id} href={`#${id}`} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{nome}</a>)}
          </nav>

          {rel.analise_ia?.principal && (
            <div style={{ ...card, borderLeft: '4px solid #1d4ed8' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>Recado da semana</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text-primary)' }}>{rel.analise_ia.principal}</p>
            </div>
          )}

          <Secao id="numeros" titulo="Números da prospecção" resumo={<>&quot;Responderam&quot; inclui robô de loja; avanço real é conversa, demonstração ou equipe. Fila de primeiro contato: <b>{rel.fila}</b> leads.{rel.ja_clientes_contatados ? <> {rel.ja_clientes_contatados} lojas contatadas no mês já eram clientes.</> : null}</>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Kpi rotulo="Lojas contatadas" semana={s.contatados} mes={m.contatados} />
              <Kpi rotulo="Responderam como pessoa" semana={s.humanos} mes={m.humanos} />
              <Kpi rotulo="Avançaram" semana={s.avancaram} mes={m.avancaram} />
              <Kpi rotulo="Demonstrações realizadas" semana={demos(s)} mes={demos(m)} destaque={!demos(m)} />
              <Kpi rotulo="Propostas novas" semana={s.propostas} mes={m.propostas} destaque={!m.propostas} />
              <Kpi rotulo="Contratos" semana={s.contratos} mes={`${m.contratos} (${brl(m.mensalidade_contratos)}/mês)`} destaque={!s.contratos} />
            </div>
          </Secao>

          <Secao id="acoes" titulo={`Ações da próxima semana${rel.proxima_semana ? ` (${rel.proxima_semana.de} a ${rel.proxima_semana.ate})` : ''}`} resumo="Marque o que foi feito; a marcação fica salva neste computador. As ações vêm dos dados (sempre) e da leitura das conversas pela IA.">
            {(rel.proxima_semana?.acoes || []).length === 0 ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Sem ações calculadas nesta semana.</p> : (
              <Tabela cab={['Feito', 'Ação', 'Responsável', 'Quando', 'Meta', 'Origem']} min={720}>
                {rel.proxima_semana!.acoes.map((a, i) => {
                  const k = `${i}-${a.acao.slice(0, 30)}`;
                  return (
                    <Linha key={k}>
                      <td style={td}><input type="checkbox" checked={!!feitas[k]} onChange={() => marcar(k)} aria-label={`Feito: ${a.acao}`} style={{ width: 18, height: 18 }} /></td>
                      <td style={{ ...td, color: 'var(--t-text-primary)', fontWeight: 600, textDecoration: feitas[k] ? 'line-through' : 'none' }}>{a.acao}</td>
                      <td style={td}>{a.responsavel}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{a.quando}</td>
                      <td style={td}>{a.meta}</td>
                      <td style={td}>{a.origem === 'ia' ? 'IA' : 'dados'}</td>
                    </Linha>
                  );
                })}
              </Tabela>
            )}
          </Secao>

          <Secao id="leads" titulo="Leads por temperatura" resumo="Temperatura do analista: quente = proposta na mão ou pedido de preço/pessoa nos últimos 14 dias; morno = demonstração pedida, conversa com a equipe ou sinal de compra. Cada nome abre a conversa.">
            <div role="tablist" aria-label="Temperatura" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['QUENTE', 'MORNO', 'FRIO'] as const).map(t => (
                <button key={t} role="tab" aria-selected={temp === t} onClick={() => setTemp(t)}
                  style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${COR_TEMP[t]}`, background: temp === t ? COR_TEMP[t] : 'var(--t-card-bg)', color: temp === t ? '#fff' : COR_TEMP[t], fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {NOME_TEMP[t]} · {rel.por_temperatura[t]}
                </button>
              ))}
            </div>
            {leadsDaTemp.length === 0 ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum lead nesta temperatura.</p> : (
              <Tabela cab={['Lead', 'Chance', 'O que aconteceu', 'Próximo passo', 'Sistema', 'Última resposta']} min={900}>
                {leadsDaTemp.map(l => (
                  <Linha key={l.id}>
                    <td style={td}>
                      {linkConversa(l.conversaId) ? <a href={linkConversa(l.conversaId)!} style={{ color: 'var(--t-link)', fontWeight: 700 }}>{l.empresa}</a> : <b>{l.empresa}</b>}
                      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{[l.segmento, l.cidade, NOME_AGENTE[l.agente] || l.agente, l.status.toLowerCase()].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td style={td}>{l.chance ? <span style={{ color: COR_CHANCE[l.chance], fontWeight: 700 }}>{l.chance === 'media' ? 'média' : l.chance}</span> : '–'}</td>
                    <td style={{ ...td, maxWidth: 320 }}>{l.por_que || l.resumo || '–'}</td>
                    <td style={{ ...td, maxWidth: 280, color: 'var(--t-text-primary)' }}>{l.proximo_passo || '–'}</td>
                    <td style={td}>{l.sistemas.join(', ') || '–'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataBr(l.ultima_cliente)}</td>
                  </Linha>
                ))}
              </Tabela>
            )}
          </Secao>

          <Secao id="propostas" titulo="Propostas para reativar" resumo={<><b>{rel.propostas_paradas.length}</b> propostas paradas somam <b>{brl(rel.mensalidade_parada)}/mês</b>. Já viram preço: é o caminho mais curto até o contrato. <a href="/propostas-comerciais" style={{ color: 'var(--t-link)' }}>Abrir propostas</a></>}>
            <Tabela cab={['Empresa', 'Cidade', 'Plano', ['Mensalidade', 'r'], ['Implantação', 'r'], 'Situação', 'Vendedor', 'Atualizada']} min={820}>
              {rel.propostas_paradas.map((p, i) => (
                <Linha key={i}>
                  <td style={{ ...td, color: 'var(--t-text-primary)', fontWeight: 600 }}>{p.empresa}</td>
                  <td style={td}>{p.cidade || '–'}</td>
                  <td style={td}>{p.plano || '–'}</td>
                  <td style={tdNum}>{brl(p.mensalidade)}</td>
                  <td style={tdNum}>{p.implantacao ? brl(p.implantacao) : '–'}</td>
                  <td style={td}>{p.status.toLowerCase()}</td>
                  <td style={td}>{p.vendedor || '–'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataBr(p.atualizada)}</td>
                </Linha>
              ))}
            </Tabela>
          </Secao>

          <Secao id="ranking" titulo="Ranking dos retornos (mês)" resumo="A barra mostra a % que avançou (conversa, demonstração ou equipe), que é o que importa; a resposta inclui robô de loja. Clique nos cabeçalhos das colunas para reordenar.">
            <div role="tablist" aria-label="Agrupar por" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RANKINGS.map(([k, nome]) => (
                <button key={k} role="tab" aria-selected={rk === k} onClick={() => setRk(k)}
                  style={{ padding: '7px 14px', borderRadius: 999, border: rk === k ? '1.5px solid #2563eb' : '1px solid var(--t-card-border)', background: rk === k ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : 'var(--t-card-bg)', color: rk === k ? '#fff' : 'var(--t-text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .2s', boxShadow: rk === k ? '0 2px 8px rgba(37,99,235,.25)' : 'none' }}>{nome}</button>
              ))}
            </div>
            <RankingInterativo linhas={linhasRk} />
          </Secao>

          <Secao id="decisores" titulo="Decisores" resumo={<>Falamos direto com o decisor em <b>{rel.decisores.falando_com_decisor}</b> conversas; sabemos quem decide em <b>{rel.decisores.decisor_identificado}</b>; pedimos o contato em <b>{rel.decisores.pedimos_contato}</b>.</>}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Contatos do decisor passados pela loja ({rel.decisores.indicados.length})</h3>
            {rel.decisores.indicados.length === 0 ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum nos últimos 45 dias.</p> : (
              <Tabela cab={['Loja', 'Cidade', 'Recebido', 'Situação', 'Respondeu']} min={560}>
                {rel.decisores.indicados.map((x, i) => (
                  <Linha key={i}>
                    <td style={td}>{linkConversa(x.conversaId) ? <a href={linkConversa(x.conversaId)!} style={{ color: 'var(--t-link)', fontWeight: 700 }}>{x.empresa}</a> : <b>{x.empresa}</b>}</td>
                    <td style={td}>{x.cidade || '–'}</td>
                    <td style={td}>{dataBr(x.em)}</td>
                    <td style={td}>{x.status.toLowerCase()}</td>
                    <td style={td}>{x.respondeu ? 'sim' : 'não'}</td>
                  </Linha>
                ))}
              </Tabela>
            )}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Retornos combinados que ficaram para trás ({rel.decisores.retornos_atrasados.length})</h3>
            {rel.decisores.retornos_atrasados.length === 0 ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum: todos os horários combinados foram cumpridos.</p> : (
              <Tabela cab={['Loja', 'Combinado', 'Para']} min={480}>
                {rel.decisores.retornos_atrasados.map((x, i) => (
                  <Linha key={i}>
                    <td style={td}>{linkConversa(x.conversaId) ? <a href={linkConversa(x.conversaId)!} style={{ color: 'var(--t-link)', fontWeight: 700 }}>{x.empresa || 'sem nome'}</a> : x.empresa}</td>
                    <td style={td}>{x.combinado || '–'}</td>
                    <td style={td}>{dataBr(x.para)}</td>
                  </Linha>
                ))}
              </Tabela>
            )}
          </Secao>

          <Secao id="sistemas" titulo="Sistemas mais citados" resumo={<>Sabemos o sistema de <b>{rel.sistema_conhecido.com}</b> dos {rel.sistema_conhecido.total} leads que responderam ({rel.sistema_conhecido.pct}%), juntando conversas e propostas.</>}>
            {rel.sistemas.length === 0 ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum sistema citado.</p> : (
              <Tabela cab={['Sistema', ['Leads', 'r'], '', 'Onde apareceu']} min={560}>
                {rel.sistemas.map(x => (
                  <Linha key={x.sistema}>
                    <td style={{ ...td, color: 'var(--t-text-primary)', fontWeight: 600 }}>{x.sistema}</td>
                    <td style={tdNum}>{x.leads}</td>
                    <td style={{ ...td, width: 140 }}><Barra valor={x.leads} max={rel.sistemas[0].leads} cor="#64748b" /></td>
                    <td style={td}>{x.onde.join(', ')}</td>
                  </Linha>
                ))}
              </Tabela>
            )}
          </Secao>

          <Secao id="conversas" titulo="Análise das conversas" resumo={rel.analise_ia ? 'Leitura das 25 conversas com mais sinal, feita pela IA a partir do que o cliente escreveu.' : 'A leitura pela IA não ficou pronta nesta edição; os números acima valem.'}>
            {rel.analise_ia && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <Lista titulo="O que trava as conversas" itens={rel.analise_ia.padroes} />
                <Lista titulo="Como aumentar o engajamento" itens={rel.analise_ia.engajamento} />
                <Lista titulo="Como chegar ao menos até a proposta" itens={rel.analise_ia.ate_proposta} />
                <Lista titulo="Como converter mais" itens={rel.analise_ia.como_converter} />
                <Lista titulo="Campanhas (farmácia e padaria)" itens={rel.analise_ia.campanhas} />
              </div>
            )}
          </Secao>

          <Secao id="dados" titulo="Dados que faltam para estudar melhor" resumo="Quanto mais destes campos preenchidos, melhor a análise da próxima sexta.">
            <Tabela cab={['O que falta', ['Quantos', 'r']]} min={420}>
              {rel.dados_faltando.map(x => (
                <Linha key={x.item}><td style={td}>{x.item}</td><td style={{ ...tdNum, fontWeight: 700, color: x.quantos ? '#dc2626' : '#16a34a' }}>{x.quantos}</td></Linha>
              ))}
            </Tabela>
          </Secao>
        </>)}
      </div>
    </DashboardLayout>
  );
}
