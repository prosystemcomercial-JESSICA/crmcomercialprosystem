'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Card do cancelamento concluído (aba Exclusões › Concluídos, pedido da Jessica, 26/10/2026):
// fluxograma das etapas, dados do cliente, como terminou e a linha do tempo inteira. Só leitura.

interface Etapa { chave: string; rotulo: string; em: string | null; por?: string | null; opcional?: boolean }
interface Evento { origem: 'CASO' | 'CLIENTE'; tipo: string; titulo: string; detalhe: string | null; por: string | null; em: string }
interface Trilha {
  caso: {
    id: string; status: string; motivo: string | null; relato: string | null; aberto_em: string; perdido_em: string | null; sistema_removido_em: string | null;
    fin_situacao: string | null; fin_valor_atraso: number | null; fin_dias_atraso: number | null; fin_observacao: string | null;
    reneg_ativa: boolean; reneg_resultado: string | null; reaberto: boolean; diagnostico: string | null;
    planos: { titulo: string; descricao: string | null; status: string; created_at: string }[];
    acoes: { titulo: string; descricao: string | null; tipo: string; status: string; created_at: string }[];
  };
  cliente: {
    codigo: string | null; nome: string; razao_social: string | null; cnpj: string | null; cidade: string | null; segmento: string | null; plano: string | null;
    grupo_tecnico: string | null; responsavel: string | null; telefone: string | null; email: string | null; cliente_desde: string | null; dia_vencimento: number | null;
    mensalidade: number | null; valor_devido: number | null; motivo_inativacao: string | null; inativado_em: string | null;
  };
  registro: { enviado_em: string; enviado_por_nome: string; observacao?: string | null; canal?: 'whatsapp' | 'pdf' } | null;
  etapas: Etapa[];
  linha_do_tempo: Evento[];
}

const real = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (v?: string | null) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const diaHora = (v: string) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const cnpjFmt = (c: string | null) => { const d = (c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (c || '—'); };
const FIN: Record<string, string> = { EM_DIA: 'Em dia', EM_ATRASO: 'Em atraso', NEGOCIANDO: 'Negociando', INADIMPLENTE: 'Inadimplente' };
const ICONE: Record<string, string> = {
  OBSERVACAO: '📝', CONTATO: '📞', TENTATIVA: '📲', FINANCEIRO: '💵', STATUS: '🔄', SISTEMA: '⚙️',
  CHURN: '⚠️', DESATIVACAO: '⛔', RENEGOCIACAO: '🤝', REATIVACAO: '✅', MENSALIDADE: '💳', SERVICO: '🧰', TROCA_CNPJ: '🔁',
};
// Tempo de casa: de "cliente desde" até a saída.
const tempoDeCasa = (desde: string | null, ate: string | null) => {
  if (!desde) return null;
  const meses = Math.max(0, Math.round((new Date(ate || Date.now()).getTime() - new Date(desde).getTime()) / (30.44 * 86400000)));
  return meses >= 12 ? `${Math.floor(meses / 12)} ano(s)${meses % 12 ? ` e ${meses % 12} mês(es)` : ''}` : `${meses} mês(es)`;
};

function Campo({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-muted)' }}>{l}</p>
      <p className="text-sm break-words">{v || '—'}</p>
    </div>
  );
}

