'use client';

// Kanban dos serviços (cross-sell): cada venda é um card que a vendedora arrasta pelas fases.
// A venda fica pendente até "Enviado ao Thiago": aí é confirmada e a comissão vai para o mês
// seguinte a essa data. Aceite pede nome completo e CPF do autorizador.

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/Toast';

type Card = {
  id: string; etapa: string | null; valor_venda: number | null; descricao_servico: string | null; observacoes: string | null;
  autorizador_nome: string | null; autorizador_cpf: string | null; vendedor_nome: string | null; status: string; created_at: string;
  cliente?: { nome?: string | null; empresa?: string | null } | null;
  data_venda?: string | null; parceiro?: { nome?: string | null; categoria?: string | null } | null;
  enviado_em?: string | null; aceite_em?: string | null; execucao_em?: string | null; concluido_em?: string | null; financeiro_em?: string | null; lancado_em?: string | null;
};

const FASES: { k: string; rot: string; cor: string; dica: string }[] = [
  { k: 'ORCAMENTO', rot: 'Orçamento', cor: '#64748b', dica: 'Copie o orçamento e envie ao cliente' },
  { k: 'ENVIADO', rot: 'Enviado ao cliente', cor: '#2563eb', dica: 'Aguardando o aceite' },
  { k: 'ACEITO', rot: 'Aceito', cor: '#7c3aed', dica: 'Encaminhe para execução' },
  { k: 'EM_EXECUCAO', rot: 'Em execução', cor: '#d97706', dica: 'Aguardando a conclusão' },
  { k: 'CONCLUIDO', rot: 'Concluído', cor: '#0d9488', dica: 'Envie ao Thiago' },
  { k: 'NO_FINANCEIRO', rot: 'Enviado ao Thiago', cor: '#0891b2', dica: 'Venda confirmada · comissão no mês seguinte' },
  { k: 'LANCADO', rot: 'Lançado', cor: '#16a34a', dica: 'Thiago lançou no financeiro' },
];
const DATA_DA_FASE: Record<string, keyof Card> = { ENVIADO: 'enviado_em', ACEITO: 'aceite_em', EM_EXECUCAO: 'execucao_em', CONCLUIDO: 'concluido_em', NO_FINANCEIRO: 'financeiro_em', LANCADO: 'lancado_em' };
const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dias = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)) : null);

