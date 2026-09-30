import type { PrismaClient } from '@prisma/client';
import { pesquisarComGemini, chamarGemini } from './ia-gemini.service';
import { lerJsonIa } from '@/lib/assistente/ia-texto';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';

// Rafael, especialista em vendas de software: os olhos e ouvidos da gestão no escritório.
// 1) ESTUDA (internet): as melhores práticas de venda de software e de vendas no geral, com
//    referências de especialistas do Brasil, e transforma em POPs, processos, exemplos e dicas.
// 2) REVISA as conversas do dia: aponta conversas deixadas de lado e as não satisfatórias, com dicas.
// 3) PROPÕE a abordagem inicial de cada agente (Caroline, Julio, Luiz Felipe) a partir das
//    conversas reais, das taxas de resposta e do que estudou. Ao aprovar, vira instrução do agente.
// Tudo fica em EspecialistaDoc (com versão); o aprovado vira parâmetro do setor.

const QUEM = [
  'Você é o Rafael, especialista em vendas de software (B2B, ERP/PDV) do time comercial da Prosystem Sistemas.',
  'A Prosystem vende sistemas de gestão (ERP) e frente de caixa (PDV) para farmácias, drogarias, farmácias de manipulação, padarias, confeitarias e varejo no Brasil, com vendas pelo WhatsApp (agentes de IA + vendedora humana) e demonstração online.',
  'Você é os olhos e ouvidos da gestora (Jessica): organiza processos, cria POPs e exemplos práticos, aponta o que não está bom e dá dicas objetivas.',
  'Escreva em português do Brasil, simples e direto, pronto para usar no dia a dia. Nunca invente números da Prosystem nem prometa preço.',
].join('\n');

type DocNovo = { tipo: 'POP' | 'PROCESSO' | 'EXEMPLO' | 'DICA' | 'ALERTA' | 'ABORDAGEM' | 'CONCORRENCIA' | 'TREINAMENTO'; titulo: string; conteudo: string; agente_alvo?: string | null };

/** Grava como nova versão quando já existe um documento com o mesmo título (o anterior é arquivado). */
async function gravarDoc(prisma: PrismaClient, d: DocNovo, origem: string, fontes?: any) {
  const titulo = d.titulo.trim().slice(0, 250);
  const anterior = await prisma.especialistaDoc.findFirst({ where: { titulo, tipo: d.tipo, status: { not: 'ARQUIVADO' } }, orderBy: { versao: 'desc' } });
  if (anterior?.status === 'PROPOSTO') await prisma.especialistaDoc.update({ where: { id: anterior.id }, data: { status: 'ARQUIVADO' } });
  return prisma.especialistaDoc.create({
    data: {
      tipo: d.tipo, titulo, conteudo: String(d.conteudo || '').slice(0, 60000), agente_alvo: d.agente_alvo || null,
      versao: (anterior?.versao || 0) + 1, origem, fontes: fontes ?? undefined, status: 'PROPOSTO',
    },
  });
}

async function avisar(prisma: PrismaClient, texto: string) {
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', texto, { somenteAprovadora: true }).catch(() => {});
}

// ── 1) Estudo ────────────────────────────────────────────────────────────────
export async function estudarVendas(prisma: PrismaClient, tema: string | null = null) {
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const aprovados = await prisma.especialistaDoc.findMany({ where: { status: 'APROVADO', tipo: { in: ['POP', 'PROCESSO'] } }, select: { titulo: true }, take: 40 });
  const pergunta = [
    tema ? `Estude a fundo: "${tema}", aplicado à venda de sistemas para farmácias e padarias pelo WhatsApp.`
      : 'Pesquise o que os maiores especialistas de vendas do Brasil (vendas B2B, venda de software/SaaS, prospecção, pré-vendas/SDR, negociação e pós-venda) ensinam de mais atual e prático, e o que funciona na venda de ERP/PDV para pequenos varejistas (farmácias e padarias) pelo WhatsApp.',
    'Transforme em material de trabalho do time: POPs (passo a passo), PROCESSOS (etapas com critérios de passagem), EXEMPLOS (mensagens reais de WhatsApp, curtas, sem travessão) e DICAS objetivas.',
    aprovados.length ? `Já temos aprovados (não repita; se melhorar um deles, use o MESMO título para criar a nova versão): ${aprovados.map(a => a.titulo).join(' | ')}` : '',
    'Responda APENAS com JSON: {"resumo": string, "documentos": [{"tipo": "POP"|"PROCESSO"|"EXEMPLO"|"DICA", "titulo": string, "conteudo": string (markdown, com listas numeradas e exemplos)}]}. Traga de 3 a 6 documentos. Cite no conteúdo, de forma breve, de quem é cada ideia quando vier de um especialista.',
  ].filter(Boolean).join('\n');
  const { texto, fontes } = await pesquisarComGemini(prisma, { sistema: QUEM + (await instrucoesPara(prisma, 'rafael')), pergunta, timeoutMs: 240_000 });
  const r = lerJsonIa<{ resumo: string; documentos: DocNovo[] }>(texto);
  const docs = (r?.documentos || []).filter(d => d?.titulo && d?.conteudo && ['POP', 'PROCESSO', 'EXEMPLO', 'DICA'].includes(d.tipo)).slice(0, 8);
  const gravados = [];
  for (const d of docs) gravados.push(await gravarDoc(prisma, d, 'estudo', fontes));
  registrarAcaoAgente('rafael', `estudou e criou ${gravados.length} documento(s)`);
  if (gravados.length) await avisar(prisma, [`📚 *Rafael estudou vendas e criou ${gravados.length} documento(s) para você aprovar*`, r?.resumo?.slice(0, 300) || '', ...gravados.map(g => `• [${g.tipo}] ${g.titulo}`), '', 'Veja e aprove no Escritório virtual › Rafael.'].join('\n'));
  return { resumo: r?.resumo || '', documentos: gravados };
}

