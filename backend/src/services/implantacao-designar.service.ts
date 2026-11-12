import type { PrismaClient } from '@prisma/client';
import { faseDoItemTreinamento, CHECKLIST_PADRAO, checklistDoPerfil, onboardingItensDoPerfil, perfilDe, ehLegado } from '@/lib/implantacao/portal';
import { numeroWhatsapp } from '@/lib/assistente/campanhas';
import {
  avisarTecnico, garantirFasesTreinamento, obterConfigPortal, criarTarefasClientePadrao, segmentoDaImplantacao,
  sincronizarOnboardingPelaFicha, TESTES_PADRAO, URL_FRONT, whats,
} from './implantacao-portal.service';

/**
 * Designação do técnico de uma demanda do portal técnico, usada pela supervisão (botão "Designar" no Quadro)
 * e, desde 12/11/2026, automaticamente quando um contrato é assinado (Lucas Diniz, por enquanto).
 */

/** Técnico que recebe toda implantação nova de contrato assinado (pedido da Jessica, 12/11/2026, "por enquanto"). */
export const TECNICO_PADRAO_NOME = 'Lucas Diniz';
/** WhatsApp que recebe o aviso de nova demanda com o link do card (pedido da Jessica, 12/11/2026). */
export const WHATSAPP_NOVA_DEMANDA = '27996581370';

/** Link que abre o card direto no Quadro do portal técnico. */
export const linkCardPortal = (implantacaoId: string) => `${URL_FRONT()}/portal-tecnico?tab=quadro&demanda=${encodeURIComponent(implantacaoId)}`;

export async function registrarAtividade(
  prisma: PrismaClient, implantacaoId: string, tipo: string, descricao: string,
  ator?: { id?: string; nome?: string }, etapaDe?: string | null, etapaPara?: string | null,
) {
  return prisma.implantacaoAtividade.create({
    data: {
      implantacao_id: implantacaoId, tipo, descricao,
      etapa_de: etapaDe || undefined, etapa_para: etapaPara || undefined,
      autor_id: ator?.id, autor_nome: ator?.nome || 'Sistema',
    },
  }).catch(() => null);
}

const descricaoTipo = (imp: { modulo?: string | null; tipo_base?: string | null; sistema_anterior?: string | null }) =>
  imp.modulo === 'SERVICO' ? 'serviço'
    : imp.tipo_base === 'CONVERSAO' ? `conversão${imp.sistema_anterior ? ` de ${imp.sistema_anterior}` : ''}` : 'banco zerado';

/**
 * Designa o técnico: grava no card, semeia testes, trilha e tarefas do cliente (uma vez) e avisa o técnico
 * (portal + WhatsApp, salvo se ele desligou). `whatsappTecnico: false` deixa o aviso só no portal.
 */
export async function designarTecnico(
  prisma: PrismaClient, id: string, tecnico: { id: string; nome: string },
  ator?: { id?: string; nome?: string } | null, opcoes: { whatsappTecnico?: boolean } = {},
) {
  const imp = await prisma.implantacao.update({
    where: { id },
    data: {
      tecnico_id: tecnico.id, tecnico_nome: tecnico.nome, designado_em: new Date(),
      etapa_execucao: 'DESIGNADO',
    },
  });

  // Semeia testes e checklist (uma vez), no perfil da implantação: segmento do cliente + banco zerado/conversão.
  const segmento = imp.modulo === 'IMPLANTACAO' ? await segmentoDaImplantacao(prisma, imp) : null;
  const perfil = perfilDe(segmento, imp.tipo_base);
  const temTeste = await prisma.implantacaoTeste.count({ where: { implantacao_id: id } });
  if (temTeste === 0 && imp.modulo === 'IMPLANTACAO' && !perfil.zerado) {
    await prisma.implantacaoTeste.createMany({ data: TESTES_PADRAO.map(item => ({ implantacao_id: id, item })) }).catch(() => {});
  }
  const temChk = await prisma.implantacaoChecklistItem.count({ where: { implantacao_id: id } });
  if (temChk === 0) {
    // Semeia a trilha (Instalação, Conversão só na conversão, Treinamento) pelo modelo do segmento do cliente
    // (Configurações do portal), sem os itens de farmácia fora da farmácia e com os extras do sistema de origem.
    const itens: any[] = [];
    if (imp.modulo === 'IMPLANTACAO') onboardingItensDoPerfil(perfil).forEach((titulo, i) => itens.push({ implantacao_id: id, grupo: 'ONBOARDING', titulo, ordem: i }));
    const cfg = await obterConfigPortal(prisma);
    const grupos = imp.modulo === 'IMPLANTACAO' ? checklistDoPerfil(cfg.modelos, cfg.extras_sistema, segmento, imp.sistema_anterior, perfil) : CHECKLIST_PADRAO;
    grupos.forEach(g => g.itens.forEach((titulo, i) => itens.push({ implantacao_id: id, grupo: g.grupo, titulo, ordem: i, fase: g.grupo === 'TREINAMENTO' ? faseDoItemTreinamento(titulo) : null })));
    await prisma.implantacaoChecklistItem.createMany({ data: itens }).catch(() => {});
  }
  // Implantação designada antes do onboarding técnico existir: acrescenta os itens dele (uma vez).
  if (imp.modulo === 'IMPLANTACAO' && temChk > 0 && !(await prisma.implantacaoChecklistItem.count({ where: { implantacao_id: id, grupo: 'ONBOARDING' } })) && !ehLegado(imp)) {
    await prisma.implantacaoChecklistItem.createMany({ data: onboardingItensDoPerfil(perfil).map((titulo, i) => ({ implantacao_id: id, grupo: 'ONBOARDING', titulo, ordem: i })) }).catch(() => {});
  }
  // Ficha já preenchida antes da designação: o roteiro nasce com esses itens marcados.
  if (imp.modulo === 'IMPLANTACAO') await sincronizarOnboardingPelaFicha(prisma, id).catch(() => 0);
  await registrarAtividade(prisma, id, 'DESIGNACAO', `Designado ao técnico ${tecnico.nome}`, ator || undefined, null, 'DESIGNADO');
  if (imp.modulo === 'IMPLANTACAO') await garantirFasesTreinamento(prisma, id).catch(() => {});
  // Tarefas padrão do cliente (certificado, XMLs, usuários): o robô avisa o cliente com o link da página.
  if (imp.modulo === 'IMPLANTACAO') await criarTarefasClientePadrao(prisma, imp, ator?.nome || 'Supervisão').catch(() => 0);
  // Nova demanda sempre chega no WhatsApp do técnico (pedido da Jessica, 05/10/2026), salvo se ele desligou nas preferências.
  const aviso = await avisarTecnico(prisma, {
    para_id: tecnico.id, implantacao_id: id, de: { id: ator?.id, nome: ator?.nome }, whatsapp: opcoes.whatsappTecnico !== false, titulo: '🆕 Nova demanda',
    texto: `Nova demanda para você: ${imp.cliente_razao_social} (${descricaoTipo(imp)}). Preencha a ficha de coleta e dê play quando começar.\n\nAbra o card no portal: ${linkCardPortal(id)}`,
  }).catch(() => null);
  return { imp, aviso };
}

