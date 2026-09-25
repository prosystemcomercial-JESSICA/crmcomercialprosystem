// Aplica um passo da triagem: envia as ações pela UAZAPI, grava as mensagens do
// robô, salva estado/dados na conversa e, no fim, aplica os efeitos no lead e
// na conversa e avisa o time.

import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { calcularSlaPrazo } from './whatsapp-sla.service';
import { obterConfigTriagem, materialVazio, type ConfigTriagem } from './triagem-config.service';
import { consultarCnpj } from '../lib/cnpj';
import { iniciarTriagem, avancarTriagem, ESTADOS_TRIAGEM, type Acao, type DadosTriagem, type EstadoTriagem, type ResultadoPasso } from '../lib/triagem/fluxo';
import { efeitosDesfecho } from '../lib/triagem/desfecho';
import { fluxoCuidaDoCnpj, cnpjNovoNaMensagem, dadosComCnpj, efeitosCnpjNoLead } from '../lib/triagem/cnpj-conversa';
import { serializarPorChave } from '../lib/serializar';

type ConversaTriagem = { id: string; contato_numero: string; lead_id: string | null; dono_id: string | null; bot_ativo: boolean; bot_estado: string | null; bot_dados: any };

// Mesma fila para a triagem, a detecção de CNPJ e a confirmação de cliente: todas leem e gravam bot_dados.
import { chaveConversa, perguntarClienteSeCasar } from './whatsapp-confirmacao-cliente.service';

const SELECT_LEAD_RECEITA = { cnpj: true, razao_social: true, nome_fantasia: true, empresa: true, segmento: true, cidade: true, estado: true, endereco: true, responsavel_nome: true, responsavel_email: true, telefone: true } as const;

/** Preenche o lead com os dados da Receita já salvos na conversa + observação (sem etapa/prioridade/alarme). */
export async function aplicarReceitaNoLead(prisma: PrismaClient, leadId: string, dados: DadosTriagem) {
  const atual = await prisma.lead.findUnique({ where: { id: leadId }, select: SELECT_LEAD_RECEITA }).catch(() => null);
  const e = efeitosCnpjNoLead(dados, atual);
  if (Object.keys(e.lead).length) {
    await prisma.lead.update({ where: { id: leadId }, data: e.lead }).catch((err: any) => console.error('[CNPJ] lead:', err?.message));
  }
  await prisma.leadObservacao.create({ data: { lead_id: leadId, tipo: 'SISTEMA', descricao: e.observacao, created_by: 'bot', created_by_name: 'Consulta de CNPJ' } })
    .catch((err: any) => console.error('[CNPJ] observação:', err?.message));
}

/**
 * Mensagem com um CNPJ novo (qualquer momento da conversa): consulta a Receita,
 * guarda em bot_dados e preenche o lead. Roda na mesma fila da triagem.
 */
export async function detectarCnpjNaConversa(
  prisma: PrismaClient, conversaId: string, texto: string,
  consultar: typeof consultarCnpj = consultarCnpj,
  token?: string,
) {
  return serializarPorChave(chaveConversa(conversaId), async () => {
    const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, lead_id: true, dono_id: true, bot_dados: true, bot_ativo: true, bot_estado: true } });
    if (!conversa || fluxoCuidaDoCnpj(conversa)) return;
    const atuais = (conversa.bot_dados || {}) as DadosTriagem;
    const cnpj = cnpjNovoNaMensagem(atuais, texto);
    if (!cnpj) return;
    const novos = dadosComCnpj(atuais, cnpj, await consultar(cnpj));
    if (!novos) return; // não encontrado na Receita
    await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_dados: novos as any } });
    if (conversa.lead_id) await aplicarReceitaNoLead(prisma, conversa.lead_id, novos);
    emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId });
    // CNPJ de cliente da base: pergunta agora (ou deixa pendente até o fim da triagem).
    if (token !== undefined) {
      await perguntarClienteSeCasar(prisma, token, conversaId).catch((e: any) => console.error('[CNPJ-CLIENTE] erro:', e?.message));
    }
  });
}

export function emTriagem(c: { bot_ativo: boolean; bot_estado: string | null }): boolean {
  return c.bot_ativo && !!c.bot_estado && ESTADOS_TRIAGEM.includes(c.bot_estado as EstadoTriagem) && c.bot_estado !== 'FIM';
}

