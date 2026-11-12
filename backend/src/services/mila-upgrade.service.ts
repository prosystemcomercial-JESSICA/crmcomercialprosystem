import type { PrismaClient } from '@prisma/client';
import { chamarGemini } from './ia-gemini.service';
import { lerJsonIa } from '@/lib/assistente/ia-texto';
import { TEXTO_DE_GENTE } from '@/lib/assistente/texto-de-gente';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';
import { escolherParaUpgrade, ferramentasNovas, mesesDeCasa, emailValido, DIAS_ENTRE_OFERTAS, MESES_MINIMOS } from '@/lib/assistente/mila-upgrade';

/**
 * MILA · oferta de upgrade para clientes da base (11/11/2026).
 * A cada 15 dias a Mila escolhe até 30 clientes antigos fora do Plus, escreve UM e-mail de convite (sem preço)
 * e deixa no painel dela para a Jessica aprovar. Aprovado, o e-mail sai em lotes nos dias úteis e fica anotado
 * no cadastro do cliente. Nada sai sem aprovação; WhatsApp não é usado (protege o número).
 */

const MILA_UPGRADE = [
  'Você é a Mila, Customer Success da Prosystem Sistemas (ERP/PDV para farmácias, drogarias, manipulação e padarias).',
  'Você escreve para clientes que já usam o sistema há bastante tempo, convidando para conhecer o plano Plus e as ferramentas novas.',
  'Tom de parceira que cuida da conta, não de vendedora. Português do Brasil, frases curtas, sem travessão, sem exagero de emoji.',
  'Nunca cite preço, desconto, prazo ou condição comercial. Nunca invente recurso: fale só das ferramentas listadas no pedido.',
  TEXTO_DE_GENTE,
].join('\n');

const LOTE = 20; // e-mails por rodada do agendador
type Fontes = { oferta: { assunto: string; email: string }; clientes: { id: string; nome: string; email: string | null }[]; envio: null | { fila: { id: string; email: string }[]; enviados: number; falhas: number; total: number } };

/** Quem já entrou numa oferta (proposta ou aprovada) nos últimos 90 dias. */
async function jaOfertados(prisma: PrismaClient, agora: Date): Promise<Set<string>> {
  const docs = await prisma.especialistaDoc.findMany({ where: { origem: 'mila', tipo: 'UPGRADE', status: { not: 'ARQUIVADO' }, created_at: { gte: new Date(+agora - DIAS_ENTRE_OFERTAS * 864e5) } }, select: { fontes: true } });
  return new Set(docs.flatMap(d => ((d.fontes as any)?.clientes || []).map((c: any) => String(c.id))));
}

