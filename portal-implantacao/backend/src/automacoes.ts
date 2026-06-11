// ─────────────────────────────────────────────────────────────────────────────
// AUTOMAÇÕES E WORKFLOWS (Parte 3 do plano)
// 1) Transição: Fase 1.5 (Negócio Fechado) → Fase 2.1 (Kick-off)
// 2) Transição: Fase 2.5 (Go-Live, checklist ok) → Fase 3.1 (Onboarding mês 1)
// 3) SLA Fiscal: >5 dias na Fase 2.2 → alerta vermelho ao gestor + e-mail ao contador
// 4) Engajamento: 15 dias na Fase 3.1 → e-mail apresentando o Freshdesk
// 5) NPS: ao entrar na Fase 3.4 (Cliente de Sucesso) → e-mail de NPS
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { FASE_POR_CODIGO, FaseDef, FASES } from './funis.js';
import { enviarEmail, alertaGestor, FRESHDESK_URL } from './notificacoes.js';

/** Cria os itens de checklist da fase (se ainda não existirem). Idempotente. */
export async function criarChecklistDaFase(prisma: PrismaClient, projetoId: string, fase: FaseDef) {
  if (!fase.checklist?.length) return;
  const existentes = await prisma.checklistItem.findMany({ where: { projeto_id: projetoId, fase: fase.codigo }, select: { titulo: true } });
  const jaTem = new Set(existentes.map(e => e.titulo));
  let ordem = existentes.length;
  for (const titulo of fase.checklist) {
    if (jaTem.has(titulo)) continue;
    await prisma.checklistItem.create({ data: { projeto_id: projetoId, fase: fase.codigo, titulo, ordem: ordem++ } });
  }
}

/** Registra que uma automação rodou (idempotente por projeto+gatilho). true se foi a 1ª vez. */
async function marcar(prisma: PrismaClient, projetoId: string, gatilho: string, detalhe?: string): Promise<boolean> {
  try {
    await prisma.logAutomacao.create({ data: { projeto_id: projetoId, gatilho, detalhe } });
    return true;
  } catch { return false; } // já existe (unique) → não repete
}

/** Automações disparadas logo APÓS um movimento de fase (transições e NPS). */
export async function dispararAutomacoesPosMovimento(prisma: PrismaClient, projeto: any, destino: FaseDef) {
  // Gatilho 1 — Fase 1.5 (Negócio Fechado) → cria/avança p/ Implantação (Fase 2.1).
  if (destino.codigo === 'COM_FECHADO') {
    if (await marcar(prisma, projeto.id, 'TRANSICAO_1', 'Negócio fechado → Implantação (Kick-off)')) {
      const kickoff = FASE_POR_CODIGO['IMP_KICKOFF'];
      await prisma.projetoImplantacao.update({ where: { id: projeto.id }, data: { funil: 'IMPLANTACAO', fase: 'IMP_KICKOFF', fase_desde: new Date() } });
      await prisma.historicoFase.create({ data: { projeto_id: projeto.id, funil_de: 'COMERCIAL', fase_de: 'COM_FECHADO', funil_para: 'IMPLANTACAO', fase_para: 'IMP_KICKOFF', movido_por_nome: 'Automação' } });
      await criarChecklistDaFase(prisma, projeto.id, kickoff);
    }
    return;
  }

  // Gatilho 2 — Fase 2.5 (Go-Live) → Onboarding (Fase 3.1). (Checklist já validado na rota /mover.)
  if (destino.codigo === 'IMP_GOLIVE') {
    if (await marcar(prisma, projeto.id, 'TRANSICAO_2', 'Go-Live → Onboarding (Mês 1)')) {
      const mes1 = FASE_POR_CODIGO['ONB_MES1'];
      await prisma.projetoImplantacao.update({ where: { id: projeto.id }, data: { funil: 'ONBOARDING', fase: 'ONB_MES1', fase_desde: new Date() } });
      await prisma.historicoFase.create({ data: { projeto_id: projeto.id, funil_de: 'IMPLANTACAO', fase_de: 'IMP_GOLIVE', funil_para: 'ONBOARDING', fase_para: 'ONB_MES1', movido_por_nome: 'Automação' } });
    }
    return;
  }

  // Gatilho 5 — Fase 3.4 (Cliente de Sucesso) → e-mail de NPS.
  if (destino.codigo === 'ONB_SUCESSO') {
    if (await marcar(prisma, projeto.id, 'NPS_SUCESSO', 'E-mail de NPS enviado')) {
      if (projeto.email) await enviarEmail({
        para: projeto.email,
        assunto: 'Como foi sua experiência com a Prosystem?',
        corpo: `Olá, ${projeto.cliente_nome}!\n\nVocê agora é um Cliente de Sucesso Prosystem 🎉. Numa escala de 0 a 10, o quanto você nos recomendaria?\n\nSua opinião é muito importante para nós.\n\nEquipe Prosystem`,
      });
    }
  }
}