async function registrarSaida(prisma: PrismaClient, conversaId: string, conteudo: string, externo_id?: string, extra: { tipo?: string; midia_url?: string } = {}) {
  const msg = await prisma.whatsappMensagem.create({
    data: { conversaId, externo_id, direcao: 'SAIDA', tipo: extra.tipo || 'TEXTO', conteudo, midia_url: extra.midia_url, status: 'ENVIADA', enviada_por: 'bot' },
  }).catch((e: any) => { console.error('[TRIAGEM] falha ao gravar saída:', e?.message); return null; });
  return msg;
}

async function enviarAcoes(prisma: PrismaClient, token: string, conversa: ConversaTriagem, acoes: Acao[], cfg: ConfigTriagem) {
  let ultima = '';
  for (const a of acoes) {
    try {
      if (a.tipo === 'texto') {
        const r = await evo.enviarTexto(token, conversa.contato_numero, a.texto);
        await registrarSaida(prisma, conversa.id, a.texto, r.externo_id);
        ultima = a.texto;
      } else if (a.tipo === 'menu') {
        const r = await evo.enviarMenu(token, conversa.contato_numero, a.menu);
        const conteudo = `${a.menu.texto}\n\n${a.menu.opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`;
        await registrarSaida(prisma, conversa.id, conteudo, r.externo_id);
        ultima = a.menu.texto;
      } else if (a.tipo === 'material') {
        const m = a.segmento === 'Farmácia' ? cfg.material.farmacia : cfg.material.padaria;
        if (m.texto.trim()) {
          const r = await evo.enviarTexto(token, conversa.contato_numero, m.texto);
          await registrarSaida(prisma, conversa.id, m.texto, r.externo_id);
        }
        if (m.imagem) {
          const r = await evo.enviarArquivo(token, conversa.contato_numero, m.imagem, 'imagem.jpg');
          await registrarSaida(prisma, conversa.id, '🖼️ Imagem', r.externo_id, { tipo: r.tipo, midia_url: m.imagem });
        }
        if (m.pdf) {
          const nome = m.pdf_nome || 'material.pdf';
          const r = await evo.enviarArquivo(token, conversa.contato_numero, m.pdf, nome);
          await registrarSaida(prisma, conversa.id, nome, r.externo_id, { tipo: r.tipo, midia_url: m.pdf });
        }
      }
    } catch (e: any) {
      console.error('[TRIAGEM] falha ao enviar ação:', e?.message);
    }
  }
  if (ultima) {
    await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { ultima_mensagem: ultima.slice(0, 200), ultima_em: new Date() } }).catch(() => {});
  }
}

async function aplicarDesfecho(prisma: PrismaClient, conversa: ConversaTriagem, passo: ResultadoPasso) {
  const lead = conversa.lead_id
    ? await prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { cnpj: true, razao_social: true, nome_fantasia: true, empresa: true, segmento: true, cidade: true, estado: true, endereco: true, responsavel_nome: true, responsavel_email: true, telefone: true, origem: true } }).catch(() => null)
    : null;
  const e = efeitosDesfecho(passo.desfecho!, passo.dados, lead);

  const dadosConversa: any = { etiqueta: e.conversa.etiqueta, etiqueta_cor: e.conversa.etiqueta_cor };
  if (e.conversa.prioridade) { dadosConversa.prioridade = e.conversa.prioridade; dadosConversa.sla_prazo_em = calcularSlaPrazo(e.conversa.prioridade); }
  if (e.conversa.contato_nome) dadosConversa.contato_nome = e.conversa.contato_nome;
  if (e.conversa.desvincularLead && conversa.lead_id) {
    dadosConversa.lead_id = null;
    if (lead?.origem === 'WHATSAPP') await prisma.lead.update({ where: { id: conversa.lead_id }, data: { deleted_at: new Date() as any } }).catch(() => {});
  }
  await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: dadosConversa }).catch((err: any) => console.error('[TRIAGEM] conversa:', err?.message));

  if (conversa.lead_id && !e.conversa.desvincularLead) {
    if (e.lead && Object.keys(e.lead).length) {
      await prisma.lead.update({ where: { id: conversa.lead_id }, data: e.lead }).catch((err: any) => console.error('[TRIAGEM] lead:', err?.message));
    }
    if (e.observacao) {
      await prisma.leadObservacao.create({ data: { lead_id: conversa.lead_id, tipo: 'SISTEMA', descricao: e.observacao, created_by: 'bot', created_by_name: 'Triagem automática' } })
        .catch((err: any) => console.error('[TRIAGEM] observação:', err?.message));
    }
  }

  if (e.notificacao) {
    emitirEventoConversa(null, 'lead_qualificado', { conversaId: conversa.id, ...e.notificacao });
    if (passo.desfecho === 'qualificado') {
      const { enviarAvisoGestao } = await import('./assistente-gestao.service');
      void enviarAvisoGestao(prisma, 'lead_qualificado',
        `🔔 *${e.notificacao.titulo}*\n${e.notificacao.detalhe}${e.notificacao.alerta ? `\n⚠️ ${e.notificacao.alerta}` : ''}\nContato: ${conversa.contato_numero}`);
    }
  }
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
}