// ── 2) Revisão das conversas ───────────────────────────────────────────────────
const AUTOMATICOS = ['bot', 'assistente_ia', 'campanha', 'cadencia_automatica', 'caroline', 'julio', 'luiz_felipe', 'abertura_jessica'];

// Recuperações de propostas recusadas nos últimos 7 dias (Luiz Felipe): contagem, motivos e o que o cliente disse.
async function recusasDaSemana(prisma: PrismaClient, agora: Date) {
  const desde = new Date(agora.getTime() - 7 * 864e5);
  const ls = await prisma.sdrLead.findMany({ where: { agente: 'luiz_felipe', updated_at: { gte: desde } }, select: { nome: true, empresa: true, dados: true, nota_motivo: true } });
  const recs = ls.filter(l => (l.dados as any)?.recuperacao && new Date((l.dados as any).recuperacao.iniciada_em) >= desde);
  const conta = (d: string | null) => recs.filter(l => ((l.dados as any).recuperacao.desfecho || null) === d).length;
  const motivos = new Map<string, number>();
  for (const l of recs) { const m = String((l.dados as any).recuperacao.motivo_informado || 'não informado').split(':')[0]; motivos.set(m, (motivos.get(m) || 0) + 1); }
  return {
    iniciadas: recs.length, recuperadas: conta('recuperada'), perdidas: conta('perdida'), sem_resposta: conta('sem_resposta'), andamento: conta(null),
    motivos: [...motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    falas: recs.filter(l => l.nota_motivo).map(l => ({ nome: l.empresa || l.nome || 'cliente', texto: String(l.nota_motivo).slice(0, 160) })),
  };
}

export async function revisarConversas(prisma: PrismaClient) {
  const agora = new Date();
  const desde = new Date(agora.getTime() - 48 * 3600_000);
  const convs = await prisma.whatsappConversa.findMany({
    where: { ultima_em: { gte: desde }, finalizada_em: null } as any,
    select: { id: true, contato_nome: true, contato_numero: true, dono_id: true, ultima_em: true, lead_id: true },
    orderBy: { ultima_em: 'desc' }, take: 80,
  });
  // Deixadas de lado: a última mensagem é do cliente e ninguém respondeu há mais de 2 h.
  const deLado: { nome: string; horas: number; texto: string }[] = [];
  const paraAvaliar: { nome: string; texto: string }[] = [];
  for (const c of convs) {
    const ms = await prisma.whatsappMensagem.findMany({ where: { conversaId: c.id }, orderBy: { created_at: 'desc' }, take: 16, select: { direcao: true, conteudo: true, transcricao: true, tipo: true, enviada_por: true, created_at: true } });
    if (!ms.length) continue;
    const nome = c.contato_nome || c.contato_numero;
    const ult = ms[0];
    const horas = (agora.getTime() - ult.created_at.getTime()) / 3600_000;
    if (ult.direcao === 'ENTRADA' && horas >= 2) deLado.push({ nome, horas: Math.round(horas), texto: ((ult.tipo === 'AUDIO' ? ult.transcricao : ult.conteudo) || '').slice(0, 120) });
    if (paraAvaliar.length < 12 && ms.some(m => m.direcao === 'ENTRADA') && ms.some(m => m.direcao === 'SAIDA')) {
      const linhas = ms.slice().reverse().map(m => `${m.direcao === 'ENTRADA' ? 'Cliente' : AUTOMATICOS.includes(m.enviada_por || '') ? `Agente(${m.enviada_por})` : 'Equipe'}: ${(m.tipo === 'AUDIO' ? `(áudio) ${m.transcricao || ''}` : m.conteudo || '').slice(0, 220)}`);
      paraAvaliar.push({ nome, texto: linhas.join('\n') });
    }
  }
  let avaliacao: { resumo: string; alertas: { conversa: string; problema: string; como_melhorar: string }[]; dicas: string[] } | null = null;
  if (paraAvaliar.length) {
    const { instrucoesPara } = await import('./agentes-conversa.service');
    const pergunta = [
      'Avalie estas conversas de venda pelo WhatsApp (últimas 48 h). Aponte SÓ as que não foram satisfatórias: cliente sem resposta clara, pergunta repetida, abordagem fraca, oportunidade perdida, erro de informação, tom robótico, demora, falta de próximo passo.',
      'Para cada uma: o problema em 1 frase e como melhorar em 1-2 frases (com um exemplo de mensagem, quando ajudar).',
      'Depois, 2 a 4 dicas gerais para o time com base no que viu.',
      'Responda APENAS com JSON: {"resumo": string, "alertas": [{"conversa": string (nome), "problema": string, "como_melhorar": string}], "dicas": [string]}',
      '', ...paraAvaliar.map((c, i) => `### Conversa ${i + 1}: ${c.nome}\n${c.texto}`),
    ].join('\n');
    avaliacao = lerJsonIa(await chamarGemini(prisma, { sistema: QUEM + (await instrucoesPara(prisma, 'rafael')), partes: [{ text: pergunta }], json: true, temperatura: 0.2, timeoutMs: 120_000 }));
  }
  const dia = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const rec = await recusasDaSemana(prisma, agora).catch(() => null);
  const md = [
    `# Revisão das conversas · ${dia}`, '',
    avaliacao?.resumo || '',
    '', `## Deixadas de lado (${deLado.length})`,
    ...(deLado.length ? deLado.map(d => `- **${d.nome}**: sem resposta há ${d.horas} h. Última mensagem: "${d.texto}"`) : ['- Nenhuma. 👏']),
    '', `## Conversas não satisfatórias (${avaliacao?.alertas?.length || 0})`,
    ...((avaliacao?.alertas || []).map(a => `- **${a.conversa}**: ${a.problema}\n  - Como melhorar: ${a.como_melhorar}`)),
    '', '## Dicas para o time', ...((avaliacao?.dicas || []).map(d => `- ${d}`)),
    ...(rec && rec.iniciadas ? ['', `## Recusas da semana (recuperação do Luiz Felipe)`,
      `- Iniciadas: ${rec.iniciadas} · recuperadas: ${rec.recuperadas} · perdidas: ${rec.perdidas} · sem resposta: ${rec.sem_resposta} · em andamento: ${rec.andamento}`,
      rec.motivos.length ? `- Motivos mais frequentes: ${rec.motivos.map(([m, n]) => `${m} (${n})`).join(', ')}` : '',
      ...rec.falas.slice(0, 6).map(f => `- **${f.nome}**: ${f.texto}`)] : []),
  ].join('\n');
  const doc = await gravarDoc(prisma, { tipo: 'ALERTA', titulo: `Revisão das conversas · ${dia}`, conteudo: md }, 'revisao');
  registrarAcaoAgente('rafael', `revisou as conversas: ${deLado.length} de lado, ${avaliacao?.alertas?.length || 0} a melhorar`);
  if (deLado.length || avaliacao?.alertas?.length) {
    await avisar(prisma, [
      `👀 *Rafael revisou as conversas (${dia})*`,
      deLado.length ? `⏰ ${deLado.length} deixada(s) de lado: ${deLado.slice(0, 5).map(d => `${d.nome} (${d.horas} h)`).join(', ')}` : '',
      avaliacao?.alertas?.length ? `⚠️ ${avaliacao.alertas.length} a melhorar: ${avaliacao.alertas.slice(0, 3).map(a => a.conversa).join(', ')}` : '',
      '', 'Detalhes e dicas no Escritório virtual › Rafael.',
    ].filter(Boolean).join('\n'));
  }
  return doc;
}

// ── 3) Abordagem inicial ────────────────────────────────────────────────────────
export async function proporAbordagem(prisma: PrismaClient) {
  const agentes = [
    { id: 'caroline', papel: 'SDR: primeiro contato com leads que se inscreveram nas campanhas (farmácias e padarias).' },
    { id: 'julio', papel: 'Retoma leads antigos da base que pararam de responder (do mais novo ao mais antigo).' },
    { id: 'luiz_felipe', papel: 'Retoma propostas enviadas e não assinadas.' },
  ];
  const blocos: string[] = [];
  for (const a of agentes) {
    const sdrs = await prisma.sdrLead.findMany({ where: { agente: a.id, primeiro_envio_em: { not: null } }, orderBy: { created_at: 'desc' }, take: 40, select: { conversaId: true, ultima_lead_em: true, primeiro_envio_em: true } });
    const responderam = sdrs.filter(s => s.ultima_lead_em).length;
    const exemplos: string[] = [];
    for (const s of sdrs.slice(0, 12)) {
      if (!s.conversaId) continue;
      const primeira = await prisma.whatsappMensagem.findFirst({ where: { conversaId: s.conversaId, direcao: 'SAIDA', enviada_por: a.id }, orderBy: { created_at: 'asc' }, select: { conteudo: true } });
      if (primeira?.conteudo) exemplos.push(`${s.ultima_lead_em ? '✅ respondeu' : '❌ não respondeu'}: "${primeira.conteudo.slice(0, 260)}"`);
      if (exemplos.length >= 6) break;
    }
    blocos.push(`### ${a.id} — ${a.papel}\nTaxa de resposta atual: ${sdrs.length ? Math.round((responderam / sdrs.length) * 100) : 0}% (${responderam} de ${sdrs.length})\nPrimeiras mensagens reais:\n${exemplos.join('\n') || '(sem exemplos ainda)'}`);
  }
  const base = await prisma.especialistaDoc.findMany({ where: { status: 'APROVADO', tipo: { in: ['POP', 'PROCESSO', 'DICA', 'CONCORRENCIA'] } }, orderBy: { created_at: 'desc' }, take: 10, select: { titulo: true, conteudo: true } });
  const pergunta = [
    'Com base nas boas práticas de prospecção e retomada pelo WhatsApp (pesquise o que os especialistas de vendas do Brasil recomendam para a PRIMEIRA mensagem) e nos dados reais abaixo, proponha a nova ABORDAGEM INICIAL de cada agente.',
    'Regras da casa: mensagens curtas, humanas, sem travessão, no máximo UMA pergunta, sem preço, sem parecer robô, citar o negócio do cliente (farmácia/padaria), proteger o número (nada de texto longo ou repetitivo).',
    base.length ? `Material aprovado do time:\n${base.map(b => `- ${b.titulo}: ${b.conteudo.slice(0, 400)}`).join('\n')}` : '',
    '', ...blocos, '',
    'Responda APENAS com JSON: {"resumo": string, "abordagens": [{"agente": "caroline"|"julio"|"luiz_felipe", "diagnostico": string (por que a atual funciona ou não, com base nos dados), "diretriz": string (como o agente deve abrir a conversa, em 3-6 regras curtas), "exemplos": [string, string, string] (mensagens prontas de primeira mensagem)}]}',
  ].filter(Boolean).join('\n');
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const { texto, fontes } = await pesquisarComGemini(prisma, { sistema: QUEM + (await instrucoesPara(prisma, 'rafael')), pergunta, timeoutMs: 240_000 });
  const r = lerJsonIa<{ resumo: string; abordagens: { agente: string; diagnostico: string; diretriz: string; exemplos: string[] }[] }>(texto);
  const nomes: Record<string, string> = { caroline: 'Caroline', julio: 'Julio', luiz_felipe: 'Luiz Felipe' };
  const gravados = [];
  for (const a of (r?.abordagens || []).filter(x => nomes[x.agente])) {
    const md = [`**Diagnóstico:** ${a.diagnostico}`, '', '**Como abrir a conversa:**', a.diretriz, '', '**Exemplos de primeira mensagem:**', ...(a.exemplos || []).slice(0, 4).map(e => `- ${e}`)].join('\n');
    gravados.push(await gravarDoc(prisma, { tipo: 'ABORDAGEM', titulo: `Abordagem inicial · ${nomes[a.agente]}`, conteudo: md, agente_alvo: a.agente }, 'abordagem', fontes));
  }
  registrarAcaoAgente('rafael', `propôs a nova abordagem inicial de ${gravados.length} agente(s)`);
  if (gravados.length) await avisar(prisma, [`🎯 *Rafael propôs a nova abordagem inicial*`, r?.resumo?.slice(0, 300) || '', ...gravados.map(g => `• ${g.titulo}`), '', 'Aprove no Escritório virtual › Rafael. Só vale depois da sua aprovação.'].join('\n'));
  return { resumo: r?.resumo || '', documentos: gravados };
}

/** Aprovar: vira parâmetro. Abordagem aprovada vira instrução do agente (substitui a abordagem anterior). */
export async function decidirDoc(prisma: PrismaClient, id: string, aprovar: boolean, userId: string) {
  const d = await prisma.especialistaDoc.findUnique({ where: { id } });
  if (!d) throw new Error('Documento não encontrado.');
  if (!aprovar) return prisma.especialistaDoc.update({ where: { id }, data: { status: 'ARQUIVADO', decidido_por: userId, decidido_em: new Date() } });
  // Versões aprovadas anteriores do mesmo título ficam arquivadas: vale sempre a última aprovada.
  await prisma.especialistaDoc.updateMany({ where: { titulo: d.titulo, tipo: d.tipo, status: 'APROVADO', id: { not: id } }, data: { status: 'ARQUIVADO' } });
  const upd = await prisma.especialistaDoc.update({ where: { id }, data: { status: 'APROVADO', decidido_por: userId, decidido_em: new Date() } });
  if (d.tipo === 'ABORDAGEM' && d.agente_alvo) {
    const prefixo = 'ABORDAGEM INICIAL (aprovada pela gestão, proposta pelo Rafael)';
    await prisma.agenteInstrucao.updateMany({ where: { agente: d.agente_alvo, ativa: true, texto: { startsWith: prefixo } }, data: { ativa: false } });
    await prisma.agenteInstrucao.create({ data: { agente: d.agente_alvo, ativa: true, criado_por: userId, texto: `${prefixo}: use esta diretriz no PRIMEIRO contato e nas retomadas.\n${d.conteudo}`.slice(0, 6000) } });
  }
  // Critérios de qualificação: passam para a Laya (pergunta nova que ela responde em cada conversa).
  if (/crit[eé]rios de qualifica[cç][aã]o para a laya/i.test(d.titulo)) {
    const { lerCriteriosQualificacao } = await import('@/lib/laya');
    const c = lerCriteriosQualificacao(d.conteudo);
    if (c) {
      const { CHAVE_CRITERIOS_QUALIFICACAO } = await import('./laya.service');
      await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE_CRITERIOS_QUALIFICACAO }, create: { chave: CHAVE_CRITERIOS_QUALIFICACAO, valor: JSON.stringify(c), updated_by: userId }, update: { valor: JSON.stringify(c), updated_by: userId } });
      registrarAcaoAgente('laya', 'aprendeu com o Rafael os critérios de qualificação de leads');
    }
  }
  if (d.tipo === 'TREINAMENTO' && d.agente_alvo) {
    const prefixo = 'TREINAMENTO DO RAFAEL (aprovado pela gestão)';
    const regras: string[] = Array.isArray((d.fontes as any)?.regras) ? (d.fontes as any).regras : [];
    if (regras.length) {
      await prisma.agenteInstrucao.updateMany({ where: { agente: d.agente_alvo, ativa: true, texto: { startsWith: prefixo } }, data: { ativa: false } });
      await prisma.agenteInstrucao.create({ data: { agente: d.agente_alvo, ativa: true, criado_por: userId, texto: `${prefixo}: siga estas regras em todas as conversas.\n${regras.map((r, i) => `${i + 1}. ${r}`).join('\n')}`.slice(0, 6000) } });
      registrarAcaoAgente(d.agente_alvo as any, `aplicou o treinamento do Rafael (${regras.length} regras)`);
    }
  }
  const { esquecerGuiaComercial } = await import('./assistente-ia.service');
  esquecerGuiaComercial();
  registrarAcaoAgente('rafael', `teve "${d.titulo.slice(0, 50)}" aprovado`);
  return upd;
}

