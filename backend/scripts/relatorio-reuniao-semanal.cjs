// Dados da reunião comercial semanal com a diretoria. SÓ LEITURA.
// Uso (no servidor, dentro de backend/, com o .env carregado):
//   node scripts/relatorio-reuniao-semanal.cjs 2026-10-13
// O argumento é o primeiro dia da semana analisada (AAAA-MM-DD); a semana anterior é a dos 7 dias antes.
// Saída: JSON no stdout. Traz nomes de empresa e ids de conversa; NUNCA telefone, CPF ou e-mail.
// Guia completo: docs/contexto/reuniao-semanal.md
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const D = (s) => new Date(s + 'T03:00:00Z'); // meia-noite em Brasília
const arg = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(arg || '')) { console.error('Informe o início da semana: AAAA-MM-DD'); process.exit(1); }
const AGORA = new Date();
const SEM = D(arg), PREV = new Date(SEM.getTime() - 7 * 864e5);
const hojeBr = new Date(AGORA.getTime() - 3 * 3600e3);
const MES = new Date(Date.UTC(hojeBr.getUTCFullYear(), hojeBr.getUTCMonth(), 1, 3));
const ANO = new Date(Date.UTC(hojeBr.getUTCFullYear(), 0, 1, 3));
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const gb = async (model, by, where) => (await p[model].groupBy({ by: [by], where, _count: { _all: true } }))
  .map((r) => [r[by], r._count._all]).sort((a, b) => b[1] - a[1]);
const conta = (arr, k) => Object.entries(arr.reduce((acc, s) => ((acc[s[k] ?? '—'] = (acc[s[k] ?? '—'] || 0) + 1), acc), {})).sort((a, b) => b[1] - a[1]);
const curto = (t, n) => (t ? String(t).replace(/\s+/g, ' ').slice(0, n) : null);

