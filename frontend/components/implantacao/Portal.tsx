'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  X, Loader2, CheckCircle, Hourglass, AlertTriangle, Rocket, FileText, Image as ImageIcon, Link2, Copy, Bell, Send,
  GraduationCap, Bug, Clock, ClipboardList, Mail, MessageSquare, Play, Users, Settings, BarChart2,
} from 'lucide-react';
import { BotoesDemanda, fmtDur, NOME_ESPERA } from './Cronometro';

// Portal de implantação e serviços: quadro (colunas do Trello), ficha da demanda, avisos, painel e configurações.

const erroDe = (e: any) => e?.response?.data?.message || 'Não foi possível agora. Tente de novo.';
const avisarCronometro = () => window.dispatchEvent(new Event('cronometro:mudou'));
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const fmtDataHora = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const paraInputData = (s?: string | null) => (s ? new Date(new Date(s).getTime() - 3 * 3600000).toISOString().slice(0, 10) : '');
const btn = (cor: string, cheio = true): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
  border: cheio ? 'none' : `1px solid ${cor}55`, background: cheio ? cor : 'transparent', color: cheio ? '#fff' : cor,
});
const cartao: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12 };
const rotulo: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 };

const COR_SLA: Record<string, { cor: string; txt: string }> = {
  NO_PRAZO: { cor: '#16a34a', txt: 'No prazo' }, EM_RISCO: { cor: '#d97706', txt: 'Prazo em risco' }, ESTOURADO: { cor: '#dc2626', txt: 'Prazo estourado' },
  CUMPRIDO: { cor: '#0891b2', txt: 'Cumprido' }, CUMPRIDO_ATRASO: { cor: '#7c3aed', txt: 'Cumprido com atraso' },
};

function SlaBadge({ sla, etapa }: { sla: any; etapa?: string }) {
  if (!sla) return <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Sem prazo</span>;
  const c = COR_SLA[sla.situacao] || COR_SLA.NO_PRAZO;
  return (
    <span title={`Prazo da ${etapa || 'demanda'}: ${fmtData(sla.prazo)} · ${sla.pct}% do tempo usado`}
      style={{ fontSize: 11, fontWeight: 700, color: c.cor, background: `${c.cor}14`, border: `1px solid ${c.cor}40`, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {c.txt} · {fmtData(sla.prazo)}
    </span>
  );
}

function Barra({ pct, cor = '#2E6EAB' }: { pct: number; cor?: string }) {
  return (
    <div style={{ height: 6, background: 'var(--t-content-bg)', borderRadius: 99, overflow: 'hidden' }} aria-label={`${pct}%`}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: cor, borderRadius: 99, transition: 'width .3s' }} />
    </div>
  );
}

// ─── Quadro ──────────────────────────────────────────────────────────────────

