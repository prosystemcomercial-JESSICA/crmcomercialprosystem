'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface ParsedLead {
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  origem?: string;
  observacoes?: string;
}

const HEADERS_EXAMPLE = 'nome,email,telefone,empresa,cargo,origem,observacoes';
const CSV_EXAMPLE = `nome,email,telefone,empresa,cargo,origem,observacoes
João Silva,joao@empresa.com,(11) 99999-0001,Empresa A,Diretor,SITE,Cliente potencial
Maria Santos,maria@empresa.com,(21) 88888-0002,Empresa B,Gerente,INDICACAO,`;

function parseCSV(text: string): ParsedLead[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const leads: ParsedLead[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const lead: any = {};
    headers.forEach((h, idx) => {
      if (values[idx]) lead[h] = values[idx];
    });
    if (lead.nome) leads.push(lead as ParsedLead);
  }
  return leads;
}

export default function ImportacaoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ criados: number; ignorados: number; erros: string[] } | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const handleParse = () => {
    setParseError('');
    setResult(null);
    const leads = parseCSV(csvText);
    if (leads.length === 0) {
      setParseError('Nenhum lead válido encontrado. Verifique o formato CSV.');
    } else {
      setParsed(leads);
    }
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      const res = await apiClient.importarLeads(parsed);
      setResult(res.data.data);
      setParsed([]);
      setCsvText('');
    } catch (e: any) {
      setParseError(e?.response?.data?.message || 'Erro ao importar leads');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
      setParsed([]);
      setResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Importação de Leads</h1>
          <p className="text-gray-500 mt-1">Importe leads em massa via arquivo CSV</p>
        </div>

        {/* Instrucoes */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">Formato esperado do CSV:</p>
          <code className="text-xs text-blue-700 font-mono block">{HEADERS_EXAMPLE}</code>
          <p className="text-xs text-blue-600 mt-2">Colunas obrigatórias: <strong>nome</strong>. Demais são opcionais. Máximo 500 leads por importação.</p>
          <p className="text-xs text-blue-600 mt-1">Origens válidas: MANUAL, SITE, INDICACAO, CAMPANHA, EVENTO, OUTRO</p>
        </div>

        {/* Resultado anterior */}
        {result && (
          <div className={`rounded-xl border p-4 ${result.erros.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <p className="font-semibold text-green-800 mb-1">✅ Importação concluída</p>
            <p className="text-sm text-green-700">{result.criados} leads criados · {result.ignorados} duplicados ignorados</p>
            {result.erros.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-yellow-800">{result.erros.length} erros:</p>
                <ul className="text-xs text-yellow-700 mt-1 space-y-0.5">
                  {result.erros.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input area */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors">
                📁 Carregar arquivo .csv
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
              <button onClick={() => setCsvText(CSV_EXAMPLE)} className="text-sm text-blue-600 hover:underline">
                Usar exemplo
              </button>
            </div>
            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setParsed([]); setResult(null); }}
              placeholder="Cole aqui o conteúdo CSV ou carregue um arquivo..."
              rows={12}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {parseError && <p className="text-sm text-red-600">{parseError}</p>}
            <div className="flex gap-3">
              <button onClick={handleParse} disabled={!csvText.trim()}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                Pré-visualizar ({csvText.trim() ? parseCSV(csvText).length : 0} leads)
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Pré-visualização</p>
            {parsed.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
                Clique em "Pré-visualizar" para conferir os dados antes de importar
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {parsed.slice(0, 20).map((lead, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm">
                    <p className="font-medium text-gray-900">{lead.nome}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {lead.empresa && <span className="text-gray-500">{lead.empresa}</span>}
                      {lead.email && <span className="text-gray-400">{lead.email}</span>}
                      {lead.origem && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{lead.origem}</span>}
                    </div>
                  </div>
                ))}
                {parsed.length > 20 && (
                  <p className="text-xs text-gray-400 text-center py-2">... e mais {parsed.length - 20} leads</p>
                )}
              </div>
            )}
            {parsed.length > 0 && (
              <button onClick={handleImport} disabled={importing}
                className="mt-4 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {importing ? 'Importando...' : `✅ Importar ${parsed.length} leads`}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
