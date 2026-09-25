'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Conversa da supervisão com um agente do escritório: instruções (gravadas e
// aplicadas na IA do agente) e perguntas (respondidas com os dados do agente).

type Msg = { id: string; autor: 'JESSICA' | 'AGENTE'; tipo: string; texto: string; created_at: string };
type Instr = { id: string; agente: string; texto: string; created_at: string };

export default function ChatAgente({ agente, onFechar }: { agente: { id: string; nome: string; cor: string; funcao: string }; onFechar: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [instr, setInstr] = useState<Instr[]>([]);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'PERGUNTA' | 'INSTRUCAO'>('PERGUNTA');
  const [equipe, setEquipe] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(() => {
    apiClient.getConversaAgente(agente.id)
      .then(r => { setMsgs(r.data.data.mensagens); setInstr(r.data.data.instrucoes); })
      .catch(e => setErro(e?.response?.status === 403 ? 'Só a supervisão conversa com os agentes.' : 'Não foi possível abrir a conversa.'));
  }, [agente.id]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const enviar = async () => {
    const t = texto.trim();
    if (t.length < 2) return;
    setEnviando(true); setErro(null);
    setMsgs(m => [...m, { id: `tmp-${Date.now()}`, autor: 'JESSICA', tipo, texto: t, created_at: new Date().toISOString() }]);
    setTexto('');
    try { await apiClient.falarComAgente(agente.id, { tipo, texto: t, equipe: tipo === 'INSTRUCAO' && equipe }); carregar(); }
    catch (e: any) { setErro(e?.response?.data?.message || 'Não foi possível enviar.'); }
    finally { setEnviando(false); }
  };

  const remover = async (id: string) => { await apiClient.removerInstrucao(id).catch(() => {}); carregar(); };

  return (
    <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${agente.cor}`, borderRadius: 14, display: 'grid', gridTemplateRows: 'auto 1fr auto', maxHeight: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--t-card-border)' }}>
        <span style={{ width: 12, height: 12, borderRadius: 99, background: agente.cor }} />
        <div style={{ flex: 1 }}>
          <b style={{ color: 'var(--t-text-primary)' }}>Conversa com {agente.nome}</b>
          <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{agente.funcao}</div>
        </div>
        <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-muted)', fontSize: 12 }}>Fechar</button>
      </div>

      <div style={{ overflowY: 'auto', padding: 14, display: 'grid', gap: 8, alignContent: 'start', minHeight: 160 }}>
        {instr.length > 0 && (
          <div style={{ background: 'var(--t-content-bg)', borderRadius: 10, padding: 10, display: 'grid', gap: 4 }}>
            <b style={{ fontSize: 12, color: 'var(--t-text-primary)' }}>📌 Instruções que {agente.nome} segue</b>
            {instr.map(i => (
              <div key={i.id} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--t-text-secondary)' }}>
                <span style={{ flex: 1 }}>{i.agente === 'equipe' ? '👥 ' : ''}{i.texto}</span>
                <button onClick={() => remover(i.id)} title="Remover instrução" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 11 }}>remover</button>
              </div>
            ))}
          </div>
        )}
        {msgs.length === 0 && <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Faça uma pergunta ou deixe uma instrução para {agente.nome}. Tudo fica gravado.</p>}
        {msgs.map(m => (
          <div key={m.id} style={{
            justifySelf: m.autor === 'JESSICA' ? 'end' : 'start', maxWidth: '85%', padding: '8px 12px', borderRadius: 12, fontSize: 13, whiteSpace: 'pre-wrap',
            background: m.autor === 'JESSICA' ? (m.tipo === 'INSTRUCAO' ? '#fef3c7' : '#dbeafe') : 'var(--t-content-bg)', color: '#0f172a',
          }}>
            {m.tipo === 'INSTRUCAO' && <b style={{ fontSize: 11 }}>📌 Instrução · </b>}{m.texto}
          </div>
        ))}
        {enviando && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{agente.nome} está pensando…</div>}
        <div ref={fim} />
      </div>

      <div style={{ borderTop: '1px solid var(--t-card-border)', padding: 10, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['PERGUNTA', 'INSTRUCAO'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${tipo === t ? agente.cor : 'var(--t-card-border)'}`, background: tipo === t ? agente.cor : 'transparent', color: tipo === t ? '#fff' : 'var(--t-text-secondary)',
            }}>{t === 'PERGUNTA' ? '❓ Perguntar' : '📌 Dar instrução'}</button>
          ))}
          {tipo === 'INSTRUCAO' && (
            <label style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <input id={`equipe-${agente.id}`} type="checkbox" checked={equipe} onChange={e => setEquipe(e.target.checked)} /> vale para toda a equipe
            </label>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id={`chat-${agente.id}`} value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
            placeholder={tipo === 'PERGUNTA' ? `Pergunte algo para ${agente.nome}…` : `Ex.: sempre ofereça demonstração no fim da resposta`}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }} />
          <button onClick={enviar} disabled={enviando || texto.trim().length < 2}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: agente.cor, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>Enviar</button>
        </div>
        {erro && <span style={{ fontSize: 12, color: '#dc2626' }}>{erro}</span>}
      </div>
    </div>
  );
}
