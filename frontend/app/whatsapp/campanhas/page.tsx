'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

// Campanhas pelo WhatsApp da empresa: novidades para clientes ou reativação de
// leads parados. A fila manda ~24 por hora em horário comercial e respeita "SAIR".

type Campanha = { id: string; nome: string; publico: string; status: string; total: number; enviados: number; pendentes: number; falhas: number; ignorados: number; created_at: string };
const PUBLICO: Record<string, string> = { CLIENTES: 'Clientes da base', LEADS_PARADOS: 'Leads parados' };
const STATUS: Record<string, string> = { ENVIANDO: 'Enviando', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' };
const MODELOS: Record<string, string> = {
  CLIENTES: 'Olá! Temos novidade no Prosystem: agora o sistema avisa quando o remédio de uso contínuo do seu cliente está acabando. Quer que a gente ative para você?',
  LEADS_PARADOS: 'Oi, {nome}! Aqui é a Jessica, da Prosystem. Falamos um tempo atrás sobre o sistema para a sua empresa. Temos condições novas este mês: posso te mostrar em 15 minutos?',
};
const campo: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 };

export default function CampanhasWhatsappPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [lista, setLista] = useState<Campanha[]>([]);
  const [publico, setPublico] = useState<'CLIENTES' | 'LEADS_PARADOS'>('LEADS_PARADOS');
  const [segmento, setSegmento] = useState('');
  const [dias, setDias] = useState(30);
  const [nome, setNome] = useState('');
  const [texto, setTexto] = useState(MODELOS.LEADS_PARADOS);
  const [previa, setPrevia] = useState<{ total: number; amostra: string[] } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const carregar = useCallback(() => {
    apiClient.listarCampanhasWhatsapp().then(r => setLista(r.data.data)).catch(() => setMsg({ ok: false, texto: 'Só a gestão pode ver as campanhas.' }));
  }, []);
  useEffect(() => { if (isAuthenticated) carregar(); }, [isAuthenticated, carregar]);

  const filtro = () => ({ publico, segmento: segmento.trim() || null, dias_parado: publico === 'LEADS_PARADOS' ? dias : null });

  const verPrevia = async () => {
    setOcupado(true); setMsg(null); setConfirmar(false);
    try { setPrevia((await apiClient.previaCampanhaWhatsapp(filtro())).data.data); }
    catch (e: any) { setMsg({ ok: false, texto: e?.response?.data?.message || 'Não foi possível calcular o público.' }); }
    finally { setOcupado(false); }
  };

  const criar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const r = await apiClient.criarCampanhaWhatsapp({ ...filtro(), nome, texto });
      setMsg({ ok: true, texto: r.data.message }); setConfirmar(false); setPrevia(null); setNome(''); carregar();
    } catch (e: any) { setMsg({ ok: false, texto: e?.response?.data?.message || 'Não foi possível criar.' }); }
    finally { setOcupado(false); }
  };

  const cancelar = async (id: string) => {
    await apiClient.cancelarCampanhaWhatsapp(id).catch(() => {});
    carregar();
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 0 40px', display: 'grid', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Campanhas pelo WhatsApp</h1>
          <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 4 }}>
            Mande novidades para clientes ou reative leads parados. Saem cerca de 24 mensagens por hora, só em horário comercial, e quem responder SAIR não recebe mais.
          </p>
        </div>

        <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 20, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Público
              <select id="publico" style={campo} value={publico} onChange={e => { const v = e.target.value as typeof publico; setPublico(v); setTexto(MODELOS[v]); setPrevia(null); }}>
                <option value="LEADS_PARADOS">Leads parados (sem movimento)</option>
                <option value="CLIENTES">Clientes da base (ativos)</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Segmento (opcional)
              <input id="segmento" style={campo} value={segmento} placeholder="ex.: Padaria, Farmácia" onChange={e => { setSegmento(e.target.value); setPrevia(null); }} />
            </label>
            {publico === 'LEADS_PARADOS' && (
              <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Parados há pelo menos
                <select id="dias" style={campo} value={dias} onChange={e => { setDias(Number(e.target.value)); setPrevia(null); }}>
                  {[15, 30, 60, 90, 180].map(d => <option key={d} value={d}>{d} dias</option>)}
                </select>
              </label>
            )}
          </div>
          <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Nome da campanha
            <input id="nome" style={campo} value={nome} placeholder="ex.: Reativação padarias setembro" onChange={e => setNome(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>Mensagem ({'{nome}'} vira o primeiro nome do lead)
            <textarea id="texto" rows={4} style={{ ...campo, resize: 'vertical' }} value={texto} onChange={e => setTexto(e.target.value)} />
          </label>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Ao final de cada mensagem vai: &quot;Para não receber mais estas mensagens, responda SAIR.&quot;</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button onClick={verPrevia} disabled={ocupado}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Ver quantos vão receber
            </button>
            {previa && (
              <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>
                <b>{previa.total}</b> celular(es){previa.amostra.length ? ` · ex.: ${previa.amostra.slice(0, 4).join(', ')}` : ''}
              </span>
            )}
          </div>

          {previa && previa.total > 0 && !confirmar && (
            <button onClick={() => setConfirmar(true)} disabled={!nome.trim() || texto.trim().length < 10}
              style={{ justifySelf: 'start', padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--t-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: !nome.trim() ? 0.5 : 1 }}>
              Criar campanha
            </button>
          )}
          {confirmar && previa && (
            <div style={{ border: '1px solid #f59e0b', background: '#fffbeb', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#92400e' }}>Confirma o envio para <b>{previa.total}</b> contato(s)? Leva cerca de {Math.ceil(previa.total / 24)} hora(s) de horário comercial.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={criar} disabled={ocupado} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: 13 }}>Sim, enviar</button>
                <button onClick={() => setConfirmar(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d6d3d1', background: '#fff', fontSize: 13 }}>Voltar</button>
              </div>
            </div>
          )}
          {msg && <p style={{ fontSize: 13, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</p>}
        </div>

        <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--t-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                {['Campanha', 'Público', 'Status', 'Enviadas', 'Na fila', 'Falhas', ''].map(h => <th key={h} style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: 'var(--t-text-muted)' }}>Nenhuma campanha ainda.</td></tr>}
              {lista.map(c => (
                <tr key={c.id} style={{ color: 'var(--t-text-primary)' }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)' }}>{c.nome}<br /><span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{new Date(c.created_at).toLocaleString('pt-BR')}</span></td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)' }}>{PUBLICO[c.publico] || c.publico}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)' }}>{STATUS[c.status] || c.status}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)', fontVariantNumeric: 'tabular-nums' }}>{c.enviados} / {c.total}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)', fontVariantNumeric: 'tabular-nums' }}>{c.pendentes}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)', fontVariantNumeric: 'tabular-nums' }}>{c.falhas}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)' }}>
                    {c.status === 'ENVIANDO' && <button onClick={() => cancelar(c.id)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