/** Técnico padrão ativo (Lucas Diniz), achado pelo nome; null se não houver cadastro ativo com esse nome. */
export async function tecnicoPadrao(prisma: PrismaClient): Promise<{ id: string; nome: string; telefone: string | null } | null> {
  const rows: any[] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, nome, telefone FROM UsuarioCRM WHERE status = 'ATIVO' AND nome LIKE ? ORDER BY created_at ASC LIMIT 1`, `${TECNICO_PADRAO_NOME}%`,
  ).catch(() => []);
  return rows[0] ? { id: rows[0].id, nome: rows[0].nome, telefone: rows[0].telefone || null } : null;
}

/**
 * Contrato assinado virou implantação: o card vai para o Lucas Diniz e o WhatsApp da nova demanda
 * (27 99658-1370) recebe o aviso com o link do card. Chamado uma vez, quando a implantação nasce.
 */
export async function encaminharNovaDemandaDoContrato(prisma: PrismaClient, implantacaoId: string, contrato: {
  numero_contrato?: string | null; razao_social?: string | null; nome_fantasia?: string | null; plano_contratado?: string | null; vendedor_nome?: string | null;
}) {
  const tec = await tecnicoPadrao(prisma);
  const destino = numeroWhatsapp(WHATSAPP_NOVA_DEMANDA);
  // Se o número da nova demanda for o do próprio Lucas, ele recebe uma mensagem só (a da nova demanda).
  const mesmoNumero = !!tec && !!destino && numeroWhatsapp(tec.telefone || '') === destino;
  let imp: any = null;
  if (tec) imp = (await designarTecnico(prisma, implantacaoId, tec, { nome: 'Sistema (contrato assinado)' }, { whatsappTecnico: !mesmoNumero }).catch(e => { console.error('[IMPLANTACAO] designar padrão:', e?.message); return null; }))?.imp || null;
  if (!imp) imp = await prisma.implantacao.findUnique({ where: { id: implantacaoId } }).catch(() => null);
  if (!imp) return { designado: false, whatsapp: false };

  const cliente = (contrato.nome_fantasia || contrato.razao_social || imp.cliente_razao_social || 'Cliente').trim();
  const texto = [
    `🆕 *Nova demanda: contrato assinado*`,
    ``,
    `Cliente: *${cliente}*${contrato.numero_contrato ? ` (contrato ${contrato.numero_contrato})` : ''}`,
    `Tipo: ${descricaoTipo(imp)}${contrato.plano_contratado ? ` · plano ${contrato.plano_contratado}` : ''}`,
    contrato.vendedor_nome ? `Vendedora: ${contrato.vendedor_nome}` : null,
    `Técnico: ${tec ? tec.nome : `não designado (cadastro "${TECNICO_PADRAO_NOME}" não encontrado)`}`,
    ``,
    `Card no portal técnico: ${linkCardPortal(implantacaoId)}`,
  ].filter(l => l !== null).join('\n');
  const enviado = await whats(prisma, WHATSAPP_NOVA_DEMANDA, texto);
  await registrarAtividade(prisma, implantacaoId, 'COMUNICACAO', `📨 Aviso de nova demanda no WhatsApp ${WHATSAPP_NOVA_DEMANDA}${enviado ? '' : ' (falhou)'}.`);
  return { designado: !!tec, whatsapp: enviado };
}
