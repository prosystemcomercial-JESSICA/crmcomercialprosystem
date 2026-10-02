'use client';

// Página pública do cliente: passo a passo da implantação/serviço, percentual e tempo dedicado.
// Sem login (link único). Não mostra esperas nem descrições internas.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' }) : null);
const fmtHoras = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`; };

export default function AcompanhamentoPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<any | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    const carregar = () => axios.get(`${API_URL}/publico/acompanhamento/${token}`).then(r => setD(r.data.data)).catch(() => setErro(true));
    carregar();
    const t = setInterval(carregar, 120000);
    return () => clearInterval(t);
  }, [token]);

  const fundo: React.CSSProperties = { minHeight: '100vh', background: '#F4F7FB', fontFamily: "'Segoe UI', Arial, sans-serif", color: '#23384D' };
  if (erro) return <div style={{ ...fundo, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}><div><h1 style={{ fontSize: 20 }}>Página não encontrada</h1><p style={{ color: '#5B7A99' }}>Confira o link recebido ou fale com a Prosystem.</p></div></div>;
  if (!d) return <div style={{ ...fundo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#5B7A99' }}>Carregando…</p></div>;

  const servico = d.modulo === 'SERVICO';
  const linha: { titulo: string; sub?: string | null; estado: 'feito' | 'atual' | 'futuro'; passos?: any[] }[] = [
    { titulo: 'Contrato assinado', sub: fmtData(d.assinatura), estado: 'feito' },
    ...d.etapas.filter((e: any) => e.grupo !== 'TREINAMENTO').map((e: any) => ({
      titulo: e.nome, sub: e.total ? `${e.feitos} de ${e.total} passos` : null, passos: e.passos,
      estado: (e.total && e.feitos === e.total) || d.virada ? 'feito' : e.feitos ? 'atual' : 'futuro',
    })),
    ...(!servico ? [{ titulo: 'Virada da loja', sub: d.virada ? `Sistema em uso desde ${fmtData(d.virada)}` : d.virada_inicio ? 'Em andamento' : 'Data combinada com o técnico', estado: (d.virada ? 'feito' : d.virada_inicio ? 'atual' : 'futuro') as any }] : []),
    ...(!servico ? d.fases.map((f: any) => ({ titulo: `Treinamento · Fase ${f.ordem}: ${f.nome}`, sub: f.realizada_em ? `Realizada em ${fmtData(f.realizada_em)}` : f.marcada_em ? `Marcada para ${fmtData(f.marcada_em)}` : null, estado: f.realizada_em ? 'feito' : f.marcada_em ? 'atual' : 'futuro' })) : []),
    ...(servico ? [{ titulo: 'Serviço concluído', sub: null, estado: (d.concluida || d.pct >= 100 ? 'feito' : 'futuro') as any }] : []),
  ];
  const corEstado = { feito: '#16a34a', atual: '#2E6EAB', futuro: '#C9D6E3' };

  return (
    <div style={fundo}>
      <header style={{ background: 'linear-gradient(135deg,#0D2238 0%,#1A4E82 50%,#2E6EAB 100%)', padding: '28px 18px 64px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '7px 14px', fontSize: 18, fontWeight: 800, color: '#fff' }}>Pro<span style={{ color: '#90BEF0' }}>System</span></span>
          <p style={{ margin: '24px 0 6px', fontSize: 12, color: '#6AAAE5', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 }}>{servico ? (d.tipo_servico || 'Serviço') : 'Acompanhamento da implantação'}</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{d.cliente}</h1>
          {d.tecnico && <p style={{ margin: '8px 0 0', color: '#A8C8E8', fontSize: 14 }}>Técnico responsável: {d.tecnico}</p>}
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: '-44px auto 0', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
        <section style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 4px 30px rgba(13,34,56,.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <b style={{ fontSize: 14, color: '#1A4E82' }}>{d.virada ? 'Loja virada! 🎉' : servico ? 'Andamento do serviço' : 'Andamento até a virada'}</b>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#2E6EAB' }}>{d.pct}%</span>
          </div>
          <div style={{ height: 12, background: '#EBF4FF', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${d.pct}%`, height: '100%', background: d.pct >= 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#4B8EC8,#2E6EAB)', borderRadius: 99, transition: 'width .5s' }} />
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, fontSize: 14, color: '#5B7A99' }}>
            <span>⏱️ Tempo dedicado: <b style={{ color: '#1A4E82' }}>{fmtHoras(d.tempo_ms)}</b></span>
            {d.primeiro_vencimento && <span>📅 1º vencimento: <b style={{ color: '#1A4E82' }}>{fmtData(d.primeiro_vencimento)}</b></span>}
          </div>
          {d.proximos?.length > 0 && !d.virada && (
            <div style={{ marginTop: 14, padding: 12, background: '#F4F7FB', borderRadius: 10, fontSize: 14 }}>
              <b style={{ color: '#1A4E82' }}>Próximos passos</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#23384D' }}>{d.proximos.map((p: string) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
        </section>
        <section style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 4px 30px rgba(13,34,56,.06)' }}>
          <b style={{ fontSize: 14, color: '#1A4E82' }}>Passo a passo</b>
          <ol style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
            {linha.map((l, k) => (
              <li key={k} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: k === linha.length - 1 ? 0 : 18 }}>
                {k < linha.length - 1 && <span style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 2, background: l.estado === 'feito' ? '#16a34a55' : '#E3EBF3' }} />}
                <span style={{ width: 24, height: 24, borderRadius: 99, flexShrink: 0, background: l.estado === 'futuro' ? '#fff' : corEstado[l.estado], border: `2px solid ${corEstado[l.estado]}`, color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{l.estado === 'feito' ? '✓' : ''}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: l.estado === 'futuro' ? '#7A93AD' : '#1A4E82' }}>{l.titulo}</div>
                  {l.sub && <div style={{ fontSize: 13, color: '#5B7A99' }}>{l.sub}</div>}
                  {l.passos && l.estado !== 'futuro' && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ fontSize: 12, color: '#2E6EAB', cursor: 'pointer' }}>Ver passos</summary>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'grid', gap: 3 }}>
                        {l.passos.map((p: any) => <li key={p.titulo} style={{ fontSize: 13, color: p.feito ? '#16a34a' : '#5B7A99' }}>{p.feito ? '✓' : '○'} {p.titulo}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#7A93AD' }}>
          Dúvidas? Fale com o suporte: <a href={d.suporte?.link} style={{ color: '#2E6EAB', fontWeight: 700 }}>{d.suporte?.telefone}</a><br />Prosystem Sistemas · Vitória/ES
        </p>
      </main>
    </div>
  );
}
