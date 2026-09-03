import { PrismaClient } from '@prisma/client';
import * as evo from '@/services/evolution.service';
import { segmentoDe } from '@/lib/segmento';

// Cadência automática de WhatsApp para leads de farmácia/drogaria/manipulação
// parados em AGUARDANDO_RETORNO. Baseada no material de nutrição comercial da
// página de captação — só a parte de WhatsApp (e-mail/ligação ficam manuais).
// Etapas: 1 = imediata (entrada em AGUARDANDO_RETORNO), 2 = dia 2, 3 = dia 6,
// 4 = mensagem final de encerramento. Se o lead responder, a conversa some do
// filtro (webhook zera cadencia_proxima_etapa) e a cadência para sozinha.

const DIAS_ETAPA: Record<number, number> = { 1: 0, 2: 2, 3: 6, 4: 12 };

function template(etapa: number, vars: { primeiro_nome: string; farmacia: string; vendedor: string }): string {
  const { primeiro_nome, farmacia, vendedor } = vars;
  switch (etapa) {
    case 1:
      return (
        `Olá, ${primeiro_nome}! Tudo bem?\n\n` +
        `Sou ${vendedor}, da ProSystem Sistemas.\n\n` +
        `Vi que você solicitou uma demonstração do nosso sistema para a ${farmacia} e estou entrando em contato para entender melhor sua operação.\n\n` +
        `Hoje, o que você mais gostaria de melhorar?\n\n` +
        `1. Agilidade no caixa\n2. Controle de estoque\n3. Comissões dos vendedores\n4. Fiscal, SNGPC ou Farmácia Popular\n5. Gestão de várias lojas\n\n` +
        `Pode me responder apenas com o número.`
      );
    case 2:
      return (
        `Oi, ${primeiro_nome}! Passando para confirmar se conseguiu ver minha mensagem sobre a demonstração do ProSystem.\n\n` +
        `Quero apresentar somente os recursos que façam sentido para a ${farmacia}.\n\n` +
        `Hoje vocês já utilizam algum sistema ou estão procurando o primeiro?`
      );
    case 3:
      return (
        `Olá, ${primeiro_nome}!\n\n` +
        `Separei dois horários para mostrarmos o ProSystem funcionando. A demonstração é gratuita e podemos focar em caixa, estoque, comissões, fiscal ou gestão das lojas.\n\n` +
        `Qual dia e horário funcionam melhor para você? Me diga que eu já confirmo.`
      );
    case 4:
      return (
        `Olá, ${primeiro_nome}!\n\n` +
        `Como não conseguimos conversar, vou encerrar minhas tentativas de contato para não ser inconveniente.\n\n` +
        `Antes disso, você poderia me informar uma opção?\n\n` +
        `1. Quero agendar a demonstração\n2. Pode falar comigo mais adiante\n3. Não tenho interesse no momento\n\n` +
        `Pode responder apenas com o número. Assim, atualizo corretamente seu atendimento.`
      );
    default:
      return '';
  }
}

/** Coloca a conversa na cadência (chamado quando ela entra em AGUARDANDO_RETORNO). */
export async function entrarNaCadencia(prisma: PrismaClient, conversaId: string) {
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId } });
  if (!conversa) return;

  // Sem relação Prisma entre WhatsappConversa e Lead/Cliente — busca manual pelo id solto.
  const [lead, cliente] = await Promise.all([
    conversa.lead_id ? prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { segmento: true } }).catch(() => null) : null,
    conversa.cliente_id ? prisma.cliente.findUnique({ where: { id: conversa.cliente_id }, select: { segmento: true } }).catch(() => null) : null,
  ]);
  const segmentoTexto = lead?.segmento || cliente?.segmento || '';
  const grupo = segmentoDe(segmentoTexto);
  if (grupo !== 'FARMACIA' && grupo !== 'MANIPULACAO') return; // fora do nicho da cadência

  await prisma.whatsappConversa.update({
    where: { id: conversaId },
    data: { cadencia_proxima_etapa: 1, cadencia_proximo_envio: new Date(), cadencia_pausada: false },
  });
}

/** Tira a conversa da cadência (resposta do lead, ou saiu de AGUARDANDO_RETORNO). */
export async function pausarCadencia(prisma: PrismaClient, conversaId: string) {
  await prisma.whatsappConversa.update({
    where: { id: conversaId },
    data: { cadencia_proxima_etapa: null, cadencia_proximo_envio: null, cadencia_pausada: false },
  }).catch(() => {});
}

