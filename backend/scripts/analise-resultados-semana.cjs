// Dados do Analista de Resultados (relatório de sexta, pedido da Jessica em 21/10/2026). SÓ LEITURA.
// Uso (no servidor, dentro de backend/, com o .env carregado):
//   node scripts/analise-resultados-semana.cjs 2026-10-19 [--conversas]
// O argumento é o primeiro dia da semana analisada (AAAA-MM-DD). Com --conversas, inclui o texto das conversas
// de quem respondeu (para a leitura de cada caso). Saída: JSON no stdout. NUNCA telefone, CPF ou e-mail.
// Guia completo: docs/contexto/analista-resultados.md. O mesmo relatório sai sozinho toda sexta pelo CRM
// (services/analista-resultados.service.ts, tela /analista); este script serve para estudo avulso.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const D = (s) => new Date(s + 'T03:00:00Z'); // meia-noite em Brasília
const arg = process.argv[2];
const COM_CONVERSAS = process.argv.includes('--conversas');
if (!/^\d{4}-\d{2}-\d{2}$/.test(arg || '')) { console.error('Informe o início da semana: AAAA-MM-DD'); process.exit(1); }
const AGORA = new Date();
const SEM = D(arg);
const hojeBr = new Date(AGORA.getTime() - 3 * 3600e3);
const MES = new Date(Date.UTC(hojeBr.getUTCFullYear(), hojeBr.getUTCMonth(), 1, 3));
const JANELA = new Date(AGORA.getTime() - 45 * 864e5); // conversas vivas: últimos 45 dias
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const curto = (t, n) => (t ? String(t).replace(/\s+/g, ' ').trim().slice(0, n) : null);
const semContato = (t) => String(t || '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]')
  .replace(/\+?\d[\d\s().-]{8,}\d/g, '[número]');
