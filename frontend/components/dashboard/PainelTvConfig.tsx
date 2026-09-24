'use client';

import { useEffect, useState } from 'react';
import { Monitor, Save, Check, Copy, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// Seção "Painel da TV" de Configurações (só gestão): metas do painel e o link
// com token que a TV do comercial abre sem login.

type CampoMeta = 'meta_contratos_ano' | 'meta_servicos_ano' | 'meta_crosssell_ano' | 'meta_faturamento_mes';

const CAMPOS: Array<{ key: CampoMeta; label: string; dica: string }> = [
  { key: 'meta_contratos_ano', label: 'Meta de contratos no ano', dica: 'quantidade' },
  { key: 'meta_servicos_ano', label: 'Meta de vendas de serviços no ano', dica: 'R$' },
  { key: 'meta_crosssell_ano', label: 'Meta de cross-sell no ano', dica: 'R$' },
  { key: 'meta_faturamento_mes', label: 'Meta de faturamento do mês (instalação)', dica: 'R$' },
];

export default function PainelTvConfig() {
  const [metas, setMetas] = useState<Record<CampoMeta, string>>({ meta_contratos_ano: '', meta_servicos_ano: '', meta_crosssell_ano: '', meta_faturamento_mes: '' });
  const [chave, setChave] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    apiClient.getPainelTvConfig()
      .then(res => {
        const d = res.data.data;
        const m = d?.metas || {};
        setMetas({
          meta_contratos_ano: m.meta_contratos_ano != null ? String(m.meta_contratos_ano) : '',
          meta_servicos_ano: m.meta_servicos_ano != null ? String(m.meta_servicos_ano) : '',
          meta_crosssell_ano: m.meta_crosssell_ano != null ? String(m.meta_crosssell_ano) : '',
          meta_faturamento_mes: m.meta_faturamento_mes != null ? String(m.meta_faturamento_mes) : '',
        });
        setChave(d?.chave || null);
      })
      .catch(() => setMsg({ ok: false, texto: 'Não foi possível carregar a configuração do painel.' }))
      .finally(() => setCarregando(false));
  }, []);

  const link = chave && typeof window !== 'undefined' ? `${window.location.origin}/tv?chave=${chave}` : null;

  const salvar = async () => {
    const payload: Partial<Record<CampoMeta, number | null>> = {};
    for (const c of CAMPOS) {
      // "25.000,50" (pt-BR) ou "25000.5": com vírgula, ponto é milhar.
      const t = metas[c.key].trim();
      const bruto = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
      if (!bruto) { payload[c.key] = null; continue; }
      const n = Number(bruto);
      if (!Number.isFinite(n) || n < 0) { setMsg({ ok: false, texto: `Valor inválido em "${c.label}".` }); return; }
      payload[c.key] = n;
    }
    setSalvando(true); setMsg(null);
    try {
      await apiClient.salvarPainelTvConfig(payload);
      setMsg({ ok: true, texto: 'Metas salvas. A TV mostra na próxima atualização (até 1 min).' });
    } catch (err: any) {
      setMsg({ ok: false, texto: err?.response?.data?.message || 'Falha ao salvar as metas.' });
    } finally { setSalvando(false); }
  };

  const gerar = async () => {
    if (chave && !window.confirm('Gerar um novo link? O link atual para de funcionar e a TV precisará abrir o novo.')) return;
    setGerando(true); setMsg(null);
    try {
      const res = await apiClient.gerarChavePainelTv();
      setChave(res.data.data.chave);
      setMsg({ ok: true, texto: 'Novo link gerado. Abra-o na TV.' });
    } catch (err: any) {
      setMsg({ ok: false, texto: err?.response?.data?.message || 'Falha ao gerar o link.' });
    } finally { setGerando(false); }
  };

  const copiar = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setMsg({ ok: false, texto: 'Não foi possível copiar — selecione o link e copie manualmente.' }); }
  };

  const botao = (cor: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
    background: cor, color: '#fff', border: 'none', cursor: 'pointer',
  });

  return (
    <div id="painel-tv" style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px var(--t-card-shadow)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Monitor size={16} color="#2563eb" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Painel da TV</h2>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Painel do comercial para a TV, só leitura. Abre pelo link abaixo, sem login.</p>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {carregando ? (
          <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando...</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {CAMPOS.map(c => (
                <div key={c.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>
                    {c.label} <span style={{ fontWeight: 400 }}>({c.dica})</span>
                  </label>
                  <input
                    inputMode="decimal"
                    value={metas[c.key]}
                    onChange={e => setMetas(m => ({ ...m, [c.key]: e.target.value }))}
                    placeholder="vazio = sem meta"
                    className="ps-input w-full"
                  />
                </div>
              ))}
            </div>
            <button onClick={salvar} disabled={salvando} style={{ ...botao('#2563eb'), alignSelf: 'flex-start', opacity: salvando ? 0.7 : 1 }}>
              <Save size={13} /> {salvando ? 'Salvando...' : 'Salvar metas'}
            </button>

            <div style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)' }}>Link da TV</p>
              {link ? (
                <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--t-text-primary)', wordBreak: 'break-all' }}>{link}</p>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhum link gerado ainda.</p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {link && (
                  <>
                    <button onClick={copiar} style={botao('#475569')}>{copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar</>}</button>
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{ ...botao('#0891b2'), textDecoration: 'none' }}><ExternalLink size={13} /> Abrir</a>
                  </>
                )}
                <button onClick={gerar} disabled={gerando} style={{ ...botao('#b45309'), opacity: gerando ? 0.7 : 1 }}>
                  <RefreshCw size={13} /> {gerando ? 'Gerando...' : 'Gerar novo link'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Quem tiver o link vê o painel (números do comercial e primeiros nomes da equipe). Se ele vazar, gere um novo.</p>
            </div>
          </>
        )}

        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
            background: msg.ok ? '#dcfce7' : 'var(--t-error-bg)', color: msg.ok ? '#15803d' : 'var(--t-error)',
            border: `1px solid ${msg.ok ? '#86efac' : 'var(--t-error-border)'}`,
          }}>
            {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {msg.texto}
          </div>
        )}
      </div>
    </div>
  );
}