// ── Olívia: concorrentes ──────────────────────────────────────────────────────────
// Pesquisa quem vende PDV/ERP para farmácias e padarias, avaliações (Google, Reclame Aqui) e
// reclamações; entrega panorama + como responder quando o cliente cita um concorrente.
// Os documentos entram no painel do Rafael (aba Concorrência) e alimentam o estudo/abordagem dele.
const OLIVIA = [
  'Você é a Olívia, analista de concorrência do time comercial da Prosystem Sistemas (ERP e PDV para farmácias, drogarias, farmácias de manipulação, padarias, confeitarias e varejo no Brasil).',
  'Pesquise na internet fatos reais e verificáveis: empresas concorrentes, o que oferecem, preços quando forem públicos, notas e avaliações (Google, Reclame Aqui, lojas de apps) e as reclamações e elogios mais comuns de clientes.',
  'Seja justa e factual: nunca invente nota, preço ou reclamação; cite a fonte no texto (nome do site). Nada de falar mal de concorrente para o cliente: o objetivo é o time saber onde a Prosystem pode se diferenciar.',
  'Escreva em português do Brasil, simples e direto.',
].join('\n');

export async function pesquisarConcorrentes(prisma: PrismaClient, foco: string | null = null) {
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const pergunta = [
    foco ? `Foque em: "${foco}".` : 'Mapeie os principais concorrentes da Prosystem em sistemas de PDV/ERP para farmácias/drogarias e para padarias/confeitarias no Brasil (os mais citados e os mais usados por pequenos e médios negócios).',
    'Para cada concorrente: segmento, principais recursos, preço público (se houver), nota e volume de avaliações (Google/Reclame Aqui/app), reclamações mais comuns e elogios mais comuns.',
    'Depois: as OPORTUNIDADES para a Prosystem (dores que os clientes dos concorrentes relatam e que um bom sistema + bom suporte resolvem) e respostas curtas e respeitosas para quando o lead disser que usa ou está avaliando um concorrente.',
    'Responda APENAS com JSON: {"resumo": string, "concorrentes": [{"nome": string, "segmento": string, "recursos": string, "preco": string, "avaliacoes": string, "reclamacoes": string, "elogios": string, "fonte": string}], "oportunidades": [string], "respostas": [{"quando_o_cliente_diz": string, "responda": string}]}',
  ].join('\n');
  const { texto, fontes } = await pesquisarComGemini(prisma, { sistema: OLIVIA + (await instrucoesPara(prisma, 'olivia')), pergunta, timeoutMs: 240_000 });
  const r = lerJsonIa<{ resumo: string; concorrentes: any[]; oportunidades: string[]; respostas: { quando_o_cliente_diz: string; responda: string }[] }>(texto);
  const dia = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const cs = (r?.concorrentes || []).slice(0, 12);
  const panorama = [
    `# Panorama da concorrência · ${dia}`, '', r?.resumo || '', '',
    ...cs.flatMap(c => [`## ${c.nome}${c.segmento ? ` (${c.segmento})` : ''}`,
      `- **Recursos:** ${c.recursos || '—'}`, `- **Preço:** ${c.preco || 'não divulgado'}`, `- **Avaliações:** ${c.avaliacoes || '—'}`,
      `- **Reclamações comuns:** ${c.reclamacoes || '—'}`, `- **Elogios comuns:** ${c.elogios || '—'}`, c.fonte ? `- Fonte: ${c.fonte}` : '', '']),
    '## Oportunidades para a Prosystem', ...((r?.oportunidades || []).map(o => `- ${o}`)),
  ].join('\n');
  const gravados = [await gravarDoc(prisma, { tipo: 'CONCORRENCIA', titulo: `Panorama da concorrência${foco ? ` · ${foco}` : ''}`, conteudo: panorama }, 'olivia', fontes)];
  if (r?.respostas?.length) {
    const md = ['Respostas respeitosas para quando o lead citar um concorrente (sem falar mal de ninguém):', '',
      ...r.respostas.slice(0, 10).flatMap(x => [`- **Quando o cliente diz:** ${x.quando_o_cliente_diz}`, `  - **Responda:** ${x.responda}`])].join('\n');
    gravados.push(await gravarDoc(prisma, { tipo: 'EXEMPLO', titulo: 'Quando o cliente cita um concorrente', conteudo: md }, 'olivia', fontes));
  }
  registrarAcaoAgente('olivia', `mapeou ${cs.length} concorrente(s) e passou para o Rafael`);
  registrarAcaoAgente('rafael', 'recebeu o panorama da concorrência da Olívia');
  await avisar(prisma, [`🔍 *Olívia mapeou a concorrência (${cs.length} empresas)*`, r?.resumo?.slice(0, 300) || '', ...cs.slice(0, 6).map(c => `• ${c.nome}${c.avaliacoes ? `: ${String(c.avaliacoes).slice(0, 60)}` : ''}`), '', 'Detalhes e respostas prontas no Escritório › painel do Rafael › Concorrência.'].join('\n'));
  return { resumo: r?.resumo || '', documentos: gravados };
}

