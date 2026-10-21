import type { PrismaClient } from '@prisma/client';
import {
  AVANCO, sistemasNoTexto, rankingRetorno, pct, temSinalDeCompra, temperaturaAnalista, retornoAtrasado, semContato, mensagemWhatsapp,
  type Temperatura,
} from '@/lib/analista-resultados';

// Analista de Resultados (pedido da Jessica, 21/10/2026): toda sexta, um relatório da prospecção com números, leitura
// das conversas, leads por temperatura, ranking dos retornos, decisores, sistemas citados e o que fazer para converter.
// Só leitura nos leads: nada é enviado a cliente. O relatório fica em ConfiguracaoIntegracao (analista.relatorio.<semana>),
// sem mudar o banco, e a gestão recebe um resumo no WhatsApp com o link da tela /analista.

const PREFIXO = 'analista.relatorio.';
const DIAS_CONVERSA = 45;
const FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const FORA_DA_REATIVACAO = [...FECHADA, 'CANCELADA', 'PERDIDA', 'RECUSADA'];
const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const brt = (d: Date) => new Date(d.getTime() - 3 * 3600e3);
const diaBr = (d: Date | null | undefined) => (d ? brt(new Date(d)).toISOString().slice(0, 10) : null);
const curto = (t: unknown, n: number) => (t ? String(t).replace(/\s+/g, ' ').trim().slice(0, n) : null);

export type Acao = { acao: string; responsavel: string; quando: string; meta: string; origem: 'dados' | 'ia' };

/** Rótulos dos dias úteis da semana seguinte (ex.: "seg 26/10"). */
export function proximaSemana(agora: Date) {
  const seg = new Date(inicioDaSemana(agora).getTime() + 7 * 864e5);
  const rot = (n: number) => { const x = brt(new Date(seg.getTime() + n * 864e5)); return `${DIA_SEMANA[x.getUTCDay()]} ${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`; };
  return { seg: rot(0), ter: rot(1), qua: rot(2), qui: rot(3), sex: rot(4) };
}

/** Segunda-feira (00h de Brasília) da semana de `agora`. */
export function inicioDaSemana(agora: Date): Date {
  const b = brt(agora);
  const volta = (b.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() - volta, 3));
}

