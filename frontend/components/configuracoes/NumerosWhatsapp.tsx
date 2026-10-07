'use client';

// Números de WhatsApp da empresa (pedido da Jessica, 07/10/2026): o principal segue na UAZAPI,
// vaga 2 na UAZAPI (cola o token) e vagas 3–5 na API gratuita (conecta pelo QR).
// Regra fixa: o contato fica sempre no número que falou com ele primeiro.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, QrCode, Power, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Numero = {
  vaga: string; rotulo: string; provedor: 'UAZAPI' | 'GRATIS'; principal: boolean;
  cadastrada: boolean; apelido: string | null; status: 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO'; numero: string | null; qr: string | null;
  uso: string; rodizio: boolean; limite_dia: number | null; limite_hoje: number | null; aquecimento_desde: string | null;
  pausada_motivo: string | null; contatos_hoje: number | null; conversas: number;
};

const COR = {
  CONECTADO: { bg: '#dcfce7', fg: '#15803d', dot: '#16a34a', txt: 'Conectado' },
  CONECTANDO: { bg: '#fef9c3', fg: '#a16207', dot: '#eab308', txt: 'Aguardando leitura do QR' },
  DESCONECTADO: { bg: 'var(--t-content-bg)', fg: 'var(--t-text-muted)', dot: '#9ca3af', txt: 'Desconectado' },
} as const;

const fone = (n: string | null) => {
  const d = (n || '').replace(/\D/g, '');
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n || '';
};

const erroDe = (e: any) => e?.response?.data?.message || 'Não foi possível concluir. Tente de novo.';

