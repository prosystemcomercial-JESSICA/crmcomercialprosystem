'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth, useRequireGestorRedirect } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Shield, Search, RefreshCw, FileText, GitMerge, Users } from 'lucide-react';
import ExportButton from '@/components/ui/ExportButton';

interface Evento {
  id: string; data: string; modulo: string; tipo: string; descricao: string;
  ator_id: string | null; ator_nome: string | null; ator_role: string | null;
  alvo: string | null; detalhe: string | null;
}
interface UsuarioOpt { id: string; nome: string; cargo?: string }

const MODULO_CFG: Record<string, { label: string; cor: string; bg: string; icon: any }> = {
  PROPOSTA: { label: 'Proposta', cor: '#2E6EAB', bg: '#EBF4FF', icon: FileText },
  LEAD:     { label: 'Lead',     cor: '#7c3aed', bg: '#f3e8ff', icon: GitMerge },
  USUARIO:  { label: 'Usuário',  cor: '#ea580c', bg: '#ffedd5', icon: Users },
};
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const cargoLabel = (c?: string | null) => {
  const m: Record<string, string> = { CEO: 'CEO', ADMIN: 'Admin', DIRETOR: 'Diretor', SUPERVISAO_COMERCIAL: 'Sup. Comercial', SUPERVISAO_TECNICA: 'Sup. Técnica', TECNICO_SUPORTE: 'Técnico', VENDEDOR: 'Vendedor', CLIENTE: 'Cliente' };
  return (c && m[c]) || c || '';
};

export default function AuditoriaPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { blocked } = useRequireGestorRedirect();   // só CEO/Supervisão/Admin

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [tipos, setTipos] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOpt[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // filtros
  const [modulo, setModulo] = useState('');
  const [atorId, setAtorId] = useState('');
  const [tipo, setTipo] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const load = useCallback(() => {
    setDataLoading(true);
    apiClient.getAuditoria({
      modulo: modulo || undefined, ator_id: atorId || undefined, tipo: tipo || undefined,
      data_inicio: dataInicio ? new Date(dataInicio).toISOString() : undefined,
      data_fim: dataFim ? new Date(dataFim + 'T23:59:59').toISOString() : undefined,
      busca: busca || undefined, page, limit,
    })
      .then(r => {
        const d = r.data.data;
        setEventos(d.eventos || []); setTotal(d.total || 0);
        setTipos(d.tipos || []); setUsuarios(d.usuarios || []);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [modulo, atorId, tipo, dataInicio, dataFim, busca, page]);

  useEffect(() => { if (isAuthenticated && !blocked) load(); }, [isAuthenticated, blocked, load]);

  const limparFiltros = () => { setModulo(''); setAtorId(''); setTipo(''); setDataInicio(''); setDataFim(''); setBusca(''); setPage(0); };

  if (loading || !isAuthenticated || blocked) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Shield size={24} className="text-blue-600" /> Auditoria
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Trilha completa de tudo que acontece — propostas, leads e usuários — por usuário e período.</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="auditoria" titulo="Auditoria — ProSystem CRM"
              linhas={eventos}
              colunas={[
                { header: 'Quando', value: (e: Evento) => fmtDateTime(e.data) || '' },
                { header: 'Módulo', value: (e: Evento) => MODULO_CFG[e.modulo]?.label || e.modulo },
                { header: 'Ação', value: (e: Evento) => e.tipo },
                { header: 'Quem', value: (e: Evento) => e.ator_nome || '' },
                { header: 'Cargo', value: (e: Evento) => cargoLabel(e.ator_role) },
                { header: 'Descrição', value: (e: Evento) => e.descricao },
                { header: 'Sobre', value: (e: Evento) => e.alvo || '' },
                { header: 'Detalhe', value: (e: Evento) => e.detalhe || '' },
              ]}
            />
            <button onClick={() => { setPage(0); load(); }} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw size={14} /> Atualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input value={busca} onChange={e => { setBusca(e.target.value); setPage(0); }} placeholder="Nome, alvo, detalhe..."
                className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Usuário</label>
            <select value={atorId} onChange={e => { setAtorId(e.target.value); setPage(0); }} className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white">
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}{u.cargo ? ` · ${cargoLabel(u.cargo)}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Módulo</label>
            <select value={modulo} onChange={e => { setModulo(e.target.value); setPage(0); }} className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white">
              <option value="">Todos</option>
              <option value="PROPOSTA">Proposta</option>
              <option value="LEAD">Lead</option>
              <option value="USUARIO">Usuário</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Ação</label>
            <select value={tipo} onChange={e => { setTipo(e.target.value); setPage(0); }} className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white">
              <option value="">Todas</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">De</label>
              <input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPage(0); }} className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Até</label>
              <input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(0); }} className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
          </div>
          <div className="md:col-span-6 flex justify-between items-center">
            <span className="text-xs text-gray-400">{total} evento(s) encontrado(s)</span>
            <button onClick={limparFiltros} className="text-xs text-blue-600 font-semibold hover:underline">Limpar filtros</button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white border rounded-xl overflow-hidden">
          {dataLoading ? (
            <div className="p-10 text-center text-gray-500 text-sm">Carregando trilha...</div>
          ) : eventos.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">Nenhum evento para os filtros selecionados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Quando</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Módulo</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Ação</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Quem</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Sobre / Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {eventos.map(e => {
                    const cfg = MODULO_CFG[e.modulo] || { label: e.modulo, cor: '#6b7280', bg: '#f3f4f6', icon: Shield };
                    const Icon = cfg.icon;
                    return (
                      <tr key={e.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{fmtDateTime(e.data)}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: cfg.cor, background: cfg.bg }}>
                            <Icon size={11} /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium text-gray-700">{e.tipo}</td>
                        <td className="px-4 py-2.5 text-xs">
                          <p className="font-medium text-gray-800">{e.ator_nome || '—'}</p>
                          {e.ator_role && <p className="text-[10px] text-gray-400">{cargoLabel(e.ator_role)}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          <p className="text-gray-800">{e.descricao}</p>
                          {e.alvo && <p className="text-[11px] text-gray-400 mt-0.5">{e.alvo}</p>}
                          {e.detalhe && <p className="text-[11px] text-gray-500 mt-0.5">{e.detalhe}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginação */}
        {total > limit && (
          <div className="flex items-center justify-between">
            <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-3 py-1.5 text-sm rounded-lg border bg-white disabled:opacity-50">Anterior</button>
            <span className="text-xs text-gray-500">Página {page + 1} de {totalPaginas}</span>
            <button disabled={page + 1 >= totalPaginas} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm rounded-lg border bg-white disabled:opacity-50">Próxima</button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
