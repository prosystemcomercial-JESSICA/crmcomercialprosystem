// Confirmação de cliente por CNPJ (WhatsApp da empresa): quando a conversa sem
// cliente tem o CNPJ de exatamente um cliente da base, pergunta "É a sua
// empresa?" e, na resposta, vincula (Sim) ou anota (Não). As regras estão em
// lib/whatsapp-confirmacao-cliente; aqui só consulta, envia e grava.

import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { dadosSairDoFunil, vincularContatoCliente } from './whatsapp-vinculo.service';
import { serializarPorChave } from '../lib/serializar';
import { ESTADOS_TRIAGEM, type EstadoTriagem } from '../lib/triagem/fluxo';
import { ETIQUETA_TIPO } from '../lib/whatsapp-identificar';
import { SQL_CNPJ_DIGITOS } from '../lib/busca-clientes';
import {
  decidirPerguntaCliente, dadosComConfirmacao, menuConfirmacaoCliente, decidirRespostaCliente, observacaoRecusa,
  soDigitos, type BotDadosConfirmacao, type ClienteCandidato,
} from '../lib/whatsapp-confirmacao-cliente';

/** Mesma fila da triagem e da detecção de CNPJ (todas leem e gravam bot_dados). */
export const chaveConversa = (id: string) => `triagem:${id}`;

const emTriagem = (c: { bot_ativo: boolean; bot_estado: string | null }) =>
  c.bot_ativo && !!c.bot_estado && ESTADOS_TRIAGEM.includes(c.bot_estado as EstadoTriagem) && c.bot_estado !== 'FIM';

const SELECT_CONVERSA = { id: true, contato_numero: true, contato_nome: true, lead_id: true, dono_id: true, cliente_id: true, bot_ativo: true, bot_estado: true, bot_dados: true } as const;

