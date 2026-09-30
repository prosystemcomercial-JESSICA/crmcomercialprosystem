'use client';

// Painel da Joana (jornalista): o Informativo Prosystem quinzenal. Ela escreve a partir das
// pesquisas da Sofia; a gestão lê e aprova; aí sai: e-mail para clientes ativos e para a lista,
// WhatsApp só para a lista (pelo Zequinha, no ritmo seguro). Nada sai sem aprovação.

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Texto } from './PainelRafael';

type Edicao = { assunto_clientes: string; email_clientes: string; assunto_lista: string; email_lista: string; whatsapp_lista: string };
type Item = { id: string; titulo: string; status: string; criado_em: string; edicao: Edicao | null; envio: { total: number; enviados: number; falhas: number; whatsapp: number } | null };
const COR = '#c2410c';
const VERSOES = [
  { k: 'clientes', r: '📧 Clientes (e-mail)' }, { k: 'lista', r: '📧 Lista (e-mail)' }, { k: 'whatsapp', r: '💬 Lista (WhatsApp)' },
] as const;

export default function PainelJoana() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [escrevendo, setEscrevendo] = useState(false);
  const [sel, setSel] = useState(0);
  const [versao, setVersao] = useState<'clientes' | 'lista' | 'whatsapp'>('clientes');
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = useCallback(() => apiClient.joanaEdicoes().then(r => { setItens(r.data.data.edicoes); setEscrevendo(r.data.data.escrevendo); }).catch(() => setItens([])), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const acao = async (fn: () => Promise<any>) => { try { const r = await fn(); setMsg(r.data?.message || 'Pronto.'); } catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo.'); } carregar(); };
  const btn = (fundo: string, cor = '#fff'): React.CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: fundo, color: cor, fontSize: 13, fontWeight: 700, cursor: 'pointer' });
  const it = itens?.[sel] || null;
  const e = it?.edicao;

  return (
    <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${COR}`, borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>📰 Joana · Jornalista do Informativo Prosystem</b>
          <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
            Escreve a cada 15 dias (quinta de manhã) a partir das pesquisas da Sofia. Clientes ativos recebem por e-mail; a lista Informativo recebe por e-mail e WhatsApp (pelo Zequinha, no ritmo seguro). Só sai depois da sua aprovação.
          </p>
        </div>
        <button onClick={() => acao(() => apiClient.joanaEscrever())} disabled={escrevendo} style={btn(COR)}>✍️ {escrevendo ? 'Escrevendo…' : 'Escrever edição agora'}</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{msg}</div>}

      {itens === null ? <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</div> : !it ? (
        <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma edição ainda. Clique em &quot;Escrever edição agora&quot;.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={sel} onChange={ev => setSel(Number(ev.target.value))} style={{ fontSize: 13, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
              {itens.map((x, i) => <option key={x.id} value={i}>{x.titulo}</option>)}
            </select>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: it.status === 'APROVADO' ? '#dcfce7' : '#fef3c7', color: it.status === 'APROVADO' ? '#166534' : '#92400e' }}>
              {it.status === 'APROVADO' ? 'Aprovada e publicada' : 'Esperando sua aprovação'}
            </span>
            {it.envio && (
              <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
                E-mails: <b>{it.envio.enviados}</b>/{it.envio.total}{it.envio.falhas ? ` · ${it.envio.falhas} falha(s)` : ''} · WhatsApp na fila do Zequinha: <b>{it.envio.whatsapp}</b>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist">
            {VERSOES.map(v => (
              <button key={v.k} role="tab" aria-selected={versao === v.k} onClick={() => setVersao(v.k)}
                style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: versao === v.k ? COR : 'var(--t-card-bg)', color: versao === v.k ? '#fff' : 'var(--t-text-secondary)' }}>{v.r}</button>
            ))}
          </div>

          {e && (
            <div style={{ border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 14, background: 'var(--t-content-bg)', display: 'grid', gap: 8 }}>
              {versao === 'whatsapp' ? (
                <div style={{ justifySelf: 'start', maxWidth: 460, background: '#dcf8c6', color: '#111', borderRadius: 10, padding: '8px 12px', fontSize: 14, whiteSpace: 'pre-wrap' }}>{e.whatsapp_lista}</div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Assunto: <b style={{ color: 'var(--t-text-primary)' }}>{versao === 'clientes' ? e.assunto_clientes : e.assunto_lista}</b></div>
                  <Texto md={versao === 'clientes' ? e.email_clientes : e.email_lista} />
                </>
              )}
            </div>
          )}

          {it.status === 'PROPOSTO' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btn('#16a34a')} onClick={() => {
                if (window.confirm('Aprovar e enviar o Informativo?\n\n• Clientes ativos: e-mail (em lotes nos dias úteis)\n• Lista Informativo: e-mail + WhatsApp pelo Zequinha (ritmo seguro)\n\nDepois de aprovado não dá para desfazer os envios já feitos.')) acao(() => apiClient.joanaAprovar(it.id));
              }}>✅ Aprovar e enviar</button>
              <button style={btn('var(--t-content-bg)', '#dc2626')} onClick={() => acao(() => apiClient.joanaArquivar(it.id))}>Arquivar</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