/** Scheduler diário: gatilhos baseados em TEMPO (SLA fiscal 5d, engajamento 15d). */
export function iniciarSchedulerAutomacoes(prisma: PrismaClient) {
  const rodar = async () => {
    const agora = Date.now();
    const ativos = await prisma.projetoImplantacao.findMany({ where: { status: { in: ['ATIVO'] } } }).catch(() => [] as any[]);
    for (const p of ativos) {
      const diasNaFase = (agora - new Date(p.fase_desde).getTime()) / 86400000;

      // Gatilho 3 — >5 dias parado na Fase 2.2 (Saneamento Fiscal): alerta + e-mail ao contador.
      if (p.fase === 'IMP_FISCAL' && diasNaFase > 5) {
        if (await marcar(prisma, p.id, 'SLA_FISCAL', `Estourou 5 dias em Saneamento Fiscal (${Math.floor(diasNaFase)}d)`)) {
          await alertaGestor(`🔴 GARGALO FISCAL: ${p.cliente_nome} está há ${Math.floor(diasNaFase)} dias na fase Saneamento Fiscal.`);
          const contato = extrairEmailContador(p.dados_contador);
          if (contato) await enviarEmail({
            para: contato,
            assunto: `Pendência fiscal — implantação Prosystem (${p.cliente_nome})`,
            corpo: `Prezado contador,\n\nEstamos finalizando a implantação fiscal do cliente ${p.cliente_nome} e precisamos da sua ajuda para concluir o saneamento fiscal (certificado, CSC SEFAZ e tributação CFOP/CSOSN). Pode nos retornar?\n\nObrigado,\nEquipe de Implantação Prosystem`,
          });
        }
      }

      // Gatilho 4 — 15 dias na Fase 3.1 (Onboarding Mês 1): e-mail apresentando o Freshdesk.
      if (p.fase === 'ONB_MES1' && diasNaFase >= 15) {
        if (await marcar(prisma, p.id, 'ENGAJAMENTO_15D', 'E-mail de apresentação do Freshdesk')) {
          if (p.email) await enviarEmail({
            para: p.email,
            assunto: 'Conheça a Central de Ajuda Prosystem',
            corpo: `Olá, ${p.cliente_nome}!\n\nVocê já está com o sistema rodando 🎉. Para tirar dúvidas a qualquer hora, conheça nossa base de conhecimento e abra chamados de suporte:\n\n${FRESHDESK_URL}\n\nEstamos com você!\nEquipe Prosystem`,
          });
        }
      }
    }
  };
  rodar().catch(() => {});                         // roda ao subir
  setInterval(() => rodar().catch(() => {}), 6 * 60 * 60 * 1000); // a cada 6h
}

function extrairEmailContador(dados?: string | null): string | null {
  if (!dados) return null;
  const m = dados.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/);
  return m ? m[0] : null;
}