export default function NumerosWhatsapp() {
  const [numeros, setNumeros] = useState<Numero[] | null>(null);
  const [aviso, setAviso] = useState('');
  const [gratisOk, setGratisOk] = useState(true);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const espera = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiClient.getNumerosWhatsapp();
      const d = r.data?.data;
      setNumeros(d?.numeros || []); setAviso(d?.aviso_licenca || ''); setGratisOk(!!d?.gratis_configurada);
    } catch { setNumeros([]); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const trocar = (n: Numero) => setNumeros(l => (l || []).map(x => (x.vaga === n.vaga ? n : x)));

  // Enquanto algum número espera a leitura do QR, confere a cada 5 s.
  useEffect(() => {
    const aguardando = (numeros || []).filter(n => n.status === 'CONECTANDO' && !n.principal);
    if (espera.current) clearInterval(espera.current);
    if (!aguardando.length) return;
    espera.current = setInterval(async () => {
      for (const n of aguardando) {
        const r = await apiClient.getNumeroWhatsapp(n.vaga).catch(() => null);
        if (r?.data?.data) trocar(r.data.data);
      }
    }, 5000);
    return () => { if (espera.current) clearInterval(espera.current); };
  }, [numeros]);

  const agir = async (vaga: string, fn: () => Promise<any>) => {
    setOcupado(vaga); setErro(e => ({ ...e, [vaga]: '' }));
    try { const r = await fn(); if (r?.data?.data) trocar(r.data.data); }
    catch (e: any) { setErro(x => ({ ...x, [vaga]: erroDe(e) })); }
    finally { setOcupado(null); }
  };

  const card: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, overflow: 'hidden' };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--t-card-border)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Smartphone size={16} color="#2563eb" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Números de WhatsApp</h2>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Números extras para dividir a prospecção. Tudo cai no mesmo Inbox, com o número indicado na conversa.</p>
        </div>
        <button onClick={carregar} title="Atualizar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-muted)' }}><RefreshCw size={15} /></button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1e3a8a' }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b>Regra fixa:</b> o contato fica sempre no número que conversou com ele primeiro. Nenhum outro número chama nem responde esse contato, nem os agentes. Se o número dele estiver desconectado, a mensagem não sai por outro.</span>
        </div>

        {numeros === null ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando...</p> : numeros.map(n => {
          const c = COR[n.status] || COR.DESCONECTADO;
          const busy = ocupado === n.vaga;
          return (
            <div key={n.vaga} style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{n.apelido && !n.principal ? n.apelido : n.rotulo}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: n.provedor === 'GRATIS' ? '#f3e8ff' : '#e0f2fe', color: n.provedor === 'GRATIS' ? '#7e22ce' : '#0369a1' }}>
                  {n.provedor === 'GRATIS' ? 'API gratuita' : 'UAZAPI'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: n.cadastrada ? c.bg : 'var(--t-content-bg)', color: n.cadastrada ? c.fg : 'var(--t-text-muted)', border: '1px solid var(--t-card-border)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.cadastrada ? c.dot : '#d1d5db' }} />
                  {n.cadastrada ? c.txt : 'Vaga livre'}
                </span>
                {n.numero && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)' }}>{fone(n.numero)}</span>}
                {n.cadastrada && <span style={{ fontSize: 11, color: 'var(--t-text-muted)', marginLeft: 'auto' }}>{n.conversas} conversa{n.conversas === 1 ? '' : 's'}</span>}
              </div>

              {n.principal && (
                <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Configurado no bloco &quot;WhatsApp da empresa&quot;. Segue com o atendimento, a Bia e os clientes. Fica fora do rodízio de prospecção.</p>
              )}

              {/* Vaga 2 (UAZAPI): colar o token da instância comprada */}
              {!n.principal && n.provedor === 'UAZAPI' && n.status !== 'CONECTADO' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input type="password" autoComplete="off" className="ps-input" style={{ flex: 1, minWidth: 200, fontFamily: 'monospace', fontSize: 12 }}
                    placeholder="Token da nova instância da UAZAPI" value={tokens[n.vaga] || ''} onChange={e => setTokens(t => ({ ...t, [n.vaga]: e.target.value }))} />
                  <button disabled={busy || !(tokens[n.vaga] || '').trim()} onClick={() => agir(n.vaga, () => apiClient.conectarNumeroWhatsapp(n.vaga, tokens[n.vaga].trim()))}
                    style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                    {busy ? 'Validando...' : 'Conectar'}
                  </button>
                </div>
              )}

              {/* Vagas 3–5 (gratuita): QR na tela */}
              {!n.principal && n.provedor === 'GRATIS' && n.status !== 'CONECTADO' && (
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {n.qr && n.status === 'CONECTANDO' ? (
                    <img src={n.qr} alt="QR Code para conectar" style={{ width: 200, height: 200, borderRadius: 8, border: '1px solid var(--t-card-border)', background: '#fff' }} />
                  ) : null}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--t-text-muted)', flex: 1, minWidth: 200 }}>
                    {n.qr && n.status === 'CONECTANDO'
                      ? <span>No celular do número novo: WhatsApp &gt; <b>Aparelhos conectados</b> &gt; <b>Conectar aparelho</b> e aponte para o QR. A tela atualiza sozinha.</span>
                      : <span>Use um chip só para isso, com WhatsApp já ativado no celular.</span>}
                    <button disabled={busy || !gratisOk} onClick={() => agir(n.vaga, () => apiClient.conectarNumeroWhatsapp(n.vaga))}
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#7e22ce', color: '#fff', border: 'none', cursor: gratisOk ? 'pointer' : 'not-allowed', opacity: busy || !gratisOk ? 0.6 : 1 }}>
                      <QrCode size={13} /> {busy ? 'Gerando...' : n.qr ? 'Gerar novo QR' : 'Conectar pelo QR'}
                    </button>
                    {!gratisOk && <span style={{ color: 'var(--t-error)' }}>A API gratuita ainda não está configurada no servidor.</span>}
                  </div>
                </div>
              )}

              {/* Rodízio da prospecção */}
              {!n.principal && n.cadastrada && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--t-text-primary)', fontWeight: 600 }}>
                    <input type="checkbox" checked={n.rodizio} disabled={busy || n.status !== 'CONECTADO'}
                      onChange={e => agir(n.vaga, () => apiClient.salvarNumeroWhatsapp(n.vaga, { rodizio: e.target.checked }))} />
                    Usar na prospecção (rodízio)
                  </label>
                  <span style={{ color: 'var(--t-text-muted)' }}>
                    Hoje: {n.contatos_hoje ?? 0} de {n.limite_hoje ?? '—'} primeiros contatos
                    {n.aquecimento_desde ? ' · em aquecimento (o limite sobe a cada semana)' : ''}
                  </span>
                  {n.status === 'CONECTADO' && (
                    <button disabled={busy} onClick={() => { if (confirm('Desconectar este número? As conversas continuam no CRM e os contatos dele não serão atendidos por outro número.')) agir(n.vaga, () => apiClient.desconectarNumeroWhatsapp(n.vaga)); }}
                      style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: 'var(--t-text-muted)', cursor: 'pointer' }}>
                      <Power size={11} /> Desconectar
                    </button>
                  )}
                </div>
              )}
              {n.pausada_motivo && <p style={{ fontSize: 11, color: '#b45309' }}>⏸ Rodízio pausado: {n.pausada_motivo}</p>}

              {erro[n.vaga] && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--t-error-bg)', border: '1px solid var(--t-error-border)', fontSize: 12, color: 'var(--t-error)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <AlertTriangle size={13} /> {erro[n.vaga]}
                </div>
              )}
            </div>
          );
        })}

        {aviso && <p style={{ fontSize: 10, color: 'var(--t-text-muted)', lineHeight: 1.5 }}>{aviso}</p>}
      </div>
    </div>
  );
}
