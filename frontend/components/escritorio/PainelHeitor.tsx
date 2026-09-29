'use client';

// Painel do Heitor (prospectador): onde ele está (onda, cidade, bairro), quanto já encontrou,
// quem virou lead com WhatsApp e o motivo de quem ficou de fora. A primeira mensagem é da Caroline.

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Item = { id: string; nome: string; segmento: string | null; cidade: string | null; bairro: string | null; status: string; motivo: string | null; whatsapp: string | null; telefone: string | null; nota: number | null; avaliacoes: number | null; instagram: string | null; site: string | null; emails: string[] | null; cnpj: string | null; razao_social: string | null; lead_id: string | null; updated_at: string };
type Painel = {
  config: { ativo: boolean; cadastros_dia: number; envios_dia: number; segmentos: string[]; ultima_rodada: string | null; ultimo_erro: string | null };
  rodando: boolean;
  posicao: { onda: number; regiao: string; cidade: string; bairro: string | null; bairros_total: number | null; bairro_numero: number | null } | null;
  progresso: { cidades_feitas: number; cidades_total: number };
  ondas: { numero: number; nome: string; cidades: number; situacao: string }[];
  por_status: Record<string, number>;
  hoje: { cadastrados: number; enviados: number; na_fila_caroline: number };
  caroline: { ativa: boolean; aprovar: boolean };
  recentes: Item[];
};