/** Rotina: revisão das conversas de seg a sex às 17h; estudo toda quarta às 9h. */
// ── Treinamento de um agente (Rafael → Luiz Felipe, Julio, Caroline) ─────────
const NOME_AGENTE: Record<string, string> = { luiz_felipe: 'Luiz Felipe', julio: 'Julio', caroline: 'Caroline' };
export type FalaTreino = { quem: 'rafael' | 'agente'; texto: string };

/**
 * Rafael lê as conversas reais do agente, aponta o que incomoda o cliente e treina:
 * gera o relatório, a conversa de treinamento entre os dois (para ver no escritório)
 * e as regras que o agente passa a seguir quando a Jessica aprovar.
 */
export async function treinarAgente(prisma: PrismaClient, agente: 'luiz_felipe' | 'julio' | 'caroline' = 'luiz_felipe') {
  const nome = NOME_AGENTE[agente] || agente;
  const desde = new Date(Date.now() - 14 * 864e5);
  const leads = await prisma.sdrLead.findMany({ where: { agente, updated_at: { gte: desde } }, orderBy: { updated_at: 'desc' }, take: 25, select: { conversaId: true, nome: true, empresa: true, status: true } });
  const conversas: string[] = [];
  for (const l of leads) {
    if (conversas.length >= 12 || !l.conversaId) continue;
    const ms = await prisma.whatsappMensagem.findMany({ where: { conversaId: l.conversaId }, orderBy: { created_at: 'desc' }, take: 18, select: { direcao: true, enviada_por: true, conteudo: true, transcricao: true, tipo: true, created_at: true } });
    if (!ms.some(m => m.enviada_por === agente)) continue;
    const linhas = ms.reverse().map(m => `[${m.created_at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}] ${m.direcao === 'ENTRADA' ? 'Cliente' : m.enviada_por === agente ? nome : AUTOMATICOS.includes(m.enviada_por || '') ? `Sistema(${m.enviada_por})` : 'Equipe'}: ${((m.tipo === 'AUDIO' ? m.transcricao : m.conteudo) || `[${String(m.tipo).toLowerCase()}]`).replace(/\s+/g, ' ').slice(0, 280)}`);
    conversas.push(`### ${l.empresa || l.nome || 'cliente'} (status ${l.status})\n${linhas.join('\n')}`);
  }
  if (!conversas.length) { registrarAcaoAgente('rafael', `não achou conversas recentes do ${nome} para treinar`); return null; }
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const regrasAtuais = await instrucoesPara(prisma, agente);
  const pops = await prisma.especialistaDoc.findMany({ where: { status: 'APROVADO', tipo: { in: ['POP', 'PROCESSO'] } }, select: { titulo: true, conteudo: true }, take: 6, orderBy: { decidido_em: 'desc' } });
  const pergunta = [
    `Você vai TREINAR o agente de IA ${nome} (conversa com clientes pelo WhatsApp em nome da Prosystem). Leia as conversas reais dele abaixo com olhar de cliente: o que soa robótico, desconfortável, insistente, repetitivo, com mensagens em sequência sem resposta, botões fora de hora, nome errado, pergunta sem contexto ou sem valor para o cliente.`,
    'Depois treine o agente como um bom gestor comercial: aponte o problema com o exemplo REAL da conversa, explique o porquê e mostre como fazer melhor com uma mensagem pronta (curta, natural, de WhatsApp, sem travessão).',
    `Crie também um DIÁLOGO de treinamento entre você (Rafael) e o ${nome}, de 10 a 14 falas, natural e respeitoso, como numa reunião 1:1 no escritório: você mostra um caso, ele reconhece, pergunta, você orienta, ele reescreve a mensagem e você valida. O ${nome} fala em primeira pessoa como agente.`,
    'Por fim, consolide as REGRAS que ele deve seguir a partir de agora (6 a 12, curtas e verificáveis), mantendo as regras atuais que continuam valendo.',
    'Se faltar informação para orientar algo (produto, mercado, regra), liste em "pesquisar" (máximo 2 perguntas objetivas) em vez de inventar.',
    'Responda APENAS com JSON: {"resumo": string, "nota_antes": 0-10, "pontos_fortes": [string], "problemas": [{"problema": string, "exemplo_real": string, "por_que": string, "como_fazer": string, "mensagem_melhor": string}], "regras": [string], "dialogo": [{"quem": "rafael"|"agente", "texto": string}], "pesquisar": [string]}',
    regrasAtuais ? `\nRegras atuais do agente:${regrasAtuais}` : '',
    pops.length ? `\nMaterial aprovado do setor (use como referência):\n${pops.map(x => `## ${x.titulo}\n${x.conteudo.slice(0, 1500)}`).join('\n\n')}` : '',
    `\n=== CONVERSAS DO ${nome.toUpperCase()} (últimos 14 dias) ===\n${conversas.join('\n\n')}`,
  ].filter(Boolean).join('\n');
  const r = lerJsonIa<any>(await chamarGemini(prisma, { sistema: QUEM + (await instrucoesPara(prisma, 'rafael')), partes: [{ text: pergunta }], json: true, temperatura: 0.4, timeoutMs: 180_000 }));
  if (!r?.dialogo?.length || !r?.regras?.length) throw new Error('o Rafael não conseguiu montar o treinamento desta vez');
  const dialogo: FalaTreino[] = r.dialogo.filter((f: any) => f?.texto).slice(0, 16).map((f: any) => ({ quem: f.quem === 'agente' ? 'agente' : 'rafael', texto: String(f.texto).slice(0, 600) }));
  const regras: string[] = r.regras.map((x: any) => String(x).slice(0, 300)).slice(0, 12);
  const dia = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const md = [
    `# Relatório de treinamento · ${nome} · ${dia}`, '',
    `**Conversas analisadas:** ${conversas.length} (últimos 14 dias) · **Nota antes do treino:** ${r.nota_antes ?? '—'}/10`, '',
    r.resumo || '',
    '', '## O que já está bom', ...(r.pontos_fortes || []).map((x: string) => `- ${x}`),
    '', `## O que precisa melhorar (${(r.problemas || []).length})`,
    ...(r.problemas || []).map((x: any, i: number) => `### ${i + 1}. ${x.problema}\n- **Na conversa:** "${x.exemplo_real}"\n- **Por que incomoda:** ${x.por_que}\n- **Como fazer:** ${x.como_fazer}\n- **Mensagem melhor:** "${x.mensagem_melhor}"`),
    '', `## Regras que o ${nome} passa a seguir (ao aprovar)`, ...regras.map((x, i) => `${i + 1}. ${x}`),
    '', '## Conversa do treinamento', ...dialogo.map(f => `- **${f.quem === 'rafael' ? 'Rafael' : nome}:** ${f.texto}`),
    ...((r.pesquisar || []).length ? ['', '## O Rafael foi pesquisar', ...(r.pesquisar as string[]).slice(0, 2).map(x => `- ${x}`)] : []),
  ].join('\n');
  const doc = await gravarDoc(prisma, { tipo: 'TREINAMENTO', titulo: `Treinamento do ${nome} · ${dia}`, conteudo: md, agente_alvo: agente }, 'treinamento', { dialogo, regras, conversas: conversas.length, nota_antes: r.nota_antes ?? null });
  registrarAcaoAgente('rafael', `treinou o ${nome}: ${(r.problemas || []).length} pontos a melhorar`);
  registrarAcaoAgente(agente as any, `recebeu treinamento do Rafael (${regras.length} regras)`);
  await avisar(prisma, [`🎓 *Rafael treinou o ${nome}*`, r.resumo?.slice(0, 280) || '', `${(r.problemas || []).length} ponto(s) a melhorar · ${regras.length} regra(s) novas.`, '', 'Leia o relatório, veja os dois conversando e aprove no Escritório virtual › Rafael (ao aprovar, as regras passam a valer).'].filter(Boolean).join('\n'));
  // Iniciativa: o que ele não sabia, vai pesquisar.
  for (const q of ((r.pesquisar || []) as string[]).slice(0, 2)) await pesquisarDuvida(prisma, q, 'Rafael (treinamento)').catch(() => {});
  return doc;
}