const conta = (arr, f) => Object.entries(arr.reduce((acc, s) => { const k = f(s) ?? '—'; acc[k] = (acc[k] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);

// Sistemas citados (ERP/PDV de farmácia, manipulação, padaria e varejo). Chave = nome exibido.
const SISTEMAS = {
  'Trier': /\btrier\b/i, 'Digifarma': /digi\s?farma/i, 'Inovafarma': /inova\s?farma/i, 'Vetor Farma': /\bvetor\b/i,
  'Alpha7': /alpha\s?7/i, 'Linx / Big': /\blinx\b|big\s?farma|\bbig\b sistema/i, 'Siaf': /\bsiaf\b/i, 'Farmax': /farmax/i,
  'Sysfar': /sysfar/i, 'Prismafive': /prisma\s?five|prismafive/i, 'Fórmula Certa': /f[oó]rmula\s?certa/i, 'PharmaSys': /pharma\s?sys/i,
  'Consys': /\bconsys\b/i, 'Hos': /\bhos\b/i, 'Gdoor': /gdoor/i, 'Hiper': /\bhiper\b/i, 'Bling': /\bbling\b/i, 'Tiny/Olist': /\btiny\b|olist/i,
  'Omie': /\bomie\b/i, 'Conta Azul': /conta\s?azul/i, 'Totvs': /totvs/i, 'SAP': /\bsap\b/i, 'Saipos': /saipos/i, 'Consumer': /\bconsumer\b/i,
  'Sischef': /sischef/i, 'Arpa': /\barpa\b/i, 'Bluesoft': /bluesoft/i, 'Questor': /questor/i, 'Sigma': /\bsigma\b/i, 'Lince': /\blince\b/i,
  'Farmácia Fácil': /farm[aá]cia\s?f[aá]cil/i, 'Gestor Farma': /gestor\s?farma/i, 'SoftPharma': /soft\s?pharma/i, 'Infarma': /\binfarma\b/i,
  'Clipp': /\bclipp\b/i, 'Wise/Lumi': /\blumi\b/i, 'Visual': /visual\s?(farma|software|mix)/i, 'Unimake': /unimake/i, 'Datasul': /datasul/i,
  'Planilha/caderno': /planilha|caderno|excel|no papel|anoto/i,
};
const sistemasNoTexto = (t) => Object.entries(SISTEMAS).filter(([, re]) => re.test(t || '')).map(([n]) => n);

const AVANCO = ['CONVERSANDO', 'DEMO', 'VENDEDORA', 'HUMANO'];

(async () => {
  const out = { periodo: { semana: dia(SEM), mes: dia(MES), gerado_em: AGORA.toISOString() } };

  // 1. Todos os contatados pelos agentes (mês e janela de 45 dias) com a conversa
  const sdrs = await p.sdrLead.findMany({
    where: { OR: [{ primeiro_envio_em: { gte: JANELA } }, { ultima_lead_em: { gte: JANELA } }] },
    select: { id: true, agente: true, status: true, empresa: true, nome: true, segmento: true, campanha: true, temperatura: true, temperatura_confirmada: true,
      nota: true, nota_motivo: true, resumo: true, dados: true, conversaId: true, lead_id: true, tentativas: true,
      primeiro_envio_em: true, ultima_caroline_em: true, ultima_lead_em: true, created_at: true },
  });
  const leadIds = [...new Set(sdrs.map((s) => s.lead_id).filter(Boolean))];
  const leads = new Map((await p.lead.findMany({ where: { id: { in: leadIds } },
    select: { id: true, origem: true, cidade: true, estado: true, segmento: true, sistema_atual: true, campanha_nome: true, temperatura: true, etapa_comercial: true, qtd_caixas: true } }))
    .map((l) => [l.id, l]));

  const respondeu = (s) => s.ultima_lead_em && s.primeiro_envio_em && s.ultima_lead_em > s.primeiro_envio_em;
  const doMes = sdrs.filter((s) => s.primeiro_envio_em && s.primeiro_envio_em >= MES);
  const daSemana = sdrs.filter((s) => s.primeiro_envio_em && s.primeiro_envio_em >= SEM);
  const resumoJanela = (lista) => ({
    contatados: lista.length, responderam: lista.filter(respondeu).length,
    avancaram: lista.filter((s) => AVANCO.includes(s.status)).length,
    status: conta(lista, (s) => s.status),
  });
  out.prospeccao = { semana: resumoJanela(daSemana), mes: resumoJanela(doMes) };

  // 2. Ranking de retorno: por agente, segmento, campanha, cidade, dia da semana, hora do 1º envio, tentativas
  const ranking = (lista, f) => {
    const g = {};
    for (const s of lista) { const k = f(s) || '—'; g[k] ||= { chave: k, contatados: 0, responderam: 0, avancaram: 0 }; g[k].contatados++; if (respondeu(s)) g[k].responderam++; if (AVANCO.includes(s.status)) g[k].avancaram++; }
    return Object.values(g).map((r) => ({ ...r, taxa_resposta: +(100 * r.responderam / r.contatados).toFixed(1), taxa_avanco: +(100 * r.avancaram / r.contatados).toFixed(1) }))
      .sort((a, b) => b.contatados - a.contatados);
  };
  const brt = (d) => new Date(new Date(d).getTime() - 3 * 3600e3);
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  out.ranking_retorno_mes = {
    agente: ranking(doMes, (s) => s.agente),
    segmento: ranking(doMes, (s) => (s.segmento || leads.get(s.lead_id)?.segmento || '').toUpperCase()),
    campanha: ranking(doMes, (s) => s.campanha || leads.get(s.lead_id)?.campanha_nome),
    cidade: ranking(doMes, (s) => s.dados?.cidade || leads.get(s.lead_id)?.cidade).filter((r) => r.contatados >= 5),
    dia_semana: ranking(doMes, (s) => DIAS[brt(s.primeiro_envio_em).getUTCDay()]),
    hora_envio: ranking(doMes, (s) => String(brt(s.primeiro_envio_em).getUTCHours()).padStart(2, '0') + 'h'),
    interlocutor: ranking(doMes, (s) => s.dados?.interlocutor),
  };

  // 3. Mensagens das conversas (entrada e saída) para sistemas citados, abertura usada e tempo de resposta
  const convIds = sdrs.map((s) => s.conversaId).filter(Boolean);
  const msgs = await p.whatsappMensagem.findMany({ where: { conversaId: { in: convIds }, created_at: { gte: new Date(JANELA.getTime() - 30 * 864e5) } },
    select: { conversaId: true, direcao: true, conteudo: true, transcricao: true, tipo: true, created_at: true }, orderBy: { created_at: 'asc' } });
  const porConv = new Map();
  for (const m of msgs) { if (!porConv.has(m.conversaId)) porConv.set(m.conversaId, []); porConv.get(m.conversaId).push(m); }

  // Sistemas citados: texto do cliente + ficha do agente + cadastro do lead
  const citacoes = {};
  const sistemaDe = new Map();
  for (const s of sdrs) {
    const entradas = (porConv.get(s.conversaId) || []).filter((m) => m.direcao === 'ENTRADA').map((m) => `${m.conteudo} ${m.transcricao || ''}`).join(' \n ');
    const fontes = `${entradas} ${s.dados?.sistema_atual || ''} ${leads.get(s.lead_id)?.sistema_atual || ''}`;
    const achados = sistemasNoTexto(fontes);
    if (achados.length) sistemaDe.set(s.id, achados);
    for (const n of achados) { citacoes[n] ||= { sistema: n, leads: 0, avancaram: 0, sem_interesse: 0 }; citacoes[n].leads++; if (AVANCO.includes(s.status)) citacoes[n].avancaram++; if (s.status === 'SEM_INTERESSE') citacoes[n].sem_interesse++; }
  }
  out.sistemas_citados = Object.values(citacoes).sort((a, b) => b.leads - a.leads);
  out.sistema_atual_texto_livre = conta(sdrs.filter((s) => s.dados?.sistema_atual), (s) => curto(s.dados.sistema_atual, 40));

  // Primeira mensagem enviada (abertura): qual texto teve mais retorno
  const aberturas = {};
  for (const s of doMes) {
    const primeira = (porConv.get(s.conversaId) || []).find((m) => m.direcao === 'SAIDA');
    if (!primeira) continue;
    const k = curto(semContato(primeira.conteudo).replace(/\b(Bom dia|Boa tarde|Boa noite|Olá|Oi)[,!]?\s*[^,!.]*[,!.]?/i, '<saudação> '), 90);
    aberturas[k] ||= { abertura: k, contatados: 0, responderam: 0, avancaram: 0 };
    aberturas[k].contatados++; if (respondeu(s)) aberturas[k].responderam++; if (AVANCO.includes(s.status)) aberturas[k].avancaram++;
  }
  out.aberturas = Object.values(aberturas).filter((a) => a.contatados >= 3).sort((a, b) => b.contatados - a.contatados).slice(0, 15);

  // Tempo até a 1ª resposta do cliente (minutos) e quantas mensagens o cliente mandou
  const tempos = [];
  for (const s of doMes.filter(respondeu)) {
    const c = porConv.get(s.conversaId) || [];
    const pe = c.find((m) => m.direcao === 'SAIDA' && m.created_at >= s.primeiro_envio_em);
    const pr = pe && c.find((m) => m.direcao === 'ENTRADA' && m.created_at > pe.created_at);
    if (pe && pr) tempos.push((pr.created_at - pe.created_at) / 60000);
  }
  tempos.sort((a, b) => a - b);
  out.tempo_primeira_resposta_min = tempos.length ? { n: tempos.length, mediana: Math.round(tempos[Math.floor(tempos.length / 2)]), ate_1h: tempos.filter((t) => t <= 60).length, ate_24h: tempos.filter((t) => t <= 1440).length } : null;

  // 4. Decisores: contatos passados pela loja e conversas em que já falamos com quem decide
  const decisoresIndicados = await p.lead.findMany({ where: { campanha_nome: 'Decisor indicado pela loja', created_at: { gte: JANELA } }, select: { id: true, nome: true, segmento: true, cidade: true, created_at: true } });
  const sdrDosDecisores = new Map(sdrs.filter((s) => decisoresIndicados.some((l) => l.id === s.lead_id)).map((s) => [s.lead_id, s]));
  out.decisores = {
    indicados_pela_loja: decisoresIndicados.map((l) => { const s = sdrDosDecisores.get(l.id); return { empresa: l.nome, segmento: l.segmento, cidade: l.cidade, em: dia(l.created_at), status: s?.status || 'sem conversa', respondeu: s ? !!respondeu(s) : false, conversaId: s?.conversaId || null }; }),
    falando_com_decisor: sdrs.filter((s) => s.dados?.interlocutor === 'decisor').length,
    com_decisor_identificado: sdrs.filter((s) => s.dados?.decisor).length,
    pedimos_contato_decisor: sdrs.filter((s) => s.dados?.pediu_decisor_em).length,
    interlocutor: conta(sdrs.filter(respondeu), (s) => s.dados?.interlocutor),
  };

  // 5. Motivos de perda e dores
  out.motivo_sem_interesse = conta(sdrs.filter((s) => s.status === 'SEM_INTERESSE'), (s) => curto(s.nota_motivo, 70));
  out.dores = sdrs.filter((s) => s.dados?.dor_principal || s.dados?.motivo_busca).map((s) => ({ empresa: s.empresa, dor: curto(s.dados.dor_principal, 120), motivo_busca: curto(s.dados.motivo_busca, 120) }));

  // 6. Lista por temperatura (todos que responderam ou estão em avanço), com tudo o que o agente sabe
  const tempo = (s) => s.temperatura_confirmada || s.temperatura || leads.get(s.lead_id)?.temperatura || 'FRIO';
  const vivos = sdrs.filter((s) => respondeu(s) || AVANCO.includes(s.status));
  out.leads_vivos = vivos.map((s) => {
    const l = leads.get(s.lead_id) || {};
    const c = porConv.get(s.conversaId) || [];
    const ent = c.filter((m) => m.direcao === 'ENTRADA');
    const item = {
      id: s.id, agente: s.agente, empresa: s.empresa || s.nome, segmento: s.segmento || l.segmento, cidade: s.dados?.cidade || l.cidade, origem: l.origem, campanha: s.campanha || l.campanha_nome,
      status: s.status, temperatura: tempo(s), nota: s.nota, motivo_nota: curto(s.nota_motivo, 160), resumo: curto(s.resumo, 300),
      interlocutor: s.dados?.interlocutor || null, decisor: curto(s.dados?.decisor, 60), sistema: sistemaDe.get(s.id) || null, computadores: s.dados?.computadores || l.qtd_caixas || null,
      momento: curto(s.dados?.momento, 80), dor: curto(s.dados?.dor_principal, 120), motivo_busca: curto(s.dados?.motivo_busca, 120),
      msgs_cliente: ent.length, primeiro_envio: dia(s.primeiro_envio_em), ultima_cliente: dia(s.ultima_lead_em), ultima_agente: dia(s.ultima_caroline_em),
      conversaId: s.conversaId,
    };
    if (COM_CONVERSAS) item.conversa = c.slice(-24).map((m) => `${m.direcao === 'ENTRADA' ? 'CLIENTE' : 'NÓS'}: ${curto(semContato(m.tipo === 'AUDIO' ? (m.transcricao || '[áudio]') : m.conteudo), 260)}`);
    return item;
  }).sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
  out.por_temperatura = conta(vivos, tempo);

  // 7. Fora dos agentes: demonstrações, propostas e conversas recentes da equipe
  out.demonstracoes = (await p.atividade.findMany({ where: { tipo: 'REUNIAO', data_prevista: { gte: new Date(MES.getTime() - 15 * 864e5) } }, select: { titulo: true, status: true, data_prevista: true, lead_id: true }, orderBy: { data_prevista: 'desc' } }))
    .map((r) => ({ titulo: r.titulo, status: r.status, data: dia(r.data_prevista) }));
  out.propostas_vivas = (await p.propostaComercial.findMany({ where: { deleted_at: null, created_at: { gte: new Date(AGORA.getTime() - 180 * 864e5) }, status: { notIn: ['CONTRATO_ASSINADO', 'CANCELADA'] } },
    select: { razao_social: true, nome_fantasia: true, cidade: true, segmento: true, status: true, plano_selecionado: true, mensalidade_basic: true, mensalidade_pro: true, mensalidade_plus: true, valor_final: true, vendedor_nome: true, sistema_atual: true, created_at: true, updated_at: true },
    orderBy: { updated_at: 'desc' } }))
    .map((r) => ({ empresa: r.nome_fantasia || r.razao_social, cidade: r.cidade, segmento: r.segmento, status: r.status, plano: r.plano_selecionado, mensalidade: r.mensalidade_plus || r.mensalidade_pro || r.mensalidade_basic, implantacao: r.valor_final, vendedor: (r.vendedor_nome || '').trim(), sistema: r.sistema_atual, criada: dia(r.created_at), atualizada: dia(r.updated_at) }));
  out.contratos_mes = await p.contratoComercial.count({ where: { data_contrato: { gte: MES }, recuado_at: null } });

  // 8. Base disponível para campanha relâmpago (farmácia e padaria), sem contar quem já está em conversa
  const segs = await p.lead.groupBy({ by: ['segmento'], where: { deleted_at: null }, _count: { _all: true } });
  out.base_por_segmento = segs.map((r) => [r.segmento, r._count._all]).sort((a, b) => b[1] - a[1]).slice(0, 15);
  out.fila_agentes = conta(await p.sdrLead.findMany({ where: { status: 'FILA' }, select: { agente: true } }), (s) => s.agente);

  console.log(JSON.stringify(out));
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); }).finally(() => p.$disconnect());