const COR = '#65a30d';
const STATUS: Record<string, { r: string; cor: string }> = {
  CADASTRADO: { r: 'Virou lead', cor: '#16a34a' }, NOVO: { r: 'Conferindo', cor: '#2563eb' }, SEM_WHATSAPP: { r: 'Sem WhatsApp', cor: '#b45309' },
  JA_NO_CRM: { r: 'Já no CRM', cor: '#6b7280' }, REDE: { r: 'Rede grande', cor: '#6b7280' }, FORA_DO_PERFIL: { r: 'Fora do perfil', cor: '#6b7280' }, FECHADO: { r: 'Fechado', cor: '#dc2626' },
};
const hora = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function PainelHeitor() {
  const [p, setP] = useState<Painel | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('CADASTRADO');
  const carregar = useCallback(() => apiClient.heitorPainel().then(r => setP(r.data.data)).catch(() => {}), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const acao = async (fn: () => Promise<any>) => { try { const r = await fn(); setMsg(r.data?.message || 'Pronto.'); } catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo.'); } carregar(); };
  const btn = (fundo: string, cor = '#fff'): React.CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: fundo, color: cor, fontSize: 13, fontWeight: 700, cursor: 'pointer' });
  const num = (v: number, r: string) => (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <b style={{ fontSize: 20, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</b>
      <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{r}</span>
    </div>
  );
  if (!p) return null;
  const c = p.config;
  const lista = p.recentes.filter(i => filtro === 'TODOS' || i.status === filtro);
  const pct = Math.round((p.progresso.cidades_feitas / Math.max(1, p.progresso.cidades_total)) * 100);

  return (
    <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${COR}`, borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>🧭 Heitor · Prospecção no Google Maps</b>
          <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Busca drogarias e padarias região por região, completa com site, redes, e-mail e dados da Receita, confere o WhatsApp e cadastra. A primeira mensagem é da Caroline, dentro do limite do número.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => acao(() => apiClient.heitorConfig({ ativo: !c.ativo }))} style={btn(c.ativo ? 'var(--t-content-bg)' : COR, c.ativo ? '#dc2626' : '#fff')}>{c.ativo ? 'Desligar' : 'Ligar o Heitor'}</button>
          <button onClick={() => acao(() => apiClient.heitorRodar())} disabled={p.rodando} style={btn('#0f766e')}>{p.rodando ? 'Buscando…' : 'Buscar agora'}</button>
        </div>
      </div>

      {!p.caroline.ativa && <div style={{ fontSize: 13, color: '#b45309' }}>⚠️ A Caroline está desligada: o Heitor cadastra, mas ninguém manda a primeira mensagem até ela ser ligada.</div>}
      {c.ultimo_erro && <div style={{ fontSize: 13, color: '#dc2626' }}>⚠️ {c.ultimo_erro}</div>}
      {msg && <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
        {num(p.hoje.cadastrados, `leads hoje (de ${c.cadastros_dia})`)}
        {num(p.hoje.enviados, `abordados hoje (até ${c.envios_dia})`)}
        {num(p.hoje.na_fila_caroline, 'esperando a Caroline')}
        {num(p.por_status.CADASTRADO || 0, 'leads no total')}
        {num(Object.values(p.por_status).reduce((a, b) => a + b, 0), 'estabelecimentos vistos')}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
          {p.posicao ? <>📍 Onda {p.posicao.onda} · {p.posicao.regiao} · <b style={{ color: 'var(--t-text-primary)' }}>{p.posicao.cidade}</b>{p.posicao.bairro_numero ? ` · bairro ${p.posicao.bairro_numero} de ${p.posicao.bairros_total}${p.posicao.bairro && p.posicao.bairro !== p.posicao.cidade.split('/')[0] ? ` (${p.posicao.bairro})` : ''}` : ''}</> : '✅ Todas as ondas concluídas.'}
          <span style={{ color: 'var(--t-text-muted)' }}> · última busca {hora(c.ultima_rodada)}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--t-content-bg)', overflow: 'hidden' }} aria-label={`${pct}% das cidades`}>
          <div style={{ width: `${pct}%`, height: '100%', background: COR }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {p.ondas.map(o => (
            <span key={o.numero} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, border: '1px solid var(--t-card-border)', color: o.situacao === 'em andamento' ? COR : 'var(--t-text-muted)', fontWeight: o.situacao === 'em andamento' ? 700 : 500 }}>
              {o.numero}. {o.nome} ({o.cidades}) {o.situacao === 'feita' ? '✓' : ''}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: 'var(--t-text-secondary)' }}>
        <label>Leads por dia <input type="number" min={1} max={60} defaultValue={c.cadastros_dia} onBlur={e => acao(() => apiClient.heitorConfig({ cadastros_dia: Number(e.target.value) }))} style={{ width: 60, minHeight: 32, marginLeft: 4 }} /></label>
        <label>Abordagens por dia <input type="number" min={0} max={30} defaultValue={c.envios_dia} onBlur={e => acao(() => apiClient.heitorConfig({ envios_dia: Number(e.target.value) }))} style={{ width: 60, minHeight: 32, marginLeft: 4 }} /></label>
        {(['farmacia', 'padaria'] as const).map(s => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={c.segmentos.includes(s)} onChange={e => {
              const novo = e.target.checked ? [...c.segmentos, s] : c.segmentos.filter(x => x !== s);
              if (novo.length) acao(() => apiClient.heitorConfig({ segmentos: novo }));
            }} />{s === 'farmacia' ? 'Drogarias e farmácias' : 'Padarias'}
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist">
        {['CADASTRADO', 'SEM_WHATSAPP', 'JA_NO_CRM', 'REDE', 'TODOS'].map(k => (
          <button key={k} role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)}
            style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: filtro === k ? COR : 'var(--t-card-bg)', color: filtro === k ? '#fff' : 'var(--t-text-secondary)' }}>
            {k === 'TODOS' ? 'Todos' : STATUS[k].r} ({k === 'TODOS' ? Object.values(p.por_status).reduce((a, b) => a + b, 0) : p.por_status[k] || 0})
          </button>
        ))}
      </div>

      {lista.length === 0 ? <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada aqui ainda. Ligue o Heitor ou toque em "Buscar agora".</div> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {lista.map(i => (
            <div key={i.id} style={{ border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 14, color: 'var(--t-text-primary)', overflowWrap: 'anywhere' }}>{i.nome}</b>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[i.status]?.cor || 'var(--t-text-muted)' }}>{STATUS[i.status]?.r || i.status}</span>
                {i.lead_id && <a href="/leads" style={{ fontSize: 12, color: COR, marginLeft: 'auto' }}>Ver na Central de Leads</a>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t-text-secondary)', overflowWrap: 'anywhere' }}>
                {[i.segmento, i.bairro ? `${i.bairro}, ${i.cidade}` : i.cidade, i.nota != null && `⭐ ${i.nota.toFixed(1).replace('.', ',')} (${i.avaliacoes || 0})`, i.whatsapp && `💬 ${i.whatsapp}`, !i.whatsapp && i.telefone && `☎️ ${i.telefone}`, i.razao_social, i.instagram && 'Instagram', i.emails?.length ? '✉️ e-mail' : null].filter(Boolean).join(' · ')}
              </div>
              {i.motivo && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{i.motivo}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
