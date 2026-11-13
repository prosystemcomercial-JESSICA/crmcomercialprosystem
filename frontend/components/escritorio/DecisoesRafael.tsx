'use client';

// Aba "Decisões" do painel do Rafael (13/11/2026): o que ele aprovou, corrigiu, mandou refazer e quais campanhas
// autorizou no lugar da Jessica. Substituiu a tela "Aprovar" (sempre vazia: o Rafael decide em até 2 minutos).

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Decisao = {
  id: string; tipo: 'aprovou' | 'corrigiu' | 'refazer' | 'campanha' | 'sem_campanha'; rotulo: string; motivo: string | null;
  fase: string | null; decidido_em: string; agente: string; cliente: string | null; empresa: string | null; conversaId: string | null;
  original: string; enviado: string | null;
};
type Resumo = { aprovou: number; corrigiu: number; refazer: number; campanhas: number };

const COR: Record<Decisao['tipo'], string> = { aprovou: '#16a34a', corrigiu: '#0f766e', refazer: '#dc2626', campanha: '#9333ea', sem_campanha: '#64748b' };
const FASE: Record<string, string> = { abertura: 'primeiro contato', retomada: 'retomada', resposta: 'resposta', encerramento: 'encerramento' };
const FILTROS: { k: string; r: string; tipos: Decisao['tipo'][] }[] = [
  { k: 'todas', r: 'Todas', tipos: [] }, { k: 'aprovou', r: '✅ Aprovou', tipos: ['aprovou'] }, { k: 'corrigiu', r: '✏️ Corrigiu', tipos: ['corrigiu'] },
  { k: 'refazer', r: '🔄 Refazer', tipos: ['refazer'] }, { k: 'campanhas', r: '💸 Campanhas', tipos: ['campanha', 'sem_campanha'] },
];
const quando = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function DecisoesRafael() {
  const [dias, setDias] = useState(7);
  const [dados, setDados] = useState<{ itens: Decisao[]; resumo: Resumo } | null>(null);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(() => {
    apiClient.client.get('/especialista/decisoes', { params: { dias } })
      .then(r => { setDados(r.data.data); setErro(false); })
      .catch(() => setErro(true));
  }, [dias]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60_000); return () => clearInterval(t); }, [carregar]);

  if (erro && !dados) return <div style={{ fontSize: 13, color: '#dc2626' }}>Não foi possível carregar as decisões do Rafael agora.</div>;
  if (!dados) return <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</div>;

  const tipos = FILTROS.find(f => f.k === filtro)?.tipos || [];
  const lista = tipos.length ? dados.itens.filter(i => tipos.includes(i.tipo)) : dados.itens;
  const r = dados.resumo;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
        O Rafael decide no seu lugar, em até 2 minutos, as mensagens da Caroline, do Julio e do Luiz Felipe e as campanhas de 30%/20%. Aqui você confere o que ele fez.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
          Últimos {dias} dias: <b>{r.aprovou}</b> aprovadas · <b>{r.corrigiu}</b> corrigidas · <b>{r.refazer}</b> refeitas · <b>{r.campanhas}</b> campanhas
        </span>
        <select value={dias} onChange={e => setDias(Number(e.target.value))} aria-label="Período"
          style={{ marginLeft: 'auto', minHeight: 32, borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13, padding: '0 8px' }}>
          <option value={1}>Hoje e ontem</option><option value={7}>7 dias</option><option value={30}>30 dias</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button key={f.k} onClick={() => setFiltro(f.k)} aria-pressed={filtro === f.k}
            style={{ minHeight: 30, padding: '0 10px', borderRadius: 14, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: filtro === f.k ? '#1e40af' : 'var(--t-card-bg)', color: filtro === f.k ? '#fff' : 'var(--t-text-secondary)', cursor: 'pointer' }}>
            {f.r}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma decisão do Rafael neste período.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {lista.map(d => {
            const abrir = aberto === d.id;
            const mudou = d.enviado && d.enviado !== d.original;
            return (
              <div key={d.id} style={{ border: '1px solid var(--t-card-border)', borderLeft: `4px solid ${COR[d.tipo]}`, borderRadius: 12, padding: 10, display: 'grid', gap: 6, minWidth: 0 }}>
                <button onClick={() => setAberto(a => a === d.id ? null : d.id)}
                  style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: COR[d.tipo] }}>{d.rotulo}</span>
                  <b style={{ fontSize: 13, color: 'var(--t-text-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>{d.cliente || 'Cliente'}{d.empresa ? ` · ${d.empresa}` : ''}</b>
                  <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{d.agente}{d.fase && FASE[d.fase] ? ` · ${FASE[d.fase]}` : ''}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t-text-muted)' }}>{quando(d.decidido_em)} {abrir ? '▲' : '▼'}</span>
                </button>
                {d.motivo && <div style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Motivo: {d.motivo}</div>}
                {abrir && (
                  <div style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    <div><b style={{ fontSize: 12 }}>{mudou ? 'O agente escreveu:' : d.enviado ? 'Mensagem enviada:' : 'Mensagem que não saiu:'}</b><div>{d.original}</div></div>
                    {mudou && <div><b style={{ fontSize: 12 }}>O que saiu depois do Rafael:</b><div>{d.enviado}</div></div>}
                    {d.conversaId && <a href={`/whatsapp?c=${d.conversaId}`} style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Ver conversa ›</a>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