async function clientesPorCnpj(prisma: PrismaClient, cnpj: string): Promise<ClienteCandidato[]> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, codigo, razao_social, nome_fantasia, nome FROM Cliente WHERE ${SQL_CNPJ_DIGITOS} = ? LIMIT 2`, cnpj,
  ).catch((e: any) => { console.error('[CNPJ-CLIENTE] busca:', e?.message); return []; });
  return rows as ClienteCandidato[];
}

async function registrarSaidaBot(prisma: PrismaClient, conversaId: string, conteudo: string, externo_id?: string) {
  await prisma.whatsappMensagem.create({
    data: { conversaId, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo, status: 'ENVIADA', enviada_por: 'bot' },
  }).catch((e: any) => console.error('[CNPJ-CLIENTE] saída:', e?.message));
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ultima_mensagem: conteudo.slice(0, 200), ultima_em: new Date() } }).catch(() => {});
}

/**
 * Pergunta (ou deixa pendente, se em triagem) quando o CNPJ da conversa é de
 * um cliente da base. SEM fila: chamar de dentro de serializarPorChave(chaveConversa).
 */
export async function perguntarClienteSeCasar(prisma: PrismaClient, token: string, conversaId: string) {
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: SELECT_CONVERSA });
  if (!conversa) return;
  const dados = (conversa.bot_dados || {}) as BotDadosConfirmacao;
  const cnpj = soDigitos(dados.cnpj);
  if (conversa.cliente_id || cnpj.length !== 14) return;
  const decisao = decidirPerguntaCliente({
    cliente_id: conversa.cliente_id, bot_dados: dados, emTriagem: emTriagem(conversa), candidatos: await clientesPorCnpj(prisma, cnpj),
  });
  if (decisao.acao === 'nenhuma') return;
  const conf = decisao.acao === 'perguntar' ? { ...decisao.confirmacao, perguntada_em: new Date().toISOString() } : decisao.confirmacao;
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_dados: dadosComConfirmacao(dados, conf) as any } });
  if (decisao.acao === 'adiar') return;
  const menu = menuConfirmacaoCliente(decisao.confirmacao);
  try {
    const r = await evo.enviarMenu(token, conversa.contato_numero, menu);
    await registrarSaidaBot(prisma, conversaId, `${menu.texto}\n\n${menu.opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`, r.externo_id);
  } catch (e: any) { console.error('[CNPJ-CLIENTE] envio:', e?.message); }
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId });
}

/** Trata a resposta à confirmação pendente. true = mensagem consumida (não segue p/ triagem). */
export async function responderConfirmacaoCliente(
  prisma: PrismaClient, token: string, conversaId: string, texto: string | null | undefined, botaoId?: string | null,
): Promise<boolean> {
  return serializarPorChave(chaveConversa(conversaId), async () => {
    const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: SELECT_CONVERSA });
    if (!conversa) return false;
    const dados = (conversa.bot_dados || {}) as BotDadosConfirmacao;
    const pend = dados.confirmacao_cliente;
    if (!pend || !pend.enviada || emTriagem(conversa)) return false;
    const desde = pend.perguntada_em ? new Date(pend.perguntada_em) : new Date(0);
    const [entradasAposPergunta, humanos] = await Promise.all([
      prisma.whatsappMensagem.count({ where: { conversaId, direcao: 'ENTRADA', created_at: { gt: desde } } }).catch(() => 99),
      prisma.whatsappMensagem.count({ where: { conversaId, direcao: 'SAIDA', created_at: { gt: desde }, OR: [{ enviada_por: null }, { enviada_por: { not: 'bot' } }] } }).catch(() => 1),
    ]);
    const decisao = decidirRespostaCliente({
      bot_dados: dados, emTriagem: false, texto, botaoId, agora: new Date(), entradasAposPergunta, humanoAposPergunta: humanos > 0,
    });
    if (!decisao) return false;
    const conf = pend;
    const semPendencia = { ...dados, confirmacao_cliente: null };
    if (decisao.acao === 'expirar') {
      // Não é resposta à pergunta: expira (o CNPJ segue em confirmacao_cliente_cnpjs) e a mensagem segue o fluxo.
      await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_dados: semPendencia as any } });
      emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId });
      return false;
    }
    const resposta = decisao.acao;
    if (resposta === 'sim' && conversa.cliente_id) {
      // Já vinculada (ex.: humano identificou): só limpa, sem réplica.
      await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_dados: semPendencia as any } });
      emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId });
      return true;
    }

    let replica: string;
    if (resposta === 'sim') {
      const existe = await prisma.cliente.findUnique({ where: { id: conf.cliente_id }, select: { id: true } }).catch(() => null);
      if (existe) {
        // Igual ao "Identificar → Cliente" do Inbox.
        await vincularContatoCliente(prisma, conversa, conf.cliente_id, undefined, undefined, { nome: 'Confirmação automática (CNPJ)' });
        const { etiqueta, cor } = ETIQUETA_TIPO.CLIENTE;
        await prisma.whatsappConversa.update({
          where: { id: conversaId },
          data: { tipo_contato: 'CLIENTE', etiqueta, etiqueta_cor: cor, bot_dados: semPendencia as any, ...(await dadosSairDoFunil(prisma, conversa)) },
        });
      } else {
        await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_dados: semPendencia as any } });
      }
      replica = 'Perfeito! Seu contato foi vinculado ao cadastro ✅';
    } else {
      await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_dados: semPendencia as any } });
      if (resposta === 'nao' && conversa.lead_id) {
        await prisma.leadObservacao.create({
          data: { lead_id: conversa.lead_id, tipo: 'SISTEMA', descricao: observacaoRecusa(conf), created_by: 'bot', created_by_name: 'Confirmação de cliente' },
        }).catch((e: any) => console.error('[CNPJ-CLIENTE] observação:', e?.message));
      } else if (resposta === 'nao') {
        console.log(`[CNPJ-CLIENTE] conversa ${conversaId}: ${observacaoRecusa(conf)}`);
      }
      replica = 'Tudo bem, obrigado!';
    }
    try {
      const r = await evo.enviarTexto(token, conversa.contato_numero, replica);
      await registrarSaidaBot(prisma, conversaId, replica, r.externo_id);
    } catch (e: any) { console.error('[CNPJ-CLIENTE] réplica:', e?.message); }
    emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId });
    return true;
  });
}

/** Humano identificou/vinculou o contato: descarta a pergunta pendente. Chamar dentro da fila da conversa. */
export async function limparConfirmacaoPendente(prisma: PrismaClient, conversaId: string) {
  const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { bot_dados: true } }).catch(() => null);
  const dados = (c?.bot_dados || null) as BotDadosConfirmacao | null;
  if (!dados?.confirmacao_cliente) return;
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_dados: { ...dados, confirmacao_cliente: null } as any } }).catch(() => {});
}
