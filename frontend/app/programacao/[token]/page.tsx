'use client';

// Página da programação (Sinval), sem login: demandas paradas esperando a programação, com "Resolvido".

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const desde = (s: string) => { const h = (Date.now() - new Date(s).getTime()) / 3600000; return h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`; };

export default function ProgramacaoPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<any | null>(null);
  const [erro, setErro] = useState(false);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const carregar = useCallback(() => axios.get(`${API_URL}/publico/programacao/${token}`).then(r => setD(r.data.data)).catch(() => setErro(true)), [token]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  const resolver = async (id: string) => {
    setSalvando(id);
    try { await axios.post(`${API_URL}/publico/programacao/${token}/esperas/${id}/resolver`, { resposta: resp[id] || null }); await carregar(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Não foi possível agora.'); } finally { setSalvando(null); }
  };
  const fundo: React.CSSProperties = { minHeight: '100vh', background: '#F4F7FB', fontFamily: "'Segoe UI', Arial, sans-serif", color: '#23384D', padding: '0 0 40px' };
  if (erro) return <div style={{ ...fundo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Link inválido.</div>;
  if (!d) return <div style={{ ...fundo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando…</div>;
  return (
    <div style={fundo}>
      <header style={{ background: 'linear-gradient(135deg,#0D2238,#2E6EAB)', padding: '22px 16px', color: '#fff' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: '#A8C8E8' }}>Prosystem · Implantação</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22 }}>Pendências da programação{d.nome ? ` · ${d.nome}` : ''}</h1>
          <div style={{ fontSize: 13, color: '#A8C8E8', marginTop: 4 }}>{d.esperas.length ? `${d.esperas.length} demanda(s) parada(s) esperando você` : 'Nenhuma demanda parada agora 👍'}</div>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: '16px auto 0', padding: '0 14px', display: 'grid', gap: 12 }}>
        {d.esperas.map((e: any) => (
          <section key={e.id} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 18px rgba(13,34,56,.08)', borderLeft: '4px solid #d97706', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 16, color: '#1A4E82' }}>{e.cliente}</b>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>parada há {desde(e.inicio)}</span>
            </div>
            <div style={{ fontSize: 14 }}><b>Motivo:</b> {e.motivo}</div>
            {e.o_que_resolver && <div style={{ fontSize: 14 }}><b>Precisa:</b> {e.o_que_resolver}</div>}
            <div style={{ fontSize: 12, color: '#5B7A99' }}>Técnico: {e.tecnico || '—'}{e.conversao ? ` · conversão de ${e.conversao}` : ''} · aberta em {fmt(e.inicio)}</div>
            <textarea rows={2} value={resp[e.id] || ''} onChange={ev => setResp(p => ({ ...p, [e.id]: ev.target.value }))} placeholder="O que foi feito (opcional)" style={{ width: '100%', borderRadius: 10, border: '1px solid #C9D6E3', padding: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <button disabled={salvando === e.id} onClick={() => resolver(e.id)} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{salvando === e.id ? 'Salvando…' : '✓ Resolvido, avisar o técnico'}</button>
          </section>
        ))}
        {d.resolvidas.length > 0 && (
          <section style={{ background: '#fff', borderRadius: 14, padding: 16 }}>
            <b style={{ fontSize: 14, color: '#1A4E82' }}>Resolvidas nos últimos 14 dias</b>
            {d.resolvidas.map((e: any) => <div key={e.id} style={{ fontSize: 13, padding: '8px 0', borderTop: '1px solid #EBF4FF' }}><b>{e.cliente}</b>: {e.motivo}{e.resposta ? <span style={{ color: '#16a34a' }}> · {e.resposta}</span> : null}<div style={{ fontSize: 12, color: '#7A93AD' }}>{fmt(e.inicio)} → {fmt(e.fim)}</div></div>)}
          </section>
        )}
      </main>
    </div>
  );
}
