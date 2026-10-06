'use client';

// Painel da IA: visão panorâmica do Escritório virtual (17 agentes) num período.
// Blocos: funil dos agentes, produtividade por agente, atendimento e horários,
// equipe/qualidade/mercado. Dados prontos de GET /assistente/painel-ia.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

type Periodo = 'hoje' | '7d' | '30d';
const AZUL = '#2E6EAB';
// Série categórica validada (claro): recebidas, agentes, pessoas.
const COR_SERIE = { recebidas: '#2a78d6', agentes: '#eb6834', pessoas: '#1baf7a' };
// Rampa sequencial azul (1 tom, claro → escuro) para o mapa de horários.
const RAMPA = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const painel: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10 };
const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' };
const secao: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--t-text-secondary)' };
const titulo: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 650, color: 'var(--t-text-primary)' };
const nf = (v: number) => Number(v || 0).toLocaleString('pt-BR');
const minutos = (v: number | null) => (v == null ? '—' : v < 1 ? 'menos de 1 min' : v < 60 ? `${v} min` : `${Math.floor(v / 60)}h${String(v % 60).padStart(2, '0')}`);
const STATUS: Record<string, [string, string]> = { trabalhando: ['Trabalhando', '#16a34a'], parado: ['Ligado, sem ação agora', 'var(--t-text-muted)'], desligado: ['Desligado', '#b45309'] };

function Pilulas({ valor, onChange }: { valor: Periodo; onChange: (v: Periodo) => void }) {
  return (
    <div role="group" aria-label="Período" style={{ display: 'flex', gap: 6 }}>
      {([['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias']] as [Periodo, string][]).map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={valor === k}
          style={{ fontSize: 13, fontWeight: valor === k ? 600 : 500, padding: '6px 14px', minHeight: 36, borderRadius: 999, cursor: 'pointer',
            border: `1px solid ${valor === k ? `${AZUL}55` : 'var(--t-card-border)'}`, background: valor === k ? `${AZUL}0f` : 'transparent', color: valor === k ? AZUL : 'var(--t-text-secondary)' }}>{l}</button>
      ))}
    </div>
  );
}

function Indicador({ l, v, s, cor }: { l: string; v: string; s?: string; cor?: string }) {
  return (
    <div style={{ ...painel, padding: '14px 16px', display: 'grid', gap: 4 }}>
      <div style={rotulo}>{l}</div>
      <div style={{ fontSize: 26, fontWeight: 650, lineHeight: 1.15, color: cor || 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{s}</div>}
    </div>
  );
}

function Barra({ l, v, max, extra }: { l: string; v: number; max: number; extra?: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--t-text-primary)' }}>{l}</span>
        <span style={{ color: 'var(--t-text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}><b style={{ color: 'var(--t-text-primary)' }}>{nf(v)}</b>{extra ? ` · ${extra}` : ''}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--t-content-bg)' }}>
        <div style={{ width: `${max ? Math.max(v ? 2 : 0, (v / max) * 100) : 0}%`, height: 8, borderRadius: 4, background: AZUL }} />
      </div>
    </div>
  );
}

