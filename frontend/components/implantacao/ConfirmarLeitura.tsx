'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { AlertTriangle, Bell, CheckCircle, Eye } from 'lucide-react';

// Leitura de recado com confirmação: o técnico toca no recado, lê no popup e confirma.
// Só a confirmação marca como lido, e a supervisão vê quem leu e quando (RadarLeitura).

const fmtDataHora = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export function ConfirmarLeitura({ aviso, onFechar }: { aviso: any | null; onFechar: () => void }) {
  const [salvando, setSalvando] = useState(false);
  if (!aviso) return null;
  const urgente = aviso.prioridade === 'URGENTE';
  const confirmar = async () => {
    setSalvando(true);
    try { await apiClient.marcarAvisoLido(aviso.id); window.dispatchEvent(new Event('avisos:mudou')); onFechar(); }
    catch { alert('Não foi possível confirmar agora. Tente de novo.'); }
    finally { setSalvando(false); }
  };
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(13,34,56,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Recado" onClick={e => e.stopPropagation()}
        style={{ width: 'min(460px, 100%)', background: 'var(--t-card-bg)', borderRadius: 16, boxShadow: '0 20px 50px rgba(13,34,56,.3)', padding: 20, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, color: urgente ? '#dc2626' : 'var(--t-text-primary)' }}>
          {urgente ? <AlertTriangle size={18} /> : <Bell size={18} color="#2E6EAB" />} {urgente ? 'Recado urgente' : 'Recado'}
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap' }}>{aviso.texto}</div>
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
          de {aviso.de_nome || 'Gestão'}{aviso.implantacao ? ` · ${aviso.implantacao.cliente_razao_social}` : ''} · {fmtDataHora(aviso.created_at)}
        </div>
        {aviso.lido_em ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16a34a', fontWeight: 700 }}><CheckCircle size={15} /> Leitura confirmada em {fmtDataHora(aviso.lido_em)}</div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onFechar} style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          {!aviso.lido_em && (
            <button onClick={confirmar} disabled={salvando} style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none', background: '#2E6EAB', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={16} /> {salvando ? 'Confirmando…' : 'Confirmo que li'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Radar da supervisão: recados enviados aos técnicos, quem já confirmou a leitura e quem ainda não. */
export function RadarLeitura() {
  const [itens, setItens] = useState<any[]>([]);
  const carregar = useCallback(async () => {
    try {
      const r = await apiClient.getAvisosTecnico(true);
      setItens((r.data.data.avisos || [])// recados da gestão + avisos automáticos que foram para o técnico do card
        .filter((a: any) => a.tipo !== 'TAREFA' && a.para_id !== a.de_id && (a.origem === 'GESTAO' || (a.implantacao?.tecnico_id && a.para_id === a.implantacao.tecnico_id))).slice(0, 30));
    } catch { /* sem login */ }
  }, []);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    window.addEventListener('avisos:mudou', carregar);
    return () => { clearInterval(t); window.removeEventListener('avisos:mudou', carregar); };
  }, [carregar]);
  const pendentes = itens.filter(a => !a.lido_em);
  return (
    <section style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--t-text-primary)', padding: '14px 16px 10px' }}>
        <Eye size={16} color="#2E6EAB" /> Leitura dos recados
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: pendentes.length ? '#d97706' : '#16a34a' }}>{pendentes.length ? `${pendentes.length} sem confirmação` : 'todos confirmados'}</span>
      </div>
      <div style={{ padding: '0 16px 14px', display: 'grid', gap: 4 }}>
        {itens.length === 0 && <div style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: '6px 0' }}>Nenhum recado enviado ainda.</div>}
        {itens.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--t-card-border)', fontSize: 13 }}>
            {a.lido_em ? <CheckCircle size={15} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} /> : <Eye size={15} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--t-text-primary)' }}><b>{a.para_nome}</b> · {a.texto.length > 90 ? `${a.texto.slice(0, 90)}…` : a.texto}</div>
              <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                enviado {fmtDataHora(a.created_at)}{a.implantacao ? ` · ${a.implantacao.cliente_razao_social}` : ''} · {a.lido_em ? <span style={{ color: '#16a34a', fontWeight: 700 }}>leu em {fmtDataHora(a.lido_em)}</span> : <span style={{ color: '#d97706', fontWeight: 700 }}>ainda não confirmou</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
