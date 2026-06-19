'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

const PRO = '#417ABC';
const PRO_DARK = '#2E5A8F';

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo',
  DIAGNOSTICADO: 'Diagnosticado',
  PLANEJADO: 'Planejado',
  EXECUTANDO: 'Em andamento',
  RECUPERADO: 'Recuperado',
  PERDIDO: 'Perdido',
};

const STATUS_COR: Record<string, { bg: string; text: string; dot: string }> = {
  NOVO:         { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  DIAGNOSTICADO:{ bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  PLANEJADO:    { bg: '#FEF9C3', text: '#92400E', dot: '#F59E0B' },
  EXECUTANDO:   { bg: '#EDE9FE', text: '#6D28D9', dot: '#8B5CF6' },
  RECUPERADO:   { bg: '#DCFCE7', text: '#166534', dot: '#22C55E' },
  PERDIDO:      { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
};

const RISK_COR = (s: number) => s >= 85 ? '#B91C1C' : s >= 70 ? '#DC2626' : s >= 40 ? '#D97706' : '#16A34A';
const RISK_LABEL = (s: number) => s >= 85 ? 'CRÍTICO' : s >= 70 ? 'ALTO' : s >= 40 ? 'MÉDIO' : 'BAIXO';

const ENCERRADOS = ['RECUPERADO', 'PERDIDO'];

// Para casos encerrados: dias entre abertura e encerramento (fixo).
// Para casos abertos: dias desde abertura até hoje (contagem correndo).
function calcDias(caso: Pick<Caso, 'status' | 'created_at' | 'updated_at'>): number {
  const inicio = new Date(caso.created_at).getTime();
  const fim = ENCERRADOS.includes(caso.status) && caso.updated_at
    ? new Date(caso.updated_at).getTime()
    : Date.now();
  return Math.max(0, Math.floor((fim - inicio) / 86_400_000));
}

function DiasChip({ dias, encerrado }: { dias: number; encerrado?: boolean }) {
  const cor = encerrado ? '#6B7280' : dias >= 30 ? '#B91C1C' : dias >= 14 ? '#D97706' : '#374151';
  const bg  = encerrado ? '#F3F4F6' : dias >= 30 ? '#FEE2E2' : dias >= 14 ? '#FEF9C3' : '#F3F4F6';
  return (
    <span title={encerrado ? `Duração total: ${dias} dias` : `Aberto há ${dias} dias`}
      style={{ background: bg, color: cor, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {dias}d{encerrado ? ' total' : ''}
    </span>
  );
}

interface Caso {
  id: string;
  status: string;
  risk_score: number;
  motivo_principal?: string;
  descricao?: string;
  created_at: string;
  updated_at?: string;
  fin_situacao?: string;
  cliente: {
    nome: string;
    razao_social?: string;
    nome_fantasia?: string;
    grupo_tecnico?: string;
    situacao?: string;
  };
}

interface Atualizacao {
  id: string;
  tipo: string;
  texto: string;
  canal?: string;
  resultado?: string;
  feito_por_nome?: string;
  created_at: string;
}

interface RadarItem {
  caso: Caso;
  atts: Atualizacao[];
  loading: boolean;
}

const ICON: Record<string, string> = {
  OBSERVACAO: '📝', CONTATO: '📞', TENTATIVA: '📲', FINANCEIRO: '💵', STATUS: '🔄', SISTEMA: '⚙️',
};

const URGENCIA_COR = (dias: number) =>
  dias >= 30 ? { bg: '#FEE2E2', text: '#991B1B', borda: '#FECACA' } :
  dias >= 14 ? { bg: '#FEF9C3', text: '#92400E', borda: '#FDE68A' } :
               { bg: '#F0FDF4', text: '#166534', borda: '#BBF7D0' };

function RadarCard({ item, onClick }: { item: RadarItem; onClick: () => void }) {
  const { caso, atts, loading } = item;
  const encerrado = ENCERRADOS.includes(caso.status);
  const dias = calcDias(caso);
  const urg = encerrado ? { bg: '#F3F4F6', text: '#374151', borda: '#E5E7EB' } : URGENCIA_COR(dias);
  const cor = STATUS_COR[caso.status] || STATUS_COR.NOVO;
  const ultimaAtt = atts[0];
  const responsavel = caso.cliente?.grupo_tecnico || '—';

  // Contagem por tipo de ação
  const contatos = atts.filter(a => ['CONTATO', 'TENTATIVA'].includes(a.tipo)).length;
  const observacoes = atts.filter(a => a.tipo === 'OBSERVACAO').length;
  const financeiro = atts.filter(a => a.tipo === 'FINANCEIRO').length;

  const nomeCliente = caso.cliente?.razao_social || caso.cliente?.nome_fantasia || caso.cliente?.nome || '—';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all hover:shadow-md"
      style={{ background: '#fff', border: `1.5px solid ${urg.borda}`, boxShadow: '0 1px 4px rgba(13,34,56,.06)' }}
    >
      {/* Topo: nome + status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
            style={{ background: cor.dot }}>
            {nomeCliente.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate max-w-[180px]">{nomeCliente}</p>
            <span style={{ background: cor.bg, color: cor.text, borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
              {STATUS_LABEL[caso.status] || caso.status}
            </span>
          </div>
        </div>
        {/* Risco score */}
        <span className="text-xs font-black flex-shrink-0" style={{ color: RISK_COR(caso.risk_score) }}>
          {caso.risk_score}% {RISK_LABEL(caso.risk_score)}
        </span>
      </div>

      {/* 3 métricas do radar */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Tempo */}
        <div className="rounded-xl p-2 text-center" style={{ background: urg.bg, border: `1px solid ${urg.borda}` }}>
          <p className="text-[18px] font-black leading-tight" style={{ color: urg.text }}>{dias}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: urg.text, opacity: 0.75 }}>
            {encerrado ? 'dias (total)' : 'dias aberto'}
          </p>
        </div>
        {/* Ações */}
        <div className="rounded-xl p-2 text-center" style={{ background: '#F0F4FF', border: '1px solid #C7D7F5' }}>
          <p className="text-[18px] font-black text-blue-700 leading-tight">{atts.length}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">ações feitas</p>
        </div>
        {/* Em quem está */}
        <div className="rounded-xl p-2 text-center" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <p className="text-[11px] font-bold text-purple-800 leading-tight truncate" title={responsavel}>
            {responsavel.length > 10 ? responsavel.slice(0, 10) + '…' : responsavel}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-purple-500">responsável</p>
        </div>
      </div>

      {/* Breakdown de ações */}
      {!loading && atts.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {contatos > 0 && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">📞 {contatos} contato{contatos > 1 ? 's' : ''}</span>}
          {observacoes > 0 && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">📝 {observacoes} obs.</span>}
          {financeiro > 0 && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">💵 {financeiro} fin.</span>}
        </div>
      )}

      {/* Última ação */}
      <div className="border-t pt-2" style={{ borderColor: '#F0F4F8' }}>
        {loading ? (
          <p className="text-[11px] text-gray-400">Carregando ações…</p>
        ) : ultimaAtt ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Última ação</p>
            <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">
              {ICON[ultimaAtt.tipo] || '•'} {ultimaAtt.texto}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {ultimaAtt.feito_por_nome ? `${ultimaAtt.feito_por_nome} · ` : ''}
              {new Date(ultimaAtt.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 italic">Nenhuma ação registrada ainda.</p>
        )}
      </div>
    </button>
  );
}

export default function ChurnCEOPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [casos, setCasos] = useState<Caso[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [ultimaAtt, setUltimaAtt] = useState<Date | null>(null);

  // Painel lateral do caso selecionado
  const [casoSelecionado, setCasoSelecionado] = useState<Caso | null>(null);
  const [atualizacoes, setAtualizacoes] = useState<Atualizacao[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(false);

  // Filtro de status
  const [statusFiltro, setStatusFiltro] = useState('');

  // Radar
  const [abaAtiva, setAbaAtiva] = useState<'lista' | 'radar'>('lista');
  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const radarCarregadoRef = useRef(false);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const fetchCasos = useCallback(async () => {
    try {
      const res = await apiClient.getCasos(0, 200, statusFiltro || undefined);
      const data = res.data?.data;
      setCasos(data?.casos || []);
      setTotal(data?.total || 0);
      setUltimaAtt(new Date());
    } catch { /* silencioso */ }
    finally { setCarregando(false); }
  }, [statusFiltro]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCasos();
    const t = setInterval(fetchCasos, 30_000);
    return () => clearInterval(t);
  }, [isAuthenticated, fetchCasos]);

  const carregarRadar = useCallback(async (listaCasos: Caso[]) => {
    const ativos = listaCasos.filter(c => !['RECUPERADO', 'PERDIDO'].includes(c.status));
    setRadarItems(ativos.map(c => ({ caso: c, atts: [], loading: true })));
    await Promise.all(ativos.map(async (c, i) => {
      try {
        const r = await apiClient.getAtualizacoesCaso(c.id);
        setRadarItems(prev => prev.map((ri, idx) => idx === i ? { ...ri, atts: r.data?.data || [], loading: false } : ri));
      } catch {
        setRadarItems(prev => prev.map((ri, idx) => idx === i ? { ...ri, loading: false } : ri));
      }
    }));
  }, []);

  useEffect(() => {
    if (abaAtiva === 'radar' && casos.length > 0 && !radarCarregadoRef.current) {
      radarCarregadoRef.current = true;
      carregarRadar(casos);
    }
    if (abaAtiva === 'lista') radarCarregadoRef.current = false;
  }, [abaAtiva, casos, carregarRadar]);

  const abrirCaso = async (c: Caso) => {
    setCasoSelecionado(c);
    setAtualizacoes([]);
    setLoadingAtt(true);
    try {
      const r = await apiClient.getAtualizacoesCaso(c.id);
      setAtualizacoes(r.data?.data || []);
    } catch { /* */ }
    finally { setLoadingAtt(false); }
  };

  if (loading || !isAuthenticated) return null;

  // Separar por grupo: em andamento vs encerrados
  const emAndamento = casos.filter(c => !['RECUPERADO', 'PERDIDO'].includes(c.status));
  const encerrados  = casos.filter(c =>  ['RECUPERADO', 'PERDIDO'].includes(c.status));

  const TABS = [
    { id: '',           label: `Todos (${total})` },
    { id: 'NOVO',       label: 'Novos' },
    { id: 'EXECUTANDO', label: 'Em andamento' },
    { id: 'RECUPERADO', label: 'Recuperados' },
    { id: 'PERDIDO',    label: 'Perdidos' },
  ];

  const nomeCliente = (c: Caso) => c.cliente?.razao_social || c.cliente?.nome_fantasia || c.cliente?.nome || '—';

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-3 md:p-5">

        {/* Cabeçalho */}
        <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRO_DARK}, ${PRO})` }}>
          <div className="px-5 py-5 text-white flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'rgba(255,255,255,.7)' }}>Painel Executivo · Prosystem</p>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Churn & Retenção — Visão CEO</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>
                Acompanhe cada caso em aberto, quem está responsável e o desfecho final.
                <span className="ml-2 font-semibold">Atualização automática a cada 30s.</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-black">{total}</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,.7)' }}>casos registrados</p>
              {ultimaAtt && (
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,.55)' }}>
                  última att.: {ultimaAtt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* KPIs resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { l: 'Em andamento', v: emAndamento.length, cor: '#7C3AED' },
            { l: 'Crítico / Alto risco', v: casos.filter(c => c.risk_score >= 70 && !['RECUPERADO','PERDIDO'].includes(c.status)).length, cor: '#DC2626' },
            { l: 'Recuperados', v: encerrados.filter(c => c.status === 'RECUPERADO').length, cor: '#16A34A' },
            { l: 'Perdidos', v: encerrados.filter(c => c.status === 'PERDIDO').length, cor: '#B91C1C' },
          ].map((k, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid #E3ECF5', boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}>
              <span className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: k.cor }} />
              <p className="text-[11px] font-medium text-gray-500 pl-1.5">{k.l}</p>
              <p className="text-3xl font-extrabold pl-1.5 mt-1" style={{ color: k.cor }}>{k.v}</p>
            </div>
          ))}
        </div>

        {/* Tabs de filtro + botão Radar */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 items-center">
          {/* Alternador Lista / Radar */}
          <div className="flex rounded-xl overflow-hidden border mr-2 flex-shrink-0" style={{ borderColor: '#E3ECF5' }}>
            <button onClick={() => setAbaAtiva('lista')}
              className="px-4 py-2 text-sm font-bold transition-colors"
              style={abaAtiva === 'lista' ? { background: PRO_DARK, color: '#fff' } : { background: '#F3F7FB', color: '#4A6E8A' }}>
              ☰ Lista
            </button>
            <button onClick={() => setAbaAtiva('radar')}
              className="px-4 py-2 text-sm font-bold transition-colors"
              style={abaAtiva === 'radar' ? { background: PRO_DARK, color: '#fff' } : { background: '#F3F7FB', color: '#4A6E8A' }}>
              ◎ Radar
            </button>
          </div>

          {/* Filtros de status (só na aba lista) */}
          {abaAtiva === 'lista' && TABS.map(t => (
            <button key={t.id} onClick={() => setStatusFiltro(t.id)}
              className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors"
              style={statusFiltro === t.id
                ? { background: PRO, color: '#fff' }
                : { background: '#F3F7FB', color: '#4A6E8A', border: '1px solid #E3ECF5' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== ABA RADAR ===== */}
        {abaAtiva === 'radar' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-gray-700">Radar de Casos em Aberto</p>
                <p className="text-xs text-gray-400">Tempo registrado · ações tomadas · responsável atual — apenas casos ativos</p>
              </div>
              <button onClick={() => { radarCarregadoRef.current = false; carregarRadar(casos); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: '#EEF4FB', color: PRO, border: `1px solid #C7D7F5` }}>
                ↻ Atualizar
              </button>
            </div>
            {radarItems.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                {casos.length === 0 ? 'Nenhum caso registrado.' : 'Nenhum caso ativo no momento.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {radarItems
                  .slice()
                  .sort((a, b) => diasAberto(b.caso.created_at) - diasAberto(a.caso.created_at))
                  .map(item => (
                    <RadarCard
                      key={item.caso.id}
                      item={item}
                      onClick={() => { setAbaAtiva('lista'); abrirCaso(item.caso); }}
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ABA LISTA ===== */}
        {abaAtiva === 'lista' && <div className="flex gap-4 items-start">

          {/* Lista de casos */}
          <div className="flex-1 min-w-0 space-y-2">
            {carregando ? (
              <div className="text-center py-16 text-gray-400">Carregando…</div>
            ) : casos.length === 0 ? (
              <div className="text-center py-16 text-gray-400">Nenhum caso encontrado.</div>
            ) : casos.map(c => {
              const encerrado = ENCERRADOS.includes(c.status);
              const dias = calcDias(c);
              const cor = STATUS_COR[c.status] || STATUS_COR.NOVO;
              const selecionado = casoSelecionado?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => abrirCaso(c)}
                  className="w-full text-left rounded-2xl p-4 transition-all"
                  style={{
                    background: selecionado ? '#EEF4FB' : '#fff',
                    border: selecionado ? `1.5px solid ${PRO}` : '1px solid #E3ECF5',
                    boxShadow: selecionado ? `0 0 0 2px ${PRO}22` : '0 1px 3px rgba(13,34,56,.05)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                      style={{ background: cor.dot }}>
                      {nomeCliente(c).charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Linha 1: nome + status + dias */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-gray-900 truncate max-w-[220px]">{nomeCliente(c)}</p>
                        <span style={{ background: cor.bg, color: cor.text, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                        <span style={{ color: RISK_COR(c.risk_score), fontSize: 11, fontWeight: 700 }}>
                          {RISK_LABEL(c.risk_score)}
                        </span>
                        <DiasChip dias={dias} encerrado={encerrado} />
                      </div>

                      {/* Linha 2: técnico + motivo */}
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.cliente?.grupo_tecnico && (
                          <span className="text-[12px] text-gray-500">
                            👤 {c.cliente.grupo_tecnico}
                          </span>
                        )}
                        {c.motivo_principal && (
                          <span className="text-[12px] text-gray-500 truncate max-w-[200px]">
                            · {c.motivo_principal}
                          </span>
                        )}
                      </div>

                      {/* Linha 3: descrição resumida */}
                      {c.descricao && (
                        <p className="text-[12px] text-gray-400 mt-0.5 truncate">{c.descricao}</p>
                      )}
                    </div>

                    {/* Data + desfecho */}
                    <div className="text-right flex-shrink-0">
                      {encerrado ? (
                        <>
                          <p className="text-[10px] text-gray-400">encerrado em</p>
                          <p className="text-[11px] font-semibold text-gray-600">
                            {c.updated_at
                              ? new Date(c.updated_at).toLocaleDateString('pt-BR')
                              : new Date(c.created_at).toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-[11px] font-bold mt-0.5" style={{ color: c.status === 'RECUPERADO' ? '#16A34A' : '#DC2626' }}>
                            {c.status === 'RECUPERADO' ? '✓ Recuperado' : '✕ Perdido'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-gray-400">aberto em</p>
                          <p className="text-[11px] font-semibold text-gray-600">
                            {new Date(c.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Painel lateral — detalhe do caso selecionado (read-only) */}
          {casoSelecionado && (
            <div className="w-80 xl:w-96 flex-shrink-0 bg-white rounded-2xl sticky top-4" style={{ border: '1px solid #E3ECF5', boxShadow: '0 4px 20px rgba(13,34,56,.08)' }}>
              {/* Header do painel */}
              <div className="flex items-start justify-between p-4 border-b" style={{ borderColor: '#E3ECF5' }}>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{nomeCliente(casoSelecionado)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span style={{
                      background: STATUS_COR[casoSelecionado.status]?.bg,
                      color: STATUS_COR[casoSelecionado.status]?.text,
                      borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                    }}>
                      {STATUS_LABEL[casoSelecionado.status] || casoSelecionado.status}
                    </span>
                    <DiasChip dias={calcDias(casoSelecionado)} encerrado={ENCERRADOS.includes(casoSelecionado.status)} />
                  </div>
                </div>
                <button onClick={() => setCasoSelecionado(null)} className="text-gray-400 hover:text-gray-700 ml-2 flex-shrink-0">✕</button>
              </div>

              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

                {/* Responsável técnico */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Responsável</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {casoSelecionado.cliente?.grupo_tecnico || '—'}
                  </p>
                </div>

                {/* Risco */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Risco</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: RISK_COR(casoSelecionado.risk_score) }}>
                      {RISK_LABEL(casoSelecionado.risk_score)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${casoSelecionado.risk_score}%`, background: RISK_COR(casoSelecionado.risk_score) }} />
                    </div>
                    <span className="text-xs text-gray-400">{casoSelecionado.risk_score}%</span>
                  </div>
                </div>

                {/* Motivo */}
                {casoSelecionado.motivo_principal && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Motivo</p>
                    <p className="text-sm text-gray-700">{casoSelecionado.motivo_principal}</p>
                  </div>
                )}

                {/* Contexto / problema */}
                {casoSelecionado.descricao && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Contexto do caso</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{casoSelecionado.descricao}</p>
                  </div>
                )}

                {/* Desfecho (encerrado) */}
                {['RECUPERADO', 'PERDIDO'].includes(casoSelecionado.status) && (
                  <div className="rounded-xl p-3" style={{
                    background: casoSelecionado.status === 'RECUPERADO' ? '#DCFCE7' : '#FEE2E2',
                    border: `1px solid ${casoSelecionado.status === 'RECUPERADO' ? '#BBF7D0' : '#FECACA'}`,
                  }}>
                    <p className="text-xs font-bold mb-1" style={{ color: casoSelecionado.status === 'RECUPERADO' ? '#166534' : '#991B1B' }}>
                      {casoSelecionado.status === 'RECUPERADO' ? '✓ Caso resolvido' : '✕ Cliente perdido'}
                    </p>
                    {casoSelecionado.status === 'PERDIDO' && casoSelecionado.motivo_principal && (
                      <p className="text-xs text-red-700">Motivo: {casoSelecionado.motivo_principal}</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: casoSelecionado.status === 'RECUPERADO' ? '#166534' : '#991B1B', opacity: 0.8 }}>
                      Encerrado em {new Date(casoSelecionado.updated_at || casoSelecionado.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}

                {/* Linha do tempo */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">O que está sendo feito</p>
                  {loadingAtt ? (
                    <p className="text-xs text-gray-400">Carregando…</p>
                  ) : atualizacoes.length === 0 ? (
                    <p className="text-xs text-gray-400">Nenhuma atualização registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {atualizacoes.map(a => (
                        <div key={a.id} className="flex gap-2 rounded-xl border p-2.5" style={{ borderColor: '#E3ECF5', background: '#F7FAFD' }}>
                          <span className="text-base flex-shrink-0 mt-0.5">{ICON[a.tipo] || '•'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-gray-800 leading-snug">{a.texto}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {a.canal ? `${a.canal} · ` : ''}
                              {a.resultado ? `${a.resultado} · ` : ''}
                              {a.feito_por_nome ? `${a.feito_por_nome} · ` : ''}
                              {new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>}
      </div>
    </DashboardLayout>
  );
}