/** Executa um passo e persiste. `inicio` = primeira mensagem de número novo. */
export async function executarTriagem(
  prisma: PrismaClient,
  token: string,
  conversaInicial: ConversaTriagem,
  entrada: { texto: string; botaoId?: string | null } | { inicio: true; clienteNome?: string | null },
) {
  // Uma triagem por conversa de cada vez: a consulta de CNPJ demora e uma segunda
  // mensagem rápida não pode ler o mesmo estado e passar na frente.
  return serializarPorChave(chaveConversa(conversaInicial.id), async () => {
    // Relê a conversa dentro da fila: a chamada anterior pode ter avançado o estado.
    const conversa = await prisma.whatsappConversa.findUnique({
      where: { id: conversaInicial.id },
      select: { id: true, contato_numero: true, lead_id: true, dono_id: true, bot_ativo: true, bot_estado: true, bot_dados: true },
    }) as ConversaTriagem | null;
    if (!conversa) return;
    if ('inicio' in entrada ? conversa.bot_estado !== null : !emTriagem(conversa)) return;
    await executarPasso(prisma, token, conversa, entrada);
  });
}

async function executarPasso(
  prisma: PrismaClient,
  token: string,
  conversa: ConversaTriagem,
  entrada: { texto: string; botaoId?: string | null } | { inicio: true; clienteNome?: string | null },
) {
  const cfg = await obterConfigTriagem(prisma);
  if (!cfg.ativa) return;
  const { obterConfigIa } = await import('./assistente-config.service');
  const ia = await obterConfigIa(prisma);
  const deps = {
    consultarCnpj: (c: string) => consultarCnpj(c),
    temMaterial: (s: 'Padaria' | 'Farmácia') => !materialVazio(s === 'Farmácia' ? cfg.material.farmacia : cfg.material.padaria),
    // Laya na triagem: só quando ligada em Configurações (desligada por padrão até o treino).
    ...(ia.laya_triagem ? {
      classificar: async (pergunta: 'menu' | 'segmento', texto: string) => {
        const { classificarTriagem } = await import('./laya.service');
        return classificarTriagem(pergunta, texto, ia.laya_confianca);
      },
    } : {}),
  };
  const inicio = 'inicio' in entrada;
  const passo = 'inicio' in entrada
    ? iniciarTriagem({ clienteNome: entrada.clienteNome })
    : await avancarTriagem((conversa.bot_estado || 'MENU') as EstadoTriagem, (conversa.bot_dados || {}) as DadosTriagem, entrada, deps);

  // Grava o estado antes de enviar: se o cliente responder rápido, o próximo webhook já vê o estado novo.
  const fim = passo.estado === 'FIM';
  // Compare-and-set: só grava se o estado ainda é o que lemos. Se outro webhook já
  // avançou (ou um humano parou o robô), não envia nada.
  const r = await prisma.whatsappConversa.updateMany({
    where: { id: conversa.id, ...(inicio ? { bot_estado: null } : { bot_ativo: true, bot_estado: conversa.bot_estado }) },
    data: { bot_ativo: !fim, bot_estado: passo.estado, bot_dados: passo.dados as any },
  });
  if (r.count === 0) return;

  await enviarAcoes(prisma, token, conversa, passo.acoes, cfg);
  if (passo.desfecho) await aplicarDesfecho(prisma, conversa, passo);
  // Fim da triagem: pergunta "É a sua empresa?" se o CNPJ (da triagem ou pendente) é de um cliente da base.
  if (fim) await perguntarClienteSeCasar(prisma, token, conversa.id).catch((e: any) => console.error('[CNPJ-CLIENTE] erro:', e?.message));
  // Lead qualificado (e não é cliente da base): oferece a demonstração com horários livres.
  if (fim && passo.desfecho === 'qualificado') {
    const { oferecerDemo } = await import('./assistente-demo.service');
    await oferecerDemo(prisma, token, conversa.id).catch((e: any) => console.error('[DEMO] oferta:', e?.message));
  }
}
