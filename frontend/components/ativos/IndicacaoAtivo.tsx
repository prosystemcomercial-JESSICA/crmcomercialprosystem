'use client';

// Indicação premiada (parte 3 do Plano de Expansão, 14/10/2026): no contato de ativo, o cliente indica alguém.
// O indicado vira lead na fila da Caroline, que abre a conversa citando o cliente. Prêmio: 50% na próxima
// mensalidade do cliente se a indicação fechar (Meta Comercial 2026).

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

export default function IndicacaoAtivo({ contatoId, clienteNome }: { contatoId: string; clienteNome?: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ nome: '', telefone: '', empresa: '', segmento: 'Farmácia' });
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const campo = 'w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm';
  const enviar = async () => {
    setEnviando(true); setMsg(null);
    try {
      const r = await apiClient.registrarIndicacaoAtivo(contatoId, { nome: f.nome.trim(), telefone: f.telefone.trim(), empresa: f.empresa.trim() || null, segmento: f.segmento || null });
      setMsg({ ok: true, texto: r.data?.message || 'Indicação registrada.' }); setF({ nome: '', telefone: '', empresa: '', segmento: f.segmento });
    } catch (e: any) { setMsg({ ok: false, texto: e?.response?.data?.message || 'Não deu para registrar.' }); }
    finally { setEnviando(false); }
  };
  if (!aberto) return (
    <button onClick={() => setAberto(true)} className="w-full px-4 py-2 text-sm font-semibold rounded-lg border" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: '#15803d' }}>
      🤝 {clienteNome ? `${clienteNome} indicou alguém?` : 'O cliente indicou alguém?'} Registrar indicação
    </button>
  );
  return (
    <div className="rounded-lg border p-3 grid gap-2" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
      <p className="text-xs" style={{ color: '#166534' }}>
        Pergunte: &quot;Você conhece alguma farmácia ou loja que esteja procurando sistema hoje? Posso falar que foi indicação sua?&quot;
        Se fechar, o cliente ganha 50% de desconto na próxima mensalidade.
      </p>
      <label className="text-xs font-medium" style={{ color: 'var(--t-text-secondary)' }}>Nome de quem foi indicado *<input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} className={campo} /></label>
      <label className="text-xs font-medium" style={{ color: 'var(--t-text-secondary)' }}>WhatsApp com DDD *<input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} inputMode="tel" placeholder="27 99999-9999" className={campo} /></label>
      <label className="text-xs font-medium" style={{ color: 'var(--t-text-secondary)' }}>Empresa<input value={f.empresa} onChange={e => setF({ ...f, empresa: e.target.value })} className={campo} /></label>
      <label className="text-xs font-medium" style={{ color: 'var(--t-text-secondary)' }}>Segmento
        <select value={f.segmento} onChange={e => setF({ ...f, segmento: e.target.value })} className={campo}>
          {['Farmácia', 'Padaria', 'Varejo'].map(s => <option key={s}>{s}</option>)}
        </select>
      </label>
      {msg && <p role="status" className="text-xs font-semibold" style={{ color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setAberto(false); setMsg(null); }} className="px-3 py-2 text-sm" style={{ color: 'var(--t-text-secondary)' }}>Fechar</button>
        <button onClick={enviar} disabled={enviando || f.nome.trim().length < 2 || f.telefone.replace(/\D/g, '').length < 10} className="flex-1 px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg disabled:opacity-50">
          {enviando ? 'Registrando…' : 'Registrar indicação'}
        </button>
      </div>
    </div>
  );
}
