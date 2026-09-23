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

type ConversaTriagem = { id: string; contato_numero: string; lead_id: string | null; dono_id: string | null; bot_ativo: boolean; bot_estado: string | null; bot_dados: any };

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
  }
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
}

/** Executa um passo e persiste. `inicio` = primeira mensagem de número novo. */
export async function executarTriagem(
  prisma: PrismaClient,
  token: string,
  conversa: ConversaTriagem,
  entrada: { texto: string; botaoId?: string | null } | { inicio: true; clienteNome?: string | null },
) {
  const cfg = await obterConfigTriagem(prisma);
  if (!cfg.ativa) return;
  const deps = {
    consultarCnpj: (c: string) => consultarCnpj(c),
    temMaterial: (s: 'Padaria' | 'Farmácia') => !materialVazio(s === 'Farmácia' ? cfg.material.farmacia : cfg.material.padaria),
  };
  const passo = 'inicio' in entrada
    ? iniciarTriagem({ clienteNome: entrada.clienteNome })
    : await avancarTriagem((conversa.bot_estado || 'MENU') as EstadoTriagem, (conversa.bot_dados || {}) as DadosTriagem, entrada, deps);

  // Grava o estado antes de enviar: se o cliente responder rápido, o próximo webhook já vê o estado novo.
  const fim = passo.estado === 'FIM';
  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: { bot_ativo: !fim, bot_estado: passo.estado, bot_dados: passo.dados as any },
  });

  await enviarAcoes(prisma, token, conversa, passo.acoes, cfg);
  if (passo.desfecho) await aplicarDesfecho(prisma, conversa, passo);
}
