'use client';

// "Esperando você" (10/11/2026): tudo o que está parado com a Jessica numa fila só, mais antigo primeiro
// dentro de cada tipo. Cada item abre o painel onde se decide.

import { useState } from 'react';
import type { AgenteTela, ItemEsperando } from './tipos';
import { haQuanto } from './tipos';

const TIPOS = [
  { id: 'mensagem', nome: 'Mensagens para aprovar', ajuda: 'Os agentes escreveram e esperam o seu ok. As seguradas pela Laya dizem o motivo.' },
  { id: 'pergunta', nome: 'Perguntas do Rafael', ajuda: 'O que só você sabe responder. A resposta vale para todos os agentes.' },
  { id: 'documento', nome: 'Documentos para aprovar', ajuda: 'Lições, POPs, treinamentos e informativos. Aprovado, vira regra dos agentes.' },
] as const;

export default function EsperandoVoce({ itens, agentes, onAbrir }: { itens: ItemEsperando[]; agentes: AgenteTela[]; onAbrir: (painel: string, tipo: string) => void }) {
  const [aba, setAba] = useState<(typeof TIPOS)[number]['id']>(() => (TIPOS.find(t => itens.some(i => i.tipo === t.id))?.id || 'mensagem'));
  const lista = itens.filter(i => i.tipo === aba);
  const nome = (id: string) => agentes.find(a => a.id === id)?.nome || id;
  const cor = (id: string) => agentes.find(a => a.id === id)?.cor || '#64748b';
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>Esperando você</h2>
        <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{itens.length ? `${itens.length} itens parados com você. Comece pelas mensagens: é um cliente esperando.` : 'Nada parado com você agora.'}</p>
      </div>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TIPOS.map(t => {
          const n = itens.filter(i => i.tipo === t.id).length;
          return <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => setAba(t.id)} className={`esc-aba${aba === t.id ? ' ativa' : ''}`}>{t.nome} <b>{n}</b></button>;
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{TIPOS.find(t => t.id === aba)?.ajuda}</p>
      {lista.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: 16, textAlign: 'center', background: 'var(--t-card-bg)', borderRadius: 12, border: '1px dashed var(--t-card-border)' }}>Nada aqui.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {lista.map(i => (
            <li key={`${i.tipo}-${i.id}`}>
              <button onClick={() => onAbrir(i.painel, i.tipo)} style={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', cursor: 'pointer', font: 'inherit' }}>
                <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, background: cor(i.agente), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>{nome(i.agente)[0]}</span>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <b style={{ fontSize: 13, color: 'var(--t-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.titulo}</b>
                  <span style={{ fontSize: 12, color: i.detalhe.startsWith('Segurada') ? '#b45309' : 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome(i.agente)} · {i.detalhe}</span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' }}>{haQuanto(i.em)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
