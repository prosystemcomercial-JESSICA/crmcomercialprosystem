'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Painel da conversa: envia ao lead o link de uma apresentação (página pública do CRM em
// /apresentacao/<nome>). A mensagem vem pronta e pode ser ajustada antes de enviar.
// Para uma apresentação nova: coloque a pasta em frontend/public/apresentacao/<nome>/ e acrescente aqui.

const BASE = 'https://comercial.prosystemnet.com/apresentacao';
const APRESENTACOES = [
  {
    id: 'padaria', nome: 'Padarias', url: `${BASE}/padaria`, segmento: /padaria|confeit|panifica/i,
    texto: (nome: string) => `${nome ? `Olá, ${nome}! ` : 'Olá! '}Preparei uma apresentação rápida de como o Prosystem funciona na padaria: caixa, balança, produção, estoque, iFood e financeiro num só sistema. Dá uma olhada, leva poucos minutos:

${BASE}/padaria`,
  },
  {
    id: 'farmacia', nome: 'Farmácias', url: `${BASE}/farmacia`, segmento: /farm[aá]cia|drogaria|manipula/i,
    texto: (nome: string) => `${nome ? `Olá, ${nome}! ` : 'Olá! '}Preparei uma apresentação rápida de como o Prosystem ajuda a farmácia a vender mais, perder menos com validade e manter o fiscal em dia. Dá uma olhada, leva poucos minutos:

${BASE}/farmacia`,
  },
  {
    id: 'farmacia-pdf', nome: 'Farmácias (PDF)', url: `${BASE}/farmacia/apresentacao-prosystem.pdf`, segmento: /farm[aá]cia|drogaria|manipula/i,
    texto: (nome: string) => `${nome ? `Olá, ${nome}! ` : 'Olá! '}Segue a apresentação do Prosystem em PDF, para você ver com calma ou repassar para quem decide na farmácia:

${BASE}/farmacia/apresentacao-prosystem.pdf`,
  },
  {
    id: 'sistema', nome: 'Varejo (sistema)', url: `${BASE}/sistema`, segmento: /varejo|loja|mercado|com[eé]rcio/i,
    texto: (nome: string) => `${nome ? `Olá, ${nome}! ` : 'Olá! '}Separei uma página com o Prosystem Gestão Inteligente: vendas, estoque, compras, fiscal e relatórios num só sistema. Dá uma olhada:

${BASE}/sistema`,
  },
];

type Conversa = { contato_nome?: string | null; etiqueta?: string | null; bot_dados?: any };

// Primeiro nome válido (para a saudação) e a lista com a do segmento do contato primeiro.
function preparar(conversa: Conversa) {
  const primeiroNome = (conversa.contato_nome || '').trim().split(/\s+/)[0] || '';
  const nomeValido = /^[A-Za-zÀ-ÿ]{2,}$/.test(primeiroNome) ? primeiroNome : '';
  const segmento = `${conversa.etiqueta || ''} ${conversa.bot_dados?.segmento || ''}`;
  const lista = [...APRESENTACOES].sort((a, b) => Number(b.segmento.test(segmento)) - Number(a.segmento.test(segmento)));
  return { nomeValido, lista, doSegmento: (id: string) => APRESENTACOES.find(x => x.id === id)!.segmento.test(segmento) };
}

export default function EnviarApresentacaoWpp({ conversaId, conversa }: { conversaId: string; conversa: Conversa }) {
  const { nomeValido, lista } = preparar(conversa);
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
              <a href={a.url} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: 'var(--t-primary, #2E6EAB)' }}>ver</a>
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

// Botão ao lado do campo de mensagem: abre as apresentações, mostra a mensagem pronta
// (editável) e envia direto na conversa, sem ir até o painel lateral.
export function BotaoApresentacaoWpp({ conversaId, conversa, onEnviada }: { conversaId: string; conversa: Conversa; onEnviada: (msg: any) => void }) {
  const { nomeValido, lista, doSegmento } = preparar(conversa);
  const [aberto, setAberto] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const fechar = () => { setAberto(false); setEscolhida(null); setErro(null); };
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) fechar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);
  useEffect(() => { fechar(); }, [conversaId]);

  const escolher = (id: string) => { setTexto(APRESENTACOES.find(x => x.id === id)!.texto(nomeValido)); setEscolhida(id); setErro(null); };
  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true); setErro(null);
    try { const res = await apiClient.enviarWhatsappMensagem(conversaId, texto.trim()); onEnviada(res.data.data); fechar(); }
    catch (e: any) { setErro(e?.response?.data?.message || 'Não foi possível enviar agora.'); }
    finally { setEnviando(false); }
  };
  const nomeEscolhida = escolhida ? APRESENTACOES.find(x => x.id === escolhida)!.nome : '';

  return (
    <div ref={caixa} className="flex-shrink-0">
      <button onClick={() => (aberto ? fechar() : setAberto(true))} title="Enviar apresentação" aria-label="Enviar apresentação" aria-expanded={aberto}
        className={`rounded-full w-11 h-11 flex items-center justify-center shadow-sm border bg-white text-[#2E6EAB] ${aberto ? 'border-[#2E6EAB]' : 'border-[#C9D8EA]'}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /><path d="M10 8.5v3l3-1.5z" fill="currentColor" />
        </svg>
      </button>
      {aberto && (
        <div role="dialog" aria-label="Enviar apresentação"
          className="apres-pop absolute bottom-full left-3 mb-1 z-30 bg-white rounded-xl border border-gray-200 shadow-xl p-3"
          style={{ width: 'min(340px, calc(100vw - 24px))' }}>
          {!escolhida ? (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Enviar apresentação</p>
              <div className="space-y-1.5">
                {lista.map(a => (
                  <div key={a.id} className="flex items-center gap-2">
                    <button onClick={() => escolher(a.id)}
                      className={`flex-1 min-h-[44px] text-left px-3 rounded-lg border text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 ${doSegmento(a.id) ? 'border-[#2E6EAB]' : 'border-gray-200'}`}>
                      {a.nome}
                      {doSegmento(a.id) && <span className="ml-2 text-[10px] font-semibold uppercase" style={{ color: '#2E6EAB' }}>do segmento</span>}
                    </button>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-xs font-medium px-1.5 py-3" style={{ color: '#2E6EAB' }}>ver</a>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase">{nomeEscolhida}: confira a mensagem</p>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} autoFocus className="w-full text-sm rounded-lg border border-gray-200 p-2" />
              {erro && <p className="text-xs text-red-600">{erro}</p>}
              <div className="flex gap-2">
                <button disabled={enviando || !texto.trim()} onClick={enviar}
                  className="flex-1 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-white bg-[#16a34a] disabled:opacity-50">
                  {enviando ? 'Enviando…' : 'Enviar no WhatsApp'}
                </button>
                <button onClick={() => setEscolhida(null)} className="min-h-[44px] px-3 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200">Voltar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
