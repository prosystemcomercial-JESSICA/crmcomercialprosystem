'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Pesquisa {
  id: string; identificacao: string; respondente_nome?: string; email?: string;
  cliente_id?: string; cliente_casado: boolean;
  nota_suporte: number; nota_sistema: number; conhece_plano: boolean;
  nota_atendimento?: number; nota_eficiencia?: number; nota_conhecimento?: number; nota_geral?: number;
  recado?: string; observacao?: string; sugestoes?: string; critico: boolean; media: number;
  created_at: string;
}
interface Resumo { total: number; criticos: number; nao_conhece_plano: number; media_suporte: number; media_sistema: number; }

const estrelas = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

export default function PesquisasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [respostas, setRespostas] = useState<Pesquisa[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [naoCasadas, setNaoCasadas] = useState<Pesquisa[]>([]);
  const [aba, setAba] = useState<'todas' | 'criticas' | 'nao_casadas'>('todas');
  const [dataLoading, setDataLoading] = useState(true);
  // Vínculo manual
  const [vinculando, setVinculando] = useState<string | null>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [resultados, setResultados] = useState<{ id: string; nome: string; razao_social?: string; codigo?: string }[]>([]);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const [list, nc] = await Promise.all([
        apiClient.getPesquisas(aba === 'criticas' ? { critico: true } : undefined),
        apiClient.getPesquisasNaoCasadas(),
      ]);
      setRespostas(list.data.data.respostas);
      setResumo(list.data.data.resumo);
      setNaoCasadas(nc.data.data);
    } catch (e) { console.error(e); } finally { setDataLoading(false); }
  }, [aba]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  // Busca de clientes para vincular (debounce simples).
  useEffect(() => {
    if (!vinculando || buscaCliente.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await apiClient.getClientes(0, 10, buscaCliente);
        setResultados(r.data.data.clientes);
      } catch { setResultados([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [buscaCliente, vinculando]);

  const vincular = async (pesquisaId: string, clienteId: string) => {
    try {
      await apiClient.vincularPesquisa(pesquisaId, clienteId);
      setVinculando(null); setBuscaCliente(''); setResultados([]);
      load();
    } catch (e: any) {
      alert('Erro ao vincular: ' + (e?.response?.data?.message || e.message));
    }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  const lista = aba === 'nao_casadas' ? naoCasadas : respostas;

  const CardResposta = ({ p, comVincular }: { p: Pesquisa; comVincular?: boolean }) => (
    <div className="rounded-xl border p-4" style={{ borderColor: p.critico ? '#fecaca' : '#e5e7eb', background: p.critico ? '#fef2f2' : '#fff' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold text-gray-900">{p.identificacao}{p.respondente_nome ? <span className="font-normal text-gray-400"> · {p.respondente_nome}</span> : ''}</p>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span style={{ color: '#FBBF24' }}>{estrelas(p.media)}</span>
            <span className="text-gray-500">média {p.media.toFixed(1)}</span>
            {p.critico && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠️ Crítico</span>}
            {!p.conhece_plano && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">não conhece o plano</span>}
            {!p.cliente_casado && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">sem vínculo</span>}
          </div>
          <div className="flex gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
            {p.nota_atendimento ? <span>Atendimento: {p.nota_atendimento}★</span> : null}
            {p.nota_eficiencia ? <span>Eficiência: {p.nota_eficiencia}★</span> : null}
            {p.nota_conhecimento ? <span>Conhecimento: {p.nota_conhecimento}★</span> : null}
            {p.nota_geral ? <span className="font-semibold text-gray-700">Prosystem: {p.nota_geral}★</span> : null}
            {!p.nota_atendimento && <span>Suporte: {p.nota_suporte}★ · Sistema: {p.nota_sistema}★</span>}
          </div>
          {p.recado && <p className="text-sm text-gray-600 mt-2">💬 {p.recado}</p>}
          {p.observacao && <p className="text-sm text-gray-600 mt-2">💬 {p.observacao}</p>}
          {p.sugestoes && <p className="text-sm text-gray-500 mt-1">💡 {p.sugestoes}</p>}
          {p.email && <p className="text-xs text-gray-400 mt-1">✉️ {p.email}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
          {p.cliente_id && (
            <button onClick={() => router.push(`/clientes/${p.cliente_id}`)} className="text-xs text-blue-600 hover:underline mt-1">ver ficha</button>
          )}
        </div>
      </div>

      {/* Vincular manualmente */}
      {comVincular && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {vinculando === p.id ? (
            <div>
              <input autoFocus value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
                placeholder="Buscar cliente por nome, razão social ou código…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              {resultados.length > 0 && (
                <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {resultados.map(c => (
                    <button key={c.id} onClick={() => vincular(p.id, c.id)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                      <span className="font-medium text-gray-900">{c.razao_social || c.nome}</span>
                      {c.codigo && <span className="text-xs text-gray-400 ml-2">#{c.codigo}</span>}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => { setVinculando(null); setBuscaCliente(''); }} className="text-xs text-gray-400 mt-2">cancelar</button>
            </div>
          ) : (
            <button onClick={() => { setVinculando(p.id); setBuscaCliente(''); }} className="text-sm text-blue-600 hover:underline font-medium">
              🔗 Vincular a um cliente
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pesquisas de Satisfação</h1>
          <p className="text-gray-500 mt-1">Respostas dos clientes, críticos e vínculos pendentes</p>
        </div>

        {/* Resumo */}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { l: 'Respostas', v: resumo.total, c: 'text-gray-800' },
              { l: 'Críticos', v: resumo.criticos, c: 'text-red-700' },
              { l: 'Não conhecem o plano', v: resumo.nao_conhece_plano, c: 'text-amber-700' },
              { l: 'Média suporte', v: `${resumo.media_suporte}★`, c: 'text-yellow-600' },
              { l: 'Média sistema', v: `${resumo.media_sistema}★`, c: 'text-yellow-600' },
            ].map(k => (
              <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{k.l}</p>
                <p className={`text-2xl font-bold ${k.c}`}>{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-2">
          {([['todas', 'Todas'], ['criticas', 'Críticas'], ['nao_casadas', `Sem vínculo (${naoCasadas.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${aba === k ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-700 font-medium">{aba === 'nao_casadas' ? 'Nenhuma resposta sem vínculo' : 'Nenhuma resposta ainda'}</p>
            <p className="text-gray-400 text-sm mt-1">Envie o link da pesquisa pelo Dashboard NPS.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(p => <CardResposta key={p.id} p={p} comVincular={aba === 'nao_casadas'} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
