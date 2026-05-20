'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

const USUARIOS_MOCK = [
  { id: 'user-ceo', nome: 'CEO ProSystem', email: 'ceo@prosystem.com.br', role: 'CEO', ativo: true },
  { id: 'user-supervisao', nome: 'Supervisora Comercial', email: 'supervisao@prosystem.com.br', role: 'SUPERVISAO', ativo: true },
  { id: 'user-tecnico', nome: 'Técnico Suporte', email: 'tecnico@prosystem.com.br', role: 'TECNICO', ativo: true },
  { id: 'user-vendedor', nome: 'Vendedor 1', email: 'vendedor@prosystem.com.br', role: 'VENDEDOR', ativo: true },
];

const ROLE_COLORS: Record<string, string> = {
  CEO: 'bg-purple-100 text-purple-700',
  SUPERVISAO: 'bg-blue-100 text-blue-700',
  VENDEDOR: 'bg-green-100 text-green-700',
  TECNICO: 'bg-orange-100 text-orange-700',
  ADMIN: 'bg-red-100 text-red-700',
  FINANCEIRO: 'bg-yellow-100 text-yellow-700',
};

const PERMISSIONS: Record<string, string[]> = {
  CEO: ['Ver tudo', 'Editar tudo', 'Configurações', 'Relatórios', 'Usuários', 'Metas', 'Ranking'],
  SUPERVISAO: ['Ver tudo', 'Editar Leads', 'Editar Casos', 'Relatórios', 'Metas', 'Ranking'],
  VENDEDOR: ['Ver Leads (próprios)', 'Criar Leads', 'Criar Atividades', 'Ver Propostas', 'Ver Funil'],
  TECNICO: ['Ver Leads', 'Ver Casos Churn', 'Editar Atividades'],
  FINANCEIRO: ['Ver Contratos', 'Ver Relatórios Financeiros', 'Ver Comissões'],
};

export default function UsuariosPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const isCEO = user?.role === 'CEO' || user?.role === 'SUPERVISAO';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Usuários e Permissões</h1>
            <p className="text-gray-500 mt-1">Gerencie usuários e seus níveis de acesso</p>
          </div>
          {isCEO && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
              + Convidar Usuário
            </button>
          )}
        </div>

        {!isCEO && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            ⚠️ Você tem permissão somente de leitura nesta tela. Apenas CEO e Supervisão podem editar usuários.
          </div>
        )}

        {/* Usuarios table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Perfil</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {USUARIOS_MOCK.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                        {u.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.nome}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {isCEO && (
                      <button className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Permissions matrix */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Matriz de Permissões por Perfil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(PERMISSIONS).map(([role, perms]) => (
              <div key={role} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-700'}`}>
                    {role}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {perms.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 text-xs">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
