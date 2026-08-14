'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Target, Loader2, Info } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const PRO = '#2E6EAB';

interface Funil {
  leads_cadastrados: number;
  tentativas_contato: number;
  contatos_efetivos: number;
  leads_qualificados: number;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  leads_distribuidos: number;
  vendas_originadas: number;
}

interface Taxas {
  taxa_contato: number;
  taxa_qualificacao: number;
  taxa_comparecimento: number;
  conversao_distribuido_venda: number;
}

interface RespostaDesempenho {
  periodo: { data_inicio: string; data_fim: string };
  funil: Funil;
  taxas: Taxas;
}

interface UsuarioOpt { id: string; nome: string; cargo?: string; }

function primeiroDiaMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const FUNIL_LABELS: { key: keyof Funil; label: string; nota?: string }[] = [
  { key: 'leads_cadastrados', label: 'Leads cadastrados' },
  { key: 'tentativas_contato', label: 'Tentativas de contato' },
  { key: 'contatos_efetivos', label: 'Contatos efetivos' },
  { key: 'leads_qualificados', label: 'Leads qualificados' },
  { key: 'reunioes_agendadas', label: 'Reuniões agendadas' },
  { key: 'reunioes_realizadas', label: 'Reuniões realizadas' },
  { key: 'leads_distribuidos', label: 'Leads distribuídos', nota: 'Baseado no histórico do lead, que é apagado automaticamente após 60 dias. Para períodos mais longos, este número pode ficar subestimado.' },
  { key: 'vendas_originadas', label: 'Vendas originadas' },
];

export default function SdrDesempenhoPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const isGestor = podeVerTudo(user?.role);

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [sdrId, setSdrId] = useState('');
  const [sdrs, setSdrs] = useState<UsuarioOpt[]>([]);
  const [dados, setDados] = useState<RespostaDesempenho | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  useEffect(() => {
    if (isGestor) {
      apiClient.getResponsaveis()
        .then(r => setSdrs((r.data?.data || []).filter((u: UsuarioOpt) => (u.cargo || '') === 'SDR')))
        .catch(() => {});
    }
  }, [isGestor]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params: Record<string, string> = { data_inicio: dataInicio, data_fim: dataFim };
      if (isGestor && sdrId) params.sdr_id = sdrId;
      const res = await apiClient.client.get('/sdr/desempenho', { params });
      setDados(res.data.data);
    } catch {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, sdrId, isGestor]);

  useEffect(() => { if (isAuthenticated) carregar(); }, [isAuthenticated, carregar]);

  const funilChart = useMemo(() => {
    if (!dados) return [];
    return FUNIL_LABELS.map(f => ({ nome: f.label, valor: dados.funil[f.key] }));
  }, [dados]);

  const maxFunil = useMemo(() => Math.max(1, ...funilChart.map(f => f.valor)), [funilChart]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Target size={18} color={PRO} />
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>
            {isGestor && sdrId ? 'Desempenho do SDR' : isGestor ? 'Desempenho dos SDRs (agregado)' : 'Meu Desempenho'}
          </h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--t-text-secondary)', marginBottom: 20 }}>
          Funil de prospecção: do lead cadastrado até a venda originada, com as taxas de conversão de cada etapa.
        </p>

        {/* Filtros: período + (gestor) SDR */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 20, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
              Data início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              style={{ border: '1px solid var(--t-card-border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
              Data fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              style={{ border: '1px solid var(--t-card-border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }}
            />
          </div>
          {isGestor && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                SDR
              </label>
              <select
                value={sdrId}
                onChange={e => setSdrId(e.target.value)}
                style={{ border: '1px solid var(--t-card-border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: 'var(--t-content-bg)', color: 'var(--t-text-primary)', minWidth: 180 }}
              >
                <option value="">Todos (agregado)</option>
                {sdrs.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        {carregando ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} className="animate-spin" color={PRO} />
          </div>
        ) : !dados ? (
          <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>Não foi possível carregar os dados de desempenho.</p>
        ) : (
          <>
            {/* Cards de KPI — um por métrica do funil */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
              {FUNIL_LABELS.map(f => (
                <div key={f.key} style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</span>
                    {f.nota && (
                      <span title={f.nota} style={{ display: 'inline-flex', cursor: 'help' }}>
                        <Info size={12} color="var(--t-text-secondary)" />
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--t-text-primary)' }}>{dados.funil[f.key]}</p>
                  {f.nota && (
                    <p style={{ fontSize: 10, color: 'var(--t-text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                      Histórico expurgado após 60 dias — subestimado além desse período.
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Taxas derivadas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Taxa de contato</span>
                <p style={{ fontSize: 22, fontWeight: 800, color: PRO, marginTop: 8 }}>{dados.taxas.taxa_contato}%</p>
              </div>
              <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Taxa de qualificação</span>
                <p style={{ fontSize: 22, fontWeight: 800, color: PRO, marginTop: 8 }}>{dados.taxas.taxa_qualificacao}%</p>
              </div>
              <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Taxa de comparecimento</span>
                <p style={{ fontSize: 22, fontWeight: 800, color: PRO, marginTop: 8 }}>{dados.taxas.taxa_comparecimento}%</p>
              </div>
              <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Conversão distribuído → venda</span>
                  <span title="Depende de 'Leads distribuídos', que usa o histórico expurgado após 60 dias." style={{ display: 'inline-flex', cursor: 'help' }}>
                    <Info size={12} color="var(--t-text-secondary)" />
                  </span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: PRO, marginTop: 8 }}>{dados.taxas.conversao_distribuido_venda}%</p>
              </div>
            </div>

            {/* Funil visual */}
            <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Funil de prospecção</span>
              <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginTop: 4, marginBottom: 12 }}>
                "Leads distribuídos" reflete apenas os últimos 60 dias de histórico (expurgo automático) — pode subestimar períodos mais longos.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(240, funilChart.length * 40)}>
                <BarChart data={funilChart} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, maxFunil]} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={160} />
                  <Tooltip formatter={(v: any) => [`${v}`, 'Quantidade']} />
                  <Bar dataKey="valor" fill={PRO} radius={[0, 6, 6, 0]}>
                    {funilChart.map((_, i) => <Cell key={i} fill={PRO} fillOpacity={1 - i * 0.07} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