/** Dispara a próxima etapa pendente de uma conversa (chamado pelo scheduler). */
export async function dispararProximaEtapaCadencia(prisma: PrismaClient, conversaId: string) {
  const conversa = await prisma.whatsappConversa.findUnique({
    where: { id: conversaId },
    include: { instancia: true },
  }).catch(() => null) as any;
  if (!conversa || conversa.cadencia_pausada || !conversa.cadencia_proxima_etapa) return null;
  // Só continua se ainda está esperando retorno — se o vendedor moveu a
  // conversa (ex.: já negociando de novo), a cadência não faz mais sentido.
  if (conversa.estagio_funil !== 'AGUARDANDO_RETORNO') {
    await pausarCadencia(prisma, conversaId);
    return null;
  }

  const [lead, cliente] = await Promise.all([
    conversa.lead_id ? prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { nome: true, razao_social: true, nome_fantasia: true } }).catch(() => null) : null,
    conversa.cliente_id ? prisma.cliente.findUnique({ where: { id: conversa.cliente_id }, select: { razao_social: true, nome_fantasia: true } }).catch(() => null) : null,
  ]);

  const etapa = conversa.cadencia_proxima_etapa;
  const primeiro_nome = (conversa.contato_nome || lead?.nome || 'tudo bem?').split(' ')[0];
  const farmacia = cliente?.razao_social || cliente?.nome_fantasia
    || lead?.razao_social || lead?.nome_fantasia || lead?.nome || 'sua farmácia';

  let vendedorNome = conversa.instancia?.dono_nome || 'Equipe ProSystem';
  if (!conversa.instancia?.dono_nome && conversa.dono_id) {
    try {
      const { resolverNomesUsuarios } = await import('@/lib/usuarios');
      const nomes = await resolverNomesUsuarios(prisma, [conversa.dono_id]);
      vendedorNome = nomes[conversa.dono_id] || vendedorNome;
    } catch { /* ignora */ }
  }

  const texto = template(etapa, { primeiro_nome, farmacia, vendedor: vendedorNome });
  if (!texto) return null;

  let externo_id: string | undefined;
  try {
    const r = await evo.enviarTexto(conversa.instancia.instancia_nome, conversa.contato_numero, texto);
    externo_id = r.externo_id;
  } catch (e: any) {
    // Falha de envio: tenta de novo em 1h, sem avançar a etapa.
    await prisma.whatsappConversa.update({
      where: { id: conversaId },
      data: { cadencia_proximo_envio: new Date(Date.now() + 60 * 60 * 1000) },
    }).catch(() => {});
    return { status: 'ERRO', erro: e?.message };
  }

  await prisma.whatsappMensagem.create({
    data: { conversaId, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: texto, status: 'ENVIADA', enviada_por: 'cadencia_automatica' },
  });

  const proximaEtapa = etapa + 1;
  const proximoDia = DIAS_ETAPA[proximaEtapa];
  await prisma.whatsappConversa.update({
    where: { id: conversaId },
    data: {
      ultima_mensagem: texto.slice(0, 200),
      ultima_em: new Date(),
      cadencia_proxima_etapa: proximoDia != null ? proximaEtapa : null,
      cadencia_proximo_envio: proximoDia != null ? new Date(Date.now() + (proximoDia - (DIAS_ETAPA[etapa] || 0)) * 86400000) : null,
    },
  });

  return { status: 'ENVIADO', etapa };
}

/** Roda periodicamente: dispara a cadência de toda conversa vencida. */
export async function rodarSchedulerCadenciaWhatsapp(prisma: PrismaClient) {
  const pendentes = await prisma.whatsappConversa.findMany({
    where: { cadencia_pausada: false, cadencia_proxima_etapa: { not: null }, cadencia_proximo_envio: { lte: new Date() } },
    select: { id: true },
  });
  let enviados = 0, erros = 0;
  for (const c of pendentes) {
    const r = await dispararProximaEtapaCadencia(prisma, c.id);
    if (r?.status === 'ENVIADO') enviados++;
    else if (r?.status === 'ERRO') erros++;
  }
  return { processados: pendentes.length, enviados, erros };
}
