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

type DocNovo = { tipo: 'POP' | 'PROCESSO' | 'EXEMPLO' | 'DICA' | 'ALERTA' | 'ABORDAGEM'; titulo: string; conteudo: string; agente_alvo?: string | null };

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
  await enviarAvisoGestao(prisma, 'lead_qualificado', texto).catch(() => {});
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
  const md = [
    `# Revisão das conversas · ${dia}`, '',
    avaliacao?.resumo || '',
    '', `## Deixadas de lado (${deLado.length})`,
    ...(deLado.length ? deLado.map(d => `- **${d.nome}**: sem resposta há ${d.horas} h. Última mensagem: "${d.texto}"`) : ['- Nenhuma. 👏']),
    '', `## Conversas não satisfatórias (${avaliacao?.alertas?.length || 0})`,
    ...((avaliacao?.alertas || []).map(a => `- **${a.conversa}**: ${a.problema}\n  - Como melhorar: ${a.como_melhorar}`)),
    '', '## Dicas para o time', ...((avaliacao?.dicas || []).map(d => `- ${d}`)),
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
  const base = await prisma.especialistaDoc.findMany({ where: { status: 'APROVADO', tipo: { in: ['POP', 'PROCESSO', 'DICA'] } }, orderBy: { created_at: 'desc' }, take: 8, select: { titulo: true, conteudo: true } });
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
  registrarAcaoAgente('rafael', `teve "${d.titulo.slice(0, 50)}" aprovado`);
  return upd;
}

/** Rotina: revisão das conversas de seg a sex às 17h; estudo toda quarta às 9h. */
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
}

/** Caderno do Rafael em markdown: tudo o que está aprovado (parâmetros do setor), por tipo. */
export async function cadernoRafael(prisma: PrismaClient): Promise<string> {
  const ds = await prisma.especialistaDoc.findMany({ where: { status: 'APROVADO' }, orderBy: [{ tipo: 'asc' }, { titulo: 'asc' }] });
  const NOME: Record<string, string> = { POP: 'POPs', PROCESSO: 'Processos', EXEMPLO: 'Exemplos', DICA: 'Dicas', ABORDAGEM: 'Abordagens iniciais', ALERTA: 'Revisões de conversas' };
  const l = ['# Caderno do Rafael · parâmetros do setor comercial', '', `Documentos aprovados (${ds.length}). Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`, ''];
  let tipo = '';
  for (const d of ds) {
    if (d.tipo !== tipo) { tipo = d.tipo; l.push(`## ${NOME[tipo] || tipo}`, ''); }
    l.push(`### ${d.titulo} (versão ${d.versao})`, '', d.conteudo, '');
  }
  return l.join('\n');
}
