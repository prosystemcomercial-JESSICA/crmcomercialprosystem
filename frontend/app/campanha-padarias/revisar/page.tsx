'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Loader2, Mail } from 'lucide-react';

const SEQUENCIA_ID = 'seq-padarias-2026';

interface LeadCandidato {
  id: string;
  nome: string;
  razao_social?: string;
  email?: string;
  responsavel_email?: string;
  vendedor_nome?: string;
  created_at: string;
}

export default function RevisarCandidatosPadariasPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [candidatos, setCandidatos] = useState<LeadCandidato[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const isGestor = user?.role === 'CEO' || user?.role === 'ADMIN' || user?.role === 'SUPERVISAO_COMERCIAL';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await apiClient.getCandidatosSequenciaEmail(SEQUENCIA_ID);
      setCandidatos(res.data?.data || res.data || []);
      setSelecionados(new Set());
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao carregar candidatos');
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

  function alternarSelecao(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionados(prev =>
      prev.size === candidatos.length ? new Set() : new Set(candidatos.map(c => c.id))
    );
  }

  async function confirmarInclusao() {
    if (selecionados.size === 0) return;
    setEnviando(true);
    setErro('');
    try {
      await apiClient.entrarLoteSequenciaEmail(SEQUENCIA_ID, Array.from(selecionados));
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao incluir leads na campanha');
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

  const todosSelecionados = candidatos.length > 0 && selecionados.size === candidatos.length;

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Revisar leads de Padaria — Campanha de E-mail</h1>
        <p style={{ color: 'var(--t-text-secondary)', marginBottom: 20 }}>
          Leads do segmento Padaria que ainda não entraram nem foram descartados da campanha de e-mail. Selecione quem deve entrar na sequência.
        </p>

        {erro && (
          <div style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24 }}>
            <Loader2 size={18} className="animate-spin" /> Carregando candidatos...
          </div>
        ) : candidatos.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--t-text-secondary)', textAlign: 'center' }}>
            <Mail size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ margin: 0 }}>Nenhum lead de Padaria aguardando revisão no momento.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid var(--t-card-border)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--t-card-border)' }}>
                    <th style={{ padding: 12, width: 40 }}>
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        onChange={alternarSelecionarTodos}
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th style={{ padding: 12 }}>Empresa</th>
                    <th style={{ padding: 12 }}>E-mail</th>
                    <th style={{ padding: 12 }}>Vendedor</th>
                    <th style={{ padding: 12 }}>Cadastrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {candidatos.map((lead) => {
                    const empresa = lead.razao_social || lead.nome;
                    const email = lead.email || lead.responsavel_email || '—';
                    const checked = selecionados.has(lead.id);
                    return (
                      <tr key={lead.id} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <td style={{ padding: 12 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => alternarSelecao(lead.id)}
                            aria-label={`Selecionar ${empresa}`}
                          />
                        </td>
                        <td style={{ padding: 12, fontWeight: 600 }}>{empresa}</td>
                        <td style={{ padding: 12 }}>{email}</td>
                        <td style={{ padding: 12 }}>{lead.vendedor_nome || '—'}</td>
                        <td style={{ padding: 12 }}>
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={confirmarInclusao}
                disabled={selecionados.size === 0 || enviando}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                  borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none',
                  cursor: selecionados.size === 0 || enviando ? 'not-allowed' : 'pointer',
                  opacity: selecionados.size === 0 || enviando ? 0.6 : 1,
                }}
              >
                {enviando && <Loader2 size={16} className="animate-spin" />}
                {enviando
                  ? 'Incluindo...'
                  : `Incluir selecionados na campanha (${selecionados.size})`}
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
