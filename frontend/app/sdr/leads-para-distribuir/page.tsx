'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Send, Undo2, Loader2, Flame, Thermometer, Snowflake, Zap } from 'lucide-react';

interface LeadProntoDistribuir {
  id: string;
  nome: string;
  razao_social?: string;
  nome_fantasia?: string;
  temperatura: string;
  created_by: string;
  completude_pct: number;
  updated_at: string;
  created_at: string;
}

interface Vendedor { id: string; nome: string; }

const TEMP_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  MUITO_QUENTE: { icon: Zap,         color: '#dc2626', label: 'Muito Quente' },
  QUENTE:       { icon: Flame,       color: '#ea580c', label: 'Quente' },
  MORNO:        { icon: Thermometer, color: '#d97706', label: 'Morno' },
  FRIO:         { icon: Snowflake,   color: '#2563eb', label: 'Frio' },
};

const corCompletude = (pct: number) => (pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626');

function tempoDesde(dataStr: string): string {
  const diffMs = Date.now() - new Date(dataStr).getTime();
  const horas = Math.floor(diffMs / (1000 * 60 * 60));
  if (horas < 1) return 'menos de 1h';
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return `${dias}d`;
}

export default function LeadsParaDistribuirPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [leads, setLeads] = useState<LeadProntoDistribuir[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [distribuirLeadId, setDistribuirLeadId] = useState<string | null>(null);
  const [vendedorSelecionado, setVendedorSelecionado] = useState('');
  const [devolverLeadId, setDevolverLeadId] = useState<string | null>(null);
  const [motivoDevolucao, setMotivoDevolucao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const isGestor = user?.role === 'CEO' || user?.role === 'ADMIN' || user?.role === 'SUPERVISAO_COMERCIAL';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [resLeads, resVendedores, resUsuarios] = await Promise.all([
        apiClient.getLeadsProntosParaDistribuir(),
        apiClient.getVendedores(),
        apiClient.getUsuarios(),
      ]);
      setLeads(resLeads.data?.data || []);
      setVendedores(resVendedores.data?.data || []);
      const mapa: Record<string, string> = {};
      for (const u of resUsuarios.data?.data || []) mapa[u.id] = u.nome;
      setUsuariosMap(mapa);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao carregar leads');
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

  async function confirmarDistribuir() {
    if (!distribuirLeadId || !vendedorSelecionado) return;
    setEnviando(true);
    try {
      await apiClient.distribuirLeadSdr(distribuirLeadId, vendedorSelecionado);
      setDistribuirLeadId(null);
      setVendedorSelecionado('');
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao distribuir lead');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarDevolver() {
    if (!devolverLeadId) return;
    if (motivoDevolucao.trim().length < 5) {
      setErro('Descreva o motivo (mínimo 5 caracteres)');
      return;
    }
    setEnviando(true);
    try {
      await apiClient.devolverLeadSdr(devolverLeadId, motivoDevolucao.trim());
      setDevolverLeadId(null);
      setMotivoDevolucao('');
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao devolver lead');
    } finally {
      setEnviando(false);
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
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Leads para Distribuir</h1>
        <p style={{ color: 'var(--t-text-secondary)', marginBottom: 20 }}>
          Leads qualificados pelos SDRs, aguardando distribuição para um vendedor.
        </p>

        {erro && (
          <div style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24 }}>
            <Loader2 size={18} className="animate-spin" /> Carregando leads...
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--t-text-secondary)' }}>
            Nenhum lead qualificado aguardando distribuição no momento.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--t-card-border)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--t-card-border)' }}>
                  <th style={{ padding: 12 }}>Empresa</th>
                  <th style={{ padding: 12 }}>SDR</th>
                  <th style={{ padding: 12 }}>Completude</th>
                  <th style={{ padding: 12 }}>Temperatura</th>
                  <th style={{ padding: 12 }}>Tempo</th>
                  <th style={{ padding: 12 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const empresa = lead.razao_social || lead.nome_fantasia || lead.nome;
                  const temp = TEMP_CONFIG[lead.temperatura] || TEMP_CONFIG.FRIO;
                  const TempIcon = temp.icon;
                  const sdrNome = usuariosMap[lead.created_by] || lead.created_by;
                  return (
                    <tr key={lead.id} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                      <td style={{ padding: 12, fontWeight: 600 }}>{empresa}</td>
                      <td style={{ padding: 12 }}>{sdrNome}</td>
                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            background: corCompletude(lead.completude_pct),
                            color: '#fff',
                            borderRadius: 999,
                            padding: '2px 8px',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {lead.completude_pct}%
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: temp.color }}>
                          <TempIcon size={14} /> {temp.label}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>{tempoDesde(lead.updated_at)}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { setDistribuirLeadId(lead.id); setVendedorSelecionado(''); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                              borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                            }}
                          >
                            <Send size={14} /> Distribuir
                          </button>
                          <button
                            onClick={() => { setDevolverLeadId(lead.id); setMotivoDevolucao(''); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                              borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                            }}
                          >
                            <Undo2 size={14} /> Devolver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Distribuir */}
        {distribuirLeadId && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}>
            <div style={{ background: 'var(--t-card-bg)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Distribuir lead</h3>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Vendedor</label>
              <select
                value={vendedorSelecionado}
                onChange={(e) => setVendedorSelecionado(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', marginBottom: 16 }}
              >
                <option value="">Selecione...</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => { setDistribuirLeadId(null); setVendedorSelecionado(''); }}
                  style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--t-card-border)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarDistribuir}
                  disabled={!vendedorSelecionado || enviando}
                  style={{
                    padding: '8px 14px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none',
                    cursor: !vendedorSelecionado || enviando ? 'not-allowed' : 'pointer', opacity: !vendedorSelecionado || enviando ? 0.6 : 1,
                  }}
                >
                  {enviando ? 'Distribuindo...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Devolver */}
        {devolverLeadId && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}>
            <div style={{ background: 'var(--t-card-bg)', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Devolver lead ao SDR</h3>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Motivo (mínimo 5 caracteres)</label>
              <textarea
                value={motivoDevolucao}
                onChange={(e) => setMotivoDevolucao(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', marginBottom: 16, resize: 'vertical' }}
                placeholder="Ex.: faltam dados de contato do responsável"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => { setDevolverLeadId(null); setMotivoDevolucao(''); }}
                  style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--t-card-border)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarDevolver}
                  disabled={motivoDevolucao.trim().length < 5 || enviando}
                  style={{
                    padding: '8px 14px', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none',
                    cursor: motivoDevolucao.trim().length < 5 || enviando ? 'not-allowed' : 'pointer',
                    opacity: motivoDevolucao.trim().length < 5 || enviando ? 0.6 : 1,
                  }}
                >
                  {enviando ? 'Devolvendo...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