export default function TrilhaCancelamento({ casoId, onFechar }: { casoId: string; onFechar: () => void }) {
  const [t, setT] = useState<Trilha | null>(null);
  const [erro, setErro] = useState('');
  const [so, setSo] = useState<'TUDO' | 'CASO' | 'CLIENTE'>('TUDO');

  useEffect(() => {
    let vivo = true;
    apiClient.getTrilhaCancelamento(casoId)
      .then(r => { if (vivo) setT(r.data?.data || null); })
      .catch(e => { if (vivo) setErro(e?.response?.data?.message || 'Não foi possível carregar a trilha.'); });
    return () => { vivo = false; };
  }, [casoId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  const muted = { color: 'var(--t-text-muted)' } as const;
  const borda = { border: '1px solid var(--t-card-border)' } as const;

  const eventos = t ? t.linha_do_tempo.filter(e => so === 'TUDO' || e.origem === so) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-6 overflow-y-auto" style={{ background: 'rgba(15,23,42,.55)' }} onClick={onFechar}>
      <div className="w-full max-w-5xl rounded-2xl shadow-xl" style={{ background: 'var(--t-card-bg)', ...borda }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={muted}>Trilha do cancelamento</p>
            <h2 className="text-lg font-bold truncate">{t ? `${t.cliente.codigo ? `${t.cliente.codigo} · ` : ''}${t.cliente.nome}` : 'Carregando…'}</h2>
            {t && <p className="text-xs" style={muted}>{cnpjFmt(t.cliente.cnpj)}{t.cliente.razao_social && t.cliente.razao_social !== t.cliente.nome ? ` · ${t.cliente.razao_social}` : ''}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {t?.caso.status === 'FINALIZADO' && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">✅ Finalizado</span>}
            <button onClick={onFechar} className="text-xl leading-none px-2" style={muted} aria-label="Fechar">✕</button>
          </div>
        </div>

        {erro && <div className="m-5 rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">{erro}</div>}
        {!t && !erro && <p className="p-5 text-sm" style={muted}>Carregando a trilha…</p>}

        {t && (
          <div className="p-5 space-y-5">
            {/* Fluxograma: cada etapa do cancelamento, com data e quem fez */}
            <section>
              <p className="text-sm font-bold mb-3">Como terminou, etapa por etapa</p>
              <ol className="grid gap-2 sm:gap-0 sm:flex sm:items-stretch">
                {t.etapas.map((e, i) => {
                  const feito = !!e.em;
                  const pulou = !feito && e.opcional;
                  const cor = feito ? '#059669' : pulou ? '#94a3b8' : '#d97706';
                  return (
                    <li key={e.chave} className="flex sm:flex-col sm:flex-1 items-center sm:items-center gap-3 sm:gap-1.5 sm:text-center relative">
                      {i > 0 && <span className="hidden sm:block absolute top-4 right-1/2 w-full h-0.5 z-0" style={{ background: feito ? '#059669' : 'var(--t-card-border)' }} />}
                      <span className="relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: cor }}>
                        {feito ? '✓' : pulou ? '–' : i + 1}
                      </span>
                      <div className="min-w-0 sm:px-1">
                        <p className="text-xs font-bold leading-tight">{e.rotulo}</p>
                        <p className="text-[11px] leading-tight" style={muted}>{feito ? dia(e.em) : pulou ? 'não se aplicou' : 'pendente'}</p>
                        {e.por && feito && <p className="text-[11px] leading-tight" style={muted}>{e.por.split(' ')[0]}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl p-4" style={borda}>
                <p className="text-sm font-bold mb-3">Cliente</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Campo l="Cidade" v={t.cliente.cidade} />
                  <Campo l="Segmento / plano" v={[t.cliente.segmento, t.cliente.plano].filter(Boolean).join(' · ')} />
                  <Campo l="Técnico" v={t.cliente.grupo_tecnico} />
                  <Campo l="Responsável" v={t.cliente.responsavel} />
                  <Campo l="Telefone" v={t.cliente.telefone} />
                  <Campo l="E-mail" v={t.cliente.email} />
                  <Campo l="Cliente desde" v={t.cliente.cliente_desde ? `${dia(t.cliente.cliente_desde)} (${tempoDeCasa(t.cliente.cliente_desde, t.caso.perdido_em)})` : null} />
                  <Campo l="Vencimento" v={t.cliente.dia_vencimento ? `dia ${t.cliente.dia_vencimento}` : null} />
                  <Campo l="Mensalidade perdida" v={real(t.cliente.mensalidade)} />
                  <Campo l="Ficou devendo" v={real(t.cliente.valor_devido)} />
                  <Campo l="Inativado em" v={dia(t.cliente.inativado_em)} />
                  <Campo l="Sistema removido em" v={dia(t.caso.sistema_removido_em)} />
                </div>
              </section>

              <section className="rounded-xl p-4" style={borda}>
                <p className="text-sm font-bold mb-3">O caso</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Campo l="Aberto em" v={dia(t.caso.aberto_em)} />
                    <Campo l="Perdido em" v={dia(t.caso.perdido_em)} />
                    <Campo l="Financeiro" v={[t.caso.fin_situacao ? FIN[t.caso.fin_situacao] || t.caso.fin_situacao : null, t.caso.fin_valor_atraso ? real(t.caso.fin_valor_atraso) : null, t.caso.fin_dias_atraso ? `${t.caso.fin_dias_atraso} dias` : null].filter(Boolean).join(' · ')} />
                    <Campo l="Reaberto" v={t.caso.reaberto ? 'Sim, uma vez' : 'Não'} />
                  </div>
                  <Campo l="Motivo" v={t.caso.motivo} />
                  {t.caso.relato && <Campo l="Relato" v={<span className="whitespace-pre-wrap">{t.caso.relato}</span>} />}
                  {t.cliente.motivo_inativacao && t.cliente.motivo_inativacao !== t.caso.relato && <Campo l="Motivo da inativação" v={t.cliente.motivo_inativacao} />}
                  {t.caso.diagnostico && <Campo l="Diagnóstico" v={t.caso.diagnostico} />}
                  {t.caso.fin_observacao && <Campo l="Observação financeira" v={t.caso.fin_observacao} />}
                  {t.caso.reneg_ativa && <Campo l="Renegociação" v={t.caso.reneg_resultado || 'Houve acordo'} />}
                  {(t.caso.planos.length > 0 || t.caso.acoes.length > 0) && (
                    <Campo l="Plano e ações de retenção" v={
                      <ul className="list-disc pl-4 space-y-0.5">
                        {t.caso.planos.map((p, i) => <li key={`p${i}`}>{p.titulo} <span style={muted}>({p.status.toLowerCase()})</span></li>)}
                        {t.caso.acoes.map((a, i) => <li key={`a${i}`}>{a.titulo} <span style={muted}>({a.status.toLowerCase().replace('_', ' ')})</span></li>)}
                      </ul>
                    } />
                  )}
                  {t.registro && <Campo l="Envio ao CEO" v={`${t.registro.enviado_por_nome} em ${dia(t.registro.enviado_em)} ${t.registro.canal === 'pdf' ? '(relatório PDF, Teams)' : '(WhatsApp)'}${t.registro.observacao ? ` · Obs.: ${t.registro.observacao}` : ''}`} />}
                </div>
              </section>
            </div>

            {/* Linha do tempo: atualizações do caso + eventos da ficha do cliente, em ordem */}
            <section className="rounded-xl p-4" style={borda}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-bold">Linha do tempo ({eventos.length})</p>
                <div className="flex gap-1 text-xs">
                  {([['TUDO', 'Tudo'], ['CASO', 'Caso de churn'], ['CLIENTE', 'Ficha do cliente']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setSo(k)} className={`px-2.5 py-1 rounded-lg font-semibold ${so === k ? 'bg-blue-600 text-white' : ''}`} style={so === k ? undefined : borda}>{l}</button>
                  ))}
                </div>
              </div>
              {eventos.length === 0
                ? <p className="text-sm" style={muted}>Nada registrado.</p>
                : <ol className="relative pl-6" style={{ borderLeft: '2px solid var(--t-card-border)', marginLeft: 8 }}>
                  {eventos.map((e, i) => (
                    <li key={i} className="relative pb-3 last:pb-0">
                      <span className="absolute -left-[35px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: 'var(--t-card-bg)', ...borda }}>{ICONE[e.tipo] || '•'}</span>
                      <p className="text-xs" style={muted}>
                        {diaHora(e.em)}{e.por ? ` · ${e.por}` : ''} · <span className="font-semibold">{e.origem === 'CASO' ? 'caso' : 'ficha do cliente'}</span>
                      </p>
                      <p className="text-sm font-semibold">{e.titulo}</p>
                      {e.detalhe && <p className="text-xs whitespace-pre-wrap" style={muted}>{e.detalhe}</p>}
                    </li>
                  ))}
                </ol>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