/**
 * Iniciativa do Rafael: dúvida que ninguém soube responder (agente com "dúvida fora do material"
 * ou lacuna no treinamento) → ele pesquisa e escreve a resposta para a Jessica aprovar.
 * Aprovada, entra no material de todos os agentes. Uma vez por dúvida por dia.
 */
export async function pesquisarDuvida(prisma: PrismaClient, duvida: string, origem: string) {
  const q = duvida.trim().slice(0, 300);
  if (q.length < 8) return null;
  const { podeEnviarUmaVez, hashTexto } = await import('./envio-unico.service');
  if (!(await podeEnviarUmaVez(prisma, `rafael.duvida.${hashTexto(q.toLowerCase())}`, 24))) return null;
  registrarAcaoAgente('rafael', `foi pesquisar: "${q.slice(0, 60)}"`);
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const { texto, fontes } = await pesquisarComGemini(prisma, {
    sistema: QUEM + (await instrucoesPara(prisma, 'rafael')),
    pergunta: [
      `Um cliente (ou a equipe) perguntou e nenhum agente soube responder: "${q}". Origem: ${origem}.`,
      'Pesquise e escreva a resposta que os agentes podem dar pelo WhatsApp, para farmácias/padarias. Se for sobre o PRODUTO Prosystem e você não achar fonte confiável, NÃO invente: diga o que a equipe precisa confirmar.',
      'Responda APENAS com JSON: {"titulo": string (curto, começando com "Resposta: "), "conteudo": string (markdown: resposta curta pronta para o WhatsApp + explicação + o que confirmar com a equipe, se houver)}',
    ].join('\n'),
    timeoutMs: 180_000,
  });
  const r = lerJsonIa<{ titulo: string; conteudo: string }>(texto);
  if (!r?.titulo || !r?.conteudo) return null;
  const doc = await gravarDoc(prisma, { tipo: 'DICA', titulo: r.titulo.startsWith('Resposta') ? r.titulo : `Resposta: ${r.titulo}`, conteudo: `> Pergunta: "${q}" (${origem})\n\n${r.conteudo}` }, 'duvida', fontes);
  registrarAcaoAgente('rafael', `pesquisou e respondeu: "${q.slice(0, 50)}"`);
  await avisar(prisma, [`🔎 *Rafael pesquisou uma dúvida que ninguém sabia*`, `"${q.slice(0, 200)}"`, '', 'A resposta está no Escritório virtual › Rafael. Aprovada, vale para todos os agentes.'].join('\n'));
  return doc;
}

