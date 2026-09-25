import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { normalizarBuscaCliente, wherePrismaBusca, SQL_CNPJ_DIGITOS } from '@/lib/busca-clientes';
import {
  acharGestor, interpretarComando, lerPreferenciasAvisos, AJUDA, textoHoje, textoSemana, textoPropostasParadas, textoClientes,
  type TipoAviso,
} from '@/lib/assistente/gestao';

// Gestão no celular (Fase 1 do assistente): comandos da Jessica/do Thiago pelo
// WhatsApp da empresa e avisos que o CRM manda para eles.

const CARGOS_GESTAO = ['CEO', 'SUPERVISAO_COMERCIAL'];
const chavePrefs = (userId: string) => `assistente.avisos.${userId}`;

export async function listarGestao(prisma: PrismaClient) {
  const us = await prisma.usuarioCRM.findMany({
    where: { status: 'ATIVO', cargo: { in: CARGOS_GESTAO }, telefone: { not: null } },
    select: { id: true, nome: true, telefone: true },
  });
  return us.filter(u => (u.telefone || '').replace(/\D/g, '').length >= 10);
}

export async function lerPrefsAvisos(prisma: PrismaClient, userId: string) {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: chavePrefs(userId) } }).catch(() => null);
  return lerPreferenciasAvisos(r?.valor);
}

export async function salvarPrefsAvisos(prisma: PrismaClient, userId: string, tipos: TipoAviso[]) {
  const chave = chavePrefs(userId), valor = JSON.stringify(tipos);
  await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: userId }, update: { valor, updated_by: userId } });
}

/**
 * Mensagem de um número da gestão para o WhatsApp da empresa: responde o comando
 * e devolve true (o webhook não cria lead nem conversa). Outros números: false.
 */
export async function responderComandoGestao(prisma: PrismaClient, token: string, numero: string, texto: string): Promise<boolean> {
  const cmd = interpretarComando(texto);
  if (!cmd) return false; // não é comando: segue o fluxo normal do WhatsApp
  const gestor = acharGestor(numero, await listarGestao(prisma));
  if (!gestor) return false;
  let resposta = AJUDA;
  try {
    if (cmd.tipo === 'hoje') {
      const { montarDadosPainelTv } = await import('@/routes/painel-tv');
      resposta = textoHoje((await montarDadosPainelTv(prisma)).tela1);
    } else if (cmd.tipo === 'semana') {
      const { montarDadosSemana } = await import('./resumo-executivo.service');
      resposta = textoSemana(await montarDadosSemana(prisma));
    } else if (cmd.tipo === 'propostas_paradas') {
      const corte = new Date(Date.now() - 7 * 86400000);
      const ps = await prisma.propostaComercial.findMany({
        where: { deleted_at: null, status: { in: ['ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO'] }, updated_at: { lt: corte } },
        select: { nome_fantasia: true, razao_social: true, valor_final: true, valor_implantacao: true, updated_at: true, status: true },
        orderBy: { updated_at: 'asc' }, take: 20,
      });
      resposta = textoPropostasParadas(ps.map(p => ({
        nome: (p.nome_fantasia || p.razao_social || 'Sem nome').trim(),
        valor: p.valor_final ?? p.valor_implantacao ?? null,
        dias: Math.floor((Date.now() - p.updated_at.getTime()) / 86400000),
        status: p.status,
      })));
    } else if (cmd.tipo === 'cliente') {
      const termo = normalizarBuscaCliente(cmd.termo);
      const ids: string[] = termo.digitosCnpj
        ? ((await prisma.$queryRawUnsafe(`SELECT id FROM Cliente WHERE ${SQL_CNPJ_DIGITOS} LIKE ? LIMIT 20`, `%${termo.digitosCnpj}%`).catch(() => [])) as any[]).map(r => r.id)
        : [];
      const where = wherePrismaBusca(termo, ids);
      const cs = where ? await prisma.cliente.findMany({
        where, take: 6,
        select: { codigo: true, nome: true, nome_fantasia: true, razao_social: true, plano: true, mensalidade_base: true, situacao: true, segmento: true },
      }) : [];
      resposta = textoClientes(cs.map(c => ({
        codigo: c.codigo, nome: (c.nome_fantasia || c.razao_social || c.nome || '').trim(),
        plano: c.plano, mensalidade: c.mensalidade_base == null ? null : Number(c.mensalidade_base), situacao: c.situacao, segmento: c.segmento,
      })), cmd.termo);
    }
  } catch (e: any) {
    console.error('[ASSISTENTE] comando falhou:', e?.message);
    resposta = 'Não consegui buscar isso agora. Tente de novo em alguns minutos.';
  }
  await evo.enviarTexto(token, numero, resposta).catch((e: any) => console.error('[ASSISTENTE] envio:', e?.message));
  console.log(`[ASSISTENTE] comando "${cmd.tipo}" de ${gestor.nome}`);
  return true;
}

/** Envia um aviso para cada pessoa da gestão que quer esse tipo. Nunca lança. */
export async function enviarAvisoGestao(prisma: PrismaClient, tipo: TipoAviso, texto: string): Promise<void> {
  try {
    const inst = await obterInstanciaEmpresa(prisma);
    if (!inst?.instance_token) return;
    for (const g of await listarGestao(prisma)) {
      if (!(await lerPrefsAvisos(prisma, g.id)).includes(tipo)) continue;
      await evo.enviarTexto(inst.instance_token, g.telefone!, texto).catch((e: any) => console.error(`[AVISO] ${tipo} → ${g.nome}:`, e?.message));
    }
  } catch (e: any) {
    console.error('[AVISO] falhou:', e?.message);
  }
}

// Conversas que já receberam aviso de prazo estourado (conversa + prazo), para avisar uma vez só.
// A primeira varredura depois de ligar o servidor só anota (não despeja avisos antigos de uma vez).
const slaAvisados = new Set<string>();
let slaAquecido = false;

/** Conversas comerciais cuja última mensagem é do cliente e o prazo de resposta passou. */
export async function avisarSlaEstourado(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const conversas = await prisma.whatsappConversa.findMany({
    where: {
      sla_prazo_em: { lt: agora, gt: new Date(agora.getTime() - 24 * 3600000) }, bot_ativo: false,
      OR: [{ tipo_contato: null }, { tipo_contato: { in: ['LEAD', 'CLIENTE', 'TERCEIRO_CLIENTE'] } }],
    },
    select: { id: true, contato_nome: true, contato_numero: true, sla_prazo_em: true, mensagens: { orderBy: { created_at: 'desc' }, take: 1, select: { direcao: true, conteudo: true } } },
    take: 50,
  });
  let n = 0;
  for (const c of conversas) {
    const ultima = c.mensagens[0];
    if (!ultima || ultima.direcao !== 'ENTRADA') continue;
    const chave = `${c.id}:${c.sla_prazo_em!.getTime()}`;
    if (slaAvisados.has(chave)) continue;
    slaAvisados.add(chave);
    if (!slaAquecido) continue;
    n++;
    await enviarAvisoGestao(prisma, 'sla_estourado',
      `⏰ *Conversa sem resposta além do prazo*\n${c.contato_nome || c.contato_numero}: "${(ultima.conteudo || '').slice(0, 120)}"`);
  }
  slaAquecido = true;
  if (slaAvisados.size > 5000) slaAvisados.clear();
  return n;
}
