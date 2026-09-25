import type { PrismaClient } from '@prisma/client';
import { limitesPeriodo } from '@/lib/painel-tv';
import { AGENTES, statusAgente, maisRecente, acaoRegistrada, type AgenteId, type StatusAgente } from '@/lib/assistente/escritorio';

// Escritório virtual (somente leitura): o que cada agente do assistente fez hoje,
// montado com os registros que o CRM já guarda (mensagens por remetente, atividades,
// propostas, campanhas, etiquetas da Laya) + registro em memória da Marta.

type Acao = { texto: string; em: Date } | null;
export type EstadoAgente = {
  id: AgenteId; nome: string; funcao: string; cor: string; status: StatusAgente;
  ultima: { texto: string; em: string } | null; numeros: { rotulo: string; valor: number | string }[]; observacao?: string;
};

const nomeContato = (c: { contato_nome: string | null; contato_numero: string } | null | undefined) => (c?.contato_nome || c?.contato_numero || 'contato');

/** Últimas ações de um agente (para o painel "Ver trabalho"). Somente leitura. */
export async function historicoAgente(prisma: PrismaClient, id: AgenteId): Promise<{ texto: string; em: string }[]> {
  const msgs = async (remetente: string, verbo: string) => (await prisma.whatsappMensagem.findMany({
    where: { direcao: 'SAIDA', enviada_por: remetente }, orderBy: { created_at: 'desc' }, take: 10,
    select: { created_at: true, conteudo: true, conversa: { select: { contato_nome: true, contato_numero: true } } },
  })).map(m => ({ texto: `${verbo} ${nomeContato(m.conversa)}: "${(m.conteudo || '').replace(/\s+/g, ' ').slice(0, 90)}"`, em: m.created_at.toISOString() }));
  switch (id) {
    case 'bia': return msgs('bot', 'Respondeu');
    case 'clarice': return msgs('assistente_ia', 'Tirou dúvida de');
    case 'luiz_felipe': return [...await agendaSdr(prisma, 'luiz_felipe'), ...await msgs('cadencia_automatica', 'Follow-up com')];
    case 'lurdinha': return (await prisma.atividade.findMany({ where: { created_by: 'lead_whatsapp' }, orderBy: { created_at: 'desc' }, take: 10, select: { titulo: true, data_prevista: true, created_at: true, status: true } }))
      .map(a => ({ texto: `${a.titulo.replace(/^Demonstração Prosystem · /, 'Demo com ')} para ${a.data_prevista?.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (${a.status.toLowerCase()})`, em: a.created_at.toISOString() }));
    case 'zequinha': return (await prisma.campanhaEnvio.findMany({ where: { status: { in: ['ENVIADO', 'FALHA'] } }, orderBy: { enviado_em: 'desc' }, take: 10, select: { nome: true, numero: true, status: true, enviado_em: true, campanha: { select: { nome: true } } } }))
      .map(e => ({ texto: `${e.status === 'ENVIADO' ? 'Enviou' : 'Falhou'} "${e.campanha.nome}" para ${e.nome || e.numero}`, em: (e.enviado_em || new Date()).toISOString() }));
    case 'helena': return (await prisma.propostaComercial.findMany({ where: { OR: [{ wpp_boasvindas_em: { not: null } }, { wpp_pesquisa_em: { not: null } }] }, orderBy: { updated_at: 'desc' }, take: 10, select: { nome_fantasia: true, razao_social: true, wpp_boasvindas_em: true, wpp_pesquisa_em: true, wpp_pesquisa_nota: true } }))
      .map(p => ({ texto: `${(p.nome_fantasia || p.razao_social || 'Cliente').trim()}: ${p.wpp_pesquisa_em ? `pesquisa enviada${p.wpp_pesquisa_nota ? ` (nota ${p.wpp_pesquisa_nota === 3 ? 'ótima' : p.wpp_pesquisa_nota === 2 ? 'regular' : 'ruim'})` : ''}` : 'boas-vindas enviadas'}`, em: (p.wpp_pesquisa_em || p.wpp_boasvindas_em)!.toISOString() }));
    case 'laya': return (await prisma.whatsappConversa.findMany({ where: { ia_sugerido_em: { not: null } }, orderBy: { ia_sugerido_em: 'desc' }, take: 10, select: { contato_nome: true, contato_numero: true, ia_sugestao: true, ia_sugerido_em: true } }))
      .map(c => { const s: any = c.ia_sugestao || {}; return { texto: `${nomeContato(c)}: ${s.segmento || '?'} · ${s.intencao || '?'}${Number(s.cancelar) >= 0.5 ? ' · risco de cancelar' : ''}`, em: c.ia_sugerido_em!.toISOString() }; });
    case 'sofia': return (await prisma.pesquisaSetor.findMany({ orderBy: { created_at: 'desc' }, take: 10, select: { titulo: true, created_at: true, itens: true } }))
      .map(p => ({ texto: `Pesquisou "${p.titulo}" (${Array.isArray(p.itens) ? (p.itens as any[]).length : 0} assuntos)`, em: p.created_at.toISOString() }));
    case 'caroline': case 'julio': return agendaSdr(prisma, id);
    case 'marta': { const a = acaoRegistrada('marta'); return a ? [{ texto: a.texto, em: a.em.toISOString() }] : []; }
    default: return [];
  }
}