// ── Mila (CS): estuda retenção e experiência do cliente e vira especialista ─────
const MILA = [
  'Você é a Mila, Customer Success (CS) da Prosystem Sistemas, que vende ERP/PDV para farmácias, drogarias, manipulação e padarias no Brasil (mensalidade, suporte e implantação).',
  'Sua missão é RETER o máximo de clientes e dar a melhor experiência: onboarding, adoção do sistema, saúde da conta, prevenção de cancelamento, recuperação e expansão (upgrade, módulos).',
  'Escreva em português do Brasil, simples e prático, pronto para usar no dia a dia do CS. Nunca invente números da Prosystem nem prometa preço ou desconto.',
].join('\n');

/** Motivos reais de saída e números da base (para a Mila partir da realidade da Prosystem). */
async function retratoDaBase(prisma: PrismaClient): Promise<string> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT COALESCE(NULLIF(TRIM(motivo_inativacao),''),'sem motivo registrado') AS motivo, COUNT(*) AS n FROM Cliente WHERE status = 'INATIVO' GROUP BY motivo ORDER BY n DESC LIMIT 8`);
    const ativos: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM Cliente WHERE status = 'ATIVO'`);
    const lista = rows.map(r => `- ${r.motivo}: ${Number(r.n)}`).join('\n');
    return `\n### Base da Prosystem hoje\nClientes ativos: ${Number(ativos[0]?.n || 0)}.\nMotivos de saída mais comuns (clientes inativos):\n${lista}`;
  } catch { return ''; }
}

