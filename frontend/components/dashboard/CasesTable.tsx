'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

interface Caso {
  id: string;
  status: string;
  risk_score: number;
  motivo_principal: string;
  created_at: string;
}

export default function CasesTable() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCasos = async () => {
      try {
        const response = await apiClient.getCasos(0, 10);
        setCasos(response.data.data);
      } catch (error) {
        console.error('Error fetching cases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCasos();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NOVO':
        return 'bg-blue-100 text-blue-800';
      case 'DIAGNOSTICADO':
        return 'bg-green-100 text-green-800';
      case 'PLANEJADO':
        return 'bg-yellow-100 text-yellow-800';
      case 'EXECUTANDO':
        return 'bg-purple-100 text-purple-800';
      case 'RECUPERADO':
        return 'bg-green-100 text-green-800';
      case 'PERDIDO':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-600';
    if (score <= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Casos Recentes</h2>
          <Link
            href="/casos"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Ver todos →
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Risk Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Motivo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {casos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Nenhum caso encontrado
                </td>
              </tr>
            ) : (
              casos.map((caso) => (
                <tr key={caso.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {caso.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        caso.status
                      )}`}
                    >
                      {caso.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold ${getRiskColor(caso.risk_score)}`}>
                      {caso.risk_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {caso.motivo_principal || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/casos/${caso.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