(async () => {
  const out = { periodo: { semana: dia(SEM), semana_anterior: dia(PREV), mes: dia(MES), ano: dia(ANO), gerado_em: AGORA.toISOString() } };

  // 1. Leads: volumes e origem (atenção: o MySQL agrupa "INDICACAO" e "Indicação" juntos)
  out.leads = {
    total: await p.lead.count(),
    ano: await p.lead.count({ where: { created_at: { gte: ANO } } }),
    mes: await p.lead.count({ where: { created_at: { gte: MES } } }),
    semana: await p.lead.count({ where: { created_at: { gte: SEM } } }),
    semana_anterior: await p.lead.count({ where: { created_at: { gte: PREV, lt: SEM } } }),
  };
  out.origem = {
    total: await gb('lead', 'origem', {}),
    ano: await gb('lead', 'origem', { created_at: { gte: ANO } }),
    mes: await gb('lead', 'origem', { created_at: { gte: MES } }),
    semana: await gb('lead', 'origem', { created_at: { gte: SEM } }),
  };
  out.campanha = { mes: await gb('lead', 'campanha_nome', { created_at: { gte: MES } }), ano: await gb('lead', 'campanha_nome', { created_at: { gte: ANO } }) };
  out.segmento_mes = await gb('lead', 'segmento', { created_at: { gte: MES } });

  // 2. Mês a mês no ano (contratos = módulo de contratos do CRM, usado desde jun/2026)
  out.por_mes = [];
  for (let m = 0; m <= hojeBr.getUTCMonth(); m++) {
    const a = new Date(Date.UTC(ANO.getUTCFullYear(), m, 1, 3)), b = new Date(Date.UTC(ANO.getUTCFullYear(), m + 1, 1, 3));
    out.por_mes.push({ mes: m + 1,
      leads: await p.lead.count({ where: { created_at: { gte: a, lt: b } } }),
      propostas: await p.propostaComercial.count({ where: { created_at: { gte: a, lt: b }, deleted_at: null } }),
      contratos: await p.contratoComercial.count({ where: { data_contrato: { gte: a, lt: b }, recuado_at: null } }),
      churn: await p.casoChurn.count({ where: { created_at: { gte: a, lt: b } } }) });
  }

  // 3. Prospecção dos agentes ("respondeu" inclui robô de loja: o que conta como avanço é o status)
  const janela = async (ini, fim) => {
    const lista = await p.sdrLead.findMany({ where: { primeiro_envio_em: { gte: ini, lt: fim } }, select: { agente: true, status: true, ultima_lead_em: true, primeiro_envio_em: true, temperatura: true } });
    const resp = lista.filter((s) => s.ultima_lead_em && s.ultima_lead_em > s.primeiro_envio_em);
    return { contatados: lista.length, responderam: resp.length, status: conta(lista, 'status'), status_respondeu: conta(resp, 'status'), por_agente: conta(lista, 'agente'), resp_por_agente: conta(resp, 'agente') };
  };
  out.prospeccao = { semana: await janela(SEM, AGORA), semana_anterior: await janela(PREV, SEM), mes: await janela(MES, AGORA), ano: await janela(ANO, AGORA) };

  // 4. Oportunidades quentes (link: https://comercial.prosystemnet.com/whatsapp?conversa=<conversaId>)
  out.oportunidades = (await p.sdrLead.findMany({
    where: { OR: [{ status: { in: ['CONVERSANDO', 'DEMO', 'VENDEDORA', 'HUMANO'] } }, { temperatura: { in: ['MORNO', 'QUENTE', 'MUITO_QUENTE'] } }], updated_at: { gte: new Date(SEM.getTime() - 35 * 864e5) } },
    select: { agente: true, empresa: true, segmento: true, campanha: true, status: true, temperatura: true, nota: true, resumo: true, nota_motivo: true, conversaId: true, ultima_lead_em: true },
    orderBy: { ultima_lead_em: 'desc' }, take: 50 }))
    .filter((s) => s.ultima_lead_em)
    .map((s) => ({ ...s, ultima_lead_em: dia(s.ultima_lead_em), resumo: curto(s.resumo || s.nota_motivo, 220), nota_motivo: undefined }));
  out.sem_interesse_mes = (await p.sdrLead.findMany({ where: { status: 'SEM_INTERESSE', updated_at: { gte: MES } }, select: { empresa: true, segmento: true, agente: true, nota_motivo: true } }))
    .map((s) => ({ ...s, nota_motivo: curto(s.nota_motivo, 120) }));
  out.reunioes = (await p.atividade.findMany({ where: { tipo: 'REUNIAO', data_prevista: { gte: new Date(SEM.getTime() - 60 * 864e5) } }, select: { titulo: true, status: true, data_prevista: true }, orderBy: { data_prevista: 'desc' } }))
    .map((r) => ({ ...r, data_prevista: dia(r.data_prevista) }));
  out.reunioes_ano = await gb('atividade', 'status', { tipo: 'REUNIAO', data_prevista: { gte: ANO, lt: AGORA } });

  // 5. Propostas (as EXPIRADA são a lista de reativação)
  out.propostas_status_ano = await gb('propostaComercial', 'status', { deleted_at: null, created_at: { gte: ANO } });
  out.propostas_abertas_ou_expiradas = (await p.propostaComercial.findMany({
    where: { deleted_at: null, created_at: { gte: ANO }, status: { notIn: ['CONTRATO_ASSINADO', 'PERDIDA', 'CANCELADA', 'RECUSADA'] } },
    select: { razao_social: true, nome_fantasia: true, cidade: true, status: true, plano_selecionado: true, valor_final: true, mensalidade_basic: true, mensalidade_pro: true, mensalidade_plus: true, vendedor_nome: true, created_at: true, updated_at: true },
    orderBy: { updated_at: 'desc' } }))
    .map((r) => ({ empresa: r.nome_fantasia || r.razao_social, cidade: r.cidade, status: r.status, plano: r.plano_selecionado,
      mensalidade: r.mensalidade_plus || r.mensalidade_pro || r.mensalidade_basic, implantacao: r.valor_final, vendedor: (r.vendedor_nome || '').trim(), criada: dia(r.created_at), atualizada: dia(r.updated_at) }));

  // 6. Contratos
  out.contratos = {
    ano: await p.contratoComercial.aggregate({ where: { data_contrato: { gte: ANO }, recuado_at: null }, _sum: { mensalidade: true, valor_setup_total: true }, _count: { _all: true } }),
    mes: await p.contratoComercial.aggregate({ where: { data_contrato: { gte: MES }, recuado_at: null }, _sum: { mensalidade: true, valor_setup_total: true }, _count: { _all: true } }),
    lista_recente: (await p.contratoComercial.findMany({ where: { data_contrato: { gte: new Date(MES.getTime() - 31 * 864e5) }, recuado_at: null },
      select: { nome_fantasia: true, razao_social: true, cidade: true, plano_contratado: true, mensalidade: true, valor_setup_total: true, vendedor_nome: true, data_contrato: true, status: true }, orderBy: { data_contrato: 'desc' } }))
      .map((r) => ({ ...r, data_contrato: dia(r.data_contrato) })),
  };
  out.vendas_adicionais_mes = (await p.vendaAdicional.findMany({ where: { created_at: { gte: MES } }, select: { tipo_negocio: true, valor_venda: true, status: true, created_at: true } }))
    .map((v) => ({ ...v, created_at: dia(v.created_at) }));
  out.indicacoes_ano = await p.indicacao.count({ where: { created_at: { gte: ANO } } });
  out.ativos_contatos = { semana: await p.contatoAtivo.count({ where: { created_at: { gte: SEM } } }), mes: await p.contatoAtivo.count({ where: { created_at: { gte: MES } } }) };

  // 7. Churn (motivo_principal é texto livre: agrupe à mão e confira se a soma fecha com o total)
  out.churn = {
    status_ano: await gb('casoChurn', 'status', { created_at: { gte: ANO } }),
    motivo_ano: await gb('casoChurn', 'motivo_principal', { created_at: { gte: ANO } }),
    novos_semana: await p.casoChurn.count({ where: { created_at: { gte: SEM } } }),
    resolvidos_mes: await p.casoChurn.count({ where: { resolvido_em: { gte: MES } } }),
    casos: (await p.casoChurn.findMany({ where: { OR: [{ created_at: { gte: MES } }, { status: { in: ['EXECUTANDO', 'AGUARDANDO_EXCLUSAO', 'DIAGNOSTICADO'] } }] },
      select: { status: true, motivo_principal: true, fin_valor_atraso: true, created_at: true, cliente: { select: { nome_fantasia: true, razao_social: true, cidade: true } } }, orderBy: { created_at: 'desc' } }))
      .map((c) => ({ cliente: c.cliente?.nome_fantasia || c.cliente?.razao_social, cidade: c.cliente?.cidade, status: c.status, motivo: curto(c.motivo_principal, 90), atraso: c.fin_valor_atraso, aberto: dia(c.created_at) })),
  };

  console.log(JSON.stringify(out));
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); }).finally(() => p.$disconnect());
