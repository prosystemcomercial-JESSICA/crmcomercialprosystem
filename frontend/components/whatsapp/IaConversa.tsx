'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

// IA de texto na conversa (Fase 3 do assistente): resumo sob demanda, botão de
// sugerir resposta e transcrição de áudio. Tudo passa pela vendedora antes de sair.

const msgErro = (e: any) => e?.response?.data?.message || 'A IA não respondeu agora. Tente de novo.';

export function ResumoIa({ conversaId }: { conversaId: string }) {
  const [r, setR] = useState<{ quem: string; falado: string; falta: string; venda_adicional: string | null } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const resumir = async () => {
    setCarregando(true); setErro(null);
    try { setR((await apiClient.resumirConversaIa(conversaId)).data.data); } catch (e) { setErro(msgErro(e)); } finally { setCarregando(false); }
  };
  return (
    <div className="px-4 py-3.5 border-b border-gray-100">
      <button onClick={resumir} disabled={carregando}
        className="w-full text-xs font-semibold rounded-lg py-2 border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50">
        {carregando ? 'Resumindo…' : r ? '✨ Resumir de novo' : '✨ Resumir conversa'}
      </button>
      {r && (
        <div className="mt-2 space-y-1.5 text-xs text-gray-700">
          <p><span className="font-semibold text-gray-500">Quem: </span>{r.quem}</p>
          <p><span className="font-semibold text-gray-500">Já falado: </span>{r.falado}</p>
          <p><span className="font-semibold text-gray-500">Próximo passo: </span>{r.falta}</p>
          {r.venda_adicional && <p className="text-emerald-700"><span className="font-semibold">Venda adicional: </span>{r.venda_adicional}</p>}
        </div>
      )}
      {erro && <p className="text-[11px] text-red-600 mt-1.5">{erro}</p>}
    </div>
  );
}

export function SugerirRespostaBtn({ conversaId, onTexto }: { conversaId: string; onTexto: (t: string) => void }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sugerir = async () => {
    setCarregando(true); setErro(null);
    try { onTexto((await apiClient.sugerirRespostaIa(conversaId)).data.data.texto); } catch (e) { setErro(msgErro(e)); } finally { setCarregando(false); }
  };
  return (
    <button onClick={sugerir} disabled={carregando} title={erro || 'Sugerir resposta com IA (você revisa antes de enviar)'}
      className={`rounded-full w-11 h-11 flex items-center justify-center shadow-sm text-lg flex-shrink-0 border ${erro ? 'border-red-300' : 'border-violet-200'} bg-white disabled:opacity-50`}>
      {carregando ? '⏳' : '✨'}
    </button>
  );
}

export function TranscricaoAudio({ mensagemId, inicial }: { mensagemId: string; inicial?: string | null }) {
  const [t, setT] = useState<string | null>(inicial || null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (t) return <p className="text-xs text-gray-600 italic max-w-[260px] mb-1">“{t}”</p>;
  const transcrever = async () => {
    setCarregando(true); setErro(null);
    try { setT((await apiClient.transcreverAudioIa(mensagemId)).data.data.transcricao); } catch (e) { setErro(msgErro(e)); } finally { setCarregando(false); }
  };
  return (
    <div className="mb-1">
      <button onClick={transcrever} disabled={carregando} className="text-[11px] text-violet-700 hover:underline disabled:opacity-50">
        {carregando ? 'Transcrevendo…' : '✨ Transcrever áudio'}
      </button>
      {erro && <span className="text-[11px] text-red-600 ml-1">{erro}</span>}
    </div>
  );
}
