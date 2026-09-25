'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Observações da equipe sobre o contato: o que foi conversado por telefone ou
// qualquer detalhe importante. Com lead vinculado, entra também no histórico do lead.

type Nota = { id: string; texto: string; autor_nome: string | null; created_at: string };

export default function ObservacoesConversa({ conversaId }: { conversaId: string }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  const carregar = useCallback(() => {
    apiClient.getNotasConversa(conversaId).then(r => setNotas(r.data.data)).catch(() => {});
  }, [conversaId]);
  useEffect(() => { setNotas([]); setTexto(''); carregar(); }, [carregar]);

  const salvar = async () => {
    if (!texto.trim()) return;
    setSalvando(true); setErro('');
    setOk('');
    try { const r = await apiClient.salvarNotaConversa(conversaId, texto.trim()); setTexto(''); setOk(r.data.message || ''); carregar(); }
    catch (e: any) { setErro(e?.response?.data?.message || 'Não foi possível salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <div className="px-4 py-3.5 border-b border-gray-100">
      <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">📝 Observações</p>
      <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) salvar(); }}
        placeholder="Ex.: Liguei hoje, falou com o dono. CNPJ 12.345.678/0001-90. Usa o sistema X, reclama do SNGPC. Retornar sexta."
        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y" />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-gray-400">Ctrl+Enter salva · CNPJ escrito aqui é consultado na Receita</span>
        <button onClick={salvar} disabled={salvando || !texto.trim()}
          className="text-white text-[11px] font-bold rounded-lg px-3 py-1.5 disabled:opacity-50" style={{ background: '#2E6EAB' }}>
          {salvando ? 'Salvando…' : 'Salvar observação'}
        </button>
      </div>
      {erro && <p className="text-[11px] text-red-600 mt-1">{erro}</p>}
      {ok && <p className="text-[11px] text-green-700 mt-1">{ok}</p>}
      {notas.length > 0 && (
        <div className="mt-2.5 space-y-2 max-h-56 overflow-y-auto">
          {notas.map(n => (
            <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
              <p className="text-[13px] text-gray-800 whitespace-pre-wrap">{n.texto}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {n.autor_nome ? ` · ${n.autor_nome}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