function baseUrl() {
  return (process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || 'https://comercial.prosystemnet.com';
}

export async function gerarAnaliseResultados(prisma: PrismaClient, agora = new Date(), opts: { enviar?: boolean; ia?: boolean } = {}) {
  const SEM = inicioDaSemana(agora);
  const b = brt(agora);
  const MES = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1, 3));
  const JANELA = new Date(agora.getTime() - DIAS_CONVERSA * 864e5);

  // 1. Contatados pelos agentes e o que eles sabem de cada lead
  const sdrs = await prisma.sdrLead.findMany({
    where: { OR: [{ primeiro_envio_em: { gte: JANELA } }, { ultima_lead_em: { gte: JANELA } }] },
    select: { id: true, agente: true, status: true, empresa: true, nome: true, segmento: true, campanha: true, nota: true, nota_motivo: true, resumo: true,
      dados: true, conversaId: true, lead_id: true, proposta_id: true, primeiro_envio_em: true, ultima_caroline_em: true, ultima_lead_em: true },
  });
  const leadIds = [...new Set(sdrs.map(s => s.lead_id).filter(Boolean) as string[])];
  const leads = new Map((await prisma.lead.findMany({ where: { id: { in: leadIds } },
    select: { id: true, origem: true, cidade: true, segmento: true, sistema_atual: true, campanha_nome: true, qtd_caixas: true } })).map(l => [l.id, l]));
  const d = (s: { dados: unknown }) => (s.dados || {}) as Record<string, any>;
  const respondeu = (s: typeof sdrs[number]) => !!(s.ultima_lead_em && s.primeiro_envio_em && s.ultima_lead_em > s.primeiro_envio_em);
  const humano = (s: typeof sdrs[number]) => respondeu(s) && d(s).interlocutor !== 'robo';
  const avancou = (s: typeof sdrs[number]) => AVANCO.includes(s.status);

  // 2. Mensagens das conversas (para sistemas, sinais de compra e a leitura da IA)
  const convIds = sdrs.map(s => s.conversaId).filter(Boolean) as string[];
  const msgs = convIds.length ? await prisma.whatsappMensagem.findMany({
    where: { conversaId: { in: convIds }, created_at: { gte: new Date(JANELA.getTime() - 30 * 864e5) } },
    select: { conversaId: true, direcao: true, conteudo: true, transcricao: true, tipo: true, created_at: true }, orderBy: { created_at: 'asc' },
  }) : [];
  const porConv = new Map<string, typeof msgs>();
  for (const m of msgs) { const l = porConv.get(m.conversaId) || []; l.push(m); porConv.set(m.conversaId, l); }
  const falaDoCliente = (convId: string | null) => (porConv.get(convId || '') || []).filter(m => m.direcao === 'ENTRADA').map(m => `${m.conteudo} ${m.transcricao || ''}`).join('\n');

  // 3. Números da semana e do mês
  const resumoJanela = async (ini: Date) => {
    const lista = sdrs.filter(s => s.primeiro_envio_em && s.primeiro_envio_em >= ini);
    const [demos, propostas, contratos] = await Promise.all([
      prisma.atividade.groupBy({ by: ['status'], where: { tipo: 'REUNIAO', data_prevista: { gte: ini, lt: agora } }, _count: { _all: true } }).catch(() => [] as any[]),
      prisma.propostaComercial.count({ where: { deleted_at: null, created_at: { gte: ini }, status: { not: 'RASCUNHO' } } }),
      prisma.contratoComercial.aggregate({ where: { data_contrato: { gte: ini }, recuado_at: null }, _count: { _all: true }, _sum: { mensalidade: true } }),
    ]);
    return {
      contatados: lista.length, responderam: lista.filter(respondeu).length, humanos: lista.filter(humano).length, avancaram: lista.filter(avancou).length,
      demonstracoes: Object.fromEntries((demos as any[]).map(g => [g.status, g._count._all])), propostas,
      contratos: contratos._count._all, mensalidade_contratos: contratos._sum.mensalidade || 0,
    };
  };
  const numeros = { semana: await resumoJanela(SEM), mes: await resumoJanela(MES) };
  const fila = await prisma.sdrLead.count({ where: { status: 'FILA' } });
  const jaClientes = sdrs.filter(s => d(s).ja_cliente && s.primeiro_envio_em && s.primeiro_envio_em >= MES).length;

  // 4. Ranking dos retornos (mês)
  const doMes = sdrs.filter(s => s.primeiro_envio_em && s.primeiro_envio_em >= MES);
  const rk = (f: (s: typeof sdrs[number]) => string | null | undefined) => rankingRetorno(doMes, f, respondeu, avancou);
  const ranking = {
    agente: rk(s => s.agente),
    segmento: rk(s => (s.segmento || leads.get(s.lead_id || '')?.segmento || '').toUpperCase()),
    campanha: rk(s => s.campanha || leads.get(s.lead_id || '')?.campanha_nome),
    cidade: rk(s => d(s).cidade || leads.get(s.lead_id || '')?.cidade).filter(r => r.contatados >= 5),
    dia_semana: rk(s => DIA_SEMANA[brt(s.primeiro_envio_em!).getUTCDay()]),
    hora: rk(s => `${String(brt(s.primeiro_envio_em!).getUTCHours()).padStart(2, '0')}h`),
    quem_respondeu: rk(s => ({ decisor: 'o decisor', atendente: 'atendente', robo: 'só o robô da loja' } as Record<string, string>)[d(s).interlocutor] || 'não identificado'),
  };

  // 5. Propostas: as que o lead tem e as paradas para reativar
  const propostas = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, created_at: { gte: new Date(agora.getTime() - 180 * 864e5) } },
    select: { id: true, razao_social: true, nome_fantasia: true, cidade: true, segmento: true, status: true, plano_selecionado: true, mensalidade_basic: true,
      mensalidade_pro: true, mensalidade_plus: true, valor_final: true, vendedor_nome: true, sistema_atual: true, created_at: true, updated_at: true },
    orderBy: { updated_at: 'desc' },
  });
  const mensalidade = (p: typeof propostas[number]) => p.mensalidade_plus || p.mensalidade_pro || p.mensalidade_basic || 0;
  const paradas = propostas.filter(p => !FORA_DA_REATIVACAO.includes(p.status)).map(p => ({
    empresa: p.nome_fantasia || p.razao_social, cidade: p.cidade, segmento: p.segmento, status: p.status, plano: p.plano_selecionado,
    mensalidade: mensalidade(p), implantacao: p.valor_final, vendedor: (p.vendedor_nome || '').trim(), criada: diaBr(p.created_at), atualizada: diaBr(p.updated_at),
  }));
  const comProposta = new Set(sdrs.filter(s => s.proposta_id).map(s => s.id));

  // 6. Leads vivos com temperatura do analista
  const vivos = sdrs.filter(s => respondeu(s) || avancou(s)).map(s => {
    const l = leads.get(s.lead_id || '');
    const fala = falaDoCliente(s.conversaId);
    const sistemas = sistemasNoTexto(`${fala}\n${d(s).sistema_atual || ''}\n${l?.sistema_atual || ''}`);
    const dias = s.ultima_lead_em ? Math.floor((agora.getTime() - s.ultima_lead_em.getTime()) / 864e5) : null;
    const temperatura: Temperatura = temperaturaAnalista({ status: s.status, nota: s.nota, temProposta: comProposta.has(s.id), sinalCompra: temSinalDeCompra(fala), diasDesdeCliente: dias });
    return {
      id: s.id, empresa: s.empresa || s.nome || 'sem nome', segmento: s.segmento || l?.segmento || null, cidade: d(s).cidade || l?.cidade || null,
      agente: s.agente, status: s.status, temperatura, nota: s.nota, sistemas, interlocutor: d(s).interlocutor || null, decisor: curto(d(s).decisor, 60),
      computadores: d(s).computadores || l?.qtd_caixas || null, resumo: curto(s.resumo || s.nota_motivo, 260), ultima_cliente: diaBr(s.ultima_lead_em),
      conversaId: s.conversaId, ja_cliente: !!d(s).ja_cliente,
      chance: null as null | 'alta' | 'media' | 'baixa', por_que: null as string | null, proximo_passo: null as string | null,
    };
  }).filter(v => !v.ja_cliente && v.status !== 'SEM_INTERESSE');
  const ordem: Record<Temperatura, number> = { QUENTE: 0, MORNO: 1, FRIO: 2 };
  vivos.sort((a, b2) => ordem[a.temperatura] - ordem[b2.temperatura] || (b2.nota ?? 0) - (a.nota ?? 0));

  // 7. Sistemas citados (conversas + propostas)
  const sistemas = new Map<string, { sistema: string; leads: number; avancaram: number; onde: string[] }>();
  const somar = (nome: string, onde: string, avancou2: boolean) => {
    const r = sistemas.get(nome) || { sistema: nome, leads: 0, avancaram: 0, onde: [] };
    r.leads++; if (avancou2) r.avancaram++; if (r.onde.length < 4) r.onde.push(onde);
    sistemas.set(nome, r);
  };
  for (const v of vivos) for (const n of v.sistemas) somar(n, v.empresa, AVANCO.includes(v.status));
  for (const p of propostas) for (const n of sistemasNoTexto(p.sistema_atual)) somar(n, `${p.nome_fantasia || p.razao_social} (proposta)`, false);
  const comSistema = vivos.filter(v => v.sistemas.length).length;

  // 8. Decisores e retornos combinados que ficaram para trás
  const indicados = await prisma.lead.findMany({ where: { campanha_nome: 'Decisor indicado pela loja', created_at: { gte: JANELA } }, select: { id: true, nome: true, cidade: true, created_at: true } });
  const sdrDoLead = new Map(sdrs.filter(s => s.lead_id).map(s => [s.lead_id!, s]));
  const decisores = {
    indicados: indicados.map(l => { const s = sdrDoLead.get(l.id); return { empresa: l.nome, cidade: l.cidade, em: diaBr(l.created_at), status: s?.status || 'sem conversa', respondeu: s ? respondeu(s) : false, conversaId: s?.conversaId || null }; }),
    falando_com_decisor: sdrs.filter(s => d(s).interlocutor === 'decisor').length,
    decisor_identificado: sdrs.filter(s => d(s).decisor).length,
    pedimos_contato: sdrs.filter(s => d(s).pediu_decisor_em).length,
    retornos_atrasados: sdrs.filter(s => ['AGUARDANDO', 'CONVERSANDO'].includes(s.status) && retornoAtrasado(d(s).retomar_em, s.ultima_caroline_em, agora))
      .map(s => ({ empresa: s.empresa || s.nome, combinado: curto(d(s).combinado, 80), para: diaBr(new Date(d(s).retomar_em)), conversaId: s.conversaId })),
  };

  // 9. Demonstrações e dados que faltam
  const demonstracoes = (await prisma.atividade.findMany({ where: { tipo: 'REUNIAO', data_prevista: { gte: new Date(agora.getTime() - 30 * 864e5) } }, select: { titulo: true, status: true, data_prevista: true }, orderBy: { data_prevista: 'desc' } }))
    .map(r => ({ titulo: r.titulo, status: r.status, data: diaBr(r.data_prevista) }));
  const dados_faltando = [
    { item: 'Demonstrações passadas ainda sem resultado (realizada, faltou, remarcada)', quantos: demonstracoes.filter(x => x.status === 'PENDENTE' && x.data && x.data < diaBr(agora)!).length },
    { item: 'Leads que responderam sem o sistema atual conhecido', quantos: vivos.length - comSistema },
    { item: 'Leads que responderam sem saber quem decide', quantos: vivos.filter(v => !v.decisor && v.interlocutor !== 'decisor').length },
    { item: 'Leads que responderam sem número de computadores', quantos: vivos.filter(v => !v.computadores).length },
  ];

  // 10. Leitura das conversas pela IA (os 25 com mais sinal): chance, por quê e próximo passo + padrões gerais
  let analise_ia: null | { principal: string; padroes: string[]; engajamento: string[]; ate_proposta: string[]; como_converter: string[]; campanhas: string[]; acoes: Acao[] } = null;
  if (opts.ia !== false) {
    const lidos = vivos.filter(v => v.conversaId && (porConv.get(v.conversaId) || []).some(m => m.direcao === 'ENTRADA')).slice(0, 25);
    const bloco = lidos.map((v, i) => `### ${i + 1}. ${v.empresa} (${v.segmento || 'ramo?'}, ${v.cidade || 'cidade?'}) · status ${v.status} · agente ${v.agente}\n` +
      (porConv.get(v.conversaId!) || []).slice(-18).map(m => `${m.direcao === 'ENTRADA' ? 'CLIENTE' : 'NÓS'}: ${curto(semContato(m.tipo === 'AUDIO' ? (m.transcricao || '[áudio]') : m.conteudo), 220)}`).join('\n')).join('\n\n');
    const contexto = JSON.stringify({ numeros, fila, ranking_agente: ranking.agente, ranking_quem_respondeu: ranking.quem_respondeu, propostas_paradas: paradas.length, ja_clientes_contatados: jaClientes });
    try {
      const { chamarGemini } = await import('./ia-gemini.service');
      const { lerJsonIa } = await import('@/lib/assistente/ia-texto');
      const r = lerJsonIa<any>(await chamarGemini(prisma, {
        sistema: 'Você é o Analista de Resultados do comercial da Prosystem Sistemas (ERP e PDV para farmácias, drogarias, manipulação e padarias, Vitória/ES). Escreve para a gestora comercial, que não é técnica: português do Brasil, frases curtas, números, nomes de empresa, sem jargão, sem travessão, sem emoji. Nunca invente fato que não esteja nas conversas ou nos números.',
        partes: [{ text: `Números da semana e do mês: ${contexto}\n\nConversas dos agentes com os leads que mais deram sinal (mais recentes por último):\n\n${bloco}\n\nPara cada conversa numerada, diga a chance de virar contrato em até 2 semanas (alta, media ou baixa), por quê em uma frase (o que o cliente disse) e o próximo passo concreto (quem faz, como e quando). Depois, olhando tudo: o principal recado da semana (1 frase com número), até 6 padrões que travam as conversas (com exemplo real), o que fazer para aumentar o engajamento, como chegar ao menos até a proposta, como converter mais e ideias de campanha para farmácia e padaria. Por fim, até 8 ações para a PRÓXIMA semana (segunda a sexta), cada uma com responsável (Jessica, Sarah, agentes ou gestão), dia e meta em número.\nResponda SOMENTE JSON: {"leads":[{"n":1,"chance":"alta|media|baixa","por_que":"...","proximo_passo":"..."}],"principal":"...","padroes":["..."],"engajamento":["..."],"ate_proposta":["..."],"como_converter":["..."],"campanhas":["..."],"acoes":[{"acao":"...","responsavel":"...","quando":"seg 26/10","meta":"..."}]}` }],
        json: true, temperatura: 0.3, timeoutMs: 180_000,
      }));
      if (r) {
        for (const x of Array.isArray(r.leads) ? r.leads : []) {
          const v = lidos[Number(x?.n) - 1];
          if (!v) continue;
          v.chance = ['alta', 'media', 'baixa'].includes(x.chance) ? x.chance : null;
          v.por_que = curto(x.por_que, 240);
          v.proximo_passo = curto(x.proximo_passo, 240);
        }
        const lista = (a: unknown) => (Array.isArray(a) ? a.map(t => curto(t, 400)).filter(Boolean) as string[] : []).slice(0, 8);
        analise_ia = { principal: curto(r.principal, 300) || '', padroes: lista(r.padroes), engajamento: lista(r.engajamento), ate_proposta: lista(r.ate_proposta), como_converter: lista(r.como_converter), campanhas: lista(r.campanhas),
          acoes: (Array.isArray(r.acoes) ? r.acoes : []).slice(0, 8)
            .map((a: any): Acao => ({ acao: curto(a?.acao, 240) || '', responsavel: curto(a?.responsavel, 40) || '', quando: curto(a?.quando, 30) || '', meta: curto(a?.meta, 120) || '', origem: 'ia' }))
            .filter((a: Acao) => a.acao) };
      }
    } catch (e: any) {
      console.error('[ANALISTA] leitura das conversas:', e?.message || e);
    }
  }

  // 11. Ações da próxima semana: as que saem direto dos dados (sempre) + as sugeridas pela IA
  const prox = proximaSemana(agora);
  const quentes = vivos.filter(v => v.temperatura === 'QUENTE');
  const mornos = vivos.filter(v => v.temperatura === 'MORNO');
  const demosSemResultado = demonstracoes.filter(x => x.status === 'PENDENTE' && x.data && x.data < diaBr(agora)!).length;
  const somaParada = Math.round(paradas.reduce((t, p) => t + (p.mensalidade || 0), 0));
  const acoes = ([
    quentes.length ? { acao: `Ligar para os ${quentes.length} leads quentes: ${quentes.slice(0, 4).map(q => q.empresa).join(', ')}${quentes.length > 4 ? ' e outros' : ''}`, responsavel: 'Jessica', quando: prox.seg, meta: `${quentes.length} ligações e proposta para quem pedir`, origem: 'dados' } : null,
    paradas.length ? { acao: `Reativar por telefone as ${paradas.length} propostas paradas (R$ ${somaParada.toLocaleString('pt-BR')}/mês)`, responsavel: 'Jessica e Sarah', quando: `${prox.seg} a ${prox.ter}`, meta: `${Math.max(1, Math.ceil(paradas.length * 0.15))} propostas reabertas`, origem: 'dados' } : null,
    mornos.length ? { acao: `Marcar demonstração com os ${mornos.length} leads mornos, oferecendo dois horários fixos`, responsavel: 'Jessica', quando: `${prox.seg} a ${prox.qua}`, meta: `${Math.max(1, Math.ceil(mornos.length / 3))} demonstrações`, origem: 'dados' } : null,
    decisores.retornos_atrasados.length ? { acao: `Cumprir os ${decisores.retornos_atrasados.length} retornos combinados que ficaram para trás`, responsavel: 'agentes (conferir no Escritório)', quando: prox.seg, meta: 'nenhum retorno atrasado', origem: 'dados' } : null,
    demosSemResultado ? { acao: `Registrar o resultado das ${demosSemResultado} demonstrações passadas que estão sem resultado na agenda`, responsavel: 'Jessica', quando: prox.seg, meta: 'todas com resultado', origem: 'dados' } : null,
    jaClientes ? { acao: `Ver por que ${jaClientes} lojas contatadas no mês já eram clientes e tirar clientes da lista do buscador`, responsavel: 'gestão', quando: prox.ter, meta: 'nenhum cliente chamado como lead', origem: 'dados' } : null,
  ].filter(Boolean)) as Acao[];

  const relatorio = {
    semana: diaBr(SEM), gerado_em: agora.toISOString(), numeros, fila, ja_clientes_contatados: jaClientes, ranking,
    por_temperatura: { QUENTE: vivos.filter(v => v.temperatura === 'QUENTE').length, MORNO: vivos.filter(v => v.temperatura === 'MORNO').length, FRIO: vivos.filter(v => v.temperatura === 'FRIO').length },
    leads: vivos.slice(0, 120),
    propostas_paradas: paradas, mensalidade_parada: paradas.reduce((t, p) => t + (p.mensalidade || 0), 0),
    sistemas: [...sistemas.values()].sort((a, b2) => b2.leads - a.leads), sistema_conhecido: { com: comSistema, total: vivos.length, pct: pct(comSistema, vivos.length) },
    decisores, demonstracoes, dados_faltando, analise_ia,
    proxima_semana: { de: prox.seg, ate: prox.sex, acoes: [...acoes, ...(analise_ia?.acoes || [])] },
  };

  await prisma.configuracaoIntegracao.upsert({
    where: { chave: PREFIXO + relatorio.semana },
    create: { chave: PREFIXO + relatorio.semana, valor: JSON.stringify(relatorio), descricao: 'Relatório do Analista de Resultados', updated_by: 'analista' },
    update: { valor: JSON.stringify(relatorio), updated_by: 'analista' },
  });

  if (opts.enviar) {
    const texto = mensagemWhatsapp({
      semana: brt(SEM).toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('/'),
      contatados: numeros.semana.contatados, humanos: numeros.semana.humanos, avancaram: numeros.semana.avancaram,
      propostas: numeros.semana.propostas, contratos: numeros.semana.contratos,
      quentes: vivos.filter(v => v.temperatura === 'QUENTE'), mornos: relatorio.por_temperatura.MORNO,
      propostasParadas: paradas.length, mensalidadeParada: relatorio.mensalidade_parada, principal: analise_ia?.principal || null,
      link: `${baseUrl()}/analista?semana=${relatorio.semana}`,
    });
    await enviarAoDestino(prisma, texto);
  }
  return relatorio;
}

