// Resumo executivo por e-mail (diretoria): os mesmos números do painel da TV,
// "hoje" (tela 1) + "acumulado do ano" (tela 2). Puro: recebe os dados prontos.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ORIGEM: Record<string, string> = { WHATSAPP: 'WhatsApp', MANUAL: 'manual', PROPOSTA: 'proposta', RETROATIVO: 'retroativo', SITE: 'site', INDICACAO: 'indicação' };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR'));
const meta = (p: { valor: number | null; meta: number | null; pct: number | null }, fmt: (n: number | null) => string) =>
  p.meta == null ? '' : ` <span style="color:#64748b;font-size:12px;">de ${fmt(p.meta)} (${(p.pct ?? 0).toLocaleString('pt-BR')}%)</span>`;

function card(rotulo: string, valor: string, detalhe = '') {
  return `<td width="33%" valign="top" style="padding:6px;">
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">${rotulo}</div>
      <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px;">${valor}</div>
      ${detalhe ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${detalhe}</div>` : ''}
    </div></td>`;
}
const linhaCards = (cards: string[]) => `<table width="100%" cellpadding="0" cellspacing="0"><tr>${cards.join('')}</tr></table>`;
const titulo = (t: string) => `<h2 style="font-size:15px;color:#1e3a8a;margin:22px 6px 6px;border-bottom:2px solid #dbeafe;padding-bottom:4px;">${t}</h2>`;
const tabela = (linhas: string[][], alinharDireita = [false, true, true]) => `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin:0 6px;">${
  linhas.map(l => `<tr>${l.map((c, i) => `<td style="padding:5px 4px;border-bottom:1px solid #f1f5f9;${alinharDireita[i] ? 'text-align:right;' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table>`;

export function assuntoResumoExecutivo(d: any, dataTxt: string): string {
  const t1 = d.tela1;
  return `📊 Resumo executivo ${dataTxt}: ${t1.leads_novos_hoje.total} lead(s) novo(s), ${t1.contratos.hoje} contrato(s) hoje`;
}

export function montarHtmlResumoExecutivo(d: any, dataTxt: string, linkCrm: string): string {
  const t1 = d.tela1, t2 = d.tela2;
  const origens = Object.entries(t1.leads_novos_hoje.por_origem || {}) as [string, number][];
  const alertas = [
    t1.alertas.conversas_fora_do_prazo ? `${t1.alertas.conversas_fora_do_prazo} conversa(s) fora do prazo de resposta` : null,
    t1.alertas.propostas_paradas ? `${t1.alertas.propostas_paradas} proposta(s) parada(s) há 7+ dias` : null,
    t1.alertas.leads_para_distribuir ? `${t1.alertas.leads_para_distribuir} lead(s) qualificado(s) aguardando distribuição` : null,
    t1.alertas.cnpj_irregular_hoje ? `${t1.alertas.cnpj_irregular_hoje} contato(s) de hoje com CNPJ não ativo` : null,
  ].filter(Boolean) as string[];
  const mesesAteAgora = (t2.contratos_por_mes as number[]).slice(0, t2.mes_atual).map((n, i) => `${MESES[i]} ${n}`).join(' · ');

  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 8px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:14px;overflow:hidden;">
<tr><td style="background:#0b1220;color:#fff;padding:18px 20px;">
  <div style="font-size:18px;font-weight:700;">ProSystem · Resumo executivo</div>
  <div style="font-size:13px;color:#93c5fd;margin-top:2px;">${esc(dataTxt)}</div>
</td></tr>
<tr><td style="padding:8px 14px 20px;">
  ${titulo('Hoje')}
  ${linhaCards([
    card('Leads novos', num(t1.leads_novos_hoje.total), origens.length ? origens.map(([o, n]) => `${n} ${esc(ORIGEM[o] || o.toLowerCase())}`).join(' · ') : 'nenhum'),
    card('Qualificados', num(t1.qualificados_hoje.pela_triagem), 'pela triagem automática'),
    card('Contratos', num(t1.contratos.hoje), `${num(t1.contratos.mes)} no mês`),
  ])}
  ${linhaCards([
    card('Conversas iniciadas', num(t1.conversas_iniciadas.total), `${t1.conversas_iniciadas.pelo_cliente} pelo cliente · ${t1.conversas_iniciadas.pela_equipe} pela equipe`),
    card('Respondidas', num(t1.conversas_respondidas.total), t1.conversas_respondidas.tempo_medio_primeira_resposta_min != null ? `1ª resposta em ${t1.conversas_respondidas.tempo_medio_primeira_resposta_min} min` : ''),
    card('Sem resposta', num(t1.sem_resposta.total), t1.sem_resposta.fora_do_prazo != null ? `${t1.sem_resposta.fora_do_prazo} fora do prazo` : ''),
  ])}
  ${alertas.length ? `<div style="margin:10px 6px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;font-size:13px;color:#991b1b;">⚠️ ${alertas.map(esc).join('<br>⚠️ ')}</div>` : ''}

  ${titulo('Leads e funil agora')}
  ${linhaCards([
    card('Leads no funil', num(t1.leads_acumulados), 'acumulados em aberto'),
    card('Em negociação', num(t1.negociacoes.total), `${t1.negociacoes.valor_potencial != null ? `${brl(t1.negociacoes.valor_potencial)} potencial · ` : ''}${t1.negociacoes.com_proposta_enviada} c/ proposta`),
    card('Faturamento do mês', brl(t1.faturamento_mes.valor), t1.faturamento_mes.meta != null ? `meta ${brl(t1.faturamento_mes.meta)}` : 'instalação'),
  ])}
  ${tabela((t1.funil as any[]).map(e => [esc(e.nome), num(e.total)]), [false, true])}

  ${(t1.equipe as any[]).length ? `${titulo('Equipe hoje')}${tabela([
    ['<b>Pessoa</b>', '<b>Conversas</b>', '<b>Propostas</b>', '<b>Vendas</b>', '<b>Atividades</b>'],
    ...(t1.equipe as any[]).map(u => [
      `${esc(u.nome)}${u.cargo === 'SDR' ? ' (SDR)' : ''}`, num(u.conversas_respondidas), num(u.propostas_criadas), num(u.contratos),
      `${u.atividades.concluidas} feitas${u.atividades.atrasadas ? ` · <span style="color:#dc2626;">${u.atividades.atrasadas} atrasadas</span>` : ''}`,
    ]),
  ], [false, true, true, true, true])}` : ''}

  ${titulo(`Acumulado de ${t2.ano}`)}
  ${linhaCards([
    card('Contratos no ano', `${num(t2.contratos_ano.valor)}${meta(t2.contratos_ano, num)}`, `ritmo ${t2.contratos_ano.por_mes.toLocaleString('pt-BR')}/mês`),
    card('Faturamento no ano', brl(t2.faturamento_ano.total), 'instalação + vendas adicionais'),
    card('MRR novo', brl(t2.mrr_novo_ano), 'mensalidades dos contratos novos'),
  ])}
  ${linhaCards([
    card('Ticket instalação', brl(t2.ticket_medio_instalacao)),
    card('Ticket mensalidade', brl(t2.ticket_medio_mensalidade)),
    card('Conversão', t2.conversao_proposta_contrato_pct == null ? '—' : `${t2.conversao_proposta_contrato_pct.toLocaleString('pt-BR')}%`, t2.ciclo_medio_dias != null ? `ciclo médio ${t2.ciclo_medio_dias} dias` : 'proposta → contrato'),
  ])}
  ${linhaCards([
    card('Vendas adicionais', `${brl(t2.crosssell_ano.valor)}${meta(t2.crosssell_ano, brl)}`, `${t2.crosssell_ano.vendas} vendas · ${t2.crosssell_ano.clientes} clientes`),
  ])}
  ${tabela((t2.contratos_por_segmento as any[]).filter(s => s.total).map(s => [esc(s.segmento), num(s.total), `${s.pct}%`]))}
  <p style="font-size:12px;color:#64748b;margin:10px 6px 0;">Contratos por mês: ${mesesAteAgora}</p>

  <div style="text-align:center;margin-top:22px;">
    <a href="${esc(linkCrm)}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:11px 28px;border-radius:8px;">Abrir o CRM</a>
  </div>
</td></tr></table>
<p style="font-size:11px;color:#94a3b8;">Resumo automático diário do CRM ProSystem, com os mesmos números do painel da TV.</p>
</td></tr></table></body></html>`;
}
