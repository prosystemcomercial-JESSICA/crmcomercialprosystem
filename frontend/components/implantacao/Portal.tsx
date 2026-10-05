'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  X, Loader2, CheckCircle, Hourglass, AlertTriangle, Rocket, FileText, Image as ImageIcon, Link2, Copy, Bell, Send,
  GraduationCap, Bug, Clock, ClipboardList, Mail, MessageSquare, Play, Users, Settings, BarChart2, Phone, Building2, Search,
} from 'lucide-react';
import { BotoesDemanda, fmtDur, NOME_ESPERA, useCronometro } from './Cronometro';
import { ConfirmarLeitura } from './ConfirmarLeitura';

// Portal de implantação e serviços: quadro (colunas do Trello), ficha da demanda, avisos, painel e configurações.

const erroDe = (e: any) => e?.response?.data?.message || 'Não foi possível agora. Tente de novo.';
// Resultado do aviso de nova demanda no WhatsApp do técnico (ENVIADO não precisa de mensagem).
const AVISO_WPP: Record<string, string> = {
  SEM_TELEFONE: 'Demanda designada, mas o WhatsApp não foi enviado: o cadastro do técnico está sem telefone. Coloque o celular dele em Usuários e designe de novo.',
  DESLIGADO: 'Demanda designada. O técnico desligou o WhatsApp nas preferências do portal: ele vê só no portal.',
  FALHOU: 'Demanda designada, mas o WhatsApp não saiu (confira se o WhatsApp da empresa está conectado). O técnico vê no portal.',
};
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
  const [vista, setVista] = useState<'kanban' | 'lista' | 'calendario' | 'equipe'>('kanban');
  const [rapidos, setRapidos] = useState<string[]>([]);
  const [abertasFinais, setAbertasFinais] = useState<string[]>([]);
  const meuId = useAuth().user?.id;
  const [soRisco, setSoRisco] = useState(false);
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

  // Finalizado e Cancelados ficam recolhidos (só o contador); toque para abrir.
  const colunas = dados?.colunas || [];
  const filtro = busca.trim().toLowerCase();
  const doModulo = (dados?.cards || []).filter(c => !modulo || c.modulo === modulo);
  const cards = doModulo.filter(c => !filtro || `${c.cliente_razao_social} ${c.cliente_cnpj || ''} ${c.tecnico_nome || ''}`.toLowerCase().includes(filtro))
    .filter(c => !soRisco || (c.saude && c.saude.nivel !== 'VERDE'))
    .filter(c => !rapidos.includes('meus') || c.tecnico_id === meuId)
    .filter(c => !rapidos.includes('virada') || (c.virada_inicio_em && !c.virada_fim_em) || (c.virada_agendada_para && !c.virada_inicio_em && new Date(c.virada_agendada_para).getTime() - Date.now() < 7 * 864e5))
    .filter(c => !rapidos.includes('cliente') || c.esperas_abertas.some((e: any) => e.tipo === 'CLIENTE'));
  const emRisco = doModulo.filter(c => c.saude && c.saude.nivel !== 'VERDE').length;
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
      {gestao && <CargaEquipe />}
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
        <button onClick={() => setSoRisco(v => !v)} aria-pressed={soRisco}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', minHeight: 32, borderRadius: 999, cursor: 'pointer', border: `1px solid ${soRisco ? '#d97706' : 'var(--t-card-border)'}`, background: soRisco ? '#d977060f' : 'transparent', color: soRisco ? '#b45309' : 'var(--t-text-secondary)' }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#d97706' }} /> Em risco <span style={{ fontVariantNumeric: 'tabular-nums' }}>{emRisco}</span>
        </button>
        {([['meus', 'Meus'], ['virada', 'Virada esta semana'], ['cliente', 'Esperando cliente']] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setRapidos(r => (r.includes(k) ? r.filter(x => x !== k) : [...r, k]))} aria-pressed={rapidos.includes(k)}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', minHeight: 32, borderRadius: 999, cursor: 'pointer', border: `1px solid ${rapidos.includes(k) ? '#2E6EAB' : 'var(--t-card-border)'}`, background: rapidos.includes(k) ? '#2E6EAB0f' : 'transparent', color: rapidos.includes(k) ? '#2E6EAB' : 'var(--t-text-secondary)' }}>{l}</button>
        ))}
        <div role="tablist" aria-label="Vista do quadro" style={{ display: 'inline-flex', border: '1px solid var(--t-card-border)', borderRadius: 8, overflow: 'hidden' }}>
          {([['kanban', 'Quadro'], ['lista', 'Lista'], ['calendario', 'Calendário'], ...(gestao ? [['equipe', 'Equipe']] : [])] as [typeof vista, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)}
              style={{ fontSize: 12, fontWeight: vista === k ? 600 : 500, padding: '6px 12px', minHeight: 32, border: 'none', cursor: 'pointer', background: vista === k ? '#2E6EAB' : 'transparent', color: vista === k ? '#fff' : 'var(--t-text-secondary)' }}>{l}</button>
          ))}
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente ou técnico" className="ps-input" style={{ width: 220 }} />

      </div>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
        Entram aqui sozinhos: <b>implantações</b> quando o contrato é assinado e <b>serviços</b> quando a vendedora move o card para <b>Em execução</b> no kanban de serviços. Mostra os últimos 60 dias.
      </div>
      {cards.filter(c => !['FINALIZADO', 'CANCELADOS'].includes(c.coluna)).length === 0 && (
        <div style={{ ...cartao, padding: 22, textAlign: 'center', color: 'var(--t-text-secondary)', fontSize: 14 }}>
          Nenhuma demanda em andamento{modulo === 'SERVICO' ? ' nos serviços' : modulo === 'IMPLANTACAO' ? ' nas implantações' : ''} agora. As finalizadas ficam na coluna recolhida Finalizado, à direita.
        </div>
      )}
      {vista === 'lista' && <VistaLista cards={cards.filter(c => colunas.some(k => k.key === c.coluna))} abrir={setAberta} />}
      {vista === 'calendario' && <VistaCalendario cards={cards} abrir={setAberta} gestao={gestao} />}
      {vista === 'equipe' && gestao && <VistaEquipe cards={cards} abrir={setAberta} />}
      <div style={{ display: vista === 'kanban' ? 'flex' : 'none', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {colunas.map(col => {
          const doCol = cards.filter(c => c.coluna === col.key);
          if (['FINALIZADO', 'CANCELADOS'].includes(col.key) && !abertasFinais.includes(col.key)) return (
            <button key={col.key} onClick={() => setAbertasFinais(a => [...a, col.key])} title={`Abrir ${col.label}`}
              onDragOver={e => { e.preventDefault(); setSobre(col.key); }} onDragLeave={() => setSobre(s => (s === col.key ? null : s))}
              onDrop={e => { e.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, col.key); setArrastando(null); }}
              style={{ ...cartao, width: 52, flexShrink: 0, alignSelf: 'stretch', minHeight: 160, cursor: 'pointer', background: sobre === col.key ? '#2E6EAB10' : 'var(--t-content-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{doCol.length}</span>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>{col.label}</span>
            </button>
          );
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
                    {c.virada_agendada_para && !c.virada_inicio_em && <Etq cor="#2E6EAB">📅 Virada {new Date(c.virada_agendada_para).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')}</Etq>}
                    {c.virada_inicio_em && !c.virada_fim_em && <Etq cor="#7c3aed">🚀 Virada em andamento</Etq>}
                    {c.virada_fim_em && !c.cobranca_lancada_em && <Etq cor="#7c3aed">💰 Cobrança a lançar</Etq>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    {c.saude && c.saude.nivel !== 'VERDE' && <span style={{ transform: 'translateY(-1px)' }}><PontoSaude saude={c.saude} /></span>}
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', lineHeight: 1.3 }}>{c.cliente_razao_social}</div>
                  </div>
                  {c.proximo_passo && c.proximo_passo.quem !== 'NINGUEM' && (
                    <div style={{ fontSize: 12, lineHeight: 1.35, color: (c.proximo_passo.quem === 'GESTAO') === gestao ? '#2E6EAB' : 'var(--t-text-secondary)' }}>→ {c.proximo_passo.titulo}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <SlaBadge sla={c.sla} etapa={c.sla_etapa} />
                    <Iniciais nome={c.tecnico_nome} />
                  </div>
                  <div title={`${c.progresso}% concluído`} style={{ height: 3, borderRadius: 99, background: 'var(--t-content-bg)', margin: '2px -2px -4px' }}>
                    <div style={{ height: 3, borderRadius: 99, width: `${c.progresso}%`, background: c.progresso >= 100 ? '#16a34a' : '#2E6EAB' }} />
                  </div>
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

type Aba = 'onboarding' | 'fichacliente' | 'tarefascliente' | 'testes' | 'anexos' | 'inventario' | 'observacoes' | 'assistida' | 'resumo' | 'ficha' | 'checklist' | 'virada' | 'treinamento' | 'correcoes' | 'tempos' | 'cliente' | 'historico';

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
  // Primeiro contato pendente: o card já abre no onboarding (uma vez, sem brigar com a escolha do técnico).
  const pedeOnboarding = !!d && d.implantacao.modulo !== 'SERVICO' && !!d.onboarding_secoes && !d.onboarding_ok;
  const [abriuOnboarding, setAbriuOnboarding] = useState(false);
  useEffect(() => { if (pedeOnboarding && !abaInicial && !abriuOnboarding) { setAba('onboarding'); setAbriuOnboarding(true); } }, [pedeOnboarding, abaInicial, abriuOnboarding]);
  if (!d) return <Gaveta onClose={onClose}><div style={{ padding: 30 }}><Loader2 className="animate-spin" size={18} /></div></Gaveta>;
  const i = d.implantacao;
  const servico = i.modulo === 'SERVICO';
  const abas: [Aba, string, any][] = [
    ...(!servico && d.onboarding_secoes ? [['onboarding', d.onboarding_ok ? 'Onboarding técnico ✓' : '🔒 Onboarding técnico', Users] as [Aba, string, any]] : []),
    ['resumo', 'Resumo', ClipboardList], ['fichacliente', 'Ficha do cliente', Building2], ['observacoes', 'Observações', MessageSquare], ...(!servico ? [['ficha', 'Ficha de coleta', FileText] as [Aba, string, any]] : []), ['checklist', 'Checklist', CheckCircle],
    ...(!servico ? [['virada', 'Virada e cobrança', Rocket] as [Aba, string, any], ...(d.assistida ? [['assistida', `Operação assistida ${d.assistida.feitos}/${d.assistida.total}`, CheckCircle] as [Aba, string, any]] : []), ['treinamento', 'Treinamento', GraduationCap] as [Aba, string, any]] : []),
    ['correcoes', `Correções${d.ocorrencias.filter((o: any) => o.situacao !== 'RESOLVIDA').length ? ` (${d.ocorrencias.filter((o: any) => o.situacao !== 'RESOLVIDA').length})` : ''}`, Bug],
    ['tempos', 'Tempos', Clock], ['cliente', 'Página do cliente', Users], ['historico', 'Histórico', MessageSquare],
    ...(!servico ? [['testes', `Testes de conversão${(d.testes || []).filter((t: any) => ['PENDENTE', 'DIVERGENTE'].includes(t.resultado)).length ? ` (${(d.testes || []).filter((t: any) => ['PENDENTE', 'DIVERGENTE'].includes(t.resultado)).length})` : ''}`, CheckCircle] as [Aba, string, any]] : []),
    ['anexos', `Arquivos${(d.anexos || []).length ? ` (${d.anexos.length})` : ''}`, FileText], ['inventario', 'Inventário técnico', Settings],
    ['tarefascliente', `Tarefas do cliente${(d.tarefas_cliente || []).filter((t: any) => t.status !== 'CONCLUIDA').length ? ` (${(d.tarefas_cliente || []).filter((t: any) => t.status !== 'CONCLUIDA').length})` : ''}`, FileText],
  ];
  // Card em 5 grupos (Fase 3): cada grupo junta as abas de um assunto; dentro dele, pílulas escolhem a aba.
  const GRUPOS_ABA: { k: string; l: string; subs: Aba[] }[] = [
    { k: 'visao', l: 'Visão geral', subs: ['resumo'] },
    { k: 'cliente', l: 'Cliente', subs: ['fichacliente', 'tarefascliente', 'ficha', 'inventario', 'anexos', 'cliente'] },
    { k: 'execucao', l: 'Execução', subs: ['onboarding', 'checklist', 'testes', 'virada', 'assistida', 'treinamento', 'correcoes'] },
    { k: 'conversa', l: 'Conversa', subs: ['observacoes', 'historico'] },
    { k: 'tempos', l: 'Tempos', subs: ['tempos'] },
  ];
  const dispo = new Map(abas.map(([k, l, Icon]) => [k, { l, Icon }]));
  const grupos = GRUPOS_ABA.map(g => ({ ...g, subs: g.subs.filter(s => dispo.has(s)) })).filter(g => g.subs.length);
  const grupoAtual = grupos.find(g => g.subs.includes(aba)) || grupos[0];
  return (
    <Gaveta onClose={onClose}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--t-card-border)', display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#2E6EAB', marginBottom: 4 }}>{d.tipo_demanda}</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em', lineHeight: 1.25, color: 'var(--t-text-primary)', textWrap: 'balance' as any }}>{i.cliente_razao_social}</h2>
            <div style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[i.cliente_cnpj, i.plano, i.tecnico_nome ? `Técnico ${i.tecnico_nome}` : 'Sem técnico', d.prazo_ajuste_ms >= 36e5 ? `prazo pausado +${Math.round(d.prazo_ajuste_ms / 36e5)}h (espera do cliente)` : null].filter(Boolean).map((t, k) => <span key={k}>{k ? <span style={{ marginRight: 8, opacity: .5 }}>·</span> : null}{t}</span>)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={18} style={{ color: 'var(--t-text-muted)' }} /></button>
        </div>
        {d.saude && d.saude.nivel !== 'VERDE' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, color: COR_SAUDE[d.saude.nivel] }}>
            <PontoSaude saude={d.saude} /><span><b style={{ fontWeight: 600 }}>{d.saude.nivel === 'VERMELHO' ? 'Precisa de atenção agora' : 'Atenção'}:</b> {d.saude.motivos.join(' · ')}</span>
          </div>
        )}
        <PainelContatos d={d} gestao={gestao} recarregar={carregar} />
        <FaixaProximoPasso d={d} gestao={gestao} aba={aba} irPara={setAba} recarregar={carregar} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}><LinhaMarcos d={d} /></div>
          <BotoesDemanda implantacao={{ ...i, onboarding_ok: d.onboarding_ok }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '0 12px', borderBottom: '1px solid var(--t-card-border)', overflowX: 'auto' }}>
        {grupos.map(g => (
          <button key={g.k} onClick={() => !g.subs.includes(aba) && setAba(g.subs[0])}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px', fontSize: 13, fontWeight: grupoAtual.k === g.k ? 600 : 500, whiteSpace: 'nowrap', border: 'none', background: 'transparent', cursor: 'pointer', color: grupoAtual.k === g.k ? '#2E6EAB' : 'var(--t-text-secondary)', borderBottom: grupoAtual.k === g.k ? '2px solid #2E6EAB' : '2px solid transparent' }}>
            {g.l}
          </button>
        ))}
      </div>
      {grupoAtual.subs.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 20px 0', overflowX: 'auto' }}>
          {grupoAtual.subs.map(k => (
            <button key={k} onClick={() => setAba(k)}
              style={{ fontSize: 12, fontWeight: aba === k ? 600 : 500, padding: '6px 12px', minHeight: 32, borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer', border: `1px solid ${aba === k ? '#2E6EAB55' : 'var(--t-card-border)'}`, background: aba === k ? '#2E6EAB0f' : 'transparent', color: aba === k ? '#2E6EAB' : 'var(--t-text-secondary)' }}>
              {dispo.get(k)?.l}
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {aba === 'onboarding' && <AbaOnboarding d={d} recarregar={carregar} irPara={setAba} />}
        {aba === 'fichacliente' && <AbaFichaCliente d={d} />}
        {aba === 'tarefascliente' && <AbaTarefasCliente d={d} recarregar={carregar} />}
        {aba === 'testes' && <AbaTestes d={d} recarregar={carregar} />}
        {aba === 'anexos' && <AbaAnexos d={d} recarregar={carregar} />}
        {aba === 'inventario' && <AbaInventario d={d} />}
        {aba === 'observacoes' && <AbaObservacoes id={d.implantacao.id} />}
        {aba === 'resumo' && <AbaResumo d={d} gestao={gestao} recarregar={carregar} />}
        {aba === 'ficha' && <AbaFicha d={d} recarregar={carregar} />}
        {aba === 'checklist' && <AbaChecklist d={d} recarregar={carregar} />}
        {aba === 'virada' && <AbaVirada d={d} gestao={gestao} recarregar={carregar} />}
        {aba === 'assistida' && <AbaAssistida d={d} recarregar={carregar} />}
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
      <BarraCelularCard d={d} />
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
  const baixarPdf = async (termo: boolean) => {
    try { const r = await apiClient.baixarRelatorioImplantacao(i.id, termo); const url = URL.createObjectURL(r.data); const el = document.createElement('a'); el.href = url; el.download = termo ? `termo-de-aceite-${i.cliente_razao_social}.pdf` : `relatorio-${i.cliente_razao_social}.pdf`; el.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
    catch (e) { alert(erroDe(e)); }
  };
  const [prazos, setPrazos] = useState({ v: paraInputData(i.prazo_virada), f: paraInputData(i.prazo_finalizacao) });
  const abertas = d.esperas.filter((e: any) => !e.fim);
  const resolver = async (eid: string) => { const r = prompt('O que foi feito para resolver? (opcional)'); if (r === null) return; try { await apiClient.resolverEspera(eid, r || undefined); avisarCronometro(); } catch (e) { alert(erroDe(e)); } };
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => baixarPdf(false)} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}><FileText size={13} /> Relatório final (PDF)</button>
        {i.modulo === 'IMPLANTACAO' && <button onClick={() => baixarPdf(true)} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}><FileText size={13} /> Prévia do termo de aceite</button>}
        {(d.pos_venda || []).length > 0 && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Pós-implantação: {(d.pos_venda as any[]).map(p => `${p.marco}d ${p.feita_em ? (p.risco ? '⚠️' : '✓') : fmtData(p.prevista_em)}`).join(' · ')}</span>}
        {i.aceite_status && <span style={{ fontSize: 12, color: i.aceite_status === 'ASSINADO' ? '#16a34a' : i.aceite_status === 'RECUSADO' ? '#dc2626' : '#b45309' }}>Termo de aceite: {i.aceite_status === 'ASSINADO' ? `assinado em ${fmtData(i.aceite_assinado_em)}` : i.aceite_status === 'RECUSADO' ? 'recusado pelo cliente' : `aguardando assinatura desde ${fmtData(i.aceite_enviado_em)}`}</span>}
      </div>
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
      {gestao && <DesignarTecnico id={i.id} tecnicoId={i.tecnico_id} recarregar={recarregar} />}
      {gestao && <EnviarAviso implantacaoId={i.id} tecnicoId={i.tecnico_id} />}
    </div>
  );
}

// Gestão escolhe o técnico responsável: só depois disso o card aparece no Quadro dele.
// A lista vem dos usuários ativos com cargo técnico (cadastrou, já aparece aqui).
function DesignarTecnico({ id, tecnicoId, recarregar, embutido }: { id: string; tecnicoId?: string | null; recarregar: () => void; embutido?: boolean }) {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  // Com a carga de cada um (só a supervisão recebe os números), para designar com justiça.
  useEffect(() => { apiClient.getTecnicosImplantacao(true).then(r => setTecnicos(r.data.data || [])).catch(() => {}); }, []);
  const designar = async (tid: string) => {
    if (!tid) return;
    try {
      const r = await apiClient.designarTecnico(id, tid);
      recarregar();
      const w = r.data?.aviso_whatsapp;
      if (w && AVISO_WPP[w]) alert(AVISO_WPP[w]);
    } catch (e) { alert(erroDe(e)); }
  };
  const carga = (t: any) => (t.ativas == null ? '' : ` · ${t.ativas} ativas${t.em_virada ? ` · ${t.em_virada} em virada` : ''} · ${t.horas_mes}h no mês`);
  const seletor = (
    <select value={tecnicoId || ''} onChange={e => designar(e.target.value)} className="ps-input" style={{ width: 'auto', maxWidth: '100%', minHeight: 40 }}>
      <option value="">Escolha o técnico…</option>
      {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}{carga(t)}</option>)}
    </select>
  );
  if (embutido) return seletor;
  return (
    <div style={{ ...cartao, padding: 14, display: 'grid', gap: 8 }}>
      <div style={rotulo}>Técnico responsável</div>
      {seletor}
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
      <PerguntasPrimeiroContato d={d} recarregar={recarregar} />
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

/** As 15 perguntas principais do primeiro contato: o técnico preenche durante a conversa com o cliente. */
function PerguntasPrimeiroContato({ d, recarregar }: { d: any; recarregar: () => void }) {
  const i = d.implantacao;
  const campos = (d.perguntas_primeiro_contato || []).map((k: string) => d.campos_coleta.find((c: any) => c.key === k)).filter(Boolean);
  const [f, setF] = useState<Record<string, any>>({ ...(i.coleta || {}) });
  const [salvando, setSalvando] = useState(false);
  const respondidas = campos.filter((c: any) => String(f[c.key] ?? '').trim() !== '').length;
  const salvar = async () => {
    setSalvando(true);
    try { await apiClient.salvarColeta(i.id, { ...(i.coleta || {}), ...f }); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };
  return (
    <div style={{ ...cartao, padding: 14, display: 'grid', gap: 10, borderColor: respondidas === campos.length ? '#16a34a55' : '#0369a155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Perguntas principais do primeiro contato</b>
        <span style={{ fontSize: 12, fontWeight: 700, color: respondidas === campos.length ? '#16a34a' : 'var(--t-text-muted)' }}>{respondidas} de {campos.length} respondidas</span>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))' }}>
        {campos.map((c: any, k: number) => (
          <label key={c.key} style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', display: 'grid', gap: 4 }}>
            <span>{k + 1}. {c.label}</span>
            {c.tipo === 'opcoes' ? (
              <select id={`pc-${c.key}`} value={f[c.key] || ''} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} className="ps-input w-full"><option value="">—</option>{c.opcoes.map((o: string) => <option key={o}>{o}</option>)}</select>
            ) : (
              <input id={`pc-${c.key}`} type={c.tipo === 'numero' ? 'number' : 'text'} value={f[c.key] || ''} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} className="ps-input w-full" />
            )}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button disabled={salvando} onClick={salvar} style={btn('#2E6EAB')}>{salvando ? <Loader2 size={13} className="animate-spin" /> : null} Salvar respostas</button>
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Com as 15 respondidas, o item "Perguntas principais" do roteiro se marca sozinho.</span>
      </div>
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
  // Virada com pré-requisitos: o técnico vê o que falta; a supervisão pode liberar mesmo assim (fica no histórico).
  const acaoVirada = async (f: (forcar: boolean) => Promise<any>, confirma: string) => {
    if (!confirm(confirma)) return;
    setOcupado(true);
    try { await f(false); recarregar(); avisarCronometro(); }
    catch (e: any) {
      const falta: string[] | undefined = e?.response?.data?.data?.pendencias;
      if (gestao && falta?.length && confirm(`Ainda falta:\n• ${falta.join('\n• ')}\n\nLiberar mesmo assim? Fica registrado no histórico do card.`)) {
        try { await f(true); recarregar(); avisarCronometro(); } catch (e2) { alert(erroDe(e2)); }
      } else alert(erroDe(e));
    } finally { setOcupado(false); }
  };
  const pendViradas: string[] = ['PREPARAR', 'CONCLUIR_VIRADA'].includes(d.proximo_passo?.chave) ? d.proximo_passo.pendencias || [] : [];
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
      <AgendaVirada d={d} recarregar={recarregar} />
      {!i.virada_fim_em && passo(pendViradas.length === 0, 'Pré-requisitos da virada', pendViradas.length === 0 ? 'Completos.' : (
        <span style={{ display: 'grid', gap: 2 }}>{pendViradas.map(t => <span key={t}>• {t}</span>)}{gestao && <span style={{ color: 'var(--t-text-muted)', marginTop: 2 }}>Como supervisão, você pode liberar mesmo assim.</span>}</span>
      ))}
      {passo(!!i.tela_suporte_arquivo_id, 'Tela do Suporte anexada', i.tela_suporte_arquivo_id ? 'Pronta.' : 'Anexe na aba Ficha de coleta. Sem ela a virada não começa.')}
      {passo(!!i.virada_inicio_em, 'Iniciar virada', i.virada_inicio_em ? `Iniciada em ${fmtDataHora(i.virada_inicio_em)}. Neste dia a jornada do técnico começa às 7h.` : (
        <button disabled={ocupado || (pendViradas.length > 0 && !gestao)} onClick={() => acaoVirada(f => apiClient.iniciarVirada(i.id, f), 'Iniciar a virada da loja agora?')} style={{ ...btn('#7c3aed'), marginTop: 6, opacity: pendViradas.length && !gestao ? 0.5 : 1 }}><Rocket size={13} /> Iniciar virada</button>
      ))}
      {passo(!!i.virada_fim_em, 'Loja virada', i.virada_fim_em ? `Em uso desde ${fmtDataHora(i.virada_fim_em)}.` : i.virada_inicio_em ? (
        <button disabled={ocupado || (pendViradas.length > 0 && !gestao)} onClick={() => acaoVirada(f => apiClient.concluirVirada(i.id, undefined, f), 'Confirmar que a loja está rodando com o Prosystem? Isso define o 1º vencimento.')} style={{ ...btn('#16a34a'), marginTop: 6, opacity: pendViradas.length && !gestao ? 0.5 : 1 }}><CheckCircle size={13} /> Loja virada</button>
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
            {f.realizada_em && (f.confirmado_em
              ? <div style={{ fontSize: 12, color: '#16a34a' }}>✍️ Confirmado por {f.confirmado_por} em {fmtData(f.confirmado_em)} · participantes: {(f.participantes || []).join(', ')}</div>
              : <div style={{ fontSize: 12, color: '#b45309' }}>Aguardando o cliente confirmar quem participou (pela página de acompanhamento).</div>)}
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

const NOME_ETAPA: Record<string, string> = { INSTALACAO: 'Instalação', CONVERSAO: 'Conversão', TREINAMENTO: 'Treinamento', ASSISTIDA: 'Operação assistida', CORRECAO: 'Correção pós-virada', SEM_ETAPA: 'Sem etapa' };

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

const NOME_MARCO = (m: string) => m === 'CONTRATO' ? 'Próximos passos (contrato)' : m === 'VIRADA' ? 'Loja virada + boas-vindas' : m === 'AGENDA_VIRADA' ? 'Data da virada' : m === 'LEMBRETE_VIRADA' ? 'Lembrete da virada'
  : m.startsWith('AGENDA_TREINO_') ? `Data da fase ${m.slice(14)} do treinamento` : m.startsWith('LEMBRETE_TREINO_') ? `Lembrete da fase ${m.slice(16)} do treinamento`
  : m.startsWith('TREINO_') ? `Fase ${m.slice(7)} do treinamento` : `${m.slice(1)}% concluído`;

// ─── Ficha do cliente (para o técnico: tudo do cadastro, sem dados financeiros) ───

const soDigitos = (t?: string | null) => (t || '').replace(/\D/g, '');
const fmtFone = (t?: string | null) => {
  const n = soDigitos(t);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return t || '';
};

/** Contatos do cliente, do mais confiável ao menos: ficha de coleta, cadastro, card. Sem repetir número. */
function contatosDoCliente(d: any): { nome: string | null; fone: string }[] {
  const c = d.cliente_ficha || {}, col = d.implantacao.coleta || {};
  const lista = [
    { nome: col.contato_nome || c.contato || null, fone: col.contato_telefone },
    { nome: c.contato || null, fone: c.tel_contato },
    { nome: c.contato2 || null, fone: c.tel_contato2 },
    { nome: c.contato || c.responsavel_nome || null, fone: d.implantacao.contato_whatsapp },
    { nome: null, fone: c.telefone1 }, { nome: null, fone: c.telefone }, { nome: null, fone: c.telefone2 },
  ];
  const vistos = new Set<string>(), out: { nome: string | null; fone: string }[] = [];
  for (const x of lista) {
    const n = soDigitos(x.fone);
    if (n.length < 8 || vistos.has(n.slice(-8))) continue;
    vistos.add(n.slice(-8)); out.push({ nome: x.nome, fone: x.fone });
  }
  return out;
}

// ─── Próximo passo do card (Fase 1): o que fazer agora e o botão que faz ───
// Técnico do card: Começar agora, Ir para a aba, Pedir validação. Supervisão: Designar, Validar, Devolver, Finalizar.

const NOME_ABA: Record<string, string> = { testes: 'Testes de conversão', onboarding: 'Onboarding', ficha: 'Ficha de coleta', checklist: 'Checklist', virada: 'Virada', assistida: 'Operação assistida', treinamento: 'Treinamento', correcoes: 'Correções' };

function FaixaProximoPasso({ d, gestao, aba, irPara, recarregar }: { d: any; gestao: boolean; aba: string; irPara: (a: any) => void; recarregar: () => void }) {
  const p = d.proximo_passo, i = d.implantacao;
  const { user } = useAuth();
  const { sessao } = useCronometro();
  const [ocupado, setOcupado] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  if (!p || p.quem === 'NINGUEM') return null;
  const souTecnico = !!user?.id && user.id === i.tecnico_id;
  const rodandoAqui = sessao?.implantacao_id === i.id;
  const run = async (f: () => Promise<any>, confirma?: string) => {
    if (confirma && !confirm(confirma)) return;
    setOcupado(true);
    try { await f(); avisarCronometro(); window.dispatchEvent(new Event('avisos:mudou')); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); }
  };
  const comecar = () => run(async () => {
    if (['BACKLOG', 'A_FAZER'].includes(i.coluna) && p.chave !== 'ONBOARDING') await apiClient.moverColunaImplantacao(i.id, 'EM_ANDAMENTO');
    await apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: i.id, etapa: p.etapa });
    if (p.aba) irPara(p.aba);
  });
  const devolver = () => run(async () => { await apiClient.devolverDemanda(i.id, motivo.trim()); setDevolvendo(false); setMotivo(''); });
  const vezDeQuem = p.quem === 'GESTAO' ? (gestao ? 'Sua vez' : 'Com a supervisão') : souTecnico ? 'Sua vez' : `Com ${i.tecnico_nome ? i.tecnico_nome.split(' ')[0] : 'o técnico'}`;
  const minhaVez = vezDeQuem === 'Sua vez';
  const acaoPrincipal: React.CSSProperties = { ...btn('#2E6EAB'), minHeight: 36 };
  const acaoSecundaria: React.CSSProperties = { ...btn('#2E6EAB', false), minHeight: 36, border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' };
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${minhaVez ? '#2E6EAB55' : 'var(--t-card-border)'}`, background: minhaVez ? '#2E6EAB08' : 'transparent', padding: '12px 14px', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: minhaVez ? '#2E6EAB' : 'var(--t-text-muted)', letterSpacing: '.02em' }}>Próximo passo · {vezDeQuem}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text-primary)', marginTop: 2 }}>{p.titulo}</div>
          {p.detalhe && <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{p.detalhe}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Passos do técnico */}
          {p.quem === 'TECNICO' && souTecnico && p.etapa && !rodandoAqui && p.chave !== 'PEDIR_VALIDACAO' && (
            <button disabled={ocupado} onClick={comecar} style={acaoPrincipal}><Play size={13} /> Começar agora</button>
          )}
          {p.quem === 'TECNICO' && p.aba && aba !== p.aba && (
            <button onClick={() => irPara(p.aba)} style={souTecnico && !rodandoAqui ? acaoSecundaria : acaoPrincipal}>Abrir {NOME_ABA[p.aba] || p.aba}</button>
          )}
          {p.chave === 'PEDIR_VALIDACAO' && souTecnico && (
            <button disabled={ocupado} onClick={() => run(() => apiClient.pedirValidacao(i.id), 'Enviar para a supervisão validar? O cronômetro desta demanda é pausado.')} style={acaoPrincipal}><CheckCircle size={13} /> Pedir validação</button>
          )}
          {/* Passos da supervisão */}
          {p.chave === 'VALIDAR' && gestao && (<>
            <button disabled={ocupado} onClick={() => run(() => apiClient.moverColunaImplantacao(i.id, 'VALIDADO'), 'Validar esta demanda?')} style={acaoPrincipal}><CheckCircle size={13} /> Validar</button>
            <button disabled={ocupado} onClick={() => setDevolvendo(v => !v)} style={acaoSecundaria}>Devolver ao técnico</button>
          </>)}
          {p.chave === 'FINALIZAR' && gestao && (<>
            {i.aceite_status === 'ASSINADO' && i.aceite_pdf_url && <a href={i.aceite_pdf_url} target="_blank" rel="noreferrer" style={{ ...acaoSecundaria, textDecoration: 'none' }}>Termo assinado</a>}
            {i.aceite_status !== 'ASSINADO' && <button disabled={ocupado} onClick={() => run(() => apiClient.reenviarTermoAceite(i.id), i.aceite_status ? 'Reenviar o termo de aceite para o cliente assinar?' : 'Enviar o termo de aceite para o cliente assinar (ZapSign)?')} style={acaoSecundaria}>{i.aceite_status ? 'Reenviar termo' : 'Enviar termo de aceite'}</button>}
            <button disabled={ocupado} onClick={() => run(() => apiClient.moverColunaImplantacao(i.id, 'FINALIZADO'), i.aceite_status === 'ASSINADO' ? 'Finalizar esta demanda? Ela sai do quadro.' : 'O termo de aceite ainda não foi assinado. Finalizar mesmo assim?')} style={acaoPrincipal}>Finalizar</button>
          </>)}
        </div>
      </div>
      {p.chave === 'DESIGNAR' && gestao && <DesignarTecnico id={i.id} tecnicoId={i.tecnico_id} recarregar={recarregar} embutido />}
      {p.pendencias?.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t-text-muted)' }}>Falta antes de avançar</div>
          {p.pendencias.map((t: string) => (
            <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, color: 'var(--t-text-primary)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: '#d97706', flexShrink: 0, transform: 'translateY(-1px)' }} />{t}
            </div>
          ))}
        </div>
      )}
      {devolvendo && (
        <div style={{ display: 'grid', gap: 8 }}>
          <textarea rows={2} autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} className="ps-input w-full" placeholder="O que o técnico precisa corrigir ou completar?" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={ocupado || motivo.trim().length < 3} onClick={devolver} style={{ ...acaoPrincipal, opacity: motivo.trim().length < 3 ? 0.5 : 1 }}>Devolver com recado</button>
            <button onClick={() => setDevolvendo(false)} style={acaoSecundaria}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Carga da equipe para a supervisão: demandas ativas, viradas em andamento e horas no mês de cada técnico. */
export function CargaEquipe() {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  useEffect(() => { apiClient.getTecnicosImplantacao(true).then(r => setTecnicos((r.data.data || []).filter((t: any) => t.cargo !== 'SUPERVISAO_TECNICA'))).catch(() => {}); }, []);
  if (!tecnicos.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' }}>Carga da equipe</span>
      {tecnicos.map(t => (
        <span key={t.id} title={`${t.ativas} demanda(s) ativa(s) · ${t.em_virada} virada(s) em andamento · ${t.horas_mes}h trabalhadas no mês`}
          style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', fontVariantNumeric: 'tabular-nums' }}>
          <b style={{ fontWeight: 600, color: 'var(--t-text-primary)' }}>{t.nome.split(' ')[0]}</b>
          <span style={{ color: 'var(--t-text-secondary)' }}>{t.ativas} ativas{t.em_virada ? ` · ${t.em_virada} em virada` : ''} · {t.horas_mes}h no mês</span>
        </span>
      ))}
    </div>
  );
}

/** Busca global do portal (Ctrl+K / ⌘K): cliente, CNPJ, técnico ou vendedor; abre o card. */
export function BuscaGlobal({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[]>([]);
  const [sel, setSel] = useState(0);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberta(true); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  useEffect(() => {
    if (!aberta) { setQ(''); setRes([]); setSel(0); return; }
    if (q.trim().length < 2) { setRes([]); return; }
    setBuscando(true);
    const t = setTimeout(() => {
      apiClient.buscarDemandas(q.trim()).then(r => { setRes(r.data.data || []); setSel(0); }).catch(() => setRes([])).finally(() => setBuscando(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, aberta]);
  const escolher = (id: string) => { setAberta(false); onAbrir(id); };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setAberta(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, res.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && res.length) { const r = res.at(sel); if (r) escolher(r.id); }
  };
  return (
    <>
      <button onClick={() => setAberta(true)} title="Buscar cliente, CNPJ ou técnico (Ctrl+K)" aria-label="Buscar"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-muted)', fontSize: 13, cursor: 'pointer' }}>
        <Search size={14} /><span className="pt-topo-extra">Buscar</span>
        <kbd className="pt-topo-extra" style={{ fontSize: 11, fontFamily: 'inherit', border: '1px solid var(--t-card-border)', borderRadius: 4, padding: '0 5px', color: 'var(--t-text-muted)' }}>Ctrl K</kbd>
      </button>
      {aberta && (
        <div onClick={() => setAberta(false)} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(13,34,56,.35)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12vh 16px 16px' }}>
          <div role="dialog" aria-label="Buscar demanda" onClick={e => e.stopPropagation()}
            style={{ width: 'min(560px, 100%)', background: 'var(--t-card-bg)', borderRadius: 12, boxShadow: '0 0 0 1px rgba(13,34,56,.08), 0 16px 40px rgba(13,34,56,.22)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--t-card-border)' }}>
              <Search size={16} color="var(--t-text-muted)" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={teclas} placeholder="Cliente, CNPJ, técnico ou vendedor"
                style={{ flex: 1, height: 48, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--t-text-primary)' }} />
              {buscando && <Loader2 size={14} className="animate-spin" color="var(--t-text-muted)" />}
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: 6 }}>
              {q.trim().length < 2 && <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t-text-muted)' }}>Digite pelo menos 2 letras. Use ↑ ↓ e Enter para abrir.</div>}
              {q.trim().length >= 2 && !buscando && res.length === 0 && <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t-text-muted)' }}>Nada encontrado.</div>}
              {res.map((r, k) => (
                <button key={r.id} onClick={() => escolher(r.id)} onMouseEnter={() => setSel(k)}
                  style={{ display: 'flex', width: '100%', textAlign: 'left', gap: 12, alignItems: 'center', padding: '10px', minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer', background: k === sel ? 'var(--t-content-bg)' : 'transparent' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente}</div>
                    <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{[r.tipo, r.cnpj, r.tecnico || 'sem técnico'].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--t-text-secondary)', border: '1px solid var(--t-card-border)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{r.coluna}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Fase 2: agenda da virada, operação assistida e modelos de checklist ───

const quandoBR = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—');
const paraInputDataHora = (s?: string | null) => (s ? new Date(new Date(s).getTime() - 3 * 3600000).toISOString().slice(0, 16) : '');

/** Agendar ou remarcar a virada (técnico do card ou supervisão). Remarcar pede o motivo. */
function AgendaVirada({ d, recarregar }: { d: any; recarregar: () => void }) {
  const i = d.implantacao;
  const [editando, setEditando] = useState(!i.virada_agendada_para);
  const [quando, setQuando] = useState(paraInputDataHora(i.virada_agendada_para));
  const [duracao, setDuracao] = useState<string>(i.virada_duracao_h ? String(i.virada_duracao_h) : '');
  const [motivo, setMotivo] = useState('');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  if (i.virada_inicio_em || i.virada_fim_em) return null;
  const remarcando = !!i.virada_agendada_para;
  const salvar = async (confirmar = false) => {
    if (!quando) return alert('Escolha a data e a hora.');
    if (remarcando && !motivo) return alert('Diga o motivo da remarcação.');
    setSalvando(true);
    try {
      await apiClient.agendarVirada(i.id, { quando, duracao_h: duracao ? Number(duracao) : null, ...(remarcando ? { motivo, motivo_texto: motivoTexto.trim() || undefined } : {}), confirmar });
      setEditando(false); recarregar();
    } catch (e: any) {
      if (e?.response?.status === 409 && confirm(`${erroDe(e)}\n\nAgendar mesmo assim?`)) { setSalvando(false); return salvar(true); }
      alert(erroDe(e));
    } finally { setSalvando(false); }
  };
  return (
    <div style={{ ...cartao, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={rotulo}>Agenda da virada</div>
        {i.virada_remarcacoes > 0 && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>remarcada {i.virada_remarcacoes}x</span>}
      </div>
      {!editando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t-text-primary)', textTransform: 'capitalize' }}>{quandoBR(i.virada_agendada_para)}</div>
            <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{i.virada_duracao_h ? `Previsão de ${i.virada_duracao_h}h · ` : ''}{i.virada_lembrete_em ? 'Lembrete enviado ao cliente' : 'O cliente recebe um lembrete no dia útil anterior'}</div>
          </div>
          <button onClick={() => setEditando(true)} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}>Remarcar</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Data e hora<br /><input type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} className="ps-input" style={{ minHeight: 40 }} /></label>
            <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Duração prevista (h)<br /><input type="number" min={1} max={24} value={duracao} onChange={e => setDuracao(e.target.value)} className="ps-input" style={{ width: 120, minHeight: 40 }} /></label>
          </div>
          {remarcando && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select value={motivo} onChange={e => setMotivo(e.target.value)} className="ps-input" style={{ width: 'auto', minHeight: 40 }}>
                <option value="">Motivo da remarcação…</option>
                <option value="CLIENTE">Cliente pediu</option><option value="TECNICO">Problema técnico</option>
                <option value="PROGRAMACAO">Aguardando programação</option><option value="OUTRO">Outro</option>
              </select>
              <input value={motivoTexto} onChange={e => setMotivoTexto(e.target.value)} placeholder="Detalhe (opcional)" className="ps-input" style={{ flex: '1 1 200px', minHeight: 40 }} />
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>O cliente recebe a data no WhatsApp com o que preparar, e um lembrete no dia útil anterior.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={salvando} onClick={() => salvar()} style={{ ...btn('#2E6EAB'), minHeight: 36 }}>{salvando ? 'Salvando…' : remarcando ? 'Remarcar a virada' : 'Agendar a virada'}</button>
            {remarcando && <button onClick={() => setEditando(false)} style={{ ...btn('#64748b', false), minHeight: 36 }}>Cancelar</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Operação assistida: 5 dias úteis depois da virada, uma checagem por dia (vendas, NFC-e, estoque). */
function AbaAssistida({ d, recarregar }: { d: any; recarregar: () => void }) {
  const a = d.assistida;
  const [form, setForm] = useState<Record<string, { vendas_ok: boolean; nfce_ok: boolean; estoque_ok: boolean; observacao: string }>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  if (!a) return <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>A operação assistida começa depois da loja virada (viradas a partir de 03/10/2026).</div>;
  const reg = (dia: string) => a.registros.find((r: any) => r.dia === dia);
  const f = (dia: string) => form[dia] || { vendas_ok: true, nfce_ok: true, estoque_ok: true, observacao: '' };
  const setF = (dia: string, k: string, v: any) => setForm(p => ({ ...p, [dia]: { ...f(dia), [k]: v } }));
  const registrar = async (dia: string) => {
    const x = f(dia);
    const falha = !x.vendas_ok || !x.nfce_ok || !x.estoque_ok;
    if (falha && !x.observacao.trim()) return alert('Conte o que aconteceu: vira uma correção no card.');
    if (falha && !confirm('Uma correção vai ser aberta no card com esse problema. Continuar?')) return;
    setSalvando(dia);
    try { await apiClient.registrarAssistida(d.implantacao.id, { dia, ...x, observacao: x.observacao.trim() || undefined }); avisarCronometro(); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setSalvando(null); }
  };
  const ddmm = (dia: string) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' });
  const ITENS: [string, string][] = [['vendas_ok', 'Vendas fecharam'], ['nfce_ok', 'NFC-e autorizando'], ['estoque_ok', 'Estoque batendo']];
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
      <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.5 }}>
        Nos 5 dias úteis depois da virada, confira todo dia se a loja está vendendo, emitindo NFC-e e com o estoque certo. Problema vira uma correção no card. A validação da supervisão só libera com os 5 dias checados. <b style={{ color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{a.feitos} de {a.total} feitos.</b>
      </div>
      <div style={{ ...cartao }}>
        {a.dias.map((x: any, k: number) => {
          const r = reg(x.dia);
          return (
            <div key={x.dia} style={{ padding: '12px 14px', borderTop: k ? '1px solid var(--t-card-border)' : 'none', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)', minWidth: 120, textTransform: 'capitalize' }}>Dia {k + 1} · {ddmm(x.dia)}</span>
                {r ? (
                  <span style={{ fontSize: 13, color: r.vendas_ok && r.nfce_ok && r.estoque_ok ? '#16a34a' : '#b45309' }}>
                    {r.vendas_ok && r.nfce_ok && r.estoque_ok ? '✓ Tudo certo' : `Problema em ${[!r.vendas_ok && 'vendas', !r.nfce_ok && 'NFC-e', !r.estoque_ok && 'estoque'].filter(Boolean).join(', ')} · correção aberta`} · {r.tecnico_nome?.split(' ')[0] || 'técnico'}
                  </span>
                ) : <span style={{ fontSize: 13, color: x.liberado ? '#b45309' : 'var(--t-text-muted)' }}>{x.liberado ? 'Checagem pendente' : 'Ainda não chegou'}</span>}
              </div>
              {r?.observacao && <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{r.observacao}</div>}
              {!r && x.liberado && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {ITENS.map(([chave, nome]) => (
                      <label key={chave} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)', minHeight: 36, cursor: 'pointer' }}>
                        <input type="checkbox" checked={(f(x.dia) as any)[chave]} onChange={e => setF(x.dia, chave, e.target.checked)} style={{ width: 18, height: 18 }} /> {nome}
                      </label>
                    ))}
                  </div>
                  <input value={f(x.dia).observacao} onChange={e => setF(x.dia, 'observacao', e.target.value)} placeholder="Observação (obrigatória se algo não estiver ok)" className="ps-input w-full" style={{ minHeight: 40 }} />
                  <div><button disabled={salvando === x.dia} onClick={() => registrar(x.dia)} style={{ ...btn('#2E6EAB'), minHeight: 36 }}>{salvando === x.dia ? 'Registrando…' : 'Registrar checagem'}</button></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Modelos de checklist por segmento e itens extras por sistema de origem (Configurações, só supervisão). */
function ModelosChecklist({ c, setC }: { c: any; setC: (f: (p: any) => any) => void }) {
  const GRUPOS: [string, string][] = [['INSTALACAO', 'Instalação'], ['CONVERSAO', 'Conversão'], ['TREINAMENTO', 'Treinamento']];
  const padrao = (g: string) => (c.checklist_padrao || []).find((x: any) => x.grupo === g)?.itens || [];
  const linhas = (t: string) => t.split('\n').map(x => x.trim()).filter(x => x.length >= 2);
  const modelos: any[] = c.modelos || [], extras: any[] = c.extras_sistema || [];
  const setModelos = (m: any[]) => setC(p => ({ ...p, modelos: m }));
  const setExtras = (m: any[]) => setC(p => ({ ...p, extras_sistema: m }));
  return (
    <div style={{ ...cartao, padding: 16, display: 'grid', gap: 14 }}>
      <div>
        <div style={rotulo}>Modelos de checklist por segmento</div>
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
          Quando a demanda é designada, o checklist vem do modelo do segmento do cliente (cadastro). Sem modelo, vale o padrão. Um item por linha.
          Itens com "certificado", "backup/Copy", "Conversão dos dados", "Validar Produtos" e "NFCE em Operação" no texto continuam travando a virada.
        </div>
      </div>
      {modelos.map((m, k) => (
        <div key={k} style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={m.segmento} onChange={e => setModelos(modelos.map((x, j) => j === k ? { ...x, segmento: e.target.value } : x))} placeholder="Segmento (ex.: Farmácia, Padaria)" className="ps-input" style={{ flex: 1, minHeight: 40 }} />
            <button onClick={() => confirm(`Remover o modelo "${m.segmento}"?`) && setModelos(modelos.filter((_, j) => j !== k))} style={{ ...btn('#dc2626', false), minHeight: 36 }}>Remover</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {GRUPOS.map(([g, nome]) => (
              <label key={g} style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'grid', gap: 4 }}>{nome} ({(m.grupos?.[g] || []).length})
                <textarea rows={8} defaultValue={(m.grupos?.[g] || []).join('\n')} onBlur={e => setModelos(modelos.map((x, j) => j === k ? { ...x, grupos: { ...x.grupos, [g]: linhas(e.target.value) } } : x))} className="ps-input w-full" style={{ fontSize: 12, lineHeight: 1.5 }} />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div><button onClick={() => setModelos([...modelos, { segmento: '', grupos: { INSTALACAO: padrao('INSTALACAO'), CONVERSAO: padrao('CONVERSAO'), TREINAMENTO: padrao('TREINAMENTO') } }])} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}>+ Novo modelo (começa com o padrão)</button></div>

      <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 14, display: 'grid', gap: 10 }}>
        <div>
          <div style={rotulo}>Itens extras por sistema de origem (conversão)</div>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 4 }}>Entram no fim da conversão quando o sistema anterior do cliente contém esse nome (na designação ou ao preencher a ficha de coleta).</div>
        </div>
        {extras.map((x, k) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr auto', gap: 8, alignItems: 'start' }}>
            <input value={x.sistema} onChange={e => setExtras(extras.map((y, j) => j === k ? { ...y, sistema: e.target.value } : y))} placeholder="Sistema (ex.: Trier)" className="ps-input" style={{ minHeight: 40 }} />
            <textarea rows={3} defaultValue={(x.itens || []).join('\n')} onBlur={e => setExtras(extras.map((y, j) => j === k ? { ...y, itens: linhas(e.target.value) } : y))} placeholder="Um item por linha" className="ps-input w-full" style={{ fontSize: 12 }} />
            <button onClick={() => setExtras(extras.filter((_, j) => j !== k))} aria-label="Remover" style={{ ...btn('#dc2626', false), minHeight: 36 }}><X size={12} /></button>
          </div>
        ))}
        <div><button onClick={() => setExtras([...extras, { sistema: '', itens: [] }])} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}>+ Sistema de origem</button></div>
      </div>
    </div>
  );
}

// ─── Fase 3: saúde do card, tarefas do cliente, vistas do quadro e resumo para o suporte ───

const COR_SAUDE: Record<string, string> = { VERDE: '#16a34a', AMARELO: '#d97706', VERMELHO: '#dc2626' };
function PontoSaude({ saude, tamanho = 8 }: { saude?: { nivel: string; motivos: string[] }; tamanho?: number }) {
  if (!saude) return null;
  return <span title={saude.motivos.length ? saude.motivos.join(' · ') : 'Em dia'} aria-label={`Saúde: ${saude.nivel.toLowerCase()}`}
    style={{ width: tamanho, height: tamanho, borderRadius: 99, background: COR_SAUDE[saude.nivel], display: 'inline-block', flexShrink: 0 }} />;
}

/** Tarefas do cliente: o que a loja precisa entregar; o cliente envia pela página de acompanhamento. */
function AbaTarefasCliente({ d, recarregar }: { d: any; recarregar: () => void }) {
  const i = d.implantacao;
  const lista: any[] = d.tarefas_cliente || [];
  const [nova, setNova] = useState({ titulo: '', descricao: '', prazo: '', exige_arquivo: true });
  const [ocupado, setOcupado] = useState(false);
  const run = async (f: () => Promise<any>) => { setOcupado(true); try { await f(); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); } };
  const baixar = async (t: any) => {
    try {
      const r = await apiClient.baixarArquivoTarefaCliente(t.id);
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = t.arquivo_nome || 'arquivo'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert(erroDe(e)); }
  };
  const devolver = (t: any) => { const m = prompt(`O que o cliente precisa corrigir em "${t.titulo}"? Ele recebe esta mensagem no WhatsApp.`); if (m && m.trim().length >= 3) run(() => apiClient.acaoTarefaCliente(t.id, 'DEVOLVER', m.trim())); };
  const STATUS: Record<string, [string, string]> = { PENDENTE: ['Aguardando o cliente', '#b45309'], ENVIADA: ['Enviado, conferir', '#2E6EAB'], CONCLUIDA: ['Conferido', '#16a34a'] };
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
      <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.5 }}>
        O cliente vê esta lista na página de acompanhamento, em "O que precisamos de você", e envia por lá. Ele é avisado no WhatsApp e lembrado a cada 2 dias úteis depois do prazo (até 3 vezes). Enquanto houver item vencido, o card fica em espera "Cliente".
      </div>
      {lista.length === 0 ? (
        <div style={{ ...cartao, padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum item pedido ao cliente ainda.</span>
          {i.modulo === 'IMPLANTACAO' && <button disabled={ocupado} onClick={() => run(() => apiClient.criarTarefaCliente(i.id, { padrao: true }))} style={{ ...btn('#2E6EAB'), minHeight: 36 }}>Pedir os itens padrão</button>}
        </div>
      ) : (
        <div style={{ ...cartao }}>
          {lista.map((t, k) => {
            const [rot, cor] = STATUS[t.status] || [t.status, 'var(--t-text-muted)'];
            return (
              <div key={t.id} style={{ padding: '12px 14px', borderTop: k ? '1px solid var(--t-card-border)' : 'none', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 220, fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)' }}>{t.titulo}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.vencida ? '#dc2626' : cor }}>{t.vencida ? 'Vencida' : rot}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
                  {t.prazo ? `Prazo ${fmtData(t.prazo)}` : 'Sem prazo'}{t.lembretes > 1 ? ` · ${t.lembretes - 1} lembrete(s)` : t.lembretes === 1 ? ' · cliente avisado' : ' · aviso sai no próximo horário comercial'}
                  {t.enviada_em ? ` · enviado em ${fmtDataHora(t.enviada_em)}` : ''}{t.devolvida_motivo && t.status === 'PENDENTE' ? ` · devolvido: ${t.devolvida_motivo}` : ''}
                </div>
                {t.resposta_texto && <div style={{ fontSize: 13, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap' }}>{t.resposta_texto}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {t.tem_arquivo && <button onClick={() => baixar(t)} style={{ ...btn('#2E6EAB', false), minHeight: 32 }}><FileText size={12} /> {t.arquivo_nome || 'Baixar arquivo'}</button>}
                  {t.status === 'ENVIADA' && <button disabled={ocupado} onClick={() => run(() => apiClient.acaoTarefaCliente(t.id, 'CONCLUIR'))} style={{ ...btn('#16a34a'), minHeight: 32 }}><CheckCircle size={12} /> Conferido</button>}
                  {t.status === 'ENVIADA' && <button disabled={ocupado} onClick={() => devolver(t)} style={{ ...btn('#b45309', false), minHeight: 32 }}>Pedir para reenviar</button>}
                  {t.status === 'CONCLUIDA' && <button disabled={ocupado} onClick={() => run(() => apiClient.acaoTarefaCliente(t.id, 'REABRIR'))} style={{ ...btn('#64748b', false), minHeight: 32 }}>Reabrir</button>}
                  {t.status !== 'CONCLUIDA' && <button disabled={ocupado} onClick={() => confirm(`Remover "${t.titulo}"?`) && run(() => apiClient.acaoTarefaCliente(t.id, 'EXCLUIR'))} style={{ ...btn('#64748b', false), minHeight: 32 }}>Remover</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 8 }}>
        <div style={rotulo}>Pedir mais um item ao cliente</div>
        <input value={nova.titulo} onChange={e => setNova(p => ({ ...p, titulo: e.target.value }))} placeholder="O que o cliente precisa enviar (ex.: planilha de preços)" className="ps-input w-full" style={{ minHeight: 40 }} />
        <input value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} placeholder="Explicação para o cliente (opcional)" className="ps-input w-full" style={{ minHeight: 40 }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Prazo <input type="date" value={nova.prazo} onChange={e => setNova(p => ({ ...p, prazo: e.target.value }))} className="ps-input" style={{ minHeight: 36 }} /></label>
          <label style={{ fontSize: 13, color: 'var(--t-text-secondary)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={nova.exige_arquivo} onChange={e => setNova(p => ({ ...p, exige_arquivo: e.target.checked }))} /> Precisa de arquivo</label>
          <button disabled={ocupado || nova.titulo.trim().length < 3} onClick={() => run(async () => { await apiClient.criarTarefaCliente(i.id, { titulo: nova.titulo.trim(), descricao: nova.descricao.trim() || undefined, prazo: nova.prazo || undefined, exige_arquivo: nova.exige_arquivo }); setNova({ titulo: '', descricao: '', prazo: '', exige_arquivo: true }); })}
            style={{ ...btn('#2E6EAB'), minHeight: 36, opacity: nova.titulo.trim().length < 3 ? 0.5 : 1 }}>Adicionar</button>
        </div>
      </div>
    </div>
  );
}

/** Resumo da implantação no topo do ticket do suporte (o mais recente validado deste cliente). */
export function ResumoImplantacaoTicket({ clienteId }: { clienteId?: string | null }) {
  const [r, setR] = useState<any | null>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => { setR(null); if (clienteId) apiClient.getResumoSuporte(clienteId).then(x => setR(x.data.data)).catch(() => {}); }, [clienteId]);
  if (!r) return null;
  const linhas: string[] = (r.resumo_suporte || '').split('\n');
  return (
    <div style={{ border: '1px solid #2E6EAB40', background: '#2E6EAB08', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#2E6EAB' }}>Resumo da {r.modulo === 'SERVICO' ? 'demanda' : 'implantação'}</span>
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>validada em {fmtData(r.validado_em)}{r.tecnico_nome ? ` · ${r.tecnico_nome.split(' ')[0]}` : ''}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap' }}>{(aberto ? linhas : linhas.slice(0, 4)).join('\n')}</div>
      {linhas.length > 4 && <button onClick={() => setAberto(v => !v)} style={{ justifySelf: 'start', fontSize: 12, fontWeight: 600, color: '#2E6EAB', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>{aberto ? 'Mostrar menos' : 'Ver o resumo completo'}</button>}
    </div>
  );
}

/** Vistas do quadro além do Kanban: Lista (tabela ordenável), Calendário (mês) e Equipe (14 dias por técnico, só supervisão). */
function VistaLista({ cards, abrir }: { cards: any[]; abrir: (id: string) => void }) {
  const [ord, setOrd] = useState<{ k: string; asc: boolean }>({ k: 'saude', asc: false });
  const ORDEM_COL = ['BACKLOG', 'A_FAZER', 'EM_ANDAMENTO', 'ACOMPANHAMENTO', 'CONCLUIDO', 'VALIDADO', 'FINALIZADO', 'CANCELADOS'];
  const PESO_SAUDE: Record<string, number> = { VERMELHO: 2, AMARELO: 1, VERDE: 0 };
  const valor = (c: any) => ord.k === 'cliente' ? c.cliente_razao_social : ord.k === 'coluna' ? ORDEM_COL.indexOf(c.coluna) : ord.k === 'tecnico' ? (c.tecnico_nome || '') : ord.k === 'prazo' ? (c.sla?.prazo ? new Date(c.sla.prazo).getTime() : Infinity) : PESO_SAUDE[c.saude?.nivel] ?? 0;
  const lista = [...cards].sort((a, b) => { const x = valor(a), y = valor(b); const r = x < y ? -1 : x > y ? 1 : 0; return ord.asc ? r : -r; });
  const cab = (k: string, l: string) => (
    <th onClick={() => setOrd(o => ({ k, asc: o.k === k ? !o.asc : k !== 'saude' }))} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
      {l}{ord.k === k ? (ord.asc ? ' ↑' : ' ↓') : ''}
    </th>
  );
  const nomeCol: Record<string, string> = { BACKLOG: 'BackLog', A_FAZER: 'A fazer', EM_ANDAMENTO: 'Em andamento', ACOMPANHAMENTO: 'Acompanhamento', CONCLUIDO: 'Concluído', VALIDADO: 'Validado', FINALIZADO: 'Finalizado', CANCELADOS: 'Cancelado' };
  return (
    <div style={{ ...cartao, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
        <thead style={{ borderBottom: '1px solid var(--t-card-border)' }}><tr>{cab('saude', 'Saúde')}{cab('cliente', 'Cliente')}{cab('coluna', 'Coluna')}<th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>Próximo passo</th>{cab('tecnico', 'Técnico')}{cab('prazo', 'Prazo')}</tr></thead>
        <tbody>
          {lista.map(c => (
            <tr key={c.id} onClick={() => abrir(c.id)} style={{ borderTop: '1px solid var(--t-card-border)', cursor: 'pointer' }}>
              <td style={{ padding: '10px 12px' }}><PontoSaude saude={c.saude} tamanho={10} /></td>
              <td style={{ padding: '10px 12px', fontSize: 13 }}><div style={{ fontWeight: 600, color: 'var(--t-text-primary)' }}>{c.cliente_razao_social}</div><div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{c.modulo === 'SERVICO' ? c.tipo_servico_label || 'Serviço' : c.tipo_base === 'BANCO_ZERADO' ? 'Banco zerado' : 'Conversão'}</div></td>
              <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--t-text-secondary)', whiteSpace: 'nowrap' }}>{nomeCol[c.coluna] || c.coluna}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--t-text-primary)' }}>{c.proximo_passo?.titulo || '—'}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, color: c.tecnico_nome ? 'var(--t-text-secondary)' : '#dc2626', whiteSpace: 'nowrap' }}>{c.tecnico_nome ? c.tecnico_nome.split(' ')[0] : 'sem técnico'}</td>
              <td style={{ padding: '10px 12px' }}><SlaBadge sla={c.sla} etapa={c.sla_etapa} /></td>
            </tr>
          ))}
          {lista.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma demanda.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

type EventoAgenda = { id: string; dia: string; hora?: string; tipo: 'VIRADA' | 'TREINO'; titulo: string; cliente: string; tecnico?: string | null };
const diaBR = (d: Date) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);
function eventosDosCards(cards: any[]): EventoAgenda[] {
  const ev: EventoAgenda[] = [];
  for (const c of cards) {
    if (c.virada_agendada_para && !c.virada_inicio_em) { const d = new Date(c.virada_agendada_para); ev.push({ id: c.id, dia: diaBR(d), hora: d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }), tipo: 'VIRADA', titulo: 'Virada', cliente: c.cliente_razao_social, tecnico: c.tecnico_nome }); }
    for (const f of c.treinos_marcados || []) ev.push({ id: c.id, dia: diaBR(new Date(f.marcada_em)), tipo: 'TREINO', titulo: `Treino fase ${f.ordem}`, cliente: c.cliente_razao_social, tecnico: c.tecnico_nome });
  }
  return ev.sort((a, b) => (a.dia + (a.hora || '')).localeCompare(b.dia + (b.hora || '')));
}
function ChipEvento({ e, abrir, mostrarTecnico }: { e: EventoAgenda; abrir: (id: string) => void; mostrarTecnico?: boolean }) {
  return (
    <button onClick={() => abrir(e.id)} title={`${e.titulo} · ${e.cliente}${e.tecnico ? ` · ${e.tecnico}` : ''}`}
      style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 11, lineHeight: 1.3, padding: '3px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', marginTop: 3,
        background: e.tipo === 'VIRADA' ? '#2E6EAB1a' : '#0891b214', color: 'var(--t-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {e.tipo === 'VIRADA' ? '🚀' : '🎓'} {e.hora ? `${e.hora} ` : ''}{e.cliente}{mostrarTecnico && e.tecnico ? ` · ${e.tecnico.split(' ')[0]}` : ''}
    </button>
  );
}
function VistaCalendario({ cards, abrir, gestao }: { cards: any[]; abrir: (id: string) => void; gestao: boolean }) {
  const hoje = diaBR(new Date());
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [y, m] = mes.split('-').map(Number);
  const primeiro = new Date(Date.UTC(y, m - 1, 1)), dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vazio = primeiro.getUTCDay();
  const ev = eventosDosCards(cards);
  const mover = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMes(d.toISOString().slice(0, 7)); };
  const nomeMes = primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const doMes = ev.filter(e => e.dia.startsWith(mes));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => mover(-1)} aria-label="Mês anterior" style={{ ...btn('#64748b', false), minHeight: 32 }}>‹</button>
        <b style={{ fontSize: 15, color: 'var(--t-text-primary)', textTransform: 'capitalize', minWidth: 160, textAlign: 'center' }}>{nomeMes}</b>
        <button onClick={() => mover(1)} aria-label="Próximo mês" style={{ ...btn('#64748b', false), minHeight: 32 }}>›</button>
        <button onClick={() => setMes(hoje.slice(0, 7))} style={{ ...btn('#2E6EAB', false), minHeight: 32 }}>Hoje</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-text-muted)' }}>{doMes.length} compromisso(s) · 🚀 virada · 🎓 treinamento</span>
      </div>
      <div className="pt-cal-grade" style={{ ...cartao, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', overflow: 'hidden' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(n => <div key={n} style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--t-text-muted)', borderBottom: '1px solid var(--t-card-border)' }}>{n}</div>)}
        {Array.from({ length: vazio }, (_, k) => <div key={`v${k}`} style={{ borderTop: '1px solid var(--t-card-border)', minHeight: 84, background: 'var(--t-content-bg)' }} />)}
        {Array.from({ length: dias }, (_, k) => {
          const dia = `${mes}-${String(k + 1).padStart(2, '0')}`;
          const doDia = doMes.filter(e => e.dia === dia);
          return (
            <div key={dia} style={{ borderTop: '1px solid var(--t-card-border)', borderLeft: (vazio + k) % 7 ? '1px solid var(--t-card-border)' : 'none', minHeight: 84, padding: 4, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: dia === hoje ? 700 : 500, color: dia === hoje ? '#2E6EAB' : 'var(--t-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{k + 1}</div>
              {doDia.slice(0, 3).map((e, j) => <ChipEvento key={j} e={e} abrir={abrir} mostrarTecnico={gestao} />)}
              {doDia.length > 3 && <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>+{doDia.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function VistaEquipe({ cards, abrir }: { cards: any[]; abrir: (id: string) => void }) {
  const hoje = new Date();
  const dias = Array.from({ length: 14 }, (_, k) => diaBR(new Date(hoje.getTime() + k * 864e5)));
  const ev = eventosDosCards(cards);
  const ativos = cards.filter(c => !['CONCLUIDO', 'VALIDADO', 'FINALIZADO', 'CANCELADOS'].includes(c.coluna));
  const nomes = [...new Set(ativos.map(c => c.tecnico_nome || ''))].sort((a, b) => (a ? (b ? a.localeCompare(b) : -1) : 1));
  const PESO: Record<string, number> = { VERMELHO: 0, AMARELO: 1, VERDE: 2 };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Próximos 14 dias por técnico (viradas e treinamentos marcados) e as demandas ativas de cada um, piores primeiro.</div>
      <div style={{ ...cartao, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(14, minmax(64px, 1fr))`, minWidth: 160 + 14 * 64 }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--t-card-border)' }} />
          {dias.map(d => { const dt = new Date(`${d}T12:00:00-03:00`); const fds = [0, 6].includes(dt.getUTCDay()); return (
            <div key={d} style={{ padding: '8px 4px', fontSize: 11, textAlign: 'center', fontWeight: d === dias[0] ? 700 : 500, color: d === dias[0] ? '#2E6EAB' : 'var(--t-text-muted)', borderBottom: '1px solid var(--t-card-border)', background: fds ? 'var(--t-content-bg)' : 'transparent', textTransform: 'capitalize' }}>
              {dt.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')}<br />{d.slice(8, 10)}/{d.slice(5, 7)}
            </div>); })}
          {nomes.map(nome => {
            const meus = ativos.filter(c => (c.tecnico_nome || '') === nome).sort((a, b) => (PESO[a.saude?.nivel] ?? 2) - (PESO[b.saude?.nivel] ?? 2));
            return (
              <div key={nome || 'sem'} style={{ display: 'contents' }}>
                <div style={{ padding: '10px', borderTop: '1px solid var(--t-card-border)', gridRow: 'span 2' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: nome ? 'var(--t-text-primary)' : '#dc2626' }}>{nome ? nome.split(' ').slice(0, 2).join(' ') : 'Sem técnico'}</div>
                  <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{meus.length} ativa(s){meus.filter(c => c.saude?.nivel !== 'VERDE').length ? ` · ${meus.filter(c => c.saude?.nivel !== 'VERDE').length} em risco` : ''}</div>
                </div>
                {dias.map(d => (
                  <div key={d} style={{ borderTop: '1px solid var(--t-card-border)', borderLeft: '1px solid var(--t-card-border)', padding: 3, minHeight: 44, minWidth: 0 }}>
                    {ev.filter(e => e.dia === d && (e.tecnico || '') === nome).map((e, j) => <ChipEvento key={j} e={e} abrir={abrir} />)}
                  </div>
                ))}
                <div style={{ gridColumn: '2 / -1', padding: '6px 6px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', borderLeft: '1px solid var(--t-card-border)' }}>
                  {meus.map(c => (
                    <button key={c.id} onClick={() => abrir(c.id)} title={c.saude?.motivos?.join(' · ') || c.proximo_passo?.titulo}
                      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', cursor: 'pointer', color: 'var(--t-text-primary)', maxWidth: 260 }}>
                      <PontoSaude saude={c.saude} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente_razao_social}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Tarefas padrão do cliente (Configurações). */
function TarefasClientePadrao({ c, setC }: { c: any; setC: (f: (p: any) => any) => void }) {
  return (
    <div style={{ ...cartao, padding: 16, display: 'grid', gap: 8 }}>
      <div style={rotulo}>O que pedir ao cliente no começo da implantação</div>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Criado na designação, com prazo de 3 dias úteis. O cliente é avisado no WhatsApp e envia pela página de acompanhamento. Um item por linha.</div>
      <textarea rows={5} defaultValue={(c.tarefas_cliente || []).join('\n')} onBlur={e => setC(p => ({ ...p, tarefas_cliente: e.target.value.split('\n').map(x => x.trim()).filter(x => x.length >= 2) }))} className="ps-input w-full" style={{ fontSize: 13, lineHeight: 1.5 }} />
    </div>
  );
}

// ─── Mais completo (05/10/2026): testes de conversão, anexos, inventário técnico ───

const lerArquivo = (f: File) => new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsDataURL(f); });

/** Testes de conversão: conferir cada cadastro convertido. Na conversão, pendente ou divergente trava a virada. */
function AbaTestes({ d, recarregar }: { d: any; recarregar: () => void }) {
  const i = d.implantacao;
  const testes: any[] = d.testes || [];
  const [novo, setNovo] = useState('');
  const [obs, setObs] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const salvar = async (t: any, resultado: string) => {
    const o = (obs[t.id] ?? t.observacao ?? '').trim();
    if (resultado === 'DIVERGENTE' && !o) return alert('Conte qual foi a divergência no campo de observação.');
    setOcupado(t.id);
    try { await apiClient.atualizarTesteConversao(t.id, { resultado, observacao: o || undefined }); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(null); }
  };
  const R: Record<string, [string, string]> = { PENDENTE: ['Sem conferir', '#b45309'], OK: ['Ok', '#16a34a'], DIVERGENTE: ['Divergência', '#dc2626'], NAO_APLICA: ['Não se aplica', '#64748b'] };
  const pend = testes.filter(t => t.resultado === 'PENDENTE').length, div = testes.filter(t => t.resultado === 'DIVERGENTE').length;
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
      <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.5 }}>
        Confira no sistema novo se cada cadastro veio certo do sistema anterior. {i.tipo_base === 'CONVERSAO' ? <b style={{ color: pend || div ? '#b45309' : '#16a34a' }}>{pend || div ? `A virada só libera com tudo conferido (${pend} sem conferir, ${div} com divergência).` : 'Tudo conferido: a virada está liberada por aqui.'}</b> : 'No banco zerado, os testes são opcionais.'}
      </div>
      <div style={{ ...cartao }}>
        {testes.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum teste ainda. Eles são criados quando o técnico é designado; adicione abaixo se precisar.</div>}
        {testes.map((t, k) => {
          const [rot, cor] = R[t.resultado] || [t.resultado, 'var(--t-text-muted)'];
          return (
            <div key={t.id} style={{ padding: '12px 14px', borderTop: k ? '1px solid var(--t-card-border)' : 'none', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 160, fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)' }}>{t.item}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: cor }}>{rot}{t.testado_por && t.resultado !== 'PENDENTE' ? ` · ${String(t.testado_por).split(' ')[0]} ${fmtData(t.testado_em)}` : ''}</span>
              </div>
              <input value={obs[t.id] ?? t.observacao ?? ''} onChange={e => setObs(p => ({ ...p, [t.id]: e.target.value }))} placeholder="Observação (obrigatória se houver divergência)" className="ps-input w-full" style={{ minHeight: 36, fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['OK', 'Ok', '#16a34a'], ['DIVERGENTE', 'Divergência', '#dc2626'], ['NAO_APLICA', 'Não se aplica', '#64748b'], ['PENDENTE', 'Reabrir', '#64748b']] as [string, string, string][]).filter(([k2]) => k2 !== t.resultado && !(k2 === 'PENDENTE' && t.resultado === 'PENDENTE')).map(([k2, l, c]) => (
                  <button key={k2} disabled={ocupado === t.id} onClick={() => salvar(t, k2)} style={{ ...btn(c, k2 === 'OK'), minHeight: 32 }}>{l}</button>
                ))}
                {t.resultado === 'PENDENTE' && <button onClick={() => confirm(`Remover o teste "${t.item}"?`) && apiClient.atualizarTesteConversao(t.id, { excluir: true }).then(recarregar).catch(e => alert(erroDe(e)))} style={{ ...btn('#64748b', false), minHeight: 32 }}>Remover</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Novo teste (ex.: Convênios)" className="ps-input" style={{ flex: 1, minHeight: 40 }} />
        <button disabled={novo.trim().length < 2} onClick={async () => { try { await apiClient.criarTesteConversao(i.id, novo.trim()); setNovo(''); recarregar(); } catch (e) { alert(erroDe(e)); } }} style={{ ...btn('#2E6EAB'), minHeight: 40, opacity: novo.trim().length < 2 ? 0.5 : 1 }}>Adicionar</button>
      </div>
    </div>
  );
}

/** Arquivos e links do card (planilhas, prints, documentos). Arquivo até 15 MB. */
function AbaAnexos({ d, recarregar }: { d: any; recarregar: () => void }) {
  const i = d.implantacao;
  const lista: any[] = d.anexos || [];
  const [link, setLink] = useState({ nome: '', url: '' });
  const [enviando, setEnviando] = useState(false);
  const enviarArquivo = async (f: File) => {
    if (f.size > 15 * 1024 * 1024) return alert('O arquivo passa de 15 MB. Envie compactado (.zip) ou como link.');
    setEnviando(true);
    try { await apiClient.anexarImplantacao(i.id, { nome: f.name, arquivo: await lerArquivo(f) }); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setEnviando(false); }
  };
  const baixar = async (a: any) => {
    try { const r = await apiClient.baixarAnexoImplantacao(a.id); const url = URL.createObjectURL(r.data); const el = document.createElement('a'); el.href = url; el.download = a.nome; el.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); } catch (e) { alert(erroDe(e)); }
  };
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
      <div style={{ ...cartao }}>
        {lista.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum arquivo ou link ainda.</div>}
        {lista.map((a, k) => (
          <div key={a.id} style={{ padding: '10px 14px', borderTop: k ? '1px solid var(--t-card-border)' : 'none', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {a.tipo === 'LINK' ? <Link2 size={15} color="#2E6EAB" /> : <FileText size={15} color="#2E6EAB" />}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)', wordBreak: 'break-word' }}>{a.nome}{a.tela_suporte ? <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 500 }}> · tela do Suporte</span> : null}</div>
              <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{a.enviado_por ? `${String(a.enviado_por).split(' ')[0]} · ` : ''}{fmtDataHora(a.created_at)}{a.descricao ? ` · ${a.descricao}` : ''}</div>
            </div>
            {a.tipo === 'LINK' ? <a href={a.url} target="_blank" rel="noreferrer" style={{ ...btn('#2E6EAB', false), minHeight: 32, textDecoration: 'none' }}>Abrir</a>
              : <button onClick={() => baixar(a)} style={{ ...btn('#2E6EAB', false), minHeight: 32 }}>Baixar</button>}
            {!a.tela_suporte && <button aria-label="Remover" onClick={() => confirm(`Remover "${a.nome}"?`) && apiClient.removerAnexoImplantacao(a.id).then(recarregar).catch(e => alert(erroDe(e)))} style={{ ...btn('#64748b', false), minHeight: 32 }}><X size={12} /></button>}
          </div>
        ))}
      </div>
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 10 }}>
        <div style={rotulo}>Adicionar</div>
        <label style={{ ...btn('#2E6EAB'), minHeight: 40, justifySelf: 'start', cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Enviando…' : 'Escolher arquivo (até 15 MB)'}
          <input type="file" disabled={enviando} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) enviarArquivo(f); }} style={{ display: 'none' }} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={link.nome} onChange={e => setLink(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do link" className="ps-input" style={{ flex: '1 1 160px', minHeight: 40 }} />
          <input value={link.url} onChange={e => setLink(p => ({ ...p, url: e.target.value }))} placeholder="https://…" className="ps-input" style={{ flex: '2 1 240px', minHeight: 40 }} />
          <button disabled={!link.nome.trim() || !/^https?:\/\//.test(link.url.trim())} onClick={async () => { try { await apiClient.anexarImplantacao(i.id, { nome: link.nome.trim(), link: link.url.trim() }); setLink({ nome: '', url: '' }); recarregar(); } catch (e) { alert(erroDe(e)); } }}
            style={{ ...btn('#2E6EAB', false), minHeight: 40 }}>Adicionar link</button>
        </div>
      </div>
    </div>
  );
}

const TIPOS_EQUIPAMENTO = ['Servidor', 'Caixa (PDV)', 'Terminal', 'Impressora NFC-e', 'Impressora de etiquetas', 'Balança', 'TEF / Pinpad', 'Gaveta', 'Leitor de código', 'Roteador / rede', 'Outro'];
/** Inventário técnico da loja: fica no cliente e aparece também nos tickets do suporte. Sem senhas. */
function AbaInventario({ d }: { d: any }) {
  const i = d.implantacao;
  const [inv, setInv] = useState<{ itens: any[]; versao_sistema: string; observacoes: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => { apiClient.getInventarioImplantacao(i.id).then(r => { const x = r.data.data; setInv({ itens: x?.itens || [], versao_sistema: x?.versao_sistema || '', observacoes: x?.observacoes || '' }); }).catch(e => alert(erroDe(e))); }, [i.id]);
  if (!inv) return <div style={{ padding: 20 }}><Loader2 size={16} className="animate-spin" /></div>;
  const set = (k: number, campo: string, v: string) => setInv(p => p && ({ ...p, itens: p.itens.map((x, j) => (j === k ? { ...x, [campo]: v } : x)) }));
  const daColeta = () => {
    const c = i.coleta || {};
    const itens: any[] = [{ tipo: 'Servidor', descricao: '', acesso_remoto: '', observacao: '' }];
    const caixas = Math.min(20, Number(String(c.caixas || '').replace(/\D/g, '')) || 0);
    for (let k = 1; k <= caixas; k++) itens.push({ tipo: 'Caixa (PDV)', descricao: `Caixa ${k}`, acesso_remoto: '', observacao: '' });
    if (c.impressora_nfce) itens.push({ tipo: 'Impressora NFC-e', descricao: String(c.impressora_nfce), acesso_remoto: '', observacao: '' });
    if (c.balanca === 'Sim') itens.push({ tipo: 'Balança', descricao: '', acesso_remoto: '', observacao: '' });
    if (c.gaveta === 'Sim') itens.push({ tipo: 'Gaveta', descricao: '', acesso_remoto: '', observacao: '' });
    if (c.etiquetas === 'Sim') itens.push({ tipo: 'Impressora de etiquetas', descricao: '', acesso_remoto: '', observacao: '' });
    if (c.tef && !/n[aã]o/i.test(String(c.tef))) itens.push({ tipo: 'TEF / Pinpad', descricao: String(c.tef), acesso_remoto: '', observacao: '' });
    setInv(p => p && ({ ...p, itens }));
  };
  const salvar = async () => {
    setSalvando(true);
    try { await apiClient.salvarInventarioImplantacao(i.id, { itens: inv.itens.filter(x => x.tipo), versao_sistema: inv.versao_sistema.trim() || undefined, observacoes: inv.observacoes.trim() || undefined }); setOk(true); setTimeout(() => setOk(false), 2000); }
    catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 900 }}>
      <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.5 }}>Equipamentos da loja e IDs de acesso remoto (AnyDesk, TeamViewer). Fica no cliente: o suporte vê nos tickets depois da implantação. <b style={{ color: 'var(--t-text-primary)' }}>Nunca anote senhas aqui.</b></div>
      <div style={{ ...cartao, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--t-card-border)' }}>{['Equipamento', 'Descrição / modelo', 'ID de acesso remoto', 'Observação', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {inv.itens.map((x, k) => (
              <tr key={k} style={{ borderTop: '1px solid var(--t-card-border)' }}>
                <td style={{ padding: 6 }}><select value={x.tipo} onChange={e => set(k, 'tipo', e.target.value)} className="ps-input" style={{ minHeight: 36, width: '100%' }}>{TIPOS_EQUIPAMENTO.map(t => <option key={t}>{t}</option>)}</select></td>
                <td style={{ padding: 6 }}><input value={x.descricao} onChange={e => set(k, 'descricao', e.target.value)} className="ps-input w-full" style={{ minHeight: 36 }} /></td>
                <td style={{ padding: 6 }}><input value={x.acesso_remoto} onChange={e => set(k, 'acesso_remoto', e.target.value)} placeholder="ex.: 123 456 789" className="ps-input w-full" style={{ minHeight: 36, fontVariantNumeric: 'tabular-nums' }} /></td>
                <td style={{ padding: 6 }}><input value={x.observacao} onChange={e => set(k, 'observacao', e.target.value)} className="ps-input w-full" style={{ minHeight: 36 }} /></td>
                <td style={{ padding: 6 }}><button aria-label="Remover linha" onClick={() => setInv(p => p && ({ ...p, itens: p.itens.filter((_, j) => j !== k) }))} style={{ ...btn('#64748b', false), minHeight: 32 }}><X size={12} /></button></td>
              </tr>
            ))}
            {inv.itens.length === 0 && <tr><td colSpan={5} style={{ padding: 14, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum equipamento. {i.coleta ? 'Comece pela ficha de coleta.' : ''}</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setInv(p => p && ({ ...p, itens: [...p.itens, { tipo: 'Caixa (PDV)', descricao: '', acesso_remoto: '', observacao: '' }] }))} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}>+ Equipamento</button>
        {inv.itens.length === 0 && i.coleta && <button onClick={daColeta} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}>Preencher pela ficha de coleta</button>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'grid', gap: 4, flex: '0 1 220px' }}>Versão do Prosystem instalada<input value={inv.versao_sistema} onChange={e => setInv(p => p && ({ ...p, versao_sistema: e.target.value }))} className="ps-input" style={{ minHeight: 40 }} /></label>
        <label style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'grid', gap: 4, flex: '1 1 300px' }}>Observações (rede, backup, particularidades)<input value={inv.observacoes} onChange={e => setInv(p => p && ({ ...p, observacoes: e.target.value }))} className="ps-input" style={{ minHeight: 40 }} /></label>
      </div>
      <div><button disabled={salvando} onClick={salvar} style={{ ...btn('#2E6EAB'), minHeight: 40 }}>{salvando ? 'Salvando…' : ok ? 'Salvo' : 'Salvar inventário'}</button></div>
    </div>
  );
}

/** Inventário técnico no ticket do suporte (só leitura). */
export function InventarioTicket({ clienteId }: { clienteId?: string | null }) {
  const [inv, setInv] = useState<any | null>(null);
  useEffect(() => { setInv(null); if (clienteId) apiClient.getInventarioCliente(clienteId).then(r => setInv(r.data.data)).catch(() => {}); }, [clienteId]);
  if (!inv || !(inv.itens || []).length) return null;
  return (
    <div style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>Inventário técnico{inv.versao_sistema ? ` · Prosystem ${inv.versao_sistema}` : ''}</div>
      {(inv.itens as any[]).map((x, k) => (
        <div key={k} style={{ fontSize: 13, color: 'var(--t-text-primary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontWeight: 600 }}>{x.tipo}</b>{x.descricao && <span style={{ color: 'var(--t-text-secondary)' }}>{x.descricao}</span>}{x.acesso_remoto && <span style={{ color: '#2E6EAB', fontVariantNumeric: 'tabular-nums' }}>acesso {x.acesso_remoto}</span>}{x.observacao && <span style={{ color: 'var(--t-text-muted)' }}>· {x.observacao}</span>}
        </div>
      ))}
      {inv.observacoes && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{inv.observacoes}</div>}
    </div>
  );
}

/** Indicadores em planilha (CSV com ; e vírgula decimal, abre direto no Excel). */
function exportarCsv(r: any) {
  const n = (v: any) => (v == null ? '' : String(v).replace('.', ','));
  const a = r.atual, b = r.anterior;
  const linhas = [
    ['Indicador', `Mês ${r.mes}`, 'Mês anterior', 'Meta'],
    ['Dias até a virada (conversão)', n(a.dias_conversao), n(b.dias_conversao), n(r.metas.virada_conversao_dias)],
    ['Dias até a virada (banco zerado)', n(a.dias_zerado), n(b.dias_zerado), n(r.metas.virada_zerado_dias)],
    ['Viradas no prazo (%)', n(a.no_prazo_pct), n(b.no_prazo_pct), n(r.metas.viradas_no_prazo_pct)],
    ['Viradas no mês', n(a.viradas), n(b.viradas), ''],
    ['Retrabalho por virada', n(a.retrabalho_por_virada), n(b.retrabalho_por_virada), n(r.metas.retrabalho_por_virada)],
    ['Horas por implantação', n(a.horas_por_implantacao), n(b.horas_por_implantacao), n(r.metas.horas_por_implantacao)],
    ['Satisfação (1 a 5)', n(a.satisfacao), n(b.satisfacao), n(r.metas.satisfacao_min)],
    ['Viradas remarcadas', n(a.remarcacoes), n(b.remarcacoes), n(r.metas.remarcacoes_max)],
    ['Horas esperando programação', n(a.espera_horas?.PROGRAMACAO), n(b.espera_horas?.PROGRAMACAO), ''],
    ['Horas esperando cliente', n(a.espera_horas?.CLIENTE), n(b.espera_horas?.CLIENTE), ''],
    [], ['Por técnico', 'Viradas', 'Dias conversão', 'Dias banco zerado', 'No prazo (%)', 'Retrabalho', 'Horas por implantação'],
    ...a.por_tecnico.map((t: any) => [t.nome, n(t.viradas), n(t.dias_conversao), n(t.dias_zerado), n(t.no_prazo_pct), n(t.retrabalho), n(t.horas_por_implantacao)]),
  ];
  const csv = '\uFEFF' + linhas.map((l: any[]) => l.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const el = document.createElement('a'); el.href = url; el.download = `indicadores-implantacao-${r.mes}.csv`; el.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Portal completo (05/10/2026): indicadores, metas, marcos, barra do celular, preferências ───

/** Indicadores do mês (supervisão): valor, comparação com o mês anterior, meta e detalhe por técnico. */
function PainelIndicadores() {
  const mesAtual = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [r, setR] = useState<any | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => { setR(null); apiClient.getIndicadoresImplantacao(mes).then(x => setR(x.data.data)).catch(e => alert(erroDe(e))); }, [mes]);
  const mover = (n: number) => { const [y, m] = mes.split('-').map(Number); setMes(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); };
  const nomeMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (!r) return <div style={{ ...cartao, padding: 20, color: 'var(--t-text-muted)', fontSize: 13 }}><Loader2 size={14} className="animate-spin" /> Calculando os indicadores…</div>;
  const a = r.atual, b = r.anterior, mt = r.metas;
  // menor é melhor? (dias, retrabalho, horas, remarcações) — define a cor da variação e da meta.
  const KPIS: { k: string; l: string; v: any; ant: any; un: string; meta: number | null; menor: boolean; sub: string; col?: string }[] = [
    { k: 'conv', l: 'Até a virada · conversão', v: a.dias_conversao, ant: b.dias_conversao, un: ' dias', meta: mt.virada_conversao_dias, menor: true, sub: 'da assinatura à loja virada, sem a espera do cliente', col: 'dias_conversao' },
    { k: 'zer', l: 'Até a virada · banco zerado', v: a.dias_zerado, ant: b.dias_zerado, un: ' dias', meta: mt.virada_zerado_dias, menor: true, sub: 'da assinatura à loja virada, sem a espera do cliente', col: 'dias_zerado' },
    { k: 'prazo', l: 'Viradas no prazo', v: a.no_prazo_pct, ant: b.no_prazo_pct, un: '%', meta: mt.viradas_no_prazo_pct, menor: false, sub: `${a.viradas} virada(s) no mês`, col: 'no_prazo_pct' },
    { k: 'retrab', l: 'Retrabalho por virada', v: a.retrabalho_por_virada, ant: b.retrabalho_por_virada, un: '', meta: mt.retrabalho_por_virada, menor: true, sub: `${a.retrabalho} correção(ões) até 30 dias depois da virada`, col: 'retrabalho' },
    { k: 'horas', l: 'Horas por implantação', v: a.horas_por_implantacao, ant: b.horas_por_implantacao, un: 'h', meta: mt.horas_por_implantacao, menor: true, sub: `${a.concluidas} concluída(s) no mês (cronômetro)`, col: 'horas_por_implantacao' },
    { k: 'sat', l: 'Satisfação', v: a.satisfacao, ant: b.satisfacao, un: '', meta: mt.satisfacao_min, menor: false, sub: `${a.pesquisas} pesquisa(s) de clientes validados (1 a 5)` },
    { k: 'rem', l: 'Viradas remarcadas', v: a.remarcacoes, ant: b.remarcacoes, un: '', meta: mt.remarcacoes_max, menor: true, sub: 'remarcações registradas no mês' },
  ];
  const cor = (k: typeof KPIS[number]) => k.v == null || k.meta == null ? 'var(--t-text-primary)' : (k.menor ? k.v <= k.meta : k.v >= k.meta) ? '#16a34a' : '#b45309';
  const delta = (k: typeof KPIS[number]) => {
    if (k.v == null || k.ant == null || k.v === k.ant) return null;
    const melhor = k.menor ? k.v < k.ant : k.v > k.ant;
    return <span style={{ fontSize: 12, fontWeight: 600, color: melhor ? '#16a34a' : '#b45309' }}>{k.v > k.ant ? '↑' : '↓'} {Math.abs(Math.round((k.v - k.ant) * 10) / 10)}{k.un} vs mês anterior</span>;
  };
  const esp = a.espera_horas || {};
  const totalEsp = Object.values(esp).reduce((t: number, v: any) => t + v, 0) as number;
  const kpiAberto = KPIS.find(k => k.k === aberto);
  return (
    <section style={{ ...cartao, padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15, color: 'var(--t-text-primary)' }}>Indicadores do mês</b>
        <span style={{ flex: 1 }} />
        <button onClick={() => mover(-1)} aria-label="Mês anterior" style={{ ...btn('#64748b', false), minHeight: 32 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-secondary)', minWidth: 130, textAlign: 'center', textTransform: 'capitalize' }}>{nomeMes}</span>
        <button onClick={() => exportarCsv(r)} style={{ ...btn('#2E6EAB', false), minHeight: 32 }}>Exportar planilha</button>
        <button onClick={() => mover(1)} disabled={mes >= mesAtual} aria-label="Próximo mês" style={{ ...btn('#64748b', false), minHeight: 32, opacity: mes >= mesAtual ? 0.4 : 1 }}>›</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIS.map(k => (
          <button key={k.k} onClick={() => setAberto(x => (x === k.k ? null : k.k))} disabled={!k.col}
            style={{ textAlign: 'left', border: `1px solid ${aberto === k.k ? '#2E6EAB66' : 'var(--t-card-border)'}`, borderRadius: 10, padding: '12px 14px', background: 'transparent', cursor: k.col ? 'pointer' : 'default', display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' }}>{k.l}</span>
            <span style={{ fontSize: 26, fontWeight: 650, color: cor(k), fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{k.v == null ? '—' : `${String(k.v).replace('.', ',')}${k.un}`}</span>
            <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{k.meta != null ? `meta ${k.menor ? 'até' : 'pelo menos'} ${String(k.meta).replace('.', ',')}${k.un} · ` : ''}{k.sub}</span>
            {delta(k)}
          </button>
        ))}
        <div style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' }}>Horas de espera por causa</span>
          {[['PROGRAMACAO', 'Programação', '#7c3aed'], ['CLIENTE', 'Cliente', '#b45309'], ['PROCESSAMENTO', 'Processamento', '#64748b']].map(([k, l, c]) => (
            <div key={k} style={{ display: 'grid', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t-text-secondary)' }}><span>{l}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{esp[k] || 0}h</span></div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--t-content-bg)' }}><div style={{ height: 6, borderRadius: 99, width: `${totalEsp ? Math.round(((esp[k] || 0) / totalEsp) * 100) : 0}%`, background: c }} /></div>
            </div>
          ))}
        </div>
      </div>
      {kpiAberto?.col && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520, fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--t-card-border)' }}>{['Técnico', 'Viradas', 'Conversão', 'Banco zerado', 'No prazo', 'Retrabalho', 'Horas/implantação'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {a.por_tecnico.map((t: any) => (
                <tr key={t.tecnico_id} style={{ borderTop: '1px solid var(--t-card-border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.nome}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{t.viradas}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{t.dias_conversao ?? '—'}{t.dias_conversao != null ? ' d' : ''}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{t.dias_zerado ?? '—'}{t.dias_zerado != null ? ' d' : ''}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{t.no_prazo_pct ?? '—'}{t.no_prazo_pct != null ? '%' : ''}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{t.retrabalho}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{t.horas_por_implantacao ?? '—'}{t.horas_por_implantacao != null ? 'h' : ''}</td>
                </tr>
              ))}
              {a.por_tecnico.length === 0 && <tr><td colSpan={7} style={{ padding: 14, color: 'var(--t-text-muted)' }}>Sem viradas nem conclusões neste mês.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Contam só as demandas que entraram a partir de 02/10/2026. Metas em Configurações. Toque num indicador para ver por técnico.</div>
    </section>
  );
}

/** Metas dos indicadores (Configurações). */
function MetasIndicadores({ c, setC }: { c: any; setC: (f: (p: any) => any) => void }) {
  const m = c.metas || {};
  const CAMPOS: [string, string, number][] = [
    ['virada_conversao_dias', 'Dias até a virada (conversão)', 1], ['virada_zerado_dias', 'Dias até a virada (banco zerado)', 1],
    ['viradas_no_prazo_pct', 'Viradas no prazo (%)', 1], ['retrabalho_por_virada', 'Retrabalho por virada (máx.)', 0.1],
    ['horas_por_implantacao', 'Horas por implantação (máx.)', 1], ['satisfacao_min', 'Satisfação mínima (1 a 5)', 0.1], ['remarcacoes_max', 'Remarcações por mês (máx.)', 1],
  ];
  return (
    <div style={{ ...cartao, padding: 16, display: 'grid', gap: 10 }}>
      <div style={rotulo}>Metas dos indicadores</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {CAMPOS.map(([k, l, passo]) => (
          <label key={k} style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'grid', gap: 4 }}>{l}
            <input type="number" step={passo} value={m[k] ?? ''} onChange={e => setC(p => ({ ...p, metas: { ...(p.metas || {}), [k]: e.target.value === '' ? '' : Number(e.target.value) } }))} className="ps-input" style={{ minHeight: 40 }} />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Linha de marcos no topo do card (substitui a barra de %): onde a demanda está na jornada. */
function LinhaMarcos({ d }: { d: any }) {
  const i = d.implantacao, servico = i.modulo === 'SERVICO';
  const col = i.coluna;
  const pos = ['CONCLUIDO', 'VALIDADO', 'FINALIZADO'];
  const marcos: [string, boolean][] = servico ? [
    ['Designado', !!i.tecnico_id], ['Execução', i.progresso >= 100 || pos.includes(col)], ['Concluído', pos.includes(col)], ['Validado', ['VALIDADO', 'FINALIZADO'].includes(col)],
  ] : [
    ['Primeiro contato', !!d.onboarding_ok], ['Coleta', !!(i.coleta?.regime_tributario && i.coleta?.contato_nome)], ['Virada', !!i.virada_fim_em],
    ...(d.assistida ? [['Assistida', !!d.assistida.concluida] as [string, boolean]] : []),
    ['Treinamento', (d.fases || []).length > 0 && (d.fases || []).every((f: any) => f.realizada_em)], ['Validação', ['VALIDADO', 'FINALIZADO'].includes(col)],
  ];
  const atual = marcos.findIndex(([, ok]) => !ok);
  return (
    <div role="list" aria-label="Marcos da demanda" style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 2 }}>
      {marcos.map(([nome, ok], k) => {
        const eAtual = k === atual;
        return (
          <div key={nome} role="listitem" style={{ display: 'flex', alignItems: 'center', flex: k < marcos.length - 1 ? '1 1 0' : '0 0 auto', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ width: 18, height: 18, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                background: ok ? '#2E6EAB' : 'transparent', color: ok ? '#fff' : eAtual ? '#2E6EAB' : 'var(--t-text-muted)', border: ok ? 'none' : `1.5px solid ${eAtual ? '#2E6EAB' : 'var(--t-card-border)'}` }}>{ok ? '✓' : k + 1}</span>
              <span style={{ fontSize: 12, fontWeight: eAtual ? 600 : 500, color: ok ? 'var(--t-text-secondary)' : eAtual ? 'var(--t-text-primary)' : 'var(--t-text-muted)', whiteSpace: 'nowrap' }}>{nome}</span>
            </div>
            {k < marcos.length - 1 && <span style={{ flex: 1, height: 1.5, minWidth: 12, margin: '0 8px', background: ok ? '#2E6EAB' : 'var(--t-card-border)' }} />}
          </div>
        );
      })}
    </div>
  );
}

/** Celular: Ligar, WhatsApp e Play fixos no rodapé do card, ao alcance do polegar. */
function BarraCelularCard({ d }: { d: any }) {
  const contatos = contatosDoCliente(d);
  const col = d.implantacao.coleta || {};
  const fone = col.decisor_telefone || contatos[0]?.fone;
  const n = soDigitos(fone), wa = n.length >= 10 ? (n.startsWith('55') ? n : `55${n}`) : null;
  const { sessao } = useCronometro();
  const rodando = sessao?.implantacao_id === d.implantacao.id;
  const etapa = d.proximo_passo?.etapa || (d.onboarding_ok === false ? 'ONBOARDING' : 'INSTALACAO');
  const play = async () => { try { if (rodando) await apiClient.pausarCronometro(); else await apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: d.implantacao.id, etapa }); avisarCronometro(); } catch (e) { alert(erroDe(e)); } };
  const item: React.CSSProperties = { flex: 1, minHeight: 52, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: 'var(--t-text-secondary)', textDecoration: 'none', background: 'transparent', border: 'none' };
  return (
    <div className="pt-barra-celular" style={{ borderTop: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <style>{`.pt-barra-celular{display:none}@media (max-width:640px){.pt-barra-celular{display:flex}}`}</style>
      {n ? <a href={`tel:${n}`} style={item}><Phone size={18} color="#2E6EAB" />Ligar</a> : <span style={{ ...item, opacity: 0.4 }}><Phone size={18} />Sem telefone</span>}
      {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={item}><MessageSquare size={18} color="#16a34a" />WhatsApp</a> : <span style={{ ...item, opacity: 0.4 }}><MessageSquare size={18} />WhatsApp</span>}
      <button onClick={play} style={{ ...item, color: rodando ? '#dc2626' : 'var(--t-text-secondary)' }}><Play size={18} color={rodando ? '#dc2626' : '#2E6EAB'} />{rodando ? 'Pausar' : 'Play'}</button>
    </div>
  );
}

/** Preferência de aviso no WhatsApp (o portal recebe tudo sempre). */
function PreferenciaAvisos() {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => { apiClient.getMinhasPreferencias().then(r => setV(r.data.data.whatsapp)).catch(() => setV('URGENTES')); }, []);
  const salvar = async (x: string) => { setV(x); try { await apiClient.salvarMinhasPreferencias({ whatsapp: x }); } catch (e) { alert(erroDe(e)); } };
  if (!v) return null;
  return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--t-card-border)', display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Também no meu WhatsApp</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['URGENTES', 'Só urgentes'], ['TODOS', 'Tudo'], ['NENHUM', 'Nada']].map(([k, l]) => (
          <button key={k} onClick={() => salvar(k)} style={{ fontSize: 12, fontWeight: v === k ? 600 : 500, padding: '5px 10px', minHeight: 30, borderRadius: 999, cursor: 'pointer', border: `1px solid ${v === k ? '#2E6EAB' : 'var(--t-card-border)'}`, background: v === k ? '#2E6EAB0f' : 'transparent', color: v === k ? '#2E6EAB' : 'var(--t-text-secondary)' }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/** Iniciais do técnico no cartão do quadro (o nome completo aparece ao passar o mouse). */
function Iniciais({ nome }: { nome?: string | null }) {
  if (!nome) return <span title="Sem técnico" style={{ fontSize: 11, fontWeight: 600, color: '#dc2626' }}>sem técnico</span>;
  const ini = nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return <span title={nome} style={{ width: 26, height: 26, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#2E6EAB', background: '#2E6EAB14', flexShrink: 0 }}>{ini}</span>;
}

// ─── Linguagem visual do card (ordem de serviço): bordas finas, cor só para ação ───
const os = {
  linha: 'var(--t-card-border)',
  rotulo: { fontSize: 11, fontWeight: 500, color: 'var(--t-text-muted)', letterSpacing: '.02em' } as React.CSSProperties,
  secao: { fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', letterSpacing: '.01em' } as React.CSSProperties,
  valor: { fontSize: 14, fontWeight: 500, color: 'var(--t-text-primary)', lineHeight: 1.5 } as React.CSSProperties,
  painel: { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10 } as React.CSSProperties,
};

/** Botão de ícone redondo (44px de toque) para ligar / WhatsApp. */
function AcaoContato({ href, titulo, children, externo }: { href: string; titulo: string; children: React.ReactNode; externo?: boolean }) {
  return (
    <a href={href} title={titulo} aria-label={titulo} {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})} className="pt-acao-contato"
      style={{ width: 36, height: 36, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${os.linha}`, color: 'var(--t-text-secondary)', textDecoration: 'none', position: 'relative' }}>
      {children}
    </a>
  );
}

function LinhaContato({ papel, nome, fone, acao }: { papel: string; nome: string | null; fone: string | null; acao?: React.ReactNode }) {
  const n = soDigitos(fone), wa = n.length >= 10 ? (n.startsWith('55') ? n : `55${n}`) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 56 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={os.rotulo}>{papel}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text-primary)' }}>{nome || 'Sem nome'}</span>
          {n ? <a href={`tel:${n}`} style={{ fontSize: 15, fontWeight: 600, color: '#2E6EAB', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{fmtFone(fone)}</a>
            : <span style={{ fontSize: 13, color: '#b45309' }}>sem telefone</span>}
        </div>
      </div>
      {acao}
      {n && <AcaoContato href={`tel:${n}`} titulo="Ligar"><Phone size={15} /></AcaoContato>}
      {wa && <AcaoContato href={`https://wa.me/${wa}`} titulo="WhatsApp" externo><MessageSquare size={15} color="#16a34a" /></AcaoContato>}
    </div>
  );
}

/** Faixa de contatos do card: decisor (informado pela supervisão) e contato do dia a dia, prontos para discar. */
function PainelContatos({ d, gestao, recarregar }: { d: any; gestao: boolean; recarregar: () => void }) {
  const col = d.implantacao.coleta || {};
  const contatos = contatosDoCliente(d);
  const principal = contatos[0];
  const nomeContato = principal?.nome || d.cliente_ficha?.contato || col.contato_nome || null;
  const temDecisor = !!(col.decisor_nome || col.decisor_telefone);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(col.decisor_nome || '');
  const [fone, setFone] = useState(col.decisor_telefone || '');
  const salvar = async () => {
    try { await apiClient.salvarDecisorImplantacao(d.implantacao.id, nome.trim(), fone.trim()); setEditando(false); recarregar(); } catch (e) { alert(erroDe(e)); }
  };
  const editar = () => { setNome(col.decisor_nome || ''); setFone(col.decisor_telefone || ''); setEditando(true); };
  const linkEditar = (txt: string) => <button onClick={editar} style={{ fontSize: 12, fontWeight: 500, color: '#2E6EAB', background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 4px' }}>{txt}</button>;
  return (
    <div style={{ ...os.painel, overflow: 'hidden' }}>
      <style>{`.pt-acao-contato{transition:background-color .15s,border-color .15s,transform .12s}.pt-acao-contato:hover{background:var(--t-content-bg);border-color:#2E6EAB55}.pt-acao-contato:active{transform:scale(.96)}.pt-acao-contato::after{content:'';position:absolute;inset:-4px}`}</style>
      {editando ? (
        <div style={{ padding: 14, display: 'grid', gap: 10 }}>
          <div style={os.rotulo}>Responsável da empresa (decisor)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" className="ps-input" style={{ flex: '1 1 200px', minHeight: 40 }} autoFocus />
            <input value={fone} onChange={e => setFone(e.target.value)} placeholder="Telefone" inputMode="tel" className="ps-input" style={{ flex: '1 1 160px', minHeight: 40 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvar} style={{ ...btn('#2E6EAB'), minHeight: 36 }}>Salvar</button>
            <button onClick={() => setEditando(false)} style={{ ...btn('#64748b', false), minHeight: 36, border: `1px solid ${os.linha}` }}>Cancelar</button>
          </div>
        </div>
      ) : temDecisor ? (
        <LinhaContato papel="Decisor · responsável da empresa" nome={col.decisor_nome} fone={col.decisor_telefone} acao={gestao ? linkEditar('Editar') : undefined} />
      ) : gestao ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 14px', minHeight: 48 }}>
          <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Decisor da empresa não informado</span>
          {linkEditar('Informar decisor')}
        </div>
      ) : null}
      {(temDecisor || gestao || editando) && <div style={{ height: 1, background: os.linha }} />}
      {principal
        ? <LinhaContato papel={contatos.length > 1 ? `Contato · +${contatos.length - 1} número(s) na ficha` : 'Contato'} nome={nomeContato} fone={principal.fone} />
        : <div style={{ padding: '14px', fontSize: 13, color: '#b45309' }}>{nomeContato ? `${nomeContato}: sem telefone cadastrado` : 'Cliente sem contato cadastrado'}</div>}
    </div>
  );
}

// ─── Observações do card: compartilhadas (técnico + supervisão) e pessoais (só minhas) ───

function AbaObservacoes({ id }: { id: string }) {
  const [obs, setObs] = useState<{ compartilhadas: any[]; pessoais: any[] }>({ compartilhadas: [], pessoais: [] });
  const eu = useAuth().user?.id || null;
  const carregar = useCallback(async () => { try { const r = await apiClient.getObservacoesImplantacao(id); setObs(r.data.data); } catch { /* ignore */ } }, [id]);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 760 }}>
      <BlocoObservacoes titulo="Equipe" dica="Técnico e supervisão leem e escrevem aqui." lista={obs.compartilhadas} privada={false} id={id} eu={eu} recarregar={carregar} />
      <BlocoObservacoes titulo="Só para mim" dica="Anotação pessoal. Ninguém mais vê." lista={obs.pessoais} privada id={id} eu={eu} recarregar={carregar} />
    </div>
  );
}

function BlocoObservacoes({ titulo, dica, lista, privada, id, eu, recarregar }: { titulo: string; dica: string; lista: any[]; privada: boolean; id: string; eu: string | null; recarregar: () => void }) {
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    try { await apiClient.addObservacaoImplantacao(id, texto.trim(), privada); setTexto(''); recarregar(); } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };
  const apagar = async (oid: string) => { if (!confirm('Apagar esta observação?')) return; try { await apiClient.delObservacaoImplantacao(oid); recarregar(); } catch (e) { alert(erroDe(e)); } };
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={os.secao}>{privada ? '🔒 ' : ''}{titulo}</span>
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{dica}</span>
      </div>
      <div style={{ ...os.painel, padding: 4 }}>
        <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} placeholder={privada ? 'Escreva algo só para você…' : 'Escreva uma observação para a equipe…'}
          style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', background: 'transparent', padding: '8px 10px', fontSize: 14, color: 'var(--t-text-primary)', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 6px 6px' }}>
          <button onClick={salvar} disabled={salvando || !texto.trim()} style={{ ...btn('#2E6EAB'), minHeight: 32, opacity: texto.trim() ? 1 : 0.45 }}>{salvando ? 'Salvando…' : 'Adicionar'}</button>
        </div>
      </div>
      {lista.length === 0
        ? <div style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: '2px 2px' }}>Nada escrito ainda.</div>
        : <div style={{ display: 'grid' }}>
          {lista.map((o, k) => (
            <div key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 2px', borderTop: k ? `1px solid ${os.linha}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 3 }}><span style={{ fontWeight: 600, color: 'var(--t-text-secondary)' }}>{privada ? 'Você' : o.autor_nome || 'Equipe'}</span> · {fmtDataHora(o.created_at)}</div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{o.texto}</div>
              </div>
              {o.autor_id === eu && <button onClick={() => apagar(o.id)} title="Apagar" aria-label="Apagar observação" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--t-text-muted)', padding: 8, borderRadius: 6 }}><X size={14} /></button>}
            </div>
          ))}
        </div>}
    </section>
  );
}

function AbaFichaCliente({ d }: { d: any }) {
  const c = d.cliente_ficha, i = d.implantacao;
  const resumoSuporte = i.resumo_suporte ? (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={os.secao}>Resumo enviado ao suporte {i.validado_em ? `(${fmtData(i.validado_em)})` : ''}</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap' }}>{i.resumo_suporte}</p>
    </section>
  ) : null;
  const dataBR = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null);
  const vendido = d.servico_descricao || (i.modulo === 'SERVICO' ? i.observacoes : null);
  // Lista de definição: rótulo à esquerda, valor à direita, linhas finas. Campos vazios não aparecem.
  const secao = (titulo: string, itens: [string, any][]) => {
    const cheios = itens.filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (!cheios.length) return null;
    return (
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={os.secao}>{titulo}</div>
        <dl style={{ ...os.painel, margin: 0 }}>
          {cheios.map(([l, v], k) => (
            <div key={l} className="pt-dl-linha" style={{ borderTop: k ? `1px solid ${os.linha}` : 'none' }}>
              <dt style={os.rotulo}>{l}</dt>
              <dd style={{ ...os.valor, margin: 0, wordBreak: 'break-word' }}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  };
  const fone = (t?: string | null) => (t ? <a href={`tel:${soDigitos(t)}`} style={{ color: '#2E6EAB', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{fmtFone(t)}</a> : null);
  const end = c ? [c.endereco, c.numero_end, c.complemento].filter(Boolean).join(', ') : '';
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 820 }}>
      <style>{`.pt-dl-linha{display:grid;grid-template-columns:170px 1fr;gap:16px;padding:11px 14px;align-items:baseline}@media (max-width:560px){.pt-dl-linha{grid-template-columns:1fr;gap:2px}}`}</style>

      {/* O que foi vendido: o texto que o técnico mais precisa ler, solto, sem caixa. */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={os.secao}>Demanda</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#2E6EAB', border: '1px solid #2E6EAB40', borderRadius: 999, padding: '2px 10px' }}>{d.tipo_demanda}</span>
        </div>
        {vendido && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--t-text-primary)', textWrap: 'pretty' as any, whiteSpace: 'pre-wrap' }}>{vendido}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 28, rowGap: 10 }}>
          {([['Plano', i.plano || c?.plano], ['Vendedor', i.vendedor_nome], ['Técnico', i.tecnico_nome], ['Entrou em', dataBR(i.data_assinatura)]] as [string, any][]).map(([l, v]) => (
            <div key={l}>
              <div style={os.rotulo}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: l === 'Técnico' && !v ? '#b45309' : 'var(--t-text-primary)' }}>{v || (l === 'Técnico' ? 'não designado' : '—')}</div>
            </div>
          ))}
        </div>
      </section>

      {!c && <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Cliente não encontrado no cadastro pelo CNPJ. Os dados abaixo vêm só do card.</div>}

      {secao('Empresa', [
        ['Razão social', c?.razao_social || i.cliente_razao_social],
        ['Nome fantasia', c?.nome_fantasia],
        ['CNPJ', c?.cnpj || i.cliente_cnpj],
        ['Inscrição estadual', c?.inscricao_estadual],
        ['Código do cliente', c?.codigo],
        ['Segmento', c?.segmento],
        ['Regime tributário', c?.regime_tributario || i.coleta?.regime_tributario],
        ['Grupo técnico', c?.grupo_tecnico],
        ['Situação', c?.situacao],
        ['Cliente desde', dataBR(c?.data_entrada)],
      ])}
      {secao('Contatos', [
        ['Decisor', i.coleta?.decisor_nome || i.coleta?.decisor_telefone ? <>{i.coleta?.decisor_nome || 'Sem nome'}{i.coleta?.decisor_telefone ? <> · {fone(i.coleta.decisor_telefone)}</> : null}</> : null],
        ['Contato principal', c?.contato || i.coleta?.contato_nome ? <>{c?.contato || i.coleta?.contato_nome}{c?.tel_contato ? <> · {fone(c.tel_contato)}</> : null}</> : null],
        ['Segundo contato', c?.contato2 ? <>{c.contato2}{c?.tel_contato2 ? <> · {fone(c.tel_contato2)}</> : null}</> : null],
        ['Responsável legal', c?.responsavel_nome],
        ['Telefone 1', fone(c?.telefone1)],
        ['Telefone 2', fone(c?.telefone2)],
        ['Telefone', fone(c?.telefone)],
        ['WhatsApp dos avisos', fone(i.contato_whatsapp)],
        ['E-mail', c?.email || i.contato_email],
      ])}
      {secao('Endereço', [
        ['Endereço', end],
        ['Bairro', c?.bairro],
        ['Cidade', c ? [c.cidade, c.estado].filter(Boolean).join(' / ') : null],
        ['CEP', c?.cep],
        ['Região', c?.regiao],
      ])}
      {resumoSuporte}
      {c?.observacoes && (
        <section style={{ display: 'grid', gap: 8 }}>
          <div style={os.secao}>Observações do cadastro</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap' }}>{c.observacoes}</p>
        </section>
      )}
    </div>
  );
}

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

/** Sino do topo: abre a caixa de novidades. Recado não lido abre o popup de confirmação de leitura. */
export function SinoAvisos({ onAbrir, onAbrirDemanda }: { onAbrir: () => void; onAbrirDemanda?: (id: string) => void }) {
  const [n, setN] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<any[]>([]);
  const [lendo, setLendo] = useState<any | null>(null);
  const abrir = async () => {
    if (aberto) { setAberto(false); return; }
    try {
      const r = await apiClient.getAvisosTecnico();
      setItens((r.data.data.avisos || []).slice(0, 20));
      setAberto(true);
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
  // Novidades do mesmo card ficam juntas ("Farmácia X: 3 novidades"), na ordem da mais recente.
  const agrupados: { chave: string; lista: any[] }[] = [];
  for (const it of itens) {
    const chave = it.implantacao?.id || 'avulso';
    const g = chave === 'avulso' ? null : agrupados.find(x => x.chave === chave);
    if (g) g.lista.push(it); else agrupados.push({ chave: chave === 'avulso' ? `avulso-${it.id}` : chave, lista: [it] });
  }
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
            {agrupados.map(g => g.lista.length > 1 && !g.chave.startsWith('avulso') ? (
              <button key={g.chave} onClick={() => { setAberto(false); if (onAbrirDemanda) onAbrirDemanda(g.chave); else onAbrir(); }}
                style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--t-card-border)', background: g.lista.some((x: any) => !x.lido_em) ? '#2E6EAB0d' : 'transparent', cursor: 'pointer' }}>
                <span style={{ fontSize: 16, lineHeight: '20px' }}>{icone(g.lista[0])}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{g.lista[0].implantacao?.cliente_razao_social}: {g.lista.length} novidades</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--t-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.lista[0].texto}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>{fmtDataHora(g.lista[0].created_at)}</span>
                </span>
              </button>
            ) : g.lista.map((a: any) => (
              <button key={a.id} onClick={() => { setAberto(false); if (!a.lido_em) setLendo(a); else if (a.implantacao?.id && onAbrirDemanda) onAbrirDemanda(a.implantacao.id); else onAbrir(); }}
                style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--t-card-border)', background: a.lido_em ? 'transparent' : '#2E6EAB0d', cursor: 'pointer' }}>
                <span style={{ fontSize: 16, lineHeight: '20px' }}>{icone(a)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--t-text-primary)', fontWeight: a.lido_em ? 400 : 700 }}>{a.texto}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>{a.de_nome || 'Sistema'} · {fmtDataHora(a.created_at)}</span>
                </span>
              </button>
            )))}
            <PreferenciaAvisos />
          </div>
        </>
      )}
      <ConfirmarLeitura aviso={lendo} onFechar={() => setLendo(null)} />
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
  const [lendo, setLendo] = useState<any | null>(null);
  const item = (a: any, meu: boolean) => (
    <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--t-card-border)', alignItems: 'flex-start', background: meu && !a.lido_em ? '#2E6EAB0a' : 'transparent' }}>
      {a.prioridade === 'URGENTE' ? <AlertTriangle size={15} color="#dc2626" /> : <Bell size={15} color="#2E6EAB" />}
      <div style={{ flex: 1, fontSize: 13 }}>
        <div style={{ color: 'var(--t-text-primary)', fontWeight: meu && !a.lido_em ? 700 : 400 }}>{a.texto}</div>
        <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{meu ? `de ${a.de_nome || 'Gestão'}` : `para ${a.para_nome}`}{a.implantacao ? ` · ${a.implantacao.cliente_razao_social}` : ''} · {fmtDataHora(a.created_at)}{!meu ? (a.lido_em ? ` · ✅ lido ${fmtDataHora(a.lido_em)}` : ' · ainda não lido') : ''}</div>
      </div>
      {meu && <button onClick={() => setLendo(a)} style={{ ...btn('#2E6EAB', false), minHeight: 36 }}>{a.lido_em ? 'Ver' : 'Ler'}</button>}
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {gestao && <EnviarAviso />}
      <div style={cartao}>
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 13 }}>Meus avisos</b></div>
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
      <ConfirmarLeitura aviso={lendo} onFechar={() => { setLendo(null); carregar(); }} />
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
      <PainelIndicadores />
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
      await apiClient.salvarConfigPortal({ sla: c.sla, programacao: { nome: c.programacao.nome, whatsapp: c.programacao.whatsapp || '', lembrete_horas: Number(c.programacao.lembrete_horas) }, avisos_cliente: c.avisos_cliente, agente_ativo: c.agente_ativo, ofertas_ativo: c.ofertas_ativo, ofertas_dias_apos_virada: Number(c.ofertas_dias_apos_virada), catalogo: c.catalogo.filter((x: any) => x.produto?.trim()), modelos: (c.modelos || []).filter((m: any) => m.segmento?.trim().length >= 2).map((m: any) => ({ segmento: m.segmento.trim(), grupos: { INSTALACAO: m.grupos?.INSTALACAO || [], CONVERSAO: m.grupos?.CONVERSAO || [], TREINAMENTO: m.grupos?.TREINAMENTO || [] } })), extras_sistema: (c.extras_sistema || []).filter((x: any) => x.sistema?.trim().length >= 2 && x.itens?.length).map((x: any) => ({ sistema: x.sistema.trim(), itens: x.itens })), tarefas_cliente: c.tarefas_cliente || [], metas: Object.fromEntries(Object.entries(c.metas || {}).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v))), jornada: { inicio: c.jornada.inicio, fim: c.jornada.fim, almoco_inicio: c.jornada.almoco_inicio, almoco_min: Number(c.jornada.almoco_min), virada_inicio: c.jornada.virada_inicio } });
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
      <div style={{ gridColumn: '1 / -1' }}><ModelosChecklist c={c} setC={setC} /></div>
      <div style={{ gridColumn: '1 / -1' }}><TarefasClientePadrao c={c} setC={setC} /></div>
      <div style={{ gridColumn: '1 / -1' }}><MetasIndicadores c={c} setC={setC} /></div>
      <div style={{ gridColumn: '1 / -1' }}><button disabled={salvando} onClick={salvar} style={{ ...btn('#2E6EAB'), padding: '10px 18px' }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />} {ok ? 'Salvo' : 'Salvar configurações'}</button></div>
    </div>
  );
}

export const ICONES_PORTAL = { BarChart2, Settings, Bell };
