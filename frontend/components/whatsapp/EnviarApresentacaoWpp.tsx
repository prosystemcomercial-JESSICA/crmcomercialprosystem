'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Painel da conversa: envia ao lead o link de uma apresentação (página pública do CRM em
// /apresentacao/<nome>). A mensagem vem pronta e pode ser ajustada antes de enviar.
// Para uma apresentação nova: coloque a pasta em frontend/public/apresentacao/<nome>/ e acrescente aqui.

const BASE = 'https://comercial.prosystemnet.com/apresentacao';
const APRESENTACOES = [
  {
    id: 'padaria', nome: 'Padarias', segmento: /padaria|confeit|panifica/i,
    texto: (nome: string) => `${nome ? `Olá, ${nome}! ` : 'Olá! '}Preparei uma apresentação rápida de como o Prosystem funciona na padaria: caixa, balança, produção, estoque, iFood e financeiro num só sistema. Dá uma olhada, leva poucos minutos:\n\n${BASE}/padaria`,
  },
];

type Conversa = { contato_nome?: string | null; etiqueta?: string | null; bot_dados?: any };

export default function EnviarApresentacaoWpp({ conversaId, conversa }: { conversaId: string; conversa: Conversa }) {
  const primeiroNome = (conversa.contato_nome || '').trim().split(/\s+/)[0] || '';
  const nomeValido = /^[A-Za-zÀ-ÿ]{2,}$/.test(primeiroNome) ? primeiroNome : '';
  const segmento = `${conversa.etiqueta || ''} ${conversa.bot_dados?.segmento || ''}`;
  // A do segmento do contato vem primeiro.
  const lista = [...APRESENTACOES].sort((a, b) => Number(b.segmento.test(segmento)) - Number(a.segmento.test(segmento)));
  const [aberta, setAberta] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState<string | null>(null);

  const abrir = (id: string) => {
    const a = APRESENTACOES.find(x => x.id === id)!;
    setTexto(a.texto(nomeValido)); setAberta(id); setEnviada(null);
  };
  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try { await apiClient.enviarWhatsappMensagem(conversaId, texto.trim()); setEnviada(aberta); setAberta(null); }
    catch (e: any) { alert(e?.response?.data?.message || 'Não foi possível enviar agora.'); }
    finally { setEnviando(false); }
  };

  return (
    <div className="px-4 py-3.5 border-b border-gray-100">
      <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Apresentação</p>
      {!aberta && (
        <div className="flex flex-wrap gap-2">
          {lista.map(a => (
            <div key={a.id} className="flex items-center gap-2">
              <button onClick={() => abrir(a.id)} className="px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--t-primary, #2E6EAB)', minHeight: 40 }}>
                Enviar apresentação · {a.nome}
              </button>
              <a href={`${BASE}/${a.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: 'var(--t-primary, #2E6EAB)' }}>ver</a>
            </div>
          ))}
        </div>
      )}
      {enviada && !aberta && <p className="text-xs mt-2" style={{ color: '#16a34a' }}>Apresentação enviada.</p>}
      {aberta && (
        <div className="space-y-2">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} className="w-full text-sm rounded-lg border border-gray-200 p-2" />
          <div className="flex gap-2">
            <button disabled={enviando || !texto.trim()} onClick={enviar} className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#16a34a', minHeight: 40 }}>
              {enviando ? 'Enviando…' : 'Enviar no WhatsApp'}
            </button>
            <button onClick={() => setAberta(null)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200" style={{ minHeight: 40 }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
