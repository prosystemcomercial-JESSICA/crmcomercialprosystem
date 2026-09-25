'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Painel da conversa: envia uma proposta aberta deste contato pelo WhatsApp, com
// os botões Aceitar / Tenho dúvidas e o follow-up automático (dias 2, 5 e 7).

type Prop = { id: string; nome: string; status: string; plano: string | null; valor: number | null; tem_link: boolean; enviada_wpp_em: string | null };
const STATUS: Record<string, string> = { RASCUNHO: 'rascunho', ENVIADA: 'enviada', VISUALIZADA: 'visualizada', EM_NEGOCIACAO: 'em negociação' };
const brl = (n: number | null) => n == null ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function EnviarPropostaWpp({ conversaId }: { conversaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Prop[] | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const abrir = async () => {
    setAberto(a => !a); setAviso(null);
    if (aberto) return;
    setLista(null);
    try { setLista((await apiClient.getPropostasConversa(conversaId)).data.data); }
    catch { setLista([]); setAviso({ ok: false, texto: 'Não foi possível buscar as propostas.' }); }
  };

  const enviar = async (p: Prop) => {
    setEnviando(p.id); setAviso(null);
    try {
      await apiClient.enviarPropostaWhatsapp(conversaId, p.id);
      setAviso({ ok: true, texto: 'Proposta enviada. O follow-up dos dias 2, 5 e 7 já está programado.' });
      setAberto(false);
    } catch (e: any) {
      setAviso({ ok: false, texto: e?.response?.data?.message || 'Não foi possível enviar.' });
    } finally { setEnviando(null); }
  };

  return (
    <div className="px-4 py-3.5 border-b border-gray-100">
      <button onClick={abrir}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg py-2" style={{ background: '#0f766e' }}>
        📄 Enviar proposta pelo WhatsApp
      </button>
      {aberto && (
        <div className="mt-2 space-y-1.5">
          {lista === null && <p className="text-xs text-gray-400">Buscando propostas deste contato…</p>}
          {lista?.length === 0 && (
            <p className="text-xs text-gray-500">Nenhuma proposta aberta com o CNPJ ou o telefone deste contato. Crie a proposta e volte aqui.</p>
          )}
          {lista?.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-lg p-2">
              <p className="text-xs font-semibold text-gray-800">{p.nome}</p>
              <p className="text-[11px] text-gray-500">
                {[p.plano, brl(p.valor), STATUS[p.status] || p.status].filter(Boolean).join(' · ')}
                {p.enviada_wpp_em ? ' · já enviada pelo WhatsApp' : ''}
              </p>
              <button disabled={!p.tem_link || enviando === p.id} onClick={() => enviar(p)}
                title={p.tem_link ? '' : 'Gere o link público da proposta antes de enviar'}
                className="mt-1.5 w-full text-[11px] font-semibold rounded-md py-1.5 border border-teal-700 text-teal-800 hover:bg-teal-50 disabled:opacity-40">
                {enviando === p.id ? 'Enviando…' : p.enviada_wpp_em ? 'Reenviar' : 'Enviar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {aviso && <p className={`text-[11px] mt-1.5 ${aviso.ok ? 'text-green-700' : 'text-red-600'}`}>{aviso.texto}</p>}
    </div>
  );
}