export async function estudarRetencao(prisma: PrismaClient, tema: string | null = null) {
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const jaTem = await prisma.especialistaDoc.findMany({ where: { origem: 'mila', status: { not: 'ARQUIVADO' } }, select: { titulo: true }, take: 40 });
  const pergunta = [
    tema ? `Estude a fundo: "${tema}", aplicado ao CS de uma empresa de sistemas para farmácias e padarias.`
      : 'Pesquise o que os maiores especialistas de Customer Success e experiência do cliente (Brasil e fora) ensinam de mais atual e prático para SaaS/ERP B2B de pequenos varejistas: onboarding, health score, sinais de risco de cancelamento, régua de relacionamento, pesquisa NPS/CSAT, recuperação de clientes, expansão e cancelamento bem conduzido.',
    'Parta dos motivos reais de saída da Prosystem (abaixo) e diga, para os principais, como prevenir e como agir quando o sinal aparecer.',
    'Transforme em material de trabalho do CS: POPs (passo a passo), PROCESSOS (etapas com critérios, ex.: jornada do cliente e régua de contato), EXEMPLOS (mensagens reais de WhatsApp curtas, sem travessão) e DICAS objetivas.',
    jaTem.length ? `Já existem (não repita; para melhorar um, use o MESMO título): ${jaTem.map(a => a.titulo).join(' | ')}` : '',
    'Responda APENAS com JSON: {"resumo": string, "documentos": [{"tipo": "POP"|"PROCESSO"|"EXEMPLO"|"DICA", "titulo": string, "conteudo": string (markdown)}]}. De 3 a 6 documentos, cite de quem é cada ideia quando vier de um especialista.',
    await retratoDaBase(prisma),
  ].filter(Boolean).join('\n');
  const { texto, fontes } = await pesquisarComGemini(prisma, { sistema: MILA + (await instrucoesPara(prisma, 'mila')), pergunta, timeoutMs: 240_000 });
  const r = lerJsonIa<{ resumo: string; documentos: DocNovo[] }>(texto);
  const docs = (r?.documentos || []).filter(d => d?.titulo && d?.conteudo && ['POP', 'PROCESSO', 'EXEMPLO', 'DICA'].includes(d.tipo)).slice(0, 8);
  const gravados = [];
  for (const d of docs) gravados.push(await gravarDoc(prisma, { ...d, titulo: `CS · ${d.titulo.replace(/^CS\s*·\s*/, '')}` }, 'mila', fontes));
  registrarAcaoAgente('mila', `estudou retenção e escreveu ${gravados.length} documento(s)`);
  if (gravados.length) await avisar(prisma, [`💚 *Mila (CS) estudou retenção e criou ${gravados.length} documento(s) para você aprovar*`, r?.resumo?.slice(0, 300) || '', ...gravados.map(g => `• [${g.tipo}] ${g.titulo}`), '', 'Veja e aprove no Escritório virtual › Painel da Mila.'].join('\n'));
  return { resumo: r?.resumo || '', documentos: gravados };
}

