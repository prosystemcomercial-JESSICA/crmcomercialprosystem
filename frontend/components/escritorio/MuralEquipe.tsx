'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Loader2, Users } from 'lucide-react';

// Mural da equipe (06/10/2026): o que os agentes passam uns para os outros e para o Rafael, o chefe.
// Passagem de bastão com contexto, dúvidas e respostas, experiências, orientações e a reunião diária.

const TIPOS: { k: string; l: string; cor: string }[] = [
  { k: '', l: 'Tudo', cor: '#2E6EAB' },
  { k: 'REUNIAO', l: 'Reuniões', cor: '#1e40af' },
  { k: 'ORIENTACAO', l: 'Orientações do Rafael', cor: '#1e40af' },
  { k: 'DUVIDA', l: 'Dúvidas', cor: '#d97706' },
  { k: 'RESPOSTA', l: 'Respostas', cor: '#16a34a' },
  { k: 'EXPERIENCIA', l: 'Experiências', cor: '#7c3aed' },
  { k: 'CONTEXTO', l: 'Passagem de bastão', cor: '#0891b2' },
  { k: 'CONVERSA', l: 'Conversas', cor: '#64748b' },
];
const COR = Object.fromEntries(TIPOS.filter(t => t.k).map(t => [t.k, t.cor]));
const ROTULO: Record<string, string> = { REUNIAO: 'Reunião', ORIENTACAO: 'Orientação', DUVIDA: 'Dúvida', RESPOSTA: 'Resposta', EXPERIENCIA: 'Experiência', CONTEXTO: 'Passagem de bastão', CONVERSA: 'Conversa' };
const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function MuralEquipe() {
  const [tipo, setTipo] = useState('');
  const [notas, setNotas] = useState<any[] | null>(null);
  const [reunindo, setReunindo] = useState(false);
  const carregar = useCallback(() => {
    setNotas(null);
    apiClient.getMuralEquipe(tipo ? { tipo } : {}).then(r => setNotas(r.data.data)).catch(() => setNotas([]));
  }, [tipo]);
  useEffect(() => { carregar(); }, [carregar]);
  const reuniao = async () => {
    setReunindo(true);
    try { const r = await apiClient.reuniaoEquipe(); if (!r.data.data) alert('Nada de novo nas últimas 24 h para o Rafael tratar.'); carregar(); }
    catch (e: any) { alert(e?.response?.data?.message || 'O Rafael não conseguiu fazer a reunião agora.'); }
    finally { setReunindo(false); }
  };

  return (
    <section style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Users size={18} color="#1e40af" />
        <div style={{ display: 'grid' }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>Mural da equipe</b>
          <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>O que os agentes passam uns para os outros e para o Rafael. Tudo isso entra no raciocínio deles.</span>
        </div>
        <button onClick={reuniao} disabled={reunindo} style={{ marginLeft: 'auto', padding: '8px 14px', minHeight: 40, borderRadius: 8, border: 'none', background: '#1e40af', color: '#fff', fontWeight: 600, fontSize: 13, cursor: reunindo ? 'wait' : 'pointer', opacity: reunindo ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {reunindo ? <><Loader2 size={14} className="animate-spin" /> Rafael reunindo a equipe…</> : 'Reunião da equipe agora'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TIPOS.map(t => (
          <button key={t.k || 'tudo'} onClick={() => setTipo(t.k)} style={{ fontSize: 12, fontWeight: tipo === t.k ? 600 : 500, padding: '6px 12px', minHeight: 32, borderRadius: 999, cursor: 'pointer', border: `1px solid ${tipo === t.k ? `${t.cor}66` : 'var(--t-card-border)'}`, background: tipo === t.k ? `${t.cor}10` : 'transparent', color: tipo === t.k ? t.cor : 'var(--t-text-secondary)' }}>{t.l}</button>
        ))}
      </div>
      {notas === null ? <Loader2 size={16} className="animate-spin" /> : notas.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada aqui ainda. O mural enche conforme os agentes trabalham; a reunião do Rafael acontece nos dias úteis entre 8h e 10h.</span>
      ) : (
        <div style={{ display: 'grid', gap: 8, maxHeight: 560, overflowY: 'auto' }}>
          {notas.map(n => (
            <div key={n.id} style={{ borderLeft: `3px solid ${COR[n.tipo] || '#64748b'}`, padding: '8px 12px', background: 'var(--t-bg-subtle, rgba(148,163,184,.06))', borderRadius: 8, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: COR[n.tipo] || '#64748b' }}>{ROTULO[n.tipo] || n.tipo}</span>
                <span style={{ color: 'var(--t-text-secondary)' }}><b style={{ color: 'var(--t-text-primary)' }}>{n.de_nome}</b> → {n.para_nome}</span>
                {n.tipo === 'DUVIDA' && <span style={{ fontWeight: 600, color: n.resolvida_em ? '#16a34a' : '#d97706' }}>{n.resolvida_em ? 'respondida' : 'em aberto'}</span>}
                <span style={{ marginLeft: 'auto', color: 'var(--t-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{quando(n.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{n.assunto}</div>
              <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.texto}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