export function QuadroDemandas({ gestao, abrirId, onAberto }: { gestao: boolean; abrirId?: string | null; onAberto?: () => void }) {
  const [dados, setDados] = useState<{ colunas: { key: string; label: string }[]; cards: any[] } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [modulo, setModulo] = useState<'' | 'IMPLANTACAO' | 'SERVICO'>('');
  useEffect(() => { if (abrirId) { setAberta(abrirId); onAberto?.(); } }, [abrirId, onAberto]);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ocultarFinalizados, setOcultarFinalizados] = useState(true);
  const carregar = useCallback(async () => {
    try { const r = await apiClient.getQuadroImplantacao(null); setDados(r.data.data); } catch { setDados({ colunas: [], cards: [] }); }
  }, []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); window.addEventListener('cronometro:mudou', carregar); return () => { clearInterval(t); window.removeEventListener('cronometro:mudou', carregar); }; }, [carregar]);

  const mover = async (id: string, coluna: string) => {
    const c = dados?.cards.find(x => x.id === id);
    if (!c || c.coluna === coluna) return;
    setDados(d => d && { ...d, cards: d.cards.map(x => (x.id === id ? { ...x, coluna } : x)) });
    try { await apiClient.moverColunaImplantacao(id, coluna); } catch (e) { alert(erroDe(e)); }
    carregar();
  };

  const colunas = (dados?.colunas || []).filter(c => !(ocultarFinalizados && ['FINALIZADO', 'CANCELADOS'].includes(c.key)));
  const filtro = busca.trim().toLowerCase();
  const doModulo = (dados?.cards || []).filter(c => !modulo || c.modulo === modulo);
  const cards = doModulo.filter(c => !filtro || `${c.cliente_razao_social} ${c.cliente_cnpj || ''} ${c.tecnico_nome || ''}`.toLowerCase().includes(filtro));
  const contagem = (m: string) => (dados?.cards || []).filter(c => (!m || c.modulo === m) && !['FINALIZADO', 'CANCELADOS'].includes(c.coluna)).length;
  const resumo = useMemo(() => {
    const ativos = doModulo.filter(c => !['FINALIZADO', 'CANCELADOS'].includes(c.coluna));
    return {
      ativos: ativos.length, risco: ativos.filter(c => c.sla?.situacao === 'EM_RISCO').length, estourado: ativos.filter(c => c.sla?.situacao === 'ESTOURADO').length,
      esperando: ativos.filter(c => c.esperas_abertas.length).length, cobranca: doModulo.filter(c => c.virada_fim_em && !c.cobranca_lancada_em).length,
    };
  }, [doModulo]);

  if (!dados) return <div style={{ padding: 32, color: 'var(--t-text-muted)' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} role="tablist" aria-label="Tipo de demanda">
        {([['', 'Tudo'], ['IMPLANTACAO', 'Implantações'], ['SERVICO', 'Serviços']] as const).map(([k, l]) => (
          <button key={k || 'tudo'} role="tab" aria-selected={modulo === k} onClick={() => setModulo(k)}
            style={{ fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${modulo === k ? '#2E6EAB' : 'var(--t-card-border)'}`, background: modulo === k ? '#2E6EAB' : 'var(--t-card-bg)', color: modulo === k ? '#fff' : 'var(--t-text-secondary)' }}>
            {l} <span style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{contagem(k)}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          ['Em andamento', resumo.ativos, '#2E6EAB'], ['Prazo em risco', resumo.risco, '#d97706'], ['Prazo estourado', resumo.estourado, '#dc2626'],
          ['Paradas em espera', resumo.esperando, '#a16207'], ...(modulo !== 'SERVICO' ? [['Cobrança a lançar', resumo.cobranca, '#7c3aed']] : []),
        ].map(([l, v, cor]) => (
          <div key={l as string} style={{ ...cartao, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <b style={{ fontSize: 20, color: cor as string, fontVariantNumeric: 'tabular-nums' }}>{v as number}</b>
            <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{l}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente ou técnico" className="ps-input" style={{ width: 220 }} />
        <label style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={ocultarFinalizados} onChange={e => setOcultarFinalizados(e.target.checked)} /> Ocultar finalizados e cancelados
        </label>
      </div>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
        Entram aqui sozinhos: <b>implantações</b> quando o contrato é assinado e <b>serviços</b> quando a vendedora move o card para <b>Em execução</b> no kanban de serviços. Mostra os últimos 60 dias.
      </div>
      {cards.filter(c => !['FINALIZADO', 'CANCELADOS'].includes(c.coluna)).length === 0 && (
        <div style={{ ...cartao, padding: 22, textAlign: 'center', color: 'var(--t-text-secondary)', fontSize: 14 }}>
          Nenhuma demanda em andamento{modulo === 'SERVICO' ? ' nos serviços' : modulo === 'IMPLANTACAO' ? ' nas implantações' : ''} agora. As finalizadas aparecem ao desmarcar "Ocultar finalizados e cancelados".
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {colunas.map(col => {
          const doCol = cards.filter(c => c.coluna === col.key);
          return (
            <div key={col.key}
              onDragOver={e => { e.preventDefault(); setSobre(col.key); }} onDragLeave={() => setSobre(s => (s === col.key ? null : s))}
              onDrop={e => { e.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, col.key); setArrastando(null); }}
              style={{ ...cartao, minWidth: 250, flex: '1 1 0', background: sobre === col.key ? '#2E6EAB10' : 'var(--t-content-bg)', padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{col.label}</b>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)' }}>{doCol.length}</span>
              </div>
              {doCol.length === 0 && <div style={{ fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'center', padding: '14px 0' }}>Arraste um card para cá</div>}
              {doCol.map(c => (
                <div key={c.id} draggable onDragStart={() => setArrastando(c.id)} onDragEnd={() => setArrastando(null)} onClick={() => setAberta(c.id)}
                  style={{ ...cartao, padding: 10, cursor: 'pointer', display: 'grid', gap: 6, opacity: arrastando === c.id ? 0.5 : 1, borderLeft: `3px solid ${c.sla?.situacao === 'ESTOURADO' ? '#dc2626' : c.sla?.situacao === 'EM_RISCO' ? '#d97706' : '#2E6EAB'}` }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {c.modulo === 'SERVICO' ? <Etq cor="#0891b2">{c.tipo_servico_label || 'Serviço'}</Etq> : <Etq cor={c.tipo_base === 'BANCO_ZERADO' ? '#64748b' : '#16a34a'}>{c.tipo_base === 'BANCO_ZERADO' ? 'Banco zerado' : `Conversão${c.sistema_anterior ? ` ${c.sistema_anterior}` : ''}`}</Etq>}
                    {c.modulo === 'IMPLANTACAO' && !c.onboarding_ok && <Etq cor="#0369a1">🔒 Onboarding {c.onboarding_feitos}/{c.onboarding_total}</Etq>}
                    {c.esperas_abertas.length > 0 && <Etq cor="#a16207">⏳ {NOME_ESPERA[c.esperas_abertas[0].tipo]}</Etq>}
                    {c.ocorrencias_abertas > 0 && <Etq cor="#dc2626">🐞 {c.ocorrencias_abertas} correção</Etq>}
                    {c.virada_inicio_em && !c.virada_fim_em && <Etq cor="#7c3aed">🚀 Virada em andamento</Etq>}
                    {c.virada_fim_em && !c.cobranca_lancada_em && <Etq cor="#7c3aed">💰 Cobrança a lançar</Etq>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', lineHeight: 1.3 }}>{c.cliente_razao_social}</div>
                  <Barra pct={c.progresso} cor={c.progresso >= 100 ? '#16a34a' : '#2E6EAB'} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t-text-muted)' }}>
                    <span>{c.progresso}% · ✓ {c.checklist_feitos}/{c.checklist_total}</span>
                    <span>{c.tecnico_nome ? c.tecnico_nome.split(' ')[0] : <b style={{ color: '#dc2626' }}>sem técnico</b>}</span>
                  </div>
                  <SlaBadge sla={c.sla} etapa={c.sla_etapa} />
                  {!c.ficha_ok && c.modulo === 'IMPLANTACAO' && <span style={{ fontSize: 11, color: '#d97706' }}>📝 Ficha de coleta incompleta</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {aberta && <FichaDemanda id={aberta} gestao={gestao} onClose={() => { setAberta(null); carregar(); }} />}
    </div>
  );
}

function Etq({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: `${cor}14`, padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>;
}

// ─── Ficha da demanda ────────────────────────────────────────────────────────

type Aba = 'onboarding' | 'resumo' | 'ficha' | 'checklist' | 'virada' | 'treinamento' | 'correcoes' | 'tempos' | 'cliente' | 'historico';

export function FichaDemanda({ id, gestao, onClose, abaInicial }: { id: string; gestao: boolean; onClose: () => void; abaInicial?: Aba }) {
  const [d, setD] = useState<any | null>(null);
  const [aba, setAba] = useState<Aba>(abaInicial || 'resumo');
  const [hist, setHist] = useState<any[]>([]);
  const carregar = useCallback(async () => {
    try {
      const [r, h] = await Promise.all([apiClient.getPortalImplantacao(id), apiClient.getImplantacao(id).catch(() => null)]);
      setD(r.data.data); setHist(h?.data?.data?.atividades || []);
    } catch (e) { alert(erroDe(e)); onClose(); }
  }, [id, onClose]);
  useEffect(() => { carregar(); window.addEventListener('cronometro:mudou', carregar); return () => window.removeEventListener('cronometro:mudou', carregar); }, [carregar]);
  if (!d) return <Gaveta onClose={onClose}><div style={{ padding: 30 }}><Loader2 className="animate-spin" size={18} /></div></Gaveta>;
  const i = d.implantacao;
  const servico = i.modulo === 'SERVICO';
  const abas: [Aba, string, any][] = [
    ...(!servico && d.onboarding_secoes ? [['onboarding', d.onboarding_ok ? 'Onboarding técnico ✓' : '🔒 Onboarding técnico', Users] as [Aba, string, any]] : []),
    ['resumo', 'Resumo', ClipboardList], ...(!servico ? [['ficha', 'Ficha de coleta', FileText] as [Aba, string, any]] : []), ['checklist', 'Checklist', CheckCircle],
    ...(!servico ? [['virada', 'Virada e cobrança', Rocket] as [Aba, string, any], ['treinamento', 'Treinamento', GraduationCap] as [Aba, string, any]] : []),
    ['correcoes', `Correções${d.ocorrencias.filter((o: any) => o.situacao !== 'RESOLVIDA').length ? ` (${d.ocorrencias.filter((o: any) => o.situacao !== 'RESOLVIDA').length})` : ''}`, Bug],
    ['tempos', 'Tempos', Clock], ['cliente', 'Cliente', Users], ['historico', 'Histórico', MessageSquare],
  ];
  return (
    <Gaveta onClose={onClose}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t-text-primary)' }}>{i.cliente_razao_social}</div>
            <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
              {servico ? 'Serviço' : i.tipo_base === 'BANCO_ZERADO' ? 'Implantação · banco zerado' : `Implantação · conversão${i.sistema_anterior ? ` de ${i.sistema_anterior}` : ''}`}
              {i.cliente_cnpj ? ` · ${i.cliente_cnpj}` : ''}{i.plano ? ` · ${i.plano}` : ''} · técnico: {i.tecnico_nome || 'não designado'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar"><X size={18} style={{ color: 'var(--t-text-muted)' }} /></button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}><Barra pct={i.progresso} cor={i.progresso >= 100 ? '#16a34a' : '#2E6EAB'} /></div>
          <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{i.progresso}%</b>
          <BotoesDemanda implantacao={{ ...i, onboarding_ok: d.onboarding_ok }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '0 12px', borderBottom: '1px solid var(--t-card-border)', overflowX: 'auto' }}>
        {abas.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setAba(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px', fontSize: 12, fontWeight: aba === k ? 700 : 500, whiteSpace: 'nowrap', border: 'none', background: 'transparent', cursor: 'pointer', color: aba === k ? '#2E6EAB' : 'var(--t-text-secondary)', borderBottom: aba === k ? '2px solid #2E6EAB' : '2px solid transparent' }}>
            <Icon size={13} /> {l}
          </button>
        ))}
      </div>
      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {aba === 'onboarding' && <AbaOnboarding d={d} recarregar={carregar} irPara={setAba} />}
        {aba === 'resumo' && <AbaResumo d={d} gestao={gestao} recarregar={carregar} />}
        {aba === 'ficha' && <AbaFicha d={d} recarregar={carregar} />}
        {aba === 'checklist' && <AbaChecklist d={d} recarregar={carregar} />}
        {aba === 'virada' && <AbaVirada d={d} gestao={gestao} recarregar={carregar} />}
        {aba === 'treinamento' && <AbaTreinamento d={d} recarregar={carregar} />}
        {aba === 'correcoes' && <AbaCorrecoes d={d} recarregar={carregar} />}
        {aba === 'tempos' && <AbaTempos d={d} />}
        {aba === 'cliente' && <AbaCliente d={d} recarregar={carregar} />}
        {aba === 'historico' && (
          <div style={{ display: 'grid', gap: 8 }}>
            {hist.length === 0 && <span style={{ color: 'var(--t-text-muted)', fontSize: 13 }}>Sem registros.</span>}
            {hist.map((h: any) => (
              <div key={h.id} style={{ fontSize: 13, display: 'flex', gap: 10 }}>
                <span style={{ color: 'var(--t-text-muted)', width: 96, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtDataHora(h.created_at)}</span>
                <span style={{ color: 'var(--t-text-primary)' }}>{h.descricao} <span style={{ color: 'var(--t-text-muted)' }}>· {h.autor_nome}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Gaveta>
  );
}

function Gaveta({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(0,0,0,.45)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(1100px, 100%)', height: '100%', background: 'var(--t-card-bg)', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,.18)' }}>{children}</div>
    </div>
  );
}

function AbaResumo({ d, gestao, recarregar }: { d: any; gestao: boolean; recarregar: () => void }) {
  const i = d.implantacao;
  const [prazos, setPrazos] = useState({ v: paraInputData(i.prazo_virada), f: paraInputData(i.prazo_finalizacao) });
  const abertas = d.esperas.filter((e: any) => !e.fim);
  const resolver = async (eid: string) => { const r = prompt('O que foi feito para resolver? (opcional)'); if (r === null) return; try { await apiClient.resolverEspera(eid, r || undefined); avisarCronometro(); } catch (e) { alert(erroDe(e)); } };
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini l="Trabalho efetivo" v={fmtDur(d.tempos.trabalho_ms)} />
        <Mini l="Esperando programação" v={fmtDur(d.tempos.esperas.PROGRAMACAO?.ms || 0)} s={`${d.tempos.esperas.PROGRAMACAO?.qtd || 0} vez(es)`} cor="#a16207" />
        <Mini l="Esperando cliente" v={fmtDur(d.tempos.esperas.CLIENTE?.ms || 0)} s={`${d.tempos.esperas.CLIENTE?.qtd || 0} vez(es)`} cor="#a16207" />
        <Mini l="Prazo total até agora" v={d.tempos.prazo_total_ms != null ? `${Math.floor(d.tempos.prazo_total_ms / 864e5)} dias` : '—'} />
      </div>
      {abertas.length > 0 && (
        <div style={{ ...cartao, padding: 12, borderColor: '#d9770655', background: '#d977060a' }}>
          <div style={rotulo}>Paradas agora</div>
          {abertas.map((e: any) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, fontSize: 13 }}>
              <Hourglass size={14} color="#d97706" />
              <span style={{ flex: 1 }}><b>{NOME_ESPERA[e.tipo]}</b>{e.responsavel_nome ? ` (${e.responsavel_nome})` : ''}: {e.motivo}{e.o_que_resolver ? ` · Precisa: ${e.o_que_resolver}` : ''} <span style={{ color: 'var(--t-text-muted)' }}>· desde {fmtDataHora(e.inicio)}</span></span>
              <button onClick={() => resolver(e.id)} style={btn('#16a34a')}><CheckCircle size={12} /> Resolvido</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 10 }}>
        <div style={rotulo}>Prazos (SLA)</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {i.modulo !== 'SERVICO' && (
            <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Virada até<br />
              <input type="date" disabled={!gestao} value={prazos.v} onChange={e => setPrazos(p => ({ ...p, v: e.target.value }))} className="ps-input" /></label>
          )}
          <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{i.modulo === 'SERVICO' ? 'Concluir até' : 'Finalização até'}<br />
            <input type="date" disabled={!gestao} value={prazos.f} onChange={e => setPrazos(p => ({ ...p, f: e.target.value }))} className="ps-input" /></label>
          {gestao && <button style={btn('#2E6EAB')} onClick={async () => { try { await apiClient.ajustarPrazos(i.id, { prazo_virada: prazos.v || null, prazo_finalizacao: prazos.f || null }); recarregar(); } catch (e) { alert(erroDe(e)); } }}>Salvar prazos</button>}
        </div>
        {!gestao && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Só a gestão altera os prazos.</span>}
      </div>
      {gestao && <EnviarAviso implantacaoId={i.id} tecnicoId={i.tecnico_id} />}
    </div>
  );
}

function Mini({ l, v, s, cor }: { l: string; v: string; s?: string; cor?: string }) {
  return (
    <div style={{ ...cartao, padding: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: cor || 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s && <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{s}</div>}
    </div>
  );
}

function AbaFicha({ d, recarregar }: { d: any; recarregar: () => void }) {
  const i = d.implantacao;
  const inicial = useMemo(() => {
    const c = { ...(i.coleta || {}) };
    if (!c.tipo_base && i.tipo_base) c.tipo_base = i.tipo_base === 'BANCO_ZERADO' ? 'Banco zerado (do zero)' : 'Conversão de outro sistema';
    if (!c.sistema_anterior && i.sistema_anterior) c.sistema_anterior = i.sistema_anterior;
    return { ...c, contato_email: i.contato_email || '', contato_whatsapp: i.contato_whatsapp || '' };
  }, [i]);
  const [f, setF] = useState<Record<string, any>>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [tela, setTela] = useState<string | null>(null);
  const grupos = Array.from(new Set<string>(d.campos_coleta.map((c: any) => c.grupo)));
  const salvar = async () => { setSalvando(true); try { await apiClient.salvarColeta(i.id, f); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); } };
  const enviarTela = async (arq: File) => {
    if (arq.size > 8 * 1024 * 1024) return alert('Arquivo grande demais (máx. 8 MB).');
    const url = await new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = erro; r.readAsDataURL(arq); });
    try { await apiClient.enviarTelaSuporte(i.id, arq.name, url); recarregar(); } catch (e) { alert(erroDe(e)); }
  };
  const verTela = async () => { try { const r = await apiClient.getTelaSuporte(i.id); setTela(r.data.data.url); } catch (e) { alert(erroDe(e)); } };
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {grupos.map(g => (
        <div key={g} style={{ ...cartao, padding: 14 }}>
          <div style={{ ...rotulo, marginBottom: 10 }}>{g}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {d.campos_coleta.filter((c: any) => c.grupo === g).map((c: any) => (
              <label key={c.key} style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', gridColumn: c.tipo === 'longo' ? '1 / -1' : undefined }}>{c.label}
                {c.tipo === 'opcoes' ? (
                  <select value={f[c.key] || ''} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} className="ps-input w-full"><option value="">—</option>{c.opcoes.map((o: string) => <option key={o}>{o}</option>)}</select>
                ) : c.tipo === 'longo' ? (
                  <textarea rows={3} value={f[c.key] || ''} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} className="ps-input w-full" />
                ) : (
                  <input type={c.tipo === 'numero' ? 'number' : 'text'} value={f[c.key] || ''} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} className="ps-input w-full" />
                )}
              </label>
            ))}
            {g === 'Contato' && (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>E-mail para avisos e boletos
                  <input value={f.contato_email || ''} onChange={e => setF(p => ({ ...p, contato_email: e.target.value }))} className="ps-input w-full" /></label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>WhatsApp para avisos de andamento
                  <input value={f.contato_whatsapp || ''} onChange={e => setF(p => ({ ...p, contato_whatsapp: e.target.value }))} className="ps-input w-full" /></label>
              </>
            )}
          </div>
        </div>
      ))}
      <button disabled={salvando} onClick={salvar} style={{ ...btn('#2E6EAB'), justifyContent: 'center', padding: '10px 14px' }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : null} Salvar ficha</button>
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 10 }}>
        <div style={rotulo}>Tela do Suporte (liberação do sistema)</div>
        <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{i.tela_suporte_arquivo_id ? '✅ Tela anexada. Pode substituir enviando outra.' : 'Obrigatória para iniciar a virada.'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ ...btn('#2E6EAB', false), cursor: 'pointer' }}><ImageIcon size={13} /> Enviar imagem ou PDF
            <input type="file" accept="image/*,application/pdf" hidden onChange={e => e.target.files?.[0] && enviarTela(e.target.files[0])} /></label>
          {i.tela_suporte_arquivo_id && <button onClick={verTela} style={btn('#64748b', false)}>Ver tela</button>}
        </div>
        {tela && (tela.startsWith('data:application/pdf') ? <a href={tela} download="tela-suporte.pdf" style={{ fontSize: 13 }}>Baixar PDF</a> : <img src={tela} alt="Tela do Suporte" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--t-card-border)' }} />)}
      </div>
    </div>
  );
}

function AbaOnboarding({ d, recarregar, irPara }: { d: any; recarregar: () => void; irPara: (a: Aba) => void }) {
  const itens = d.checklist.filter((c: any) => c.grupo === 'ONBOARDING');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const i = d.implantacao;
  const feitos = itens.filter((c: any) => c.feito).length;
  const marcar = async (item: any) => { setSalvando(item.id); try { await apiClient.marcarChecklistImplantacao(item.id, !item.feito); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setSalvando(null); } };
  const copiarLink = async () => {
    let link = d.link_cliente;
    if (!link) { try { const r = await apiClient.gerarPaginaCliente(i.id); link = r.data.data.link; recarregar(); } catch (e) { return alert(erroDe(e)); } }
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { prompt('Copie o link:', link); }
  };
  if (!itens.length) return <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>O roteiro do onboarding é criado quando a gestão designa o técnico.</div>;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 8, background: d.onboarding_ok ? '#16a34a0d' : '#0369a10d', borderColor: d.onboarding_ok ? '#16a34a55' : '#0369a155' }}>
        <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>{d.onboarding_ok ? '✅ Onboarding técnico concluído' : '🔒 Primeiro contato com o cliente, antes de qualquer ação'}</b>
        <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
          {d.onboarding_ok ? 'A implantação está liberada: instalação, conversão, quadro e virada.' : 'Responsabilidade do técnico, em até 2 dias úteis após a designação. Enquanto não terminar, a instalação, a conversão, o quadro e a virada ficam travados. Use o Play na etapa "Onboarding técnico" para contar o tempo.'}
        </div>
        <Barra pct={itens.length ? (feitos / itens.length) * 100 : 0} cor={d.onboarding_ok ? '#16a34a' : '#0369a1'} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{feitos} de {itens.length} itens</span>
          <button onClick={() => irPara('ficha')} style={btn('#2E6EAB', false)}><FileText size={12} /> Preencher a ficha de coleta</button>
          <button onClick={copiarLink} style={btn('#0369a1', false)}><Link2 size={12} /> {copiado ? 'Link copiado' : 'Copiar link para o cliente aprovar'}</button>
          {i.onboarding_aprovado_em && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>Aprovado pelo cliente: {i.onboarding_aprovado_por} em {fmtDataHora(i.onboarding_aprovado_em)}</span>}
        </div>
      </div>
      {d.onboarding_secoes.map((s: any) => (
        <div key={s.secao} style={{ ...cartao, padding: 14 }}>
          <div style={{ ...rotulo, marginBottom: 6 }}>{s.secao}</div>
          {s.itens.map((t: string) => {
            const c = itens.find((x: any) => x.titulo === t);
            if (!c) return null;
            return (
              <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 4px', fontSize: 13, cursor: 'pointer', color: c.feito ? 'var(--t-text-muted)' : 'var(--t-text-primary)' }}>
                {salvando === c.id ? <Loader2 size={14} className="animate-spin" /> : <input type="checkbox" checked={c.feito} onChange={() => marcar(c)} style={{ marginTop: 2 }} />}
                <span style={{ textDecoration: c.feito ? 'line-through' : 'none' }}>{c.titulo}{c.feito && c.feito_por ? <span style={{ color: 'var(--t-text-muted)', textDecoration: 'none' }}> · {c.feito_por}</span> : null}</span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const ETAPA_ONB: { key: string; label: string; cor: string; dica: string }[] = [
  { key: 'SEM_TECNICO', label: 'Sem técnico', cor: '#dc2626', dica: 'A gestão designa o técnico' },
  { key: 'PRIMEIRO_CONTATO', label: 'Primeiro contato', cor: '#0369a1', dica: 'Técnico se apresenta ao cliente' },
  { key: 'DIAGNOSTICO', label: 'Diagnóstico', cor: '#2E6EAB', dica: 'Levantando a ficha da loja' },
  { key: 'APROVACAO', label: 'Aprovação do cliente', cor: '#7c3aed', dica: 'Cliente confere e aprova' },
  { key: 'CONCLUIDO', label: 'Concluído', cor: '#16a34a', dica: 'Implantação liberada' },
];

/** Tela "Onboarding": o primeiro contato do técnico com cada cliente, antes de qualquer ação. */
export function OnboardingTecnico({ gestao }: { gestao: boolean }) {
  const [cards, setCards] = useState<any[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const carregar = useCallback(async () => { try { const r = await apiClient.getOnboardingTecnico(); setCards(r.data.data || []); } catch { setCards([]); } }, []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  if (!cards) return <div style={{ padding: 30 }}><Loader2 className="animate-spin" size={18} /></div>;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...cartao, padding: '12px 16px', fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.55 }}>
        <b style={{ color: 'var(--t-text-primary)' }}>Onboarding técnico</b>: o primeiro contato do técnico com o cliente, <b>antes de qualquer ação</b>. O técnico se apresenta, explica as etapas e os prazos, levanta o diagnóstico da loja (empresa, estrutura, equipamentos, fiscal, estoque, integrações, operação e treinamento) e o cliente aprova. Prazo: 2 dias úteis após a designação. Só depois disso a implantação começa.
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {ETAPA_ONB.map(col => {
          const doCol = cards.filter(c => c.etapa === col.key);
          return (
            <div key={col.key} style={{ ...cartao, minWidth: 230, flex: '1 1 0', background: 'var(--t-content-bg)', padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 4px' }}>
                <b style={{ fontSize: 13, color: col.cor }}>{col.label}</b><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)' }}>{doCol.length}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t-text-muted)', padding: '0 4px' }}>{col.dica}</div>
              {doCol.length === 0 && <div style={{ fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhuma</div>}
              {doCol.map(c => (
                <button key={c.id} onClick={() => setAberta(c.id)} style={{ ...cartao, padding: 10, cursor: 'pointer', textAlign: 'left', display: 'grid', gap: 6, borderLeft: `3px solid ${c.atrasado ? '#dc2626' : col.cor}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{c.cliente_razao_social}</div>
                  <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{c.tipo_base === 'BANCO_ZERADO' ? 'Banco zerado' : `Conversão${c.sistema_anterior ? ` de ${c.sistema_anterior}` : ''}`} · {c.tecnico_nome ? c.tecnico_nome.split(' ')[0] : 'sem técnico'}</div>
                  <Barra pct={c.total ? (c.feitos / c.total) * 100 : 0} cor={col.cor} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.atrasado ? '#dc2626' : 'var(--t-text-muted)' }}>
                    <span>{c.feitos}/{c.total} itens</span>
                    <span>{c.concluido_em ? `concluído ${fmtData(c.concluido_em)}` : c.prazo ? `${c.atrasado ? 'atrasado · ' : ''}prazo ${fmtData(c.prazo)}` : 'aguardando designação'}</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {aberta && <FichaDemanda id={aberta} gestao={gestao} abaInicial="onboarding" onClose={() => { setAberta(null); carregar(); }} />}
    </div>
  );
}

const NOME_GRUPO: Record<string, string> = { INSTALACAO: 'Instalação do sistema', CONVERSAO: 'Conversão de dados', TREINAMENTO: 'Treinamento', SERVICO: 'Serviço' };

function AbaChecklist({ d, recarregar }: { d: any; recarregar: () => void }) {
  const grupos = Array.from(new Set<string>(d.checklist.map((c: any) => c.grupo))).filter(g => g !== 'ONBOARDING');
  const [salvando, setSalvando] = useState<string | null>(null);
  const marcar = async (item: any) => { setSalvando(item.id); try { await apiClient.marcarChecklistImplantacao(item.id, !item.feito); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setSalvando(null); } };
  if (!d.checklist.length) return <div style={{ color: 'var(--t-text-muted)', fontSize: 13 }}>O checklist padrão é criado quando a gestão designa o técnico.</div>;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {!d.onboarding_ok && <div style={{ ...cartao, padding: 12, fontSize: 13, background: '#0369a10d', borderColor: '#0369a155', color: 'var(--t-text-primary)' }}>🔒 Estes passos ficam liberados quando o <b>onboarding técnico</b> (primeiro contato com o cliente) estiver concluído.</div>}
      {grupos.map(g => {
        const its = d.checklist.filter((c: any) => c.grupo === g);
        const feitos = its.filter((c: any) => c.feito).length;
        return (
          <div key={g} style={{ ...cartao, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><b style={{ fontSize: 13 }}>{NOME_GRUPO[g] || g}</b><span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{feitos} de {its.length}</span></div>
            <Barra pct={its.length ? (feitos / its.length) * 100 : 0} />
            <div style={{ display: 'grid', gap: 2, marginTop: 8 }}>
              {its.map((c: any) => (
                <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 4px', fontSize: 13, cursor: 'pointer', color: c.feito ? 'var(--t-text-muted)' : 'var(--t-text-primary)' }}>
                  {salvando === c.id ? <Loader2 size={14} className="animate-spin" /> : <input type="checkbox" checked={c.feito} onChange={() => marcar(c)} style={{ marginTop: 2 }} />}
                  <span style={{ textDecoration: c.feito ? 'line-through' : 'none' }}>{c.titulo}{g === 'TREINAMENTO' && c.fase ? <span style={{ color: 'var(--t-text-muted)' }}> · fase {c.fase}</span> : null}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AbaVirada({ d, gestao, recarregar }: { d: any; gestao: boolean; recarregar: () => void }) {
  const i = d.implantacao;
  const [ocupado, setOcupado] = useState(false);
  const [retro, setRetro] = useState('');
  const legado = !i.data_assinatura || new Date(i.data_assinatura) < new Date('2026-10-02T14:00:00Z');
  const acao = async (f: () => Promise<any>, confirma?: string) => { if (confirma && !confirm(confirma)) return; setOcupado(true); try { await f(); recarregar(); avisarCronometro(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); } };
  const hojeTxt = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const passo = (ok: boolean, titulo: string, sub: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 26, height: 26, borderRadius: 99, background: ok ? '#16a34a' : 'var(--t-content-bg)', border: ok ? 'none' : '2px solid var(--t-card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ok && <CheckCircle size={15} color="#fff" />}</div>
      <div><b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>{titulo}</b><div style={{ fontSize: 13, color: 'var(--t-text-secondary)', marginTop: 2 }}>{sub}</div></div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {legado && <div style={{ ...cartao, padding: 12, fontSize: 13, color: 'var(--t-text-secondary)', background: 'var(--t-content-bg)' }}>Demanda anterior ao portal: o cliente <b>não recebe</b> nenhuma mensagem automática e ela não gera avisos.</div>}
      {gestao && !i.virada_fim_em && (
        <div style={{ ...cartao, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}><b>Virada retroativa</b> (a loja já está usando)<br /><input type="date" max={hojeTxt} value={retro} onChange={e => setRetro(e.target.value)} className="ps-input" /></label>
          <button disabled={!retro || ocupado} onClick={() => acao(() => apiClient.concluirVirada(i.id, retro), `Lançar a virada em ${retro.split('-').reverse().join('/')}? O 1º vencimento é calculado a partir dessa data e o cliente não recebe mensagem.`)} style={{ ...btn('#7c3aed'), opacity: retro ? 1 : 0.5 }}>Lançar virada retroativa</button>
        </div>
      )}
      {passo(!!i.tela_suporte_arquivo_id, 'Tela do Suporte anexada', i.tela_suporte_arquivo_id ? 'Pronta.' : 'Anexe na aba Ficha de coleta. Sem ela a virada não começa.')}
      {passo(!!i.virada_inicio_em, 'Iniciar virada', i.virada_inicio_em ? `Iniciada em ${fmtDataHora(i.virada_inicio_em)}. Neste dia a jornada do técnico começa às 7h.` : (
        <button disabled={ocupado || !i.tela_suporte_arquivo_id} onClick={() => acao(() => apiClient.iniciarVirada(i.id), 'Iniciar a virada da loja agora?')} style={{ ...btn('#7c3aed'), marginTop: 6, opacity: i.tela_suporte_arquivo_id ? 1 : 0.5 }}><Rocket size={13} /> Iniciar virada</button>
      ))}
      {passo(!!i.virada_fim_em, 'Loja virada', i.virada_fim_em ? `Em uso desde ${fmtDataHora(i.virada_fim_em)}.` : i.virada_inicio_em ? (
        <button disabled={ocupado} onClick={() => acao(() => apiClient.concluirVirada(i.id), 'Confirmar que a loja está rodando com o Prosystem? Isso define o 1º vencimento.')} style={{ ...btn('#16a34a'), marginTop: 6 }}><CheckCircle size={13} /> Loja virada</button>
      ) : 'Depois de iniciar a virada.')}
      {passo(!!i.data_primeiro_vencimento && !!i.virada_fim_em, '1º vencimento da mensalidade', i.virada_fim_em ? <>Vence em <b>{fmtData(i.data_primeiro_vencimento)}</b> (30 dias após o início de uso, no próximo dia 01, 05, 10, 15, 20 ou 25). Comissão no mês seguinte ao 1º pagamento ({i.mes_pagamento_comissao || '—'}).<br />O cliente recebe as boas-vindas com essa data, a confirmação do e-mail e a regra do boleto.</> : 'Calculado automaticamente na virada.')}
      {passo(!!i.cobranca_lancada_em, 'Cobrança lançada', i.cobranca_lancada_em ? `Lançada por ${i.cobranca_lancada_por} em ${fmtDataHora(i.cobranca_lancada_em)}.` : i.virada_fim_em ? (gestao ? (
        <button disabled={ocupado} onClick={() => acao(() => apiClient.cobrancaLancada(i.id), 'Confirmar que a cobrança da mensalidade foi lançada?')} style={{ ...btn('#7c3aed'), marginTop: 6 }}>💰 Marcar cobrança lançada</button>
      ) : 'A gestão marca quando lançar. Até lá, ela recebe aviso todo dia útil.') : 'Depois da virada.')}
    </div>
  );
}

function AbaTreinamento({ d, recarregar }: { d: any; recarregar: () => void }) {
  const itens = d.checklist.filter((c: any) => c.grupo === 'TREINAMENTO');
  const salvar = async (faseId: string, data: any) => { try { await apiClient.atualizarFaseTreinamento(faseId, data); recarregar(); } catch (e) { alert(erroDe(e)); } };
  const play = async (f: any) => { try { await apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: d.implantacao.id, etapa: 'TREINAMENTO', descricao: `Fase ${f.ordem} · ${f.nome}` }); avisarCronometro(); } catch (e) { alert(erroDe(e)); } };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>O treinamento acontece depois da virada, por fases. As horas de cada fase vêm do cronômetro (use o Play da fase). Ao marcar uma fase como realizada, o cliente recebe um resumo.</div>
      {d.fases.map((f: any) => {
        const its = itens.filter((c: any) => c.fase === f.ordem);
        return (
          <div key={f.id} style={{ ...cartao, padding: 14, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14 }}>Fase {f.ordem} · {f.nome}</b>
              <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>⏱ {fmtDur(d.horas_por_fase?.[f.ordem] || 0)} · ✓ {its.filter((c: any) => c.feito).length}/{its.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Marcada para<br /><input type="date" defaultValue={paraInputData(f.marcada_em)} onBlur={e => e.target.value !== paraInputData(f.marcada_em) && salvar(f.id, { marcada_em: e.target.value || null })} className="ps-input" /></label>
              {f.realizada_em ? <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>✅ Realizada em {fmtData(f.realizada_em)}</span>
                : <button onClick={() => confirm(`Marcar a fase ${f.ordem} como realizada hoje? O cliente recebe o resumo.`) && salvar(f.id, { realizada_em: new Date().toISOString() })} style={btn('#16a34a')}><CheckCircle size={12} /> Fase realizada</button>}
              <button onClick={() => play(f)} style={btn('#2E6EAB', false)}><Play size={12} /> Play nesta fase</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{its.map((c: any) => `${c.feito ? '✓' : '○'} ${c.titulo}`).join(' · ') || 'Sem itens nesta fase.'}</div>
          </div>
        );
      })}
    </div>
  );
}

const SIT_OC: Record<string, { txt: string; cor: string }> = { ABERTA: { txt: 'Aberta', cor: '#dc2626' }, EM_CORRECAO: { txt: 'Em correção', cor: '#d97706' }, AGUARDANDO_PROGRAMACAO: { txt: 'Aguardando programação', cor: '#a16207' }, RESOLVIDA: { txt: 'Resolvida', cor: '#16a34a' } };

function AbaCorrecoes({ d, recarregar }: { d: any; recarregar: () => void }) {
  const [nova, setNova] = useState({ titulo: '', descricao: '', gravidade: 'MEDIA' });
  const criar = async () => { if (nova.titulo.trim().length < 3) return alert('Dê um título.'); try { await apiClient.abrirOcorrencia(d.implantacao.id, nova); setNova({ titulo: '', descricao: '', gravidade: 'MEDIA' }); recarregar(); } catch (e) { alert(erroDe(e)); } };
  const mudar = async (o: any, situacao: string) => {
    const resolucao = situacao === 'RESOLVIDA' ? prompt('O que foi feito?') : undefined;
    if (situacao === 'RESOLVIDA' && resolucao === null) return;
    try { await apiClient.atualizarOcorrencia(o.id, { situacao, resolucao: resolucao || undefined }); recarregar(); } catch (e) { alert(erroDe(e)); }
  };
  const play = async (o: any) => { try { await apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: d.implantacao.id, etapa: 'CORRECAO', ocorrencia_id: o.id, descricao: o.titulo }); avisarCronometro(); } catch (e) { alert(erroDe(e)); } };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 8 }}>
        <div style={rotulo}>Registrar correção ou bug</div>
        <input value={nova.titulo} onChange={e => setNova(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex.: estoque de controlados divergente após a conversão" className="ps-input w-full" />
        <textarea rows={2} value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes (opcional)" className="ps-input w-full" />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={nova.gravidade} onChange={e => setNova(p => ({ ...p, gravidade: e.target.value }))} className="ps-input" style={{ width: 'auto' }}><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option></select>
          <button onClick={criar} style={btn('#dc2626')}><Bug size={12} /> Registrar</button>
        </div>
      </div>
      {d.ocorrencias.length === 0 && <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma correção registrada.</span>}
      {d.ocorrencias.map((o: any) => {
        const s = SIT_OC[o.situacao] || SIT_OC.ABERTA;
        return (
          <div key={o.id} style={{ ...cartao, padding: 12, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 13, flex: 1 }}>{o.titulo}</b>
              <Etq cor={o.gravidade === 'ALTA' ? '#dc2626' : o.gravidade === 'MEDIA' ? '#d97706' : '#64748b'}>{o.gravidade}</Etq>
              <Etq cor={s.cor}>{s.txt}</Etq>
              <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>⏱ {fmtDur(d.horas_por_ocorrencia?.[o.id] || 0)}</span>
            </div>
            {o.descricao && <div style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{o.descricao}</div>}
            {o.resolucao && <div style={{ fontSize: 12, color: '#16a34a' }}>Resolução: {o.resolucao}</div>}
            <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Aberta por {o.aberta_por || '—'} em {fmtDataHora(o.aberta_em)}{o.resolvida_em ? ` · resolvida em ${fmtDataHora(o.resolvida_em)}` : ''}</div>
            {o.situacao !== 'RESOLVIDA' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => play(o)} style={btn('#2E6EAB', false)}><Play size={12} /> Play na correção</button>
                {o.situacao !== 'EM_CORRECAO' && <button onClick={() => mudar(o, 'EM_CORRECAO')} style={btn('#d97706', false)}>Em correção</button>}
                {o.situacao !== 'AGUARDANDO_PROGRAMACAO' && <button onClick={() => mudar(o, 'AGUARDANDO_PROGRAMACAO')} style={btn('#a16207', false)}>Aguardando programação</button>}
                <button onClick={() => mudar(o, 'RESOLVIDA')} style={btn('#16a34a')}><CheckCircle size={12} /> Resolvida</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const NOME_ETAPA: Record<string, string> = { INSTALACAO: 'Instalação', CONVERSAO: 'Conversão', TREINAMENTO: 'Treinamento', CORRECAO: 'Correção pós-virada', SEM_ETAPA: 'Sem etapa' };

function AbaTempos({ d }: { d: any }) {
  const t = d.tempos;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Mini l="Trabalho efetivo" v={fmtDur(t.trabalho_ms)} s={`${t.sessoes} play(s)`} />
        {Object.entries(t.por_etapa).map(([k, v]) => <Mini key={k} l={NOME_ETAPA[k] || k} v={fmtDur(v as number)} />)}
      </div>
      <div style={{ ...cartao, padding: 14 }}>
        <div style={{ ...rotulo, marginBottom: 8 }}>Esperas</div>
        {Object.keys(t.esperas).length === 0 && <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma espera registrada.</span>}
        {Object.entries(t.esperas).map(([k, v]: any) => <div key={k} style={{ fontSize: 13 }}><b>{NOME_ESPERA[k]}</b>: {v.qtd} vez(es), {fmtDur(v.ms)}{v.abertas ? ` (${v.abertas} aberta)` : ''}</div>)}
        {d.esperas.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
            {d.esperas.map((e: any) => <div key={e.id} style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{fmtDataHora(e.inicio)} → {e.fim ? fmtDataHora(e.fim) : 'aberta'} · {NOME_ESPERA[e.tipo]}: {e.motivo}{e.resposta ? ` · ✅ ${e.resposta}` : ''}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

const NOME_MARCO = (m: string) => m === 'CONTRATO' ? 'Próximos passos (contrato)' : m === 'VIRADA' ? 'Loja virada + boas-vindas' : m.startsWith('TREINO_') ? `Fase ${m.slice(7)} do treinamento` : `${m.slice(1)}% concluído`;

function AbaCliente({ d, recarregar }: { d: any; recarregar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const gerar = async () => { try { await apiClient.gerarPaginaCliente(d.implantacao.id); recarregar(); } catch (e) { alert(erroDe(e)); } };
  const copiar = async () => { await navigator.clipboard.writeText(d.link_cliente); setCopiado(true); setTimeout(() => setCopiado(false), 1500); };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 8 }}>
        <div style={rotulo}>Página de acompanhamento do cliente</div>
        <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>O cliente vê o passo a passo padrão, o percentual e o tempo dedicado. Não vê esperas nem descrições internas.</div>
        {d.link_cliente ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <code style={{ fontSize: 12, background: 'var(--t-content-bg)', padding: '6px 10px', borderRadius: 8, wordBreak: 'break-all' }}>{d.link_cliente}</code>
            <button onClick={copiar} style={btn('#2E6EAB', false)}><Copy size={12} /> {copiado ? 'Copiado' : 'Copiar'}</button>
            <a href={d.link_cliente} target="_blank" rel="noreferrer" style={btn('#2E6EAB')}><Link2 size={12} /> Abrir</a>
          </div>
        ) : (
          <div><button onClick={gerar} style={btn('#2E6EAB')}><Link2 size={12} /> Criar página do cliente</button><div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 6 }}>Demanda antiga: ao criar, o cliente só recebe os próximos avisos (nada atrasado).</div></div>
        )}
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Avisos vão para: WhatsApp {d.implantacao.contato_whatsapp || (d.implantacao.coleta?.contato_telefone) || <b style={{ color: '#dc2626' }}>sem número</b>} · e-mail {d.implantacao.contato_email || <b style={{ color: '#dc2626' }}>sem e-mail</b>} (ajuste na Ficha de coleta).</div>
      </div>
      <div style={{ ...cartao, padding: 14 }}>
        <div style={{ ...rotulo, marginBottom: 8 }}>Mensagens enviadas ao cliente</div>
        {d.comunicacoes.length === 0 && <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma ainda. Saem sozinhas nos marcos: contrato, 30%, 50%, 80%, loja virada e cada fase do treinamento (dias úteis, 8h às 18h).</span>}
        {d.comunicacoes.map((c: any) => (
          <div key={c.id} style={{ padding: '8px 0', borderTop: '1px solid var(--t-card-border)', fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {c.canal === 'EMAIL' ? <Mail size={13} /> : <MessageSquare size={13} />}
              <b>{NOME_MARCO(c.marco)}</b>
              <Etq cor={c.status === 'ENVIADO' ? '#16a34a' : c.status === 'PULADO' ? '#64748b' : '#dc2626'}>{c.status === 'PULADO' ? 'não enviado (já tinha passado)' : c.status === 'SEM_DESTINO' ? 'sem contato' : c.status.toLowerCase()}</Etq>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t-text-muted)' }}>{fmtDataHora(c.created_at)}</span>
            </div>
            {c.texto && <div style={{ fontSize: 12, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.texto}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Avisos para o técnico ───────────────────────────────────────────────────

function EnviarAviso({ implantacaoId, tecnicoId }: { implantacaoId?: string | null; tecnicoId?: string | null }) {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [para, setPara] = useState(tecnicoId || '');
  const [texto, setTexto] = useState('');
  const [prioridade, setPrioridade] = useState('NORMAL');
  const [ok, setOk] = useState(false);
  useEffect(() => { apiClient.getTecnicosImplantacao().then(r => setTecnicos(r.data.data || [])).catch(() => {}); }, []);
  const enviar = async () => {
    if (!para || texto.trim().length < 2) return alert('Escolha o técnico e escreva o aviso.');
    try { await apiClient.enviarAvisoTecnico({ para_id: para, texto: texto.trim(), prioridade, implantacao_id: implantacaoId || null }); setTexto(''); setOk(true); setTimeout(() => setOk(false), 2000); } catch (e) { alert(erroDe(e)); }
  };
  return (
    <div style={{ ...cartao, padding: 14, display: 'grid', gap: 8 }}>
      <div style={rotulo}>Enviar aviso para o técnico</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={para} onChange={e => setPara(e.target.value)} className="ps-input" style={{ width: 'auto' }}><option value="">Técnico…</option>{tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
        <select value={prioridade} onChange={e => setPrioridade(e.target.value)} className="ps-input" style={{ width: 'auto' }}><option value="NORMAL">Normal</option><option value="URGENTE">Urgente (também no WhatsApp)</option></select>
      </div>
      <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} className="ps-input w-full" placeholder="Ex.: prioridade hoje é a virada da Drogaria X" />
      <div><button onClick={enviar} style={btn(prioridade === 'URGENTE' ? '#dc2626' : '#2E6EAB')}><Send size={12} /> {ok ? 'Enviado' : 'Enviar aviso'}</button></div>
    </div>
  );
}

/** Sino do topo: abre a caixa de novidades (implantações, serviços, tarefas, recados, prazos) e limpa ao abrir. */
export function SinoAvisos({ onAbrir, onAbrirDemanda }: { onAbrir: () => void; onAbrirDemanda?: (id: string) => void }) {
  const [n, setN] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<any[]>([]);
  const abrir = async () => {
    if (aberto) { setAberto(false); return; }
    try {
      const r = await apiClient.getAvisosTecnico();
      setItens((r.data.data.avisos || []).slice(0, 20));
      setAberto(true);
      if (r.data.data.nao_lidos) { await apiClient.marcarAvisosLidos().catch(() => {}); setN(0); window.dispatchEvent(new Event('avisos:mudou')); }
    } catch { onAbrir(); }
  };
  useEffect(() => {
    let anterior = -1;
    const ver = async () => {
      try {
        const r = await apiClient.getAvisosTecnico();
        const atual = r.data.data.nao_lidos || 0;
        if (anterior >= 0 && atual > anterior) {
          try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); o.start(); o.stop(ctx.currentTime + 0.5); } catch { /* sem som */ }
        }
        anterior = atual; setN(atual);
      } catch { /* sem login */ }
    };
    ver(); const t = setInterval(ver, 45000); window.addEventListener('avisos:mudou', ver);
    return () => { clearInterval(t); window.removeEventListener('avisos:mudou', ver); };
  }, []);
  const icone = (a: any) => a.tipo === 'TAREFA' ? '📋' : a.prioridade === 'URGENTE' ? '🚨' : /implanta/i.test(a.texto) && /nova/i.test(a.texto) ? '🚀' : /servi[cç]o/i.test(a.texto) && /novo/i.test(a.texto) ? '🧰' : /prazo/i.test(a.texto) ? '⏰' : '📌';
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={abrir} title="Novidades" aria-expanded={aberto} style={{ position: 'relative', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--t-card-border)', background: aberto ? 'var(--t-content-bg)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-text-secondary)' }}>
        <Bell size={15} />
        {n > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 99, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{n}</span>}
      </button>
      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div role="dialog" aria-label="Novidades" style={{ position: 'absolute', right: 0, top: 40, zIndex: 71, width: 'min(380px, calc(100vw - 24px))', maxHeight: '70vh', overflowY: 'auto', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, boxShadow: '0 16px 40px rgba(13,34,56,.18)' }}>
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--t-card-border)' }}>
              <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Novidades</b>
              <button onClick={() => { setAberto(false); onAbrir(); }} style={{ fontSize: 12, fontWeight: 700, color: '#2E6EAB', background: 'transparent', border: 'none', cursor: 'pointer' }}>Ver todas</button>
            </div>
            {itens.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--t-text-muted)' }}>Nada novo por aqui.</div>}
            {itens.map(a => (
              <button key={a.id} onClick={() => { setAberto(false); if (a.implantacao?.id && onAbrirDemanda) onAbrirDemanda(a.implantacao.id); else onAbrir(); }}
                style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--t-card-border)', background: a.lido_em ? 'transparent' : '#2E6EAB0d', cursor: 'pointer' }}>
                <span style={{ fontSize: 16, lineHeight: '20px' }}>{icone(a)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--t-text-primary)', fontWeight: a.lido_em ? 400 : 700 }}>{a.texto}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>{a.de_nome || 'Sistema'} · {fmtDataHora(a.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PainelAvisos({ gestao }: { gestao: boolean }) {
  const [meus, setMeus] = useState<any[]>([]);
  const [enviados, setEnviados] = useState<any[]>([]);
  const carregar = useCallback(async () => {
    try {
      const r = await apiClient.getAvisosTecnico(); setMeus(r.data.data.avisos || []);
      if (gestao) { const e = await apiClient.getAvisosTecnico(true); setEnviados((e.data.data.avisos || []).filter((a: any) => a.origem === 'GESTAO')); }
    } catch { /* ignore */ }
  }, [gestao]);
  useEffect(() => { carregar(); }, [carregar]);
  const lido = async (id: string) => { await apiClient.marcarAvisoLido(id).catch(() => {}); window.dispatchEvent(new Event('avisos:mudou')); carregar(); };
  const todos = async () => { await apiClient.marcarAvisosLidos().catch(() => {}); window.dispatchEvent(new Event('avisos:mudou')); carregar(); };
  const item = (a: any, meu: boolean) => (
    <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--t-card-border)', alignItems: 'flex-start', background: meu && !a.lido_em ? '#2E6EAB0a' : 'transparent' }}>
      {a.prioridade === 'URGENTE' ? <AlertTriangle size={15} color="#dc2626" /> : <Bell size={15} color="#2E6EAB" />}
      <div style={{ flex: 1, fontSize: 13 }}>
        <div style={{ color: 'var(--t-text-primary)', fontWeight: meu && !a.lido_em ? 700 : 400 }}>{a.texto}</div>
        <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{meu ? `de ${a.de_nome || 'Gestão'}` : `para ${a.para_nome}`}{a.implantacao ? ` · ${a.implantacao.cliente_razao_social}` : ''} · {fmtDataHora(a.created_at)}{!meu ? (a.lido_em ? ` · ✅ lido ${fmtDataHora(a.lido_em)}` : ' · ainda não lido') : ''}</div>
      </div>
      {meu && !a.lido_em && <button onClick={() => lido(a.id)} style={btn('#2E6EAB', false)}>Lido</button>}
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {gestao && <EnviarAviso />}
      <div style={cartao}>
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 13 }}>Meus avisos</b>{meus.some(a => !a.lido_em) && <button onClick={todos} style={btn('#2E6EAB', false)}>Marcar todos como lidos</button>}</div>
        {meus.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum aviso.</div>}
        {meus.map(a => item(a, true))}
      </div>
      {gestao && (
        <div style={cartao}>
          <div style={{ padding: '10px 14px' }}><b style={{ fontSize: 13 }}>Avisos enviados pela gestão</b></div>
          {enviados.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum.</div>}
          {enviados.map(a => item(a, false))}
        </div>
      )}
    </div>
  );
}

// ─── Painel da gestão ────────────────────────────────────────────────────────

export function PainelGestaoImplantacao() {
  const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const [de, setDe] = useState(new Date(Date.now() - 3 * 3600000 - 6 * 864e5).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hoje);
  const [p, setP] = useState<any | null>(null);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const carregar = useCallback(async () => {
    try { const [r, c] = await Promise.all([apiClient.getPainelImplantacao({ de, ate }), apiClient.getCobrancasPendentes()]); setP(r.data.data); setCobrancas(c.data.data || []); } catch (e) { alert(erroDe(e)); }
  }, [de, ate]);
  useEffect(() => { carregar(); }, [carregar]);
  const lancar = async (id: string) => { if (!confirm('Confirmar que a cobrança foi lançada?')) return; try { await apiClient.cobrancaLancada(id); carregar(); } catch (e) { alert(erroDe(e)); } };
  if (!p) return <div style={{ padding: 30 }}><Loader2 className="animate-spin" size={18} /></div>;
  const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={de} max={ate} onChange={e => setDe(e.target.value)} className="ps-input" style={{ width: 'auto' }} /> até
        <input type="date" value={ate} max={hoje} onChange={e => setAte(e.target.value)} className="ps-input" style={{ width: 'auto' }} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini l="No prazo" v={String(p.sla.NO_PRAZO || 0)} cor="#16a34a" />
        <Mini l="Prazo em risco" v={String(p.sla.EM_RISCO || 0)} cor="#d97706" />
        <Mini l="Prazo estourado" v={String(p.sla.ESTOURADO || 0)} cor="#dc2626" />
        <Mini l="Cobranças a lançar" v={String(p.cobrancas_pendentes)} cor="#7c3aed" />
        <Mini l="Esperas da programação" v={String(p.esperas.programacao.qtd)} s={`${fmtDur(p.esperas.programacao.ms)} parado · ${p.esperas.programacao.abertas} aberta(s)`} cor="#a16207" />
        <Mini l="Esperas do cliente" v={String(p.esperas.cliente.qtd)} s={fmtDur(p.esperas.cliente.ms)} />
        <Mini l="Viradas no período" v={String(p.viradas.length)} />
        <Mini l="Prazo médio de entrega" v={p.prazo_medio_ms.implantacao ? `${Math.round(p.prazo_medio_ms.implantacao / 864e5)} dias` : '—'} s={p.prazo_medio_ms.servico ? `serviços: ${(p.prazo_medio_ms.servico / 864e5).toFixed(1)} dias` : `${p.concluidas} concluída(s)`} />
      </div>
      <div style={cartao}>
        <div style={{ padding: '10px 14px' }}><b style={{ fontSize: 13 }}>Técnicos · trabalho e aproveitamento</b></div>
        {p.tecnicos.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum play no período.</div>}
        {p.tecnicos.map((t: any) => (
          <div key={t.id} style={{ padding: '10px 14px', borderTop: '1px solid var(--t-card-border)', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, alignItems: 'baseline' }}>
              <b style={{ minWidth: 140 }}>{t.nome}</b>
              <span>Trabalhado <b>{fmtDur(t.trabalhado)}</b></span><span>Na jornada <b>{fmtDur(t.dentro)}</b> de {fmtDur(t.jornada)}</span>
              <span>Aproveitamento <b style={{ color: (t.aproveitamento || 0) >= 0.75 ? '#16a34a' : (t.aproveitamento || 0) >= 0.5 ? '#d97706' : '#dc2626' }}>{pct(t.aproveitamento)}</b></span>
              <span>Hora extra <b style={{ color: '#7c3aed' }}>{fmtDur(t.extra)}</b></span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 46 }}>
              {t.dias.map((d: any) => (
                <div key={d.dia} title={`${d.dia.split('-').reverse().join('/')}: ${fmtDur(d.trabalhado_ms)} (${pct(d.aproveitamento)})`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ height: `${Math.min(100, (d.trabalhado_ms / (10 * 3600000)) * 100)}%`, background: d.extra_ms ? 'linear-gradient(#7c3aed, #2E6EAB)' : '#2E6EAB', borderRadius: 3, minHeight: d.trabalhado_ms ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{Object.entries(t.por_tipo).map(([k, v]) => `${({ DEMANDA: 'Demandas', SUPORTE: 'Suporte', REUNIAO: 'Reuniões', INTERNO: 'Interno' } as any)[k] || k}: ${fmtDur(v as number)}`).join(' · ')}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div style={cartao}>
          <div style={{ padding: '10px 14px' }}><b style={{ fontSize: 13 }}>O que mais trava (esperas da programação)</b></div>
          {p.esperas.motivos.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma no período.</div>}
          {p.esperas.motivos.map((m: any) => <div key={m.motivo} style={{ padding: '6px 14px', borderTop: '1px solid var(--t-card-border)', fontSize: 13, display: 'flex' }}><span style={{ flex: 1 }}>{m.motivo}</span><b>{m.qtd}</b></div>)}
        </div>
        <div style={cartao}>
          <div style={{ padding: '10px 14px' }}><b style={{ fontSize: 13 }}>Horas por cliente no período</b></div>
          {p.por_cliente.map((c: any) => <div key={c.cliente} style={{ padding: '6px 14px', borderTop: '1px solid var(--t-card-border)', fontSize: 13, display: 'flex', gap: 8 }}><span style={{ flex: 1 }}>{c.cliente}</span><span style={{ color: 'var(--t-text-muted)' }}>trein. {fmtDur(c.treinamento)} · corr. {fmtDur(c.correcao)}</span><b>{fmtDur(c.trabalho)}</b></div>)}
        </div>
      </div>
      <div style={cartao}>
        <div style={{ padding: '10px 14px' }}><b style={{ fontSize: 13 }}>💰 Cobranças da mensalidade a lançar</b></div>
        {cobrancas.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Tudo lançado.</div>}
        {cobrancas.map(c => (
          <div key={c.id} style={{ padding: '8px 14px', borderTop: '1px solid var(--t-card-border)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ flex: 1 }}>{c.cliente_razao_social}</b>
            <span>virada {fmtData(c.virada_fim_em)}</span><span>1º vencimento <b>{fmtData(c.data_primeiro_vencimento)}</b></span>
            {c.mensalidade ? <span>R$ {Number(c.mensalidade).toFixed(2).replace('.', ',')}</span> : null}
            <button onClick={() => lancar(c.id)} style={btn('#7c3aed')}>Cobrança lançada</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Configurações ───────────────────────────────────────────────────────────

export function ConfigPortalImplantacao() {
  const [c, setC] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => { apiClient.getConfigPortal().then(r => setC(r.data.data)).catch(e => alert(erroDe(e))); }, []);
  if (!c) return <div style={{ padding: 30 }}><Loader2 className="animate-spin" size={18} /></div>;
  const set = (caminho: string[], v: any) => setC((p: any) => { const n = structuredClone(p); let o = n; for (const k of caminho.slice(0, -1)) o = o[k]; o[caminho[caminho.length - 1]] = v; return n; });
  const salvar = async () => {
    setSalvando(true);
    try {
      await apiClient.salvarConfigPortal({ sla: c.sla, programacao: { nome: c.programacao.nome, whatsapp: c.programacao.whatsapp || '', lembrete_horas: Number(c.programacao.lembrete_horas) }, avisos_cliente: c.avisos_cliente, agente_ativo: c.agente_ativo, ofertas_ativo: c.ofertas_ativo, ofertas_dias_apos_virada: Number(c.ofertas_dias_apos_virada), catalogo: c.catalogo.filter((x: any) => x.produto?.trim()), jornada: { inicio: c.jornada.inicio, fim: c.jornada.fim, almoco_inicio: c.jornada.almoco_inicio, almoco_min: Number(c.jornada.almoco_min), virada_inicio: c.jornada.virada_inicio } });
      setOk(true); setTimeout(() => setOk(false), 2000);
    } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };
  const num = (v: any, f: (n: number) => void) => <input type="number" value={v} onChange={e => f(Number(e.target.value))} className="ps-input" style={{ width: 80 }} />;
  const liga = (v: boolean, f: (b: boolean) => void, t: string, s: string) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={v} onChange={e => f(e.target.checked)} style={{ marginTop: 3 }} /><span><b>{t}</b><br /><span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>{s}</span></span></label>
  );
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', alignItems: 'start' }}>
      <div style={{ ...cartao, padding: 16, display: 'grid', gap: 10 }}>
        <div style={rotulo}>Programação (quem resolve as esperas)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12 }}>Nome<br /><input value={c.programacao.nome} onChange={e => set(['programacao', 'nome'], e.target.value)} className="ps-input" /></label>
          <label style={{ fontSize: 12 }}>WhatsApp<br /><input value={c.programacao.whatsapp} onChange={e => set(['programacao', 'whatsapp'], e.target.value)} placeholder="27 99999-9999" className="ps-input" /></label>
          <label style={{ fontSize: 12 }}>Lembrar depois de (horas úteis)<br />{num(c.programacao.lembrete_horas, n => set(['programacao', 'lembrete_horas'], n))}</label>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Link das pendências (sem login, só as esperas da programação): <code style={{ wordBreak: 'break-all' }}>{c.link_programacao}</code>. Com o WhatsApp preenchido, ele recebe cada pendência na hora, com esse link, e pode responder "resolvido" pelo próprio WhatsApp.</div>
      </div>
      <div style={{ ...cartao, padding: 16, display: 'grid', gap: 10 }}>
        <div style={rotulo}>Prazos padrão (SLA)</div>
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          <div>Conversão: virada em {num(c.sla.CONVERSAO.virada, n => set(['sla', 'CONVERSAO', 'virada'], n))} dias · finalização em {num(c.sla.CONVERSAO.final, n => set(['sla', 'CONVERSAO', 'final'], n))} dias</div>
          <div>Banco zerado: virada em {num(c.sla.BANCO_ZERADO.virada, n => set(['sla', 'BANCO_ZERADO', 'virada'], n))} dias · finalização em {num(c.sla.BANCO_ZERADO.final, n => set(['sla', 'BANCO_ZERADO', 'final'], n))} dias</div>
          <div>Serviços: {num(c.sla.SERVICO_DIAS_UTEIS, n => set(['sla', 'SERVICO_DIAS_UTEIS'], n))} dias úteis</div>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Valem para as demandas novas. Para mudar o prazo de uma demanda, abra o card.</div>
        </div>
      </div>
      <div style={{ ...cartao, padding: 16, display: 'grid', gap: 10 }}>
        <div style={rotulo}>Jornada do técnico</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
          {[['inicio', 'Entrada'], ['fim', 'Saída'], ['almoco_inicio', 'Almoço às'], ['virada_inicio', 'Entrada em dia de virada']].map(([k, l]) => <label key={k}>{l}<br /><input type="time" value={c.jornada[k]} onChange={e => set(['jornada', k], e.target.value)} className="ps-input" /></label>)}
          <label>Almoço (min)<br />{num(c.jornada.almoco_min, n => set(['jornada', 'almoco_min'], n))}</label>
        </div>
      </div>
      <div style={{ ...cartao, padding: 16, display: 'grid', gap: 12 }}>
        <div style={rotulo}>Agentes</div>
        {liga(c.avisos_cliente, v => set(['avisos_cliente'], v), 'Avisos ao cliente', 'Próximos passos no contrato, 30%, 50%, 80%, loja virada (com boas-vindas, 1º vencimento, e-mail e regra do boleto) e cada fase do treinamento, por WhatsApp e e-mail, escritos com o contexto de cada cliente. Dias úteis, 8h às 18h, até 3 por rodada.')}
        {liga(c.agente_ativo, v => set(['agente_ativo'], v), 'Otávio, assistente de implantação', 'Fica de olho em tudo (prazo, espera, ficha, tela do Suporte, play esquecido, correção alta), avisa o técnico e a gestão e responde dúvidas do técnico pelo WhatsApp.')}
        {liga(c.ofertas_ativo, v => set(['ofertas_ativo'], v), 'Agente de oferta', `Depois da virada, oferece ao cliente um item do catálogo que ele ainda não usa (1 por cliente a cada 30 dias, nunca se uma pessoa estiver atendendo a conversa). Só funciona com o catálogo preenchido.`)}
        <label style={{ fontSize: 12 }}>Oferecer a partir de {num(c.ofertas_dias_apos_virada, n => set(['ofertas_dias_apos_virada'], n))} dias depois da virada</label>
      </div>
      <div style={{ ...cartao, padding: 16, display: 'grid', gap: 8, gridColumn: '1 / -1' }}>
        <div style={rotulo}>Catálogo do agente de oferta</div>
        {c.catalogo.map((it: any, k: number) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr)) auto', gap: 6 }}>
            <input value={it.produto} onChange={e => set(['catalogo', String(k), 'produto'], e.target.value)} placeholder="Produto (ex.: Pacote fiscal)" className="ps-input" />
            <input value={it.descricao} onChange={e => set(['catalogo', String(k), 'descricao'], e.target.value)} placeholder="O que é e o que resolve" className="ps-input" />
            <input value={it.preco} onChange={e => set(['catalogo', String(k), 'preco'], e.target.value)} placeholder="Preço (ex.: R$ 50/mês)" className="ps-input" />
            <button onClick={() => setC((p: any) => ({ ...p, catalogo: p.catalogo.filter((_: any, j: number) => j !== k) }))} style={btn('#dc2626', false)}><X size={12} /></button>
          </div>
        ))}
        <div><button onClick={() => setC((p: any) => ({ ...p, catalogo: [...p.catalogo, { produto: '', descricao: '', preco: '' }] }))} style={btn('#2E6EAB', false)}>+ Produto ou pacote</button></div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}><button disabled={salvando} onClick={salvar} style={{ ...btn('#2E6EAB'), padding: '10px 18px' }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />} {ok ? 'Salvo' : 'Salvar configurações'}</button></div>
    </div>
  );
}

export const ICONES_PORTAL = { BarChart2, Settings, Bell };