/**
 * O resumo vai SÓ para um WhatsApp (pedido da Jessica, 21/10/2026), não para a lista da gestão. O número fica no banco
 * (ConfiguracaoIntegracao `analista.whatsapp_destino`), nunca no Git; sem número configurado, nada é enviado.
 */
export const CHAVE_DESTINO = 'analista.whatsapp_destino';
async function enviarAoDestino(prisma: PrismaClient, texto: string) {
  const numero = ((await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_DESTINO } }).catch(() => null))?.valor || '').replace(/\D/g, '');
  if (numero.length < 12) { console.error('[ANALISTA] sem WhatsApp de destino configurado; resumo não enviado'); return; }
  const { obterInstanciaEmpresa } = await import('@/lib/whatsapp-empresa');
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) { console.error('[ANALISTA] WhatsApp da empresa desconectado; resumo não enviado'); return; }
  const evo = await import('./evolution.service');
  await evo.enviarTexto(inst.instance_token, numero, texto).catch((e: any) => console.error('[ANALISTA] envio do resumo:', e?.message || e));
}

/** Relatório guardado de uma semana (AAAA-MM-DD da segunda) ou o mais recente. */
export async function lerAnaliseResultados(prisma: PrismaClient, semana?: string | null) {
  const r = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana)
    ? await prisma.configuracaoIntegracao.findUnique({ where: { chave: PREFIXO + semana } })
    : await prisma.configuracaoIntegracao.findFirst({ where: { chave: { startsWith: PREFIXO } }, orderBy: { chave: 'desc' } });
  try { return r ? JSON.parse(r.valor) : null; } catch { return null; }
}

/** Semanas que já têm relatório, da mais nova para a mais antiga. */
export async function semanasComAnalise(prisma: PrismaClient): Promise<string[]> {
  const rs = await prisma.configuracaoIntegracao.findMany({ where: { chave: { startsWith: PREFIXO } }, select: { chave: true }, orderBy: { chave: 'desc' }, take: 52 });
  return rs.map(r => r.chave.slice(PREFIXO.length));
}