function Numeros({ itens }: { itens: [string, any][] }) {
  return (
    <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
      {itens.map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
          <dt style={{ color: 'var(--t-text-secondary)' }}>{l}</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function DicaDia({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...painel, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--t-text-secondary)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color }} />{p.name}<b style={{ marginLeft: 'auto', color: 'var(--t-text-primary)' }}>{nf(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

function MapaHorarios({ mapa }: { mapa: number[][] }) {
  const max = Math.max(1, ...mapa.flat());
  const horas = Array.from({ length: 24 }, (_, h) => h);
  const cor = (v: number) => (v ? RAMPA[Math.min(RAMPA.length - 1, Math.floor((v / max) * (RAMPA.length - 1e-9)))] : 'var(--t-content-bg)');
  const pico = mapa.flatMap((l, d) => l.map((v, h) => ({ v, d, h }))).sort((a, b) => b.v - a.v)[0];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }} aria-label="Mensagens recebidas por dia da semana e hora">
          <thead><tr><th />{horas.map(h => <th key={h} style={{ fontWeight: 500, color: 'var(--t-text-muted)', width: 22 }}>{h % 3 === 0 ? `${h}h` : ''}</th>)}</tr></thead>
          <tbody>
            {mapa.map((linha, d) => (
              <tr key={d}>
                <th style={{ fontWeight: 500, color: 'var(--t-text-muted)', textAlign: 'left', paddingRight: 6 }}>{DIAS[d]}</th>
                {linha.map((v, h) => <td key={h} title={`${DIAS[d]} ${h}h: ${v} mensage${v === 1 ? 'm' : 'ns'}`} style={{ width: 22, height: 22, borderRadius: 4, background: cor(v) }} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--t-text-muted)' }}>
        <span>menos</span><span style={{ display: 'flex', gap: 2 }}>{RAMPA.map(c => <span key={c} style={{ width: 14, height: 10, borderRadius: 2, background: c }} />)}</span><span>mais</span>
        {pico?.v ? <span style={{ marginLeft: 8 }}>Pico: <b style={{ color: 'var(--t-text-primary)' }}>{DIAS[pico.d]} às {pico.h}h</b> ({pico.v})</span> : null}
      </div>
    </div>
  );
}

export default function PainelIaPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [d, setD] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);
  useEffect(() => {
    if (!isAuthenticated) return;
    setCarregando(true); setErro(null);
    apiClient.getPainelIa(periodo).then(r => setD(r.data.data)).catch((e: any) => setErro(e?.response?.data?.message || 'Não foi possível carregar o painel.')).finally(() => setCarregando(false));
  }, [periodo, isAuthenticated]);
  if (loading || !isAuthenticated) return null;

  const r = d?.resumo, at = d?.atendimento, eq = d?.equipe;
  const agentesMsg = d ? [...d.agentes].filter((a: any) => a.mensagens).sort((a: any, b: any) => b.mensagens - a.mensagens) : [];
  const maxOrigem = d ? Math.max(1, ...d.origens.map((o: any) => o.leads)) : 1;
  const dias = at?.por_dia.map((x: any) => ({ ...x, rot: new Date(`${x.dia}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })) || [];

  return (
    <DashboardLayout>
      <style>{`.pi-grid{display:grid;gap:12px}.pi-6{grid-template-columns:repeat(6,minmax(0,1fr))}.pi-2{grid-template-columns:1fr 1fr}.pi-3{grid-template-columns:repeat(3,minmax(0,1fr))}
        @media (max-width:1150px){.pi-6{grid-template-columns:repeat(3,minmax(0,1fr))}.pi-3{grid-template-columns:1fr 1fr}}
        @media (max-width:760px){.pi-6{grid-template-columns:repeat(2,minmax(0,1fr))}.pi-2,.pi-3{grid-template-columns:1fr}}
        .pi-tab{width:100%;border-collapse:collapse;font-size:13px}.pi-tab th{font-size:12px;font-weight:500;color:var(--t-text-muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--t-card-border);white-space:nowrap}
        .pi-tab td{padding:10px 12px;border-top:1px solid var(--t-card-border);color:var(--t-text-primary);vertical-align:top}.pi-tab .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}`}</style>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--t-text-primary)' }}>Painel da IA</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-text-muted)' }}>Visão panorâmica do Escritório virtual: o que os {r?.agentes_total || 17} agentes fizeram, o que virou resultado e onde estão os gargalos.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {d?.gerado_em && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Atualizado às {new Date(d.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            <Pilulas valor={periodo} onChange={setPeriodo} />
          </div>
        </header>

        {carregando && !d ? <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={22} /></div>
          : erro ? <div style={{ ...painel, padding: 16, color: '#dc2626', fontSize: 13 }}>{erro}</div>
          : d && (
          <div style={{ display: 'grid', gap: 24, opacity: carregando ? 0.6 : 1 }}>
            {/* Visão geral */}
            <section className="pi-grid pi-6">
              <Indicador l="Contatos novos" v={nf(r.contatos_novos)} s="conversas novas no WhatsApp" />
              <Indicador l="Mensagens recebidas" v={nf(r.mensagens_recebidas)} s={`${nf(at.conversas_no_periodo)} conversas movimentadas`} />
              <Indicador l="Feito pelos agentes" v={`${r.automacao_pct}%`} cor={AZUL} s={`${nf(r.enviadas_agentes)} msgs dos agentes · ${nf(r.enviadas_pessoas)} das pessoas`} />
              <Indicador l="Demonstrações marcadas" v={nf(r.demos)} />
              <Indicador l="Vendas fechadas" v={nf(r.vendas_fechadas)} cor={r.vendas_fechadas ? '#16a34a' : undefined} />
              <Indicador l="Agentes ligados" v={`${r.agentes_ligados}/${r.agentes_total}`} s={r.falhas_envio ? `${r.falhas_envio} falhas de envio` : 'nenhuma falha de envio'} />
            </section>

            {/* Agora */}
            {(at.agora.aguardando_resposta > 0 || at.agora.sem_dono > 0 || at.agora.mensagens_para_aprovar > 0) && (
              <div style={{ ...painel, padding: '12px 16px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, borderColor: '#d9770655', background: '#d977060a', color: 'var(--t-text-secondary)' }}>
                <AlertTriangle size={16} color="#d97706" />
                <b style={{ color: '#b45309' }}>Agora</b>
                <span><b style={{ color: 'var(--t-text-primary)' }}>{at.agora.aguardando_resposta}</b> conversa(s) esperando resposta</span>
                <span><b style={{ color: 'var(--t-text-primary)' }}>{at.agora.sem_dono}</b> conversa(s) ativas sem dono (7 dias)</span>
                <span><b style={{ color: 'var(--t-text-primary)' }}>{at.agora.mensagens_para_aprovar}</b> mensagem(ns) de agente para você aprovar</span>
              </div>
            )}

            {/* 1. Funil dos agentes */}
            <section style={{ display: 'grid', gap: 12 }}>
              <h2 style={titulo}>Funil dos agentes</h2>
              <div className="pi-grid pi-2">
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 14 }}>
                  <div style={secao}>Do contato à venda</div>
                  {d.funil.map((f: any) => (
                    <Barra key={f.etapa} l={f.etapa} v={f.valor} max={d.funil[0].valor || 1}
                      extra={f.da_anterior_pct != null ? `${f.da_anterior_pct}% da etapa anterior` : f.do_topo_pct != null && f.do_topo_pct !== 100 ? 'inclui outros canais' : undefined} />
                  ))}
                  <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Conversão do contato à venda no período: <b style={{ color: 'var(--t-text-primary)' }}>{d.funil[0].valor ? `${((d.funil.at(-1).valor / d.funil[0].valor) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</b></div>
                </div>
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 14, alignContent: 'start' }}>
                  <div style={secao}>Origem dos leads novos</div>
                  {d.origens.length ? d.origens.map((o: any) => <Barra key={o.origem} l={o.origem} v={o.leads} max={maxOrigem} />) : <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum lead novo no período.</span>}
                </div>
              </div>
              <div style={{ ...painel, padding: 16, display: 'grid', gap: 10 }}>
                <div style={secao}>Agentes que abordam leads</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="pi-tab">
                    <thead><tr><th>Agente</th><th className="n">Abordados</th><th className="n">Responderam</th><th className="n">Demos</th><th className="n">Passados para pessoa</th><th className="n">Sem interesse</th><th className="n">Na fila</th><th className="n">Para aprovar</th></tr></thead>
                    <tbody>{d.sdrs.map((s: any) => (
                      <tr key={s.agente}><td>{s.nome}</td><td className="n">{nf(s.abordados)}</td><td className="n">{nf(s.responderam)}{s.taxa_resposta != null ? ` (${s.taxa_resposta}%)` : ''}</td><td className="n">{nf(s.demo)}</td><td className="n">{nf(s.humano)}</td><td className="n">{nf(s.sem_interesse)}</td><td className="n">{nf(s.fila)}</td>
                        <td className="n" style={{ color: s.para_aprovar ? '#b45309' : undefined }}>{nf(s.para_aprovar)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 2. Produtividade por agente */}
            <section style={{ display: 'grid', gap: 12 }}>
              <h2 style={titulo}>Produtividade por agente</h2>
              {agentesMsg.length > 0 && (
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 12 }}>
                  <div style={secao}>Quem mais conversou com clientes</div>
                  {agentesMsg.map((a: any) => <Barra key={a.id} l={a.nome} v={a.mensagens} max={agentesMsg[0].mensagens}
                    extra={`${nf(a.conversas)} conversas${a.taxa_resposta != null ? ` · ${a.taxa_resposta}% responderam` : ''}${a.falhas ? ` · ${a.falhas} falhas` : ''}`} />)}
                </div>
              )}
              <div style={{ ...painel, overflowX: 'auto' }}>
                <table className="pi-tab">
                  <thead><tr><th>Agente</th><th>Situação</th><th className="n">Mensagens</th><th className="n">Conversas</th><th className="n">Responderam</th><th>Entregas no período</th></tr></thead>
                  <tbody>{d.agentes.map((a: any) => {
                    const [st, cor] = STATUS[a.status] || ['—', 'var(--t-text-muted)'];
                    return (
                      <tr key={a.id}>
                        <td style={{ minWidth: 220 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: a.cor, flexShrink: 0 }} /><b style={{ fontWeight: 600 }}>{a.nome}</b></div>
                          <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginLeft: 16 }}>{a.funcao}</div>
                        </td>
                        <td style={{ minWidth: 180 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: cor }}>{st}</div>
                          {a.observacao && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{a.observacao}</div>}
                          {a.ultima && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Última: {a.ultima.texto} · {new Date(a.ultima.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
                        </td>
                        <td className="n">{a.mensagens ? nf(a.mensagens) : '—'}</td>
                        <td className="n">{a.conversas ? nf(a.conversas) : '—'}</td>
                        <td className="n">{a.taxa_resposta != null ? `${a.taxa_resposta}%` : '—'}</td>
                        <td style={{ minWidth: 220, fontSize: 12, color: 'var(--t-text-secondary)' }}>{a.entregas.length ? a.entregas.map((e: any) => `${e.rotulo}: ${nf(e.valor)}`).join(' · ') : '—'}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </section>

            {/* 3. Atendimento e horários */}
            <section style={{ display: 'grid', gap: 12 }}>
              <h2 style={titulo}>Atendimento e horários</h2>
              <div className="pi-grid pi-3">
                <Indicador l="1ª resposta dos agentes (mediana)" v={minutos(at.primeira_resposta.agentes.mediana_min)} s={`${nf(at.primeira_resposta.agentes.qtd)} conversas`} cor={AZUL} />
                <Indicador l="1ª resposta das pessoas (mediana)" v={minutos(at.primeira_resposta.pessoas.mediana_min)} s={`${nf(at.primeira_resposta.pessoas.qtd)} conversas`} />
                <Indicador l="Clientes sem resposta" v={nf(at.primeira_resposta.sem_resposta)} s="chamaram e ninguém respondeu no período" cor={at.primeira_resposta.sem_resposta ? '#b45309' : undefined} />
              </div>
              <div className="pi-grid pi-2">
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 12, minWidth: 0 }}>
                  <div style={secao}>Mensagens por dia</div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dias} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--t-card-border)" />
                        <XAxis dataKey="rot" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} />
                        <YAxis width={36} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} />
                        <Tooltip content={<DicaDia />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="recebidas" name="Recebidas" stroke={COR_SERIE.recebidas} strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="agentes" name="Enviadas pelos agentes" stroke={COR_SERIE.agentes} strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="pessoas" name="Enviadas pelas pessoas" stroke={COR_SERIE.pessoas} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 12, minWidth: 0 }}>
                  <div style={secao}>Quando os clientes chamam (mensagens recebidas)</div>
                  <MapaHorarios mapa={at.mapa} />
                </div>
              </div>
            </section>

            {/* 4. Equipe, qualidade e mercado */}
            <section style={{ display: 'grid', gap: 12 }}>
              <h2 style={titulo}>Equipe, qualidade e mercado</h2>
              <div className="pi-grid pi-3">
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 10, alignContent: 'start' }}>
                  <div style={secao}>Mural da equipe</div>
                  <Numeros itens={[['Dúvidas levantadas', eq.mural.duvidas], ['Dúvidas em aberto', eq.mural.duvidas_abertas], ['Respostas do Rafael', eq.mural.respostas], ['Orientações', eq.mural.orientacoes], ['Experiências compartilhadas', eq.mural.experiencias], ['Passagens de contexto', eq.mural.contexto], ['Conversas entre agentes', eq.mural.conversas], ['Reuniões', eq.mural.reunioes]]} />
                </div>
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 10, alignContent: 'start' }}>
                  <div style={secao}>Clientes da base</div>
                  <Numeros itens={[['Boas-vindas (Helena)', eq.pos_venda.boas_vindas], ['Pesquisas enviadas', eq.pos_venda.pesquisas],
                    ['Nota da pesquisa', eq.pos_venda.nota_pesquisa != null ? `${eq.pos_venda.nota_pesquisa.toFixed(1)} (${eq.pos_venda.respostas_pesquisa})` : '—'],
                    ['CSAT do suporte (1 a 5)', eq.pos_venda.csat_media != null ? `${eq.pos_venda.csat_media.toFixed(1)} (${eq.pos_venda.csat_respostas})` : '—'],
                    ['Implantações em andamento', eq.implantacao.em_andamento], ['Paradas em espera', eq.implantacao.em_espera], ['Avisos do Otávio ao técnico', eq.implantacao.avisos]]} />
                </div>
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 10, alignContent: 'start' }}>
                  <div style={secao}>Aprendizado e mercado</div>
                  <Numeros itens={[['Conversas analisadas (Laya)', eq.laya.analisadas], ['Exemplos ensinados', `${nf(eq.laya.ensinadas)} (total ${nf(eq.laya.ensinadas_total)})`],
                    ['Pesquisas do setor (Sofia)', eq.mercado.pesquisas_sofia], ['Documentos do Rafael', eq.mercado.docs_rafael], ['Concorrência (Olívia)', eq.mercado.docs_olivia],
                    ['Documentos de CS (Mila)', eq.mercado.docs_mila], ['Informativos (Joana)', eq.mercado.informativos_joana], ['Esperando sua aprovação', eq.mercado.para_aprovar],
                    ['Campanhas enviadas (Zequinha)', `${nf(eq.campanhas.enviadas)}${eq.campanhas.falhas ? ` · ${eq.campanhas.falhas} falhas` : ''}`]]} />
                </div>
              </div>
              {eq.ultima_reuniao && (
                <div style={{ ...painel, padding: 16, display: 'grid', gap: 6 }}>
                  <div style={secao}>Última reunião da equipe · {new Date(eq.ultima_reuniao.em).toLocaleDateString('pt-BR')}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)' }}>{eq.ultima_reuniao.assunto}</div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap' }}>{eq.ultima_reuniao.texto}</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