const STATUS_SDR: Record<string, string> = { FILA: 'na fila', AGUARDANDO: 'esperando resposta', CONVERSANDO: 'conversando', DEMO: 'demonstração', VENDEDORA: 'com a vendedora', SEM_INTERESSE: 'sem interesse', SEM_RESPOSTA: 'sem resposta', HUMANO: 'uma pessoa assumiu', SAIU: 'pediu para sair' };
const dataHora = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Agenda de um agente que conversa (Caroline, Julio, Luiz Felipe): com quem está falando e o próximo passo. */
export async function agendaSdr(prisma: PrismaClient, agente: string): Promise<{ texto: string; em: string }[]> {
  const ls = await prisma.sdrLead.findMany({ where: { agente }, orderBy: { updated_at: 'desc' }, take: 40 });
  const pend = new Set((await prisma.sdrMensagem.findMany({ where: { status: 'PENDENTE', sdrId: { in: ls.map(l => l.id) } }, select: { sdrId: true } })).map(m => m.sdrId));
  const ordem = (l: any) => (pend.has(l.id) ? 0 : l.status === 'CONVERSANDO' ? 1 : (l.dados as any)?.retomar_em ? 2 : l.status === 'AGUARDANDO' ? 3 : l.status === 'FILA' ? 4 : 5);
  return ls.sort((a, b) => ordem(a) - ordem(b)).map(l => {
    const d: any = l.dados || {};
    const quem = `${l.nome || l.numero}${l.empresa ? ` (${l.empresa})` : ''}`;
    const proximo = pend.has(l.id) ? '⏳ mensagem esperando sua aprovação'
      : d.retomar_em ? `📅 combinado: chamar ${dataHora(new Date(d.retomar_em))}`
      : d.ciclo_em ? `🔁 sem resposta: volta a chamar ${dataHora(new Date(d.ciclo_em))} (ciclo ${d.ciclos}/3)`
      : l.status === 'AGUARDANDO' && d.parou_em ? `⏸ parou de responder ${dataHora(new Date(d.parou_em))}: retomando (${l.tentativas}/3)`
      : l.status === 'CONVERSANDO' ? '💬 conversando agora'
      : l.status === 'AGUARDANDO' ? `⏱ esperando resposta (${l.tentativas}/3)`
      : l.status === 'FILA' ? '🕐 na fila para o primeiro contato'
      : `✔ ${STATUS_SDR[l.status] || l.status}`;
    const nota = l.nota != null ? ` · nota ${l.nota}` : '';
    return { texto: `${quem} · ${proximo}${nota}`, em: (d.retomar_em ? new Date(d.retomar_em) : l.updated_at).toISOString() };
  });
}

