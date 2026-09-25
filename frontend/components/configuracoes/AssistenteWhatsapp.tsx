'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// Configurações → Assistente no WhatsApp: quais avisos a pessoa logada recebe no
// celular (pelo WhatsApp da empresa) e a chave PIX usada após o aceite da proposta.

type Cfg = { avisos: string[]; tipos: { id: string; nome: string }[]; telefone: string | null; recebe: boolean; pix_chave: string };

const card: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, overflow: 'hidden' };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 };

export default function AssistenteWhatsapp() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    apiClient.getAssistenteConfig().then(r => setCfg(r.data.data)).catch(() => setMsg({ ok: false, texto: 'Não foi possível carregar.' }));
  }, []);

  if (!cfg) return null;

  const alternar = (id: string) => setCfg(c => c && ({ ...c, avisos: c.avisos.includes(id) ? c.avisos.filter(a => a !== id) : [...c.avisos, id] }));
  const salvar = async () => {
    setSalvando(true); setMsg(null);
    try {
      await apiClient.salvarAssistenteConfig({ avisos: cfg.avisos, pix_chave: cfg.pix_chave });
      setMsg({ ok: true, texto: 'Salvo.' });
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.response?.data?.message || 'Não foi possível salvar.' });
    } finally { setSalvando(false); }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={16} color="#15803d" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Assistente no WhatsApp</h2>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
            Mande <b>hoje</b>, <b>semana</b>, <b>propostas paradas</b> ou <b>cliente 381</b> do seu celular para o WhatsApp da empresa e o CRM responde.
          </p>
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!cfg.recebe && (
          <p style={{ fontSize: 12, color: '#b45309' }}>
            Seu telefone {cfg.telefone ? `(${cfg.telefone})` : ''} não está cadastrado ou incompleto no seu usuário. Ajuste em Usuários para usar os comandos e receber avisos.
          </p>
        )}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)', marginBottom: 8 }}>Avisos que eu quero receber no celular</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {cfg.tipos.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)' }}>
                <input id={`aviso-${t.id}`} type="checkbox" checked={cfg.avisos.includes(t.id)} onChange={() => alternar(t.id)} /> {t.nome}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="pix-chave" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)', marginBottom: 6 }}>Chave PIX da empresa</label>
          <input id="pix-chave" style={input} value={cfg.pix_chave} placeholder="CNPJ, e-mail, telefone ou chave aleatória"
            onChange={e => setCfg(c => c && ({ ...c, pix_chave: e.target.value }))} />
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
            Enviada ao cliente depois que ele aceita a proposta pelo WhatsApp. Sem chave, ele recebe &quot;o financeiro vai te enviar a cobrança da entrada&quot;.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={salvar} disabled={salvando}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--t-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</span>}
        </div>
      </div>
    </div>
  );
}