export async function rodarRafael(prisma: PrismaClient, agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  const dia = partes.find(p => p.type === 'weekday')?.value || '';
  const hora = Number(partes.find(p => p.type === 'hour')?.value);
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  const hoje = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(dia) && hora >= 17 && hora < 19 && await podeEnviarUmaVez(prisma, `rafael.revisao.${hoje}`, 20)) {
    await revisarConversas(prisma).catch(e => console.error('[RAFAEL] revisão:', e?.message));
  }
  if (dia === 'Wed' && hora >= 9 && hora < 12 && await podeEnviarUmaVez(prisma, `rafael.estudo.${hoje}`, 20)) {
    await estudarVendas(prisma).catch(e => console.error('[RAFAEL] estudo:', e?.message));
  }
  if (dia === 'Thu' && hora >= 10 && hora < 12 && await podeEnviarUmaVez(prisma, `rafael.treino.luiz_felipe.${hoje}`, 20)) {
    await treinarAgente(prisma, 'luiz_felipe').catch(e => console.error('[RAFAEL] treino:', e?.message));
  }
  // Mila (CS): estuda retenção toda segunda de manhã.
  if (dia === 'Mon' && hora >= 10 && hora < 12 && await podeEnviarUmaVez(prisma, `mila.estudo.${hoje}`, 20)) {
    await estudarRetencao(prisma).catch(e => console.error('[MILA] estudo:', e?.message));
  }
  // Olívia: a cada 15 dias, na terça de manhã (a trava de 14 dias evita repetir na semana seguinte).
  if (dia === 'Tue' && hora >= 9 && hora < 12 && await podeEnviarUmaVez(prisma, 'olivia.concorrencia', 24 * 13)) {
    await pesquisarConcorrentes(prisma).catch(e => console.error('[OLIVIA]', e?.message));
  }
}

/** Caderno do Rafael em markdown: tudo o que está aprovado (parâmetros do setor), por tipo. */
export async function cadernoRafael(prisma: PrismaClient): Promise<string> {
  const ds = await prisma.especialistaDoc.findMany({ where: { status: 'APROVADO' }, orderBy: [{ tipo: 'asc' }, { titulo: 'asc' }] });
  const NOME: Record<string, string> = { POP: 'POPs', PROCESSO: 'Processos', EXEMPLO: 'Exemplos', DICA: 'Dicas', ABORDAGEM: 'Abordagens iniciais', CONCORRENCIA: 'Concorrência', ALERTA: 'Revisões de conversas' };
  const l = ['# Caderno do Rafael · parâmetros do setor comercial', '', `Documentos aprovados (${ds.length}). Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`, ''];
  let tipo = '';
  for (const d of ds) {
    if (d.tipo !== tipo) { tipo = d.tipo; l.push(`## ${NOME[tipo] || tipo}`, ''); }
    l.push(`### ${d.titulo} (versão ${d.versao})`, '', d.conteudo, '');
  }
  return l.join('\n');
}