export async function montarEscritorio(prisma: PrismaClient, agora = new Date()): Promise<EstadoAgente[]> {
  const { inicioHoje, fimHoje } = limitesPeriodo(agora);
  const hoje = { gte: inicioHoje, lt: fimHoje };

  const saidas = async (remetente: string) => {
    const [total, ultima] = await Promise.all([
      prisma.whatsappMensagem.count({ where: { direcao: 'SAIDA', enviada_por: remetente, created_at: hoje } }),
      prisma.whatsappMensagem.findFirst({
        where: { direcao: 'SAIDA', enviada_por: remetente }, orderBy: { created_at: 'desc' },
        select: { created_at: true, conteudo: true, conversa: { select: { contato_nome: true, contato_numero: true } } },
      }),
    ]);
    return { total, ultima };
  };
  const cfgRows = await prisma.configuracaoIntegracao.findMany({
    where: { chave: { in: ['whatsapp.triagem.ativa', 'assistente.tira_duvidas', 'assistente.gemini_chave', 'assistente.posvenda'] } },
  }).catch(() => []);
  const cfg = (k: string) => cfgRows.find(r => r.chave === k)?.valor;

  // Bia — triagem
  const bot = await saidas('bot');
  const qualificados = await prisma.leadObservacao.count({ where: { created_at: hoje, created_by: 'bot', created_by_name: 'Triagem automática' } });
  const novos = await prisma.whatsappConversa.count({ where: { created_at: hoje } });
  const bia: Acao = bot.ultima ? { texto: `respondeu ${nomeContato(bot.ultima.conversa)}`, em: bot.ultima.created_at } : null;

  // Lurdinha — demos
  const demosHoje = await prisma.atividade.count({ where: { created_by: 'lead_whatsapp', created_at: hoje } });
  const lembretes = await prisma.atividade.count({ where: { lembrete_whatsapp_em: hoje } });
  const proxima = await prisma.atividade.findFirst({ where: { tipo: 'REUNIAO', whatsapp_conversa_id: { not: null }, status: { in: ['PENDENTE', 'CONFIRMADA'] }, data_prevista: { gt: agora } }, orderBy: { data_prevista: 'asc' }, select: { titulo: true, data_prevista: true } });
  const ultDemo = await prisma.atividade.findFirst({ where: { created_by: 'lead_whatsapp' }, orderBy: { created_at: 'desc' }, select: { titulo: true, created_at: true } });
  const ultLembrete = await prisma.atividade.findFirst({ where: { lembrete_whatsapp_em: { not: null } }, orderBy: { lembrete_whatsapp_em: 'desc' }, select: { titulo: true, lembrete_whatsapp_em: true } });
  const lurdinha = maisRecente<Acao>(
    ultDemo ? { texto: `marcou ${ultDemo.titulo.replace(/^Demonstração Prosystem · /, 'demo com ')}`, em: ultDemo.created_at } : null,
    ultLembrete ? { texto: `lembrou ${ultLembrete.titulo.replace(/^Demonstração Prosystem · /, '')} da demo`, em: ultLembrete.lembrete_whatsapp_em! } : null,
  );

  // Clarice — IA
  const ia = await saidas('assistente_ia');
  const temChave = !!(cfg('assistente.gemini_chave') || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
  const modoIa = cfg('assistente.tira_duvidas') || 'fora_do_horario';
  const clarice: Acao = ia.ultima ? { texto: `tirou dúvida de ${nomeContato(ia.ultima.conversa)}`, em: ia.ultima.created_at } : null;

  // Luiz Felipe — follow-up
  const fu = await saidas('cadencia_automatica');
  const emAcompanhamento = await prisma.propostaComercial.count({ where: { deleted_at: null, wpp_enviada_em: { not: null }, wpp_followup_etapa: { lt: 3 }, status: { in: ['ENVIADA', 'VISUALIZADA'] } } });
  const luiz: Acao = fu.ultima ? { texto: `fez follow-up com ${nomeContato(fu.ultima.conversa)}`, em: fu.ultima.created_at } : null;

  // Zequinha — campanhas
  const enviadosHoje = await prisma.campanhaEnvio.count({ where: { status: 'ENVIADO', enviado_em: hoje } });
  const naFila = await prisma.campanhaEnvio.count({ where: { status: 'PENDENTE', campanha: { status: 'ENVIANDO' } } });
  const ultEnvio = await prisma.campanhaEnvio.findFirst({ where: { status: 'ENVIADO' }, orderBy: { enviado_em: 'desc' }, select: { nome: true, numero: true, enviado_em: true, campanha: { select: { nome: true } } } });
  const zequinha: Acao = ultEnvio ? { texto: `enviou "${ultEnvio.campanha.nome}" para ${ultEnvio.nome || ultEnvio.numero}`, em: ultEnvio.enviado_em! } : null;

  // Helena — pós-venda
  const boasVindas = await prisma.propostaComercial.count({ where: { wpp_boasvindas_em: hoje } });
  const pesquisas = await prisma.propostaComercial.count({ where: { wpp_pesquisa_em: hoje } });
  const ultBv = await prisma.propostaComercial.findFirst({ where: { wpp_boasvindas_em: { not: null } }, orderBy: { wpp_boasvindas_em: 'desc' }, select: { nome_fantasia: true, razao_social: true, wpp_boasvindas_em: true } });
  const ultPq = await prisma.propostaComercial.findFirst({ where: { wpp_pesquisa_em: { not: null } }, orderBy: { wpp_pesquisa_em: 'desc' }, select: { nome_fantasia: true, razao_social: true, wpp_pesquisa_em: true } });
  const helena = maisRecente<Acao>(
    ultBv ? { texto: `deu boas-vindas a ${(ultBv.nome_fantasia || ultBv.razao_social || 'cliente').trim()}`, em: ultBv.wpp_boasvindas_em! } : null,
    ultPq ? { texto: `enviou pesquisa para ${(ultPq.nome_fantasia || ultPq.razao_social || 'cliente').trim()}`, em: ultPq.wpp_pesquisa_em! } : null,
  );

  // Laya — análises e treino
  const analisadas = await prisma.whatsappConversa.count({ where: { ia_sugerido_em: hoje } });
  const ensinadasHoje = await prisma.iaAmostra.count({ where: { created_at: hoje } });
  const ensinadasTotal = await prisma.iaAmostra.count();
  const ultLaya = await prisma.whatsappConversa.findFirst({ where: { ia_sugerido_em: { not: null } }, orderBy: { ia_sugerido_em: 'desc' }, select: { contato_nome: true, contato_numero: true, ia_sugerido_em: true } });
  const layaOn = await fetch(`${process.env.LAYA_URL || 'http://127.0.0.1:8765'}/health`, { signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false);
  const laya: Acao = ultLaya ? { texto: `analisou a conversa com ${nomeContato(ultLaya)}`, em: ultLaya.ia_sugerido_em! } : null;

  // Marta — gestão (registro em memória + aprovações de desconto e tarefas lançadas)
  const tarefasHoje = await prisma.atividade.count({ where: { descricao: 'Lançada pelo WhatsApp (assistente do CRM).', created_at: hoje } });
  const aprovacoesHoje = await prisma.propostaComercial.count({ where: { desconto_aprov_em: hoje } });
  const marta = acaoRegistrada('marta');

  // Sofia — pesquisas do setor
  const pesquisasMes = await prisma.pesquisaSetor.count({ where: { created_at: { gte: new Date(agora.getTime() - 30 * 86400000) } } });
  const ultPesq = await prisma.pesquisaSetor.findFirst({ orderBy: { created_at: 'desc' }, select: { titulo: true, created_at: true } });
  const sofia = maisRecente<Acao>(ultPesq ? { texto: `pesquisou "${ultPesq.titulo.slice(0, 50)}"`, em: ultPesq.created_at } : null, acaoRegistrada('sofia'));

  // Caroline — SDR
  const { obterConfigAgente } = await import('./caroline.service');
  const carolCfg = await obterConfigAgente(prisma, 'caroline');
  const numerosSdr = async (agente: string) => {
    const ids = (await prisma.sdrLead.findMany({ where: { agente, status: { in: ['FILA', 'AGUARDANDO', 'CONVERSANDO'] } }, select: { id: true } })).map(x => x.id);
    return Promise.all([
      prisma.sdrLead.count({ where: { agente, status: 'FILA' } }),
      prisma.sdrLead.count({ where: { agente, status: { in: ['AGUARDANDO', 'CONVERSANDO'] } } }),
      prisma.sdrLead.count({ where: { agente, status: 'DEMO' } }),
      prisma.sdrMensagem.count({ where: { status: 'PENDENTE', sdrId: { in: ids } } }),
    ]);
  };
  const [carolFila, carolConversando, carolDemos, carolPendentes] = await numerosSdr('caroline');
  const julioCfg = await obterConfigAgente(prisma, 'julio');
  const luizCfg = await obterConfigAgente(prisma, 'luiz_felipe');
  const [julioFila, julioConversando, , julioPendentes] = await numerosSdr('julio');
  const [, luizConversando, , luizPendentes] = await numerosSdr('luiz_felipe');
  const julioAtivo = await prisma.sdrLead.count({ where: { agente: 'julio' } });
  const quando = (c: { ativa: boolean; inicia_em?: string | null }) => !c.ativa ? 'Desligado: ligue no painel dele'
    : c.inicia_em && new Date(c.inicia_em) > agora ? `Começa ${new Date(c.inicia_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : undefined;
  const ultCarol = await prisma.sdrMensagem.findFirst({ where: { status: { not: 'DESCARTADA' } }, orderBy: { created_at: 'desc' }, select: { created_at: true, status: true } });
  const caroline = maisRecente<Acao>(ultCarol ? { texto: ultCarol.status === 'PENDENTE' ? 'escreveu e espera sua aprovação' : 'conversou com um lead', em: ultCarol.created_at } : null, acaoRegistrada('caroline'));

  const estado = (id: AgenteId, ligado: boolean, ultima: Acao, numeros: EstadoAgente['numeros'], observacao?: string): EstadoAgente => {
    const a = AGENTES.find(x => x.id === id)!;
    return { id, nome: a.nome, funcao: a.funcao, cor: a.cor, status: statusAgente(ligado, ultima?.em || null, agora), ultima: ultima ? { texto: ultima.texto, em: ultima.em.toISOString() } : null, numeros, observacao };
  };
  const triagemOn = cfg('whatsapp.triagem.ativa') === 'true';
  const iaOn = temChave && modoIa !== 'desligado';
  const posvendaOn = cfg('assistente.posvenda') === 'true';

  return [
    estado('bia', triagemOn, bia, [{ rotulo: 'contatos novos', valor: novos }, { rotulo: 'qualificados', valor: qualificados }, { rotulo: 'mensagens', valor: bot.total }], triagemOn ? undefined : 'Triagem desligada em Configurações'),
    estado('lurdinha', triagemOn, lurdinha, [{ rotulo: 'demos marcadas', valor: demosHoje }, { rotulo: 'lembretes', valor: lembretes }],
      proxima ? `Próxima: ${proxima.titulo.replace(/^Demonstração Prosystem · /, '')} ${proxima.data_prevista!.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : undefined),
    estado('clarice', iaOn, clarice, [{ rotulo: 'dúvidas respondidas', valor: ia.total }], !temChave ? 'Esperando a chave da IA em Configurações' : modoIa === 'fora_do_horario' ? 'Atende fora do horário comercial' : undefined),
    estado('luiz_felipe', true, luiz, [{ rotulo: 'follow-ups hoje', valor: fu.total }, { rotulo: 'propostas acompanhadas', valor: emAcompanhamento }, { rotulo: 'retomando propostas', valor: luizConversando }, { rotulo: 'para aprovar', valor: luizPendentes }], quando(luizCfg)),
    estado('zequinha', true, zequinha, [{ rotulo: 'enviadas hoje', valor: enviadosHoje }, { rotulo: 'na fila', valor: naFila }], naFila ? 'Campanha em andamento' : 'Sem campanha na fila'),
    estado('helena', posvendaOn, helena, [{ rotulo: 'boas-vindas', valor: boasVindas }, { rotulo: 'pesquisas', valor: pesquisas }], posvendaOn ? undefined : 'Pós-venda desligado em Configurações'),
    estado('laya', layaOn, laya, [{ rotulo: 'conversas analisadas', valor: analisadas }, { rotulo: 'ensinadas hoje', valor: ensinadasHoje }, { rotulo: 'ensinadas no total', valor: ensinadasTotal }], layaOn ? 'Aprendendo até 14/10' : 'Serviço da Laya fora do ar'),
    estado('sofia', temChave, sofia, [{ rotulo: 'pesquisas no mês', valor: pesquisasMes }], temChave ? 'Pesquisa toda segunda às 8h' : 'Esperando a chave da IA em Configurações'),
    estado('caroline', carolCfg.ativa, caroline, [{ rotulo: 'na fila', valor: carolFila }, { rotulo: 'conversando', valor: carolConversando }, { rotulo: 'demos', valor: carolDemos }, { rotulo: 'para aprovar', valor: carolPendentes }],
      carolCfg.pausada_motivo ? `Pausada: ${carolCfg.pausada_motivo}` : carolCfg.ativa ? (carolCfg.aprovar ? 'Você aprova cada mensagem antes de sair' : 'Enviando sozinha') : 'Desligada: ligue no painel dela'),
    estado('julio', julioCfg.ativa, maisRecente<Acao>(null, acaoRegistrada('julio')), [{ rotulo: 'na fila', valor: julioFila }, { rotulo: 'conversando', valor: julioConversando }, { rotulo: 'para aprovar', valor: julioPendentes }, { rotulo: 'retomados', valor: julioAtivo }], quando(julioCfg) || 'Retoma a base do mais novo para o mais antigo'),
    estado('marta', true, marta, [{ rotulo: 'tarefas lançadas', valor: tarefasHoje }, { rotulo: 'descontos decididos', valor: aprovacoesHoje }]),
  ];
}