/** A Mila monta a oferta e deixa para aprovar. Devolve null quando não há o que oferecer. */
export async function proporOfertaUpgrade(prisma: PrismaClient, agora = new Date()) {
  if (await prisma.especialistaDoc.count({ where: { origem: 'mila', tipo: 'UPGRADE', status: 'PROPOSTO' } })) {
    registrarAcaoAgente('mila', 'ainda espera a aprovação da última oferta de upgrade');
    return null;
  }
  const base = await prisma.cliente.findMany({
    where: { situacao: 'ATIVA' },
    select: { id: true, nome: true, nome_fantasia: true, email: true, segmento: true, plano: true, situacao: true, data_entrada: true, risco_atencao: true, apresentou_plus: true, conhece_dashboard: true, conhece_mensageria: true, conhece_gerencial: true, conhece_atencao_farma: true },
  });
  const escolhidos = escolherParaUpgrade(base, agora, await jaOfertados(prisma, agora));
  if (!escolhidos.length) { registrarAcaoAgente('mila', 'conferiu a base: ninguém novo para a oferta de upgrade'); return null; }

  const conta = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => (m[x] = (m[x] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(', ');
  const ferramentas = conta(escolhidos.flatMap(ferramentasNovas));
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const pergunta = [
    `Escreva UM e-mail de convite para ${escolhidos.length} clientes antigos (${MESES_MINIMOS} meses ou mais de casa) que ainda não estão no plano Plus.`,
    `Perfil do grupo: segmentos (${conta(escolhidos.map(c => c.segmento || 'não informado'))}); planos atuais (${conta(escolhidos.map(c => c.plano || 'não informado'))}).`,
    ferramentas ? `Ferramentas que eles ainda não conhecem (use só estas): ${ferramentas}.` : 'Fale do plano Plus de forma geral, sem listar recursos.',
    'O e-mail: agradece o tempo de parceria, diz em 2 ou 3 linhas o que o cliente ganha no dia a dia da loja com essas ferramentas e convida para uma apresentação de 20 minutos, sem compromisso. Chamada final: responder este e-mail ou chamar no WhatsApp da Prosystem.',
    'Markdown simples, até 170 palavras, sem o nome do cliente (o mesmo texto vai para todos). Assunto curto e específico, sem caixa alta.',
    'Responda APENAS com JSON: {"assunto": string, "email": string}',
  ].join('\n');
  const r = lerJsonIa<{ assunto: string; email: string }>(await chamarGemini(prisma, { sistema: MILA_UPGRADE + (await instrucoesPara(prisma, 'mila')), partes: [{ text: pergunta }], json: true, temperatura: 0.5, timeoutMs: 120_000 }));
  if (!r?.assunto || !r?.email) throw new Error('a Mila não conseguiu escrever a oferta desta vez');

  const dia = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const comEmail = escolhidos.filter(c => emailValido(c.email));
  const md = [
    `# Oferta de upgrade · ${dia}`, '',
    `${escolhidos.length} cliente(s) escolhido(s): ${comEmail.length} recebem o e-mail abaixo depois da sua aprovação; ${escolhidos.length - comEmail.length} não têm e-mail no cadastro (a equipe pode ligar).`, '',
    '## E-mail', `**Assunto:** ${r.assunto}`, '', r.email, '',
    '## Clientes', '| Cliente | Plano | Tempo de casa | Ainda não conhece | E-mail |', '| --- | --- | --- | --- | --- |',
    ...escolhidos.map(c => `| ${(c.nome_fantasia || c.nome).replace(/\|/g, ' ')} | ${c.plano || '—'} | ${mesesDeCasa(c, agora)} meses | ${ferramentasNovas(c).join(', ') || '—'} | ${emailValido(c.email) ? 'sim' : 'não tem'} |`),
  ].join('\n');
  const fontes: Fontes = { oferta: { assunto: r.assunto.slice(0, 150), email: r.email }, clientes: escolhidos.map(c => ({ id: c.id, nome: c.nome_fantasia || c.nome, email: emailValido(c.email) ? c.email!.trim().toLowerCase() : null })), envio: null };
  const doc = await prisma.especialistaDoc.create({ data: { tipo: 'UPGRADE', titulo: `Oferta de upgrade · ${dia}`, conteudo: md, origem: 'mila', status: 'PROPOSTO', fontes: fontes as any } });
  registrarAcaoAgente('mila', `montou a oferta de upgrade para ${escolhidos.length} cliente(s) (esperando aprovação)`);
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', `💚 *Mila montou uma oferta de upgrade para ${escolhidos.length} cliente(s) da base*\nAssunto: "${r.assunto}"\n${comEmail.length} recebem por e-mail; ${escolhidos.length - comEmail.length} sem e-mail.\n\nLeia e aprove no Escritório › Painel da Mila › Para aprovar. Só sai depois da sua aprovação.`, { somenteAprovadora: true }).catch(() => {});
  return doc;
}

/** Chamado na aprovação do documento: monta a fila de e-mails. */
export async function iniciarEnvioUpgrade(prisma: PrismaClient, docId: string) {
  const d = await prisma.especialistaDoc.findUnique({ where: { id: docId } });
  const f = d?.fontes as unknown as Fontes | null;
  if (!d || !f?.oferta || f.envio) return 0;
  const fila = f.clientes.filter(c => c.email).map(c => ({ id: c.id, email: c.email! }));
  await prisma.especialistaDoc.update({ where: { id: docId }, data: { fontes: { ...f, envio: { fila, enviados: 0, falhas: 0, total: fila.length } } as any } });
  registrarAcaoAgente('mila', `teve a oferta de upgrade aprovada: ${fila.length} e-mail(s) na fila`);
  return fila.length;
}

/** Agendador: manda os e-mails aprovados em lotes (dias úteis, 8h–18h) e anota no cadastro do cliente. */
export async function enviarOfertasUpgrade(prisma: PrismaClient, agora = new Date()) {
  const d = await prisma.especialistaDoc.findFirst({ where: { origem: 'mila', tipo: 'UPGRADE', status: 'APROVADO' }, orderBy: { decidido_em: 'desc' } });
  const f = d?.fontes as unknown as Fontes | null;
  const env = f?.envio;
  if (!d || !f || !env || env.enviados + env.falhas >= env.total) return 0;
  const { enviarEmailInformativo } = await import('./email.service');
  const { mdParaHtml } = await import('./joana.service');
  const dia = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  const inicio = env.enviados + env.falhas;
  let ok = 0, falha = 0;
  for (const c of env.fila.slice(inicio, inicio + LOTE)) {
    const foi = await enviarEmailInformativo(c.email, f.oferta.assunto, mdParaHtml(f.oferta.email, 'Prosystem Sistemas'), 'Prosystem Sistemas').catch(() => false);
    if (foi) {
      ok++;
      const cli = await prisma.cliente.findUnique({ where: { id: c.id }, select: { ativo_observacoes: true } }).catch(() => null);
      if (cli) await prisma.cliente.update({ where: { id: c.id }, data: { ativo_observacoes: `${cli.ativo_observacoes ? `${cli.ativo_observacoes}\n` : ''}${dia}: oferta de upgrade enviada por e-mail (Mila).`.slice(-4000) } }).catch(() => {});
    } else falha++;
    await new Promise(res => setTimeout(res, 1500));
  }
  await prisma.especialistaDoc.update({ where: { id: d.id }, data: { fontes: { ...f, envio: { ...env, enviados: env.enviados + ok, falhas: env.falhas + falha } } as any } });
  registrarAcaoAgente('mila', `enviou ${ok} e-mail(s) da oferta de upgrade (${env.enviados + ok}/${env.total})`);
  return ok;
}