export default function KanbanServicos({ onNovaVenda, versao }: { onNovaVenda: () => void; versao?: number }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Card | null>(null);
  const [nota, setNota] = useState('');

  const carregar = useCallback(async () => {
    try {
      // Todas as vendas do cross-sell (serviço, comunicação, integradora...). Venda sem fase entra
      // pela situação: pendente → Orçamento; confirmada → Enviado ao Thiago; paga → Lançado.
      const r = await apiClient.getVendasAdicionais({});
      const lista = (r.data.data?.vendas || r.data.data || []) as Card[];
      const limiteLancado = Date.now() - 60 * 864e5;
      setCards(lista
        .filter(v => v.status !== 'CANCELADO' && v.etapa !== 'RECUSADO')
        .map(v => ({ ...v, etapa: v.etapa || (v.status === 'PAGA' ? 'LANCADO' : v.status === 'CONFIRMADA' ? 'NO_FINANCEIRO' : 'ORCAMENTO') }))
        .filter(v => v.etapa !== 'LANCADO' || new Date(v.lancado_em || v.data_venda || v.created_at).getTime() >= limiteLancado));
    } catch { setCards([]); }
  }, []);
  useEffect(() => { carregar(); }, [carregar, versao]);

  const copiar = async (id: string, qual: 'orcamento' | 'financeiro') => {
    const r = await apiClient.textosVendaAdicional(id);
    await navigator.clipboard.writeText(r.data.data[qual]);
    showToast.success(qual === 'orcamento' ? 'Orçamento copiado' : 'Texto do Thiago copiado', qual === 'orcamento' ? 'Cole no WhatsApp do cliente.' : 'Cole no Teams para o Thiago.');
  };

  const mover = async (card: Card, etapa: string) => {
    if (card.etapa === etapa) return;
    const dados: any = { etapa };
    if (etapa === 'ACEITO' && !(card.autorizador_nome && card.autorizador_cpf)) {
      const nome = window.prompt('Nome completo de quem autorizou o orçamento:');
      if (!nome) return;
      const cpf = window.prompt('CPF de quem autorizou:');
      if (!cpf) return;
      dados.autorizador_nome = nome; dados.autorizador_cpf = cpf;
    }
    if (etapa === 'NO_FINANCEIRO') {
      if (!window.confirm('Serviço concluído e enviado ao Thiago?\n\nA venda é confirmada agora e a comissão entra no mês seguinte. O texto para o Teams será copiado.')) return;
      await copiar(card.id, 'financeiro').catch(() => {});
    }
    try {
      await apiClient.etapaVendaAdicional(card.id, dados);
      setCards(cs => cs && cs.map(c => (c.id === card.id ? { ...c, etapa } : c)));
      carregar();
    } catch (e: any) { showToast.error('Não deu certo', e?.response?.data?.message || 'Tente de novo.'); }
  };

  const salvarNota = async () => {
    if (!aberto || !nota.trim()) return;
    try {
      await apiClient.notaVendaAdicional(aberto.id, nota.trim());
      setNota('');
      await carregar();
      setAberto(a => a && { ...a, observacoes: `${a.observacoes ? `${a.observacoes}\n` : ''}[agora] ${nota.trim()}` });
    } catch { showToast.error('Não deu certo', 'Tente de novo.'); }
  };

  const recusar = async (card: Card) => {
    const motivo = window.prompt(`Por que ${nomeCli(card)} recusou o orçamento?\n(ex.: preço, já resolveu com outro, não precisa agora, sem retorno)`);
    if (!motivo || !motivo.trim()) return;
    try {
      await apiClient.etapaVendaAdicional(card.id, { etapa: 'RECUSADO', motivo: motivo.trim() });
      showToast.success('Recusa registrada', 'O card saiu do kanban e o motivo ficou salvo.');
      setAberto(null);
      carregar();
    } catch (e: any) { showToast.error('Não deu certo', e?.response?.data?.message || 'Tente de novo.'); }
  };

  const salvarDataVenda = async (card: Card, valor: string) => {
    if (!valor) return;
    try {
      await apiClient.updateVendaAdicional(card.id, { data_venda: valor });
      showToast.success('Data da venda atualizada', 'Em venda de mês anterior, as fases e a comissão seguem essa data.');
      setAberto(a => a && { ...a, data_venda: `${valor}T12:00:00-03:00` });
      carregar();
    } catch (e: any) { showToast.error('Não deu certo', e?.response?.data?.message || 'Tente de novo.'); }
  };

  const nomeCli = (c: Card) => (c.cliente?.empresa || c.cliente?.nome || 'Cliente').trim();

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>🛠️ Serviços em andamento</b>
          <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Arraste o card de fase em fase. Até &quot;Enviado ao Thiago&quot; a venda fica pendente; ali ela é confirmada e a comissão entra no mês seguinte.</p>
        </div>
        <button onClick={onNovaVenda} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Nova venda</button>
      </div>

      {cards === null ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</p> : (
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(220px, 1fr)', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {FASES.map(f => {
            const daFase = cards.filter(c => (c.etapa || 'ORCAMENTO') === f.k);
            return (
              <div key={f.k}
                onDragOver={e => { e.preventDefault(); setSobre(f.k); }}
                onDragLeave={() => setSobre(s => (s === f.k ? null : s))}
                onDrop={e => { e.preventDefault(); setSobre(null); const c = cards.find(x => x.id === arrastando); if (c) mover(c, f.k); setArrastando(null); }}
                style={{ background: sobre === f.k ? `${f.cor}14` : 'var(--t-content-bg)', border: `1px solid ${sobre === f.k ? f.cor : 'var(--t-card-border)'}`, borderRadius: 12, padding: 10, minHeight: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: f.cor }} />
                  <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{f.rot}</b>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: f.cor }}>{daFase.length}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: -4 }}>{f.dica}</span>
                {daFase.map(c => {
                  const d = dias((c[DATA_DA_FASE[f.k]] as string) || c.created_at);
                  return (
                    <div key={c.id} draggable onDragStart={() => setArrastando(c.id)} onDragEnd={() => setArrastando(null)} onClick={() => setAberto(c)}
                      style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderLeft: `3px solid ${f.cor}`, borderRadius: 10, padding: 10, cursor: 'grab', opacity: arrastando === c.id ? 0.5 : 1, display: 'grid', gap: 4 }}>
                      <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{nomeCli(c)}</b>
                      <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.descricao_servico || c.parceiro?.nome || 'Serviço'}</span>
                      {c.data_venda && <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>📅 venda em {new Date(c.data_venda).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <b style={{ color: 'var(--t-text-primary)' }}>{brl(c.valor_venda)}</b>
                        <span style={{ color: d != null && d >= 5 && f.k !== 'LANCADO' ? '#dc2626' : 'var(--t-text-muted)' }}>{d == null ? '' : d === 0 ? 'hoje' : `${d}d nesta fase`}</span>
                      </div>
                      {c.observacoes && <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>💬 {c.observacoes.split('\n').length} observação(ões)</span>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        {['ORCAMENTO', 'ENVIADO'].includes(f.k) && <button onClick={() => copiar(c.id, 'orcamento')} style={btnMini}>📋 Orçamento</button>}
                        {['CONCLUIDO', 'NO_FINANCEIRO', 'LANCADO'].includes(f.k) && <button onClick={() => copiar(c.id, 'financeiro')} style={btnMini}>📋 Texto do Thiago</button>}
                        {['ORCAMENTO', 'ENVIADO'].includes(f.k) && <button onClick={() => recusar(c)} style={{ ...btnMini, borderColor: '#fca5a5', color: '#dc2626' }}>✖ Recusou</button>}
                      </div>
                    </div>
                  );
                })}
                {!daFase.length && <span style={{ fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'center', marginTop: 20 }}>Arraste um card para cá</span>}
              </div>
            );
          })}
        </div>
      )}

      {aberto && (
        <div role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setAberto(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 520, background: 'var(--t-card-bg)', borderRadius: 16, padding: 18, display: 'grid', gap: 10, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>{nomeCli(aberto)}</b>
              <button onClick={() => setAberto(null)} aria-label="Fechar" style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', display: 'grid', gap: 4 }}>
              <span><b>Demanda:</b> {aberto.descricao_servico || '—'}</span>
              <span><b>Valor:</b> {brl(aberto.valor_venda)} · <b>Vendedor:</b> {aberto.vendedor_nome || '—'}</span>
              <span><b>Fase:</b> {FASES.find(x => x.k === (aberto.etapa || 'ORCAMENTO'))?.rot}</span>
              {aberto.autorizador_nome && <span><b>Autorizado por:</b> {aberto.autorizador_nome} · CPF {aberto.autorizador_cpf}</span>}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <b>Data da venda:</b>
                <input type="date" defaultValue={(aberto.data_venda || aberto.created_at || '').slice(0, 10)} onChange={e => salvarDataVenda(aberto, e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }} />
              </label>
              <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Venda retroativa: coloque a data real e depois arraste o card até a fase certa. As datas e o mês da comissão seguem essa data.</span>
            </div>
            <div>
              <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>Observações</b>
              <div style={{ marginTop: 6, display: 'grid', gap: 4, fontSize: 12, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap' }}>
                {aberto.observacoes ? aberto.observacoes.split('\n').map((l, i) => <div key={i} style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '6px 8px' }}>{l}</div>) : <span style={{ color: 'var(--t-text-muted)' }}>Nenhuma ainda.</span>}
              </div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Ex.: cliente pediu para agendar a migração na sexta à tarde"
                style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }} />
              <button onClick={salvarNota} disabled={!nota.trim()} style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: nota.trim() ? 1 : 0.5 }}>Adicionar observação</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--t-text-muted)', alignSelf: 'center' }}>Mover para:</span>
              {FASES.filter(x => x.k !== (aberto.etapa || 'ORCAMENTO')).map(x => (
                <button key={x.k} onClick={async () => { await mover(aberto, x.k); setAberto(null); }} style={{ ...btnMini, borderColor: x.cor, color: x.cor }}>{x.rot}</button>
              ))}
              <button onClick={() => recusar(aberto)} style={{ ...btnMini, borderColor: '#fca5a5', color: '#dc2626' }}>✖ Cliente recusou</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnMini: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-secondary)', cursor: 'pointer' };
