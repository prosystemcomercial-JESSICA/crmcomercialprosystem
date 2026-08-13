'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { TrendingUp, Users, Award, Loader2, ArrowUpDown, Search } from 'lucide-react';

const PRO = '#2E6EAB';

interface ClienteLtv {
  id: string;
  nome: string;
  razao_social: string | null;
  segmento: string | null;
  situacao: string;
  meses_de_casa: number;
  ltv: number;
}

interface RespostaLtv {
  resumo: { ltv_medio: number; ltv_total: number; total_clientes_considerados: number };
  clientes: ClienteLtv[];
}

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type ColunaOrdem = 'nome' | 'segmento' | 'situacao' | 'meses_de_casa' | 'ltv';

export default function LtvPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [dados, setDados] = useState<RespostaLtv | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<{ coluna: ColunaOrdem; direcao: 'asc' | 'desc' }>({ coluna: 'ltv', direcao: 'desc' });

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await apiClient.client.get('/clientes/ltv');
      setDados(res.data.data);
    } catch {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { if (isAuthenticated) carregar(); }, [isAuthenticated, carregar]);

  function alternarOrdem(coluna: ColunaOrdem) {
    setOrdem(prev => prev.coluna === coluna
      ? { coluna, direcao: prev.direcao === 'desc' ? 'asc' : 'desc' }
      : { coluna, direcao: 'desc' });
  }

  const clientesFiltrados = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    let lista = dados.clientes;
    if (termo) {
      lista = lista.filter(c =>
        c.nome.toLowerCase().includes(termo) || (c.razao_social || '').toLowerCase().includes(termo)
      );
    }
    const { coluna, direcao } = ordem;
    const mult = direcao === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const av = a[coluna];
      const bv = b[coluna];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
      return String(av || '').localeCompare(String(bv || '')) * mult;
    });
  }, [dados, busca, ordem]);

  const top10 = useMemo(() => {
    if (!dados) return [];
    return [...dados.clientes].filter(c => c.situacao === 'ATIVA').sort((a, b) => b.ltv - a.ltv).slice(0, 10);
  }, [dados]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TrendingUp size={18} color={PRO} />
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>LTV dos Clientes</h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--t-text-secondary)', marginBottom: 20 }}>
          Lifetime Value realizado até hoje — mensalidade acumulada ao longo do tempo de casa + instalação + vendas adicionais confirmadas.
        </p>

        {carregando ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} className="animate-spin" color={PRO} />
          </div>
        ) : !dados ? (
          <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>Não foi possível carregar os dados de LTV.</p>
        ) : (
          <>
            {/* Cards de resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingUp size={14} color={PRO} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>LTV Médio</span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--t-text-primary)' }}>{fmt(dados.resumo.ltv_medio)}</p>
                <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginTop: 4 }}>por cliente ativo</p>
              </div>

              <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Users size={14} color={PRO} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>LTV Total</span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--t-text-primary)' }}>{fmt(dados.resumo.ltv_total)}</p>
                <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginTop: 4 }}>{dados.resumo.total_clientes_considerados} clientes ativos</p>
              </div>

              <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 20, gridColumn: 'span 2', minWidth: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Award size={14} color={PRO} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Top 10 clientes por LTV</span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {top10.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--t-text-primary)' }}>
                        <strong style={{ color: 'var(--t-text-secondary)', marginRight: 6 }}>{i + 1}.</strong>{c.nome}
                      </span>
                      <span style={{ fontWeight: 700, color: PRO }}>{fmt(c.ltv)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Busca */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10, padding: '8px 12px', maxWidth: 320 }}>
              <Search size={14} color="var(--t-text-secondary)" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar cliente..."
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, flex: 1, color: 'var(--t-text-primary)' }}
              />
            </div>

            {/* Tabela completa */}
            <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                      {([
                        ['nome', 'Cliente'], ['segmento', 'Segmento'], ['situacao', 'Situação'],
                        ['meses_de_casa', 'Tempo de casa'], ['ltv', 'LTV'],
                      ] as [ColunaOrdem, string][]).map(([col, label]) => (
                        <th
                          key={col}
                          onClick={() => alternarOrdem(col)}
                          style={{ padding: '10px 14px', textAlign: col === 'ltv' || col === 'meses_de_casa' ? 'right' : 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--t-text-secondary)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {label}
                            {ordem.coluna === col && <ArrowUpDown size={11} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--t-text-primary)', fontWeight: 600 }}>{c.nome}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--t-text-secondary)' }}>{c.segmento || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            background: c.situacao === 'ATIVA' ? '#dcfce7' : '#f3f4f6',
                            color: c.situacao === 'ATIVA' ? '#16a34a' : '#6b7280',
                          }}>
                            {c.situacao === 'ATIVA' ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--t-text-secondary)' }}>{c.meses_de_casa} meses</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: PRO }}>{fmt(c.ltv)}</td>
                      </tr>
                    ))}
                    {clientesFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--t-text-secondary)', fontSize: 12 }}>
                          Nenhum cliente encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
