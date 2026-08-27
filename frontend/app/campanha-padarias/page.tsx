'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Loader2, Mail, ArrowRightCircle } from 'lucide-react';

const SEQUENCIA_ID = 'seq-padarias-2026';
const TOTAL_ETAPAS = 12;

const FASES_ORDEM = [
  'BASE_VALIDADA',
  'NUTRICAO_1',
  'NUTRICAO_2',
  'NUTRICAO_3',
  'NUTRICAO_4',
  'ENGAJOU_QUALIFICAR',
  'APRESENTACAO_AGENDADA',
  'APRESENTACAO_REALIZADA',
  'PROPOSTA_NEGOCIACAO',
  'CONTRATO_ASSINADO',
  'LONGO_PRAZO',
  'DESCADASTRADO',
] as const;

const FASE_LABELS: Record<string, string> = {
  BASE_VALIDADA: 'Base validada',
  NUTRICAO_1: 'Nutrição 1',
  NUTRICAO_2: 'Nutrição 2',
  NUTRICAO_3: 'Nutrição 3',
  NUTRICAO_4: 'Nutrição 4',
  ENGAJOU_QUALIFICAR: 'Engajou / Qualificar',
  APRESENTACAO_AGENDADA: 'Apresentação agendada',
  APRESENTACAO_REALIZADA: 'Apresentação realizada',
  PROPOSTA_NEGOCIACAO: 'Proposta / Negociação',
  CONTRATO_ASSINADO: 'Contrato assinado',
  LONGO_PRAZO: 'Nutrição de longo prazo',
  DESCADASTRADO: 'Descadastrado',
};

const FASES_NUTRICAO = new Set(['NUTRICAO_1', 'NUTRICAO_2', 'NUTRICAO_3', 'NUTRICAO_4']);

interface LeadKanban {
  id: string;
  fase_kanban: string;
  ultima_etapa_enviada?: number;
  tema_interesse?: string | null;
  lead?: {
    id: string;
    nome?: string;
    razao_social?: string;
    nome_fantasia?: string;
    email?: string;
    responsavel_nome?: string;
    responsavel_telefone?: string;
    vendedor_nome?: string;
  };
}

interface KanbanData {
  fases: string[];
  leads: Record<string, LeadKanban[]>;
}

export default function CampanhaPadariasPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [kanban, setKanban] = useState<KanbanData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const isGestor = user?.role === 'CEO' || user?.role === 'ADMIN' || user?.role === 'SUPERVISAO_COMERCIAL';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await apiClient.getKanbanSequenciaEmail(SEQUENCIA_ID);
      setKanban(res.data?.data ?? null);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao carregar o kanban da campanha');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
    if (!loading && isAuthenticated && !isGestor) router.push('/dashboard');
  }, [loading, isAuthenticated, isGestor, router]);

  useEffect(() => {
    if (isAuthenticated && isGestor) carregar();
  }, [isAuthenticated, isGestor, carregar]);

  async function marcarComoEngajou(leadSequenciaId: string) {
    setMovendo(leadSequenciaId);
    setErro('');
    try {
      await apiClient.moverFaseSequenciaEmail(leadSequenciaId, 'ENGAJOU_QUALIFICAR', 'Engajamento manual');
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao mover o lead');
    } finally {
      setMovendo(null);
    }
  }

  if (loading || !isAuthenticated || !isGestor) {
    return (
      <DashboardLayout>
        <div style={{ padding: 24 }}>Carregando...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Campanha de E-mail — Padarias</h1>
        <p style={{ color: 'var(--t-text-secondary)', marginBottom: 20 }}>
          Acompanhamento por fase da sequência de nutrição por e-mail. Mova manualmente um lead para
          &quot;Engajou / Qualificar&quot; quando ele responder ou demonstrar interesse fora do fluxo automático.
        </p>

        {erro && (
          <div style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24 }}>
            <Loader2 size={18} className="animate-spin" /> Carregando kanban...
          </div>
        ) : !kanban ? (
          <div style={{ padding: 24, color: 'var(--t-text-secondary)', textAlign: 'center' }}>
            <Mail size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ margin: 0 }}>Não foi possível carregar os dados da campanha.</p>
          </div>
        ) : (
          <div
            className="rounded-2xl ps-card overflow-hidden"
            style={{ border: '1px solid var(--t-card-border)', boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}
          >
            <div className="overflow-x-auto">
              <div className="flex gap-3 p-4" style={{ minWidth: `${FASES_ORDEM.length * 250}px` }}>
                {FASES_ORDEM.map(fase => {
                  const leadsDaFase = kanban.leads?.[fase] || [];
                  const permiteEngajar = FASES_NUTRICAO.has(fase);
                  return (
                    <div
                      key={fase}
                      className="flex flex-col rounded-xl flex-shrink-0"
                      style={{ width: 234, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}
                    >
                      <div
                        className="px-3 py-2.5 flex items-center justify-between flex-shrink-0"
                        style={{ borderBottom: '1px solid var(--t-card-border)' }}
                      >
                        <span className="text-[11px] font-bold truncate" style={{ color: 'var(--t-text-primary)' }}>
                          {FASE_LABELS[fase] || fase}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1"
                          style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}
                        >
                          {leadsDaFase.length}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ minHeight: 200, maxHeight: 620 }}>
                        {leadsDaFase.map(item => {
                          const nome = item.lead?.razao_social || item.lead?.nome_fantasia || item.lead?.nome || 'Sem nome';
                          return (
                            <div
                              key={item.id}
                              className="rounded-lg p-2.5"
                              style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}
                            >
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--t-text-primary)' }}>
                                {nome}
                              </p>
                              {item.tema_interesse && (
                                <span
                                  className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1"
                                  style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                                >
                                  {item.tema_interesse}
                                </span>
                              )}
                              <p className="text-[10px] mt-1" style={{ color: 'var(--t-text-muted)' }}>
                                {typeof item.ultima_etapa_enviada === 'number'
                                  ? `E${item.ultima_etapa_enviada}/${TOTAL_ETAPAS}`
                                  : '—'}
                              </p>
                              {item.lead?.vendedor_nome && (
                                <p className="text-[10px] truncate" style={{ color: 'var(--t-text-muted)' }}>
                                  {item.lead.vendedor_nome}
                                </p>
                              )}
                              {permiteEngajar && (
                                <button
                                  onClick={() => marcarComoEngajou(item.id)}
                                  disabled={movendo === item.id}
                                  className="flex items-center gap-1 mt-2 text-[10px] font-semibold rounded-md px-2 py-1"
                                  style={{
                                    background: '#16a34a',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: movendo === item.id ? 'not-allowed' : 'pointer',
                                    opacity: movendo === item.id ? 0.6 : 1,
                                  }}
                                >
                                  {movendo === item.id ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <ArrowRightCircle size={11} />
                                  )}
                                  Marcar como engajou
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {leadsDaFase.length === 0 && (
                          <p className="text-center text-[10px] py-5" style={{ color: 'var(--t-text-muted)' }}>
                            Vazio
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
