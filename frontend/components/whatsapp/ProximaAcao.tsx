'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Topo da lista de conversas: "o que fazer agora" (próxima melhor ação).
// Só sugere; clicar abre a conversa. Não cria atividade.

type Acao = { chave: string; urgencia: 'urgente' | 'alta' | 'normal'; titulo: string; detalhe: string; conversaId: string | null };
const COR: Record<Acao['urgencia'], string> = { urgente: '#dc2626', alta: '#d97706', normal: '#2563eb' };
const CHAVE_FECHADO = 'wpp.proximaAcao.fechado';

export default function ProximaAcao({ versao, onAbrir }: { versao: string; onAbrir: (conversaId: string) => void }) {
  const [acoes, setAcoes] = useState<Acao[] | null>(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => { try { setFechado(localStorage.getItem(CHAVE_FECHADO) === '1'); } catch { /* sem storage */ } }, []);

  useEffect(() => {
    let vivo = true;
    const buscar = () => apiClient.getProximaAcao().then(r => { if (vivo) setAcoes(r.data.data); }).catch(() => { if (vivo) setAcoes([]); });
    buscar();
    const i = setInterval(buscar, 60_000);
    return () => { vivo = false; clearInterval(i); };
  }, [versao]);

  if (!acoes || acoes.length === 0) return null;
  const alternar = () => { const v = !fechado; setFechado(v); try { localStorage.setItem(CHAVE_FECHADO, v ? '1' : '0'); } catch { /* sem storage */ } };

  return (
    <div className="border-b border-gray-100 bg-amber-50/40">
      <button onClick={alternar} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <span className="text-xs font-semibold text-gray-700">⚡ O que fazer agora</span>
        <span className="text-[11px] text-gray-500">{acoes.length}</span>
        <span className="ml-auto text-[11px] text-gray-400">{fechado ? 'mostrar' : 'esconder'}</span>
      </button>
      {!fechado && (
        <ul className="px-2 pb-2 space-y-1">
          {acoes.map(a => (
            <li key={a.chave}>
              <button disabled={!a.conversaId} onClick={() => a.conversaId && onAbrir(a.conversaId)}
                className="w-full text-left rounded-md px-2 py-1.5 hover:bg-white disabled:cursor-default flex gap-2 items-start">
                <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: COR[a.urgencia] }} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-gray-800 truncate">{a.titulo}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{a.detalhe}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
