// Painel da IA: visão panorâmica do Escritório virtual num período (hoje / 7 / 30 dias).
// Quatro blocos: funil dos agentes, produtividade por agente, atendimento e horários,
// equipe/qualidade/mercado. Só leitura; contas puras em lib/painel-ia.ts.
import { PrismaClient } from '@prisma/client';
import { AGENTES } from '@/lib/assistente/escritorio';
import { montarFunil, resumirMensagens } from '@/lib/painel-ia';
import { montarEscritorio } from './escritorio.service';

const zero = () => 0;
const ROTULO_ORIGEM: Record<string, string> = { PROSPECCAO: 'Prospecção', WHATSAPP: 'WhatsApp', CAMPANHA: 'Campanha', PROPOSTA: 'Proposta', INDICACAO: 'Indicação', TRAFEGO: 'Tráfego pago', VISITA: 'Visita', CLIENTE_ANTIGO: 'Cliente antigo' };

export async function montarPainelIa(prisma: PrismaClient, periodo: { inicio: Date; fim: Date }, agora = new Date()) {
  const no = { gte: periodo.inicio, lte: periodo.fim };

  const [msgs, estado] = await Promise.all([
    prisma.whatsappMensagem.findMany({ where: { created_at: no }, select: { conversaId: true, direcao: true, enviada_por: true, status: true, created_at: true }, take: 60000 }),
    montarEscritorio(prisma, agora).catch(() => []),
  ]);
  const m = resumirMensagens(msgs);

  // ── Funil dos agentes ──────────────────────────────────────────────────────
  const [contatos, qualificados, demos, demosRealizadas, propostas, fechados] = await Promise.all([
    prisma.whatsappConversa.count({ where: { created_at: no } }),
    prisma.whatsappConversa.count({ where: { created_at: no, estagio_funil: { not: 'NOVO_CONTATO' } } }),
    prisma.atividade.count({ where: { tipo: 'REUNIAO', created_at: no, OR: [{ whatsapp_conversa_id: { not: null } }, { created_by: 'lead_whatsapp' }] } }),
    prisma.atividade.count({ where: { tipo: 'REUNIAO', created_at: no, status: 'REALIZADA', OR: [{ whatsapp_conversa_id: { not: null } }, { created_by: 'lead_whatsapp' }] } }),
    prisma.propostaComercial.count({ where: { deleted_at: null, OR: [{ wpp_enviada_em: no }, { created_at: no, status: { not: 'RASCUNHO' } }] } }),
    prisma.propostaComercial.count({ where: { data_aceite: no } }),
  ]);
  const funil = montarFunil([['Contatos novos no WhatsApp', contatos], ['Qualificados / interessados', qualificados], ['Demonstrações marcadas', demos], ['Propostas enviadas', propostas], ['Vendas fechadas', fechados]]);

  const leadsOrigem = await prisma.lead.groupBy({ by: ['origem'], where: { created_at: no }, _count: { _all: true } }).catch(() => [] as any[]);
  const origens = (leadsOrigem as any[]).map(l => ({ origem: ROTULO_ORIGEM[l.origem] || l.origem || 'Sem origem', leads: l._count._all })).sort((a, b) => b.leads - a.leads);

  // SDRs (Caroline: leads de campanha e do Heitor; Julio: base antiga; Luiz Felipe: propostas paradas).
  const sdrs = await Promise.all(['caroline', 'julio', 'luiz_felipe'].map(async agente => {
    const [abordados, responderam, demo, humano, semInteresse, fila, aprovar] = await Promise.all([
      prisma.sdrLead.count({ where: { agente, primeiro_envio_em: no } }),
      prisma.sdrLead.count({ where: { agente, primeiro_envio_em: no, ultima_lead_em: { not: null } } }),
      prisma.sdrLead.count({ where: { agente, status: 'DEMO', updated_at: no } }),
      prisma.sdrLead.count({ where: { agente, status: { in: ['HUMANO', 'VENDEDORA'] }, updated_at: no } }),
      prisma.sdrLead.count({ where: { agente, status: 'SEM_INTERESSE', updated_at: no } }),
      prisma.sdrLead.count({ where: { agente, status: 'FILA' } }),
      prisma.sdrMensagem.count({ where: { status: 'PENDENTE', sdrId: { in: (await prisma.sdrLead.findMany({ where: { agente }, select: { id: true } })).map(x => x.id) } } }),
    ]);
    return { agente, nome: AGENTES.find(a => a.id === agente)?.nome || agente, abordados, responderam, taxa_resposta: abordados ? Math.round((responderam / abordados) * 100) : null, demo, humano, sem_interesse: semInteresse, fila, para_aprovar: aprovar };
  }));

  // ── Entregas de cada agente no período (além das mensagens) ────────────────
  const docs = (origem: string | string[], extra: any = {}) => prisma.especialistaDoc.count({ where: { origem: Array.isArray(origem) ? { in: origem } : origem, created_at: no, ...extra } }).catch(zero);
  const [lembretes, campEnviados, campFalhas, campFila, boasVindas, pesquisasPv, analisadas, amostras, amostrasTotal, tarefasMarta, descontos,
    pesquisasSofia, rafaelDocs, oliviaDocs, milaDocs, joanaDocs, heitorCad, heitorParaCaroline, avisosOtavio] = await Promise.all([
    prisma.atividade.count({ where: { lembrete_whatsapp_em: no } }),
    prisma.campanhaEnvio.count({ where: { status: 'ENVIADO', enviado_em: no } }),
    prisma.campanhaEnvio.count({ where: { status: 'FALHA', enviado_em: no } }),
    prisma.campanhaEnvio.count({ where: { status: 'PENDENTE', campanha: { status: 'ENVIANDO' } } }),
    prisma.propostaComercial.count({ where: { wpp_boasvindas_em: no } }),
    prisma.propostaComercial.count({ where: { wpp_pesquisa_em: no } }),
    prisma.whatsappConversa.count({ where: { ia_sugerido_em: no } }),
    prisma.iaAmostra.count({ where: { created_at: no } }),
    prisma.iaAmostra.count(),
    prisma.atividade.count({ where: { descricao: 'Lançada pelo WhatsApp (assistente do CRM).', created_at: no } }),
    prisma.propostaComercial.count({ where: { desconto_aprov_em: no } }),
    prisma.pesquisaSetor.count({ where: { created_at: no } }),
    docs(['estudo', 'duvida', 'revisao', 'treinamento', 'abordagem']),
    docs('olivia'), docs('mila'), docs('joana'),
    prisma.prospeccaoLocal.count({ where: { status: 'CADASTRADO', cadastrado_em: no } }).catch(zero),
    prisma.sdrLead.count({ where: { criado_por: 'heitor', created_at: no } }).catch(zero),
    (prisma as any).avisoTecnico.count({ where: { created_at: no, origem: { not: 'GESTAO' } } }).catch(zero),
  ]);
  const entregas: Record<string, { rotulo: string; valor: number }[]> = {
    bia: [{ rotulo: 'contatos novos', valor: contatos }, { rotulo: 'qualificados', valor: qualificados }],
    lurdinha: [{ rotulo: 'demos marcadas', valor: demos }, { rotulo: 'lembretes', valor: lembretes }],
    clarice: [],
    luiz_felipe: [{ rotulo: 'propostas retomadas', valor: sdrs[2].abordados }],
    zequinha: [{ rotulo: 'campanhas enviadas', valor: campEnviados }, { rotulo: 'falhas', valor: campFalhas }, { rotulo: 'na fila', valor: campFila }],
    helena: [{ rotulo: 'boas-vindas', valor: boasVindas }, { rotulo: 'pesquisas', valor: pesquisasPv }],
    laya: [{ rotulo: 'conversas analisadas', valor: analisadas }, { rotulo: 'exemplos ensinados', valor: amostras }],
    marta: [{ rotulo: 'tarefas lançadas', valor: tarefasMarta }, { rotulo: 'descontos decididos', valor: descontos }],
    sofia: [{ rotulo: 'pesquisas', valor: pesquisasSofia }],
    caroline: [{ rotulo: 'leads abordados', valor: sdrs[0].abordados }, { rotulo: 'demos', valor: sdrs[0].demo }],
    julio: [{ rotulo: 'leads retomados', valor: sdrs[1].abordados }, { rotulo: 'responderam', valor: sdrs[1].responderam }],
    rafael: [{ rotulo: 'documentos escritos', valor: rafaelDocs }],
    olivia: [{ rotulo: 'documentos', valor: oliviaDocs }],
    heitor: [{ rotulo: 'empresas cadastradas', valor: heitorCad }, { rotulo: 'leads para a Caroline', valor: heitorParaCaroline }],
    mila: [{ rotulo: 'documentos de CS', valor: milaDocs }],
    otavio: [{ rotulo: 'avisos ao técnico', valor: avisosOtavio }],
    joana: [{ rotulo: 'informativos', valor: joanaDocs }],
  };
  const agentes = AGENTES.map(a => {
    const e: any = (estado as any[]).find(x => x.id === a.id) || {};
    const msg = m.por_agente[a.id] || null;
    return {
      id: a.id, nome: a.nome, funcao: a.funcao, cor: a.cor, status: e.status || null, observacao: e.observacao || null, ultima: e.ultima || null,
      mensagens: msg?.mensagens || 0, conversas: msg?.conversas || 0, responderam: msg?.responderam || 0,
      taxa_resposta: msg?.conversas ? Math.round((msg.responderam / msg.conversas) * 100) : null, falhas: msg?.falhas || 0,
      entregas: entregas[a.id] || [],
    };
  });

  // ── Atendimento agora ─────────────────────────────────────────────────────
  const ativas = { finalizada_em: null, ultima_em: { gte: new Date(agora.getTime() - 7 * 864e5) } };
  const [aguardando, semDono, paraAprovar] = await Promise.all([
    prisma.whatsappConversa.count({ where: { ...ativas, nao_lidas: { gt: 0 } } }),
    prisma.whatsappConversa.count({ where: { ...ativas, dono_id: null } }),
    prisma.sdrMensagem.count({ where: { status: 'PENDENTE' } }),
  ]);

  // ── Equipe, qualidade e mercado ───────────────────────────────────────────
  const [notasTipo, duvidasAbertas, ultimaReuniao, csat, notaPv, docsParaAprovar] = await Promise.all([
    (prisma as any).agenteNota.groupBy({ by: ['tipo'], where: { created_at: no }, _count: { _all: true } }).catch(() => []),
    (prisma as any).agenteNota.count({ where: { tipo: 'DUVIDA', resolvida_em: null } }).catch(zero),
    (prisma as any).agenteNota.findFirst({ where: { tipo: 'REUNIAO' }, orderBy: { created_at: 'desc' }, select: { assunto: true, texto: true, created_at: true } }).catch(() => null),
    prisma.csatSurvey.aggregate({ where: { status: 'RESPONDIDO', respondido_at: no }, _avg: { nota: true }, _count: { _all: true } }).catch(() => null),
    prisma.propostaComercial.aggregate({ where: { wpp_pesquisa_em: no, wpp_pesquisa_nota: { not: null } }, _avg: { wpp_pesquisa_nota: true }, _count: { _all: true } }).catch(() => null),
    prisma.especialistaDoc.count({ where: { status: 'PROPOSTO' } }).catch(zero),
  ]);
  const nota = (t: string) => ((notasTipo as any[]).find(x => x.tipo === t)?._count?._all) || 0;
  const [implAndamento, implEspera] = await Promise.all([
    prisma.implantacao.count({ where: { concluida_fila_em: null, data_conclusao: null, status: { not: 'CANCELADA' } } }).catch(zero),
    prisma.implantacaoEspera.count({ where: { fim: null } }).catch(zero),
  ]);

  return {
    periodo: { inicio: periodo.inicio.toISOString(), fim: periodo.fim.toISOString() },
    resumo: {
      contatos_novos: contatos, mensagens_recebidas: m.totais.recebidas, enviadas_agentes: m.totais.enviadas_agentes, enviadas_pessoas: m.totais.enviadas_pessoas,
      automacao_pct: m.totais.automacao_pct, demos, vendas_fechadas: fechados, falhas_envio: m.totais.falhas,
      agentes_ligados: agentes.filter(a => a.status && a.status !== 'desligado').length, agentes_total: agentes.length,
    },
    funil, origens, sdrs, agentes,
    atendimento: {
      agora: { aguardando_resposta: aguardando, sem_dono: semDono, mensagens_para_aprovar: paraAprovar },
      primeira_resposta: m.primeira_resposta, mapa: m.mapa, por_dia: m.por_dia, conversas_no_periodo: m.totais.conversas,
    },
    equipe: {
      mural: { duvidas: nota('DUVIDA'), respostas: nota('RESPOSTA'), orientacoes: nota('ORIENTACAO'), experiencias: nota('EXPERIENCIA'), contexto: nota('CONTEXTO'), conversas: nota('CONVERSA'), reunioes: nota('REUNIAO'), duvidas_abertas: duvidasAbertas },
      ultima_reuniao: ultimaReuniao ? { assunto: ultimaReuniao.assunto, texto: String(ultimaReuniao.texto || '').slice(0, 600), em: ultimaReuniao.created_at } : null,
      laya: { analisadas, ensinadas: amostras, ensinadas_total: amostrasTotal },
      campanhas: { enviadas: campEnviados, falhas: campFalhas, na_fila: campFila },
      pos_venda: { boas_vindas: boasVindas, pesquisas: pesquisasPv, nota_pesquisa: notaPv?._avg?.wpp_pesquisa_nota ?? null, respostas_pesquisa: notaPv?._count?._all || 0,
        csat_media: csat?._avg?.nota ?? null, csat_respostas: csat?._count?._all || 0 },
      implantacao: { em_andamento: implAndamento, em_espera: implEspera, avisos: avisosOtavio },
      mercado: { pesquisas_sofia: pesquisasSofia, docs_rafael: rafaelDocs, docs_olivia: oliviaDocs, informativos_joana: joanaDocs, docs_mila: milaDocs, para_aprovar: docsParaAprovar },
    },
  };
}
