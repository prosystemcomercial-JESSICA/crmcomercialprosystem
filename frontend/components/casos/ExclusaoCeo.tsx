'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Churn → CEO (pedido da Jessica, 15/10/2026): selecionar clientes perdidos e enviar ao CEO para
// retirar o cadastro do suporte e suspender as cobranças. O CEO marca as duas confirmações aqui.

interface Registro {
  enviado_em: string; enviado_por_nome: string; observacao?: string | null; canal?: 'whatsapp' | 'pdf';
  suporte_em?: string | null; suporte_por_nome?: string | null;
  cobranca_em?: string | null; cobranca_por_nome?: string | null;
}
interface Item {
  id: string; status: string; motivo: string | null; perdido_em: string | null;
  cliente: { id: string; codigo: string | null; nome: string; razao_social: string | null; cnpj: string | null; grupo_tecnico: string | null; mensalidade: number | null; valor_devido: number | null };
  situacao: 'NAO_ENVIADO' | 'ENVIADO' | 'CONCLUIDO';
  registro: Registro | null;
}

const real = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (v?: string | null) => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
const cnpjFmt = (c: string | null) => { const d = (c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (c || ''); };
const STATUS: Record<string, string> = { PERDIDO: 'Perdido', SISTEMA_REMOVIDO: 'Sistema removido', AGUARDANDO_EXCLUSAO: 'Aguardando exclusão', FINALIZADO: 'Finalizado' };

// podeConfirmar: gestão (CEO, ADMIN, SUPERVISAO_COMERCIAL). Quem só tem o módulo Churn (ex.: Ana Clara) seleciona e envia.
export default function ExclusaoCeo({ podeConfirmar = true }: { podeConfirmar?: boolean }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [verConcluidos, setVerConcluidos] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try { const r = await apiClient.getExclusaoChurn(); setItens(r.data?.data || []); }
    catch (e: any) { setErro(e?.response?.data?.message || 'Não foi possível carregar os casos.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const paraEnviar = useMemo(() => itens.filter(i => i.situacao === 'NAO_ENVIADO'), [itens]);
  const enviados = useMemo(() => itens.filter(i => i.situacao === 'ENVIADO'), [itens]);
  const concluidos = useMemo(() => itens.filter(i => i.situacao === 'CONCLUIDO'), [itens]);
  const selecionados = paraEnviar.filter(i => sel.has(i.id));
  const somaSel = selecionados.reduce((t, i) => t + (i.cliente.mensalidade || 0), 0);

  const alternar = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todos = sel.size > 0 && paraEnviar.every(i => sel.has(i.id));

  // Baixa o PDF (identidade Prosystem) no navegador.
  async function baixarPdf(ids: string[], observacao: string) {
    const r = await apiClient.relatorioExclusaoPdf(ids, observacao);
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = `Churn_suporte_cobrancas_${new Date().toLocaleDateString('sv-SE')}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  // Erro de resposta em blob (PDF) vem como Blob: lê a mensagem do JSON.
  async function mensagemErro(e: any, padrao: string) {
    const d = e?.response?.data;
    if (d instanceof Blob) { try { return JSON.parse(await d.text())?.message || padrao; } catch { return padrao; } }
    return d?.message || padrao;
  }

  // Duas opções (15/10/2026): relatório em PDF para mandar no Teams ou a lista por WhatsApp.
  async function enviar(canal: 'pdf' | 'whatsapp') {
    if (!selecionados.length || enviando) return;
    const n = selecionados.length;
    const pergunta = canal === 'pdf'
      ? `Gerar o relatório em PDF de ${n} cliente(s) para mandar ao CEO no Teams?\n\nEles passam para "Com o CEO", para acompanhar as confirmações. Nenhum WhatsApp é enviado.`
      : `Enviar ${n} cliente(s) ao CEO por WhatsApp para retirar do suporte e suspender as cobranças?`;
    if (!confirm(pergunta)) return;
    setEnviando(true); setAviso(''); setErro('');
    const ids = selecionados.map(i => i.id);
    try {
      if (canal === 'pdf') await baixarPdf(ids, obs.trim()); // primeiro o PDF: se falhar, nada muda no CRM
      const r = await apiClient.enviarExclusaoAoCeo(ids, obs.trim(), canal);
      const d = r.data?.data || {};
      setAviso(canal === 'pdf'
        ? `Relatório baixado com ${d.enviados} cliente(s). Poste o PDF no Teams para o CEO. Eles estão em "Com o CEO" para as confirmações.`
        : `${d.enviados} cliente(s) enviado(s). ${d.avisados?.length ? `Aviso no WhatsApp para ${d.avisados.join(', ')}.` : 'O WhatsApp do CEO não recebeu o aviso: ele vê a lista aqui, na aba Exclusões.'}`);
      setSel(new Set()); setObs('');
      await carregar();
    } catch (e: any) { setErro(await mensagemErro(e, canal === 'pdf' ? 'Não foi possível gerar o relatório.' : 'Não foi possível enviar.')); }
    finally { setEnviando(false); }
  }

  // Baixa de novo o relatório de quem está com o CEO (não muda nada no CRM).
  async function baixarPendentes() {
    if (!enviados.length || enviando) return;
    setEnviando(true); setErro('');
    try { await baixarPdf(enviados.map(i => i.id), ''); }
    catch (e: any) { setErro(await mensagemErro(e, 'Não foi possível gerar o relatório.')); }
    finally { setEnviando(false); }
  }

  async function marcar(i: Item, campo: 'suporte' | 'cobranca', feito: boolean) {
    setSalvando(`${i.id}.${campo}`); setErro('');
    try {
      const r = await apiClient.marcarExclusaoChurn(i.id, campo, feito);
      const d = r.data?.data;
      setItens(lista => lista.map(x => x.id === i.id ? { ...x, situacao: d.situacao, registro: d.registro } : x));
    } catch (e: any) { setErro(e?.response?.data?.message || 'Não foi possível salvar.'); }
    finally { setSalvando(null); }
  }

  const muted = { color: 'var(--t-text-muted)' } as const;
  const card = 'ps-card rounded-2xl p-4';
  const borda = { border: '1px solid var(--t-card-border)' } as const;

  const Cliente = ({ i }: { i: Item }) => (
    <div className="min-w-0">
      <p className="font-semibold text-sm truncate">{i.cliente.codigo ? `${i.cliente.codigo} · ` : ''}{i.cliente.nome}</p>
      <p className="text-xs truncate" style={muted}>
        {[cnpjFmt(i.cliente.cnpj), i.cliente.grupo_tecnico, `${STATUS[i.status] || i.status}${i.perdido_em ? ` em ${data(i.perdido_em)}` : ''}`].filter(Boolean).join(' · ')}
      </p>
      {i.motivo && <p className="text-xs mt-0.5 line-clamp-2" style={muted}>Motivo: {i.motivo}</p>}
    </div>
  );

  const Confirmacoes = ({ i }: { i: Item }) => (
    <div className="flex flex-col gap-1.5 text-sm sm:items-end">
      {(['suporte', 'cobranca'] as const).map(campo => {
        const em = campo === 'suporte' ? i.registro?.suporte_em : i.registro?.cobranca_em;
        const por = campo === 'suporte' ? i.registro?.suporte_por_nome : i.registro?.cobranca_por_nome;
        return (
          <label key={campo} className={`flex items-center gap-2 select-none ${podeConfirmar ? 'cursor-pointer' : 'opacity-70'}`} title={podeConfirmar ? undefined : 'Quem confirma é o CEO ou a gestão'}>
            <input type="checkbox" className="w-4 h-4" checked={!!em} disabled={!podeConfirmar || salvando === `${i.id}.${campo}`}
              onChange={e => marcar(i, campo, e.target.checked)} />
            <span>{campo === 'suporte' ? 'Retirado do suporte' : 'Cobrança suspensa'}</span>
            {em && <span className="text-xs" style={muted}>{data(em)}{por ? ` · ${por.split(' ')[0]}` : ''}</span>}
          </label>
        );
      })}
    </div>
  );

  if (carregando) return <div className={card} style={borda}><p className="text-sm" style={muted}>Carregando casos perdidos…</p></div>;

  return (
    <div className="space-y-5">
      {erro && <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">{erro}</div>}
      {aviso && <div className="rounded-xl px-4 py-3 text-sm bg-green-50 text-green-800 border border-green-200">{aviso}</div>}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { l: 'Para enviar ao CEO', v: paraEnviar.length, cor: '#475569' },
          { l: 'Com o CEO (falta confirmar)', v: enviados.length, cor: '#D97706' },
          { l: 'Concluídos', v: concluidos.length, cor: '#16A34A' },
        ].map(k => (
          <div key={k.l} className="ps-card rounded-2xl p-3 sm:p-4" style={borda}>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide leading-tight" style={muted}>{k.l}</p>
            <p className="text-xl sm:text-2xl font-extrabold mt-1" style={{ color: k.cor }}>{k.v}</p>
          </div>
        ))}
      </div>

      <section className={card} style={borda}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-bold">Selecionar e enviar ao CEO</p>
            <p className="text-xs" style={muted}>Casos perdidos que ainda não foram enviados. Gere o relatório em PDF para mandar no Teams ou envie a lista ao CEO por WhatsApp.</p>
          </div>
          {paraEnviar.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(paraEnviar.map(i => i.id)))} />
              Selecionar todos
            </label>
          )}
        </div>
        {paraEnviar.length === 0
          ? <p className="text-sm py-2" style={muted}>Nenhum caso perdido esperando envio. Para enviar um cliente, marque o caso como Perdido no Kanban.</p>
          : <ul className="divide-y" style={{ borderColor: 'var(--t-card-border)' }}>
            {paraEnviar.map(i => (
              <li key={i.id} className="py-2.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 mt-1 shrink-0" checked={sel.has(i.id)} onChange={() => alternar(i.id)} />
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                    <Cliente i={i} />
                    <div className="text-xs sm:text-right shrink-0" style={muted}>
                      <p>{real(i.cliente.mensalidade)}/mês</p>
                      {i.cliente.valor_devido ? <p>deve {real(i.cliente.valor_devido)}</p> : null}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>}
        {paraEnviar.length > 0 && (
          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--t-card-border)' }}>
            <textarea value={obs} onChange={e => setObs(e.target.value)} maxLength={500} rows={2}
              placeholder="Observação para o CEO (opcional). Ex.: conferir o boleto de outubro antes de suspender."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm" style={muted}>{selecionados.length ? `${selecionados.length} selecionado(s) · ${real(somaSel)}/mês` : 'Nenhum selecionado'}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => enviar('pdf')} disabled={!selecionados.length || enviando}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
                  {enviando ? 'Gerando…' : `📄 Gerar relatório PDF${selecionados.length ? ` (${selecionados.length})` : ''}`}
                </button>
                <button onClick={() => enviar('whatsapp')} disabled={!selecionados.length || enviando}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-200 disabled:opacity-50">
                  📲 Enviar por WhatsApp
                </button>
              </div>
            </div>
            <p className="text-xs" style={muted}>PDF: você baixa o relatório (com as observações de cada cliente) e manda no Teams; nenhum WhatsApp sai. WhatsApp: o CEO recebe a lista no número dele. Nos dois, os clientes passam para "Com o CEO".</p>
          </div>
        )}
      </section>

      <section className={card} style={borda}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">Com o CEO</p>
          {enviados.length > 0 && (
            <button onClick={baixarPendentes} disabled={enviando} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 disabled:opacity-50">
              📄 Baixar relatório dos pendentes
            </button>
          )}
        </div>
        <p className="text-xs mb-3" style={muted}>{podeConfirmar ? 'Marque quando o cadastro sair do suporte e quando a cobrança for suspensa. Com as duas marcadas, quem enviou recebe a confirmação.' : 'Acompanhe aqui: o CEO marca quando o cadastro sair do suporte e quando a cobrança for suspensa. Com as duas marcadas, você recebe a confirmação.'}</p>
        {enviados.length === 0
          ? <p className="text-sm py-2" style={muted}>Nada pendente com o CEO.</p>
          : <ul className="divide-y" style={{ borderColor: 'var(--t-card-border)' }}>
            {enviados.map(i => (
              <li key={i.id} className="py-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0">
                  <Cliente i={i} />
                  <p className="text-xs mt-0.5" style={muted}>
                    Enviado por {i.registro?.enviado_por_nome} em {data(i.registro?.enviado_em)} {i.registro?.canal === 'pdf' ? '(relatório PDF, Teams)' : '(WhatsApp)'} · {real(i.cliente.mensalidade)}/mês
                    {i.registro?.observacao ? ` · Obs.: ${i.registro.observacao}` : ''}
                  </p>
                </div>
                <Confirmacoes i={i} />
              </li>
            ))}
          </ul>}
      </section>

      {concluidos.length > 0 && (
        <section className={card} style={borda}>
          <button onClick={() => setVerConcluidos(v => !v)} className="text-sm font-bold">
            {verConcluidos ? '▾' : '▸'} Concluídos ({concluidos.length})
          </button>
          {verConcluidos && (
            <ul className="divide-y mt-2" style={{ borderColor: 'var(--t-card-border)' }}>
              {concluidos.map(i => (
                <li key={i.id} className="py-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <Cliente i={i} />
                  <Confirmacoes i={i} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
