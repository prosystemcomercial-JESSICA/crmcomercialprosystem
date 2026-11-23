import type { PrismaClient } from '@prisma/client';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';
import { montarAgendaCs, agendaEmMarkdown, type DadosAgenda } from '@/lib/assistente/mila-agenda';

/**
 * MILA · Agenda do CS (23/11/2026). Toda segunda de manhã a Mila lê o CRM, aplica os gatilhos do manual
 * (docs/comercial/playbook-mila-cs.md, seção 1) e deixa no painel dela a lista da semana: quem, quando, o que fazer
 * e a mensagem sugerida. Só leitura: não manda mensagem, não cria atividade e não muda cadastro.
 */
export async function lerDadosAgenda(prisma: PrismaClient, agora = new Date()): Promise<DadosAgenda> {
  const meioAno = new Date(+agora - 200 * 864e5);
  const tresMeses = new Date(+agora - 90 * 864e5);
  const [implantacoes, emAtencao, casos, inativos, ativos] = await Promise.all([
    prisma.implantacao.findMany({
      where: { OR: [{ data_conclusao: null, created_at: { gte: meioAno } }, { data_conclusao: { gte: new Date(+agora - 100 * 864e5) } }] },
      select: { id: true, cliente_razao_social: true, cliente_cnpj: true, status: true, modulo: true, tipo_base: true, tecnico_nome: true, etapa_execucao: true, data_conclusao: true, created_at: true, updated_at: true },
    }),
    prisma.cliente.findMany({ where: { situacao: 'ATIVA', risco_atencao: true }, select: { id: true, nome: true, nome_fantasia: true, cnpj: true, segmento: true } }),
    prisma.casoChurn.findMany({ where: { status: { in: ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'] } }, select: { status: true, motivo_principal: true, updated_at: true, cliente: { select: { nome: true, nome_fantasia: true } } } }),
    prisma.cliente.findMany({ where: { situacao: 'INATIVA', inativado_em: { gte: tresMeses } }, select: { nome: true, nome_fantasia: true, cnpj: true, motivo_inativacao: true, inativado_em: true } }),
    prisma.cliente.findMany({ where: { situacao: 'ATIVA', cnpj: { not: null } }, select: { id: true, nome: true, nome_fantasia: true, cnpj: true, segmento: true } }),
  ]);
  const nome = (c: { nome: string; nome_fantasia?: string | null }) => c.nome_fantasia || c.nome;
  return {
    implantacoes,
    emAtencao: emAtencao.map(c => ({ ...c, nome: nome(c) })),
    casos: casos.map(c => ({ cliente: nome(c.cliente), status: c.status, motivo: c.motivo_principal, updated_at: c.updated_at })),
    inativos: inativos.map(c => ({ nome: nome(c), cnpj: c.cnpj, motivo: c.motivo_inativacao, inativado_em: c.inativado_em })),
    ativos: ativos.map(c => ({ ...c, nome: nome(c) })),
  };
}

export async function montarAgendaDaSemana(prisma: PrismaClient, agora = new Date()) {
  const secoes = montarAgendaCs(await lerDadosAgenda(prisma, agora), agora);
  const { md, total } = agendaEmMarkdown(secoes, agora);
  // A agenda da semana anterior ainda não vista sai da fila: só a mais nova vale.
  await prisma.especialistaDoc.updateMany({ where: { origem: 'mila', tipo: 'ALERTA', status: 'PROPOSTO', titulo: { startsWith: 'Agenda do CS' } }, data: { status: 'ARQUIVADO' } });
  const doc = await prisma.especialistaDoc.create({ data: { tipo: 'ALERTA', titulo: md.split('\n')[0].replace(/^# /, ''), conteudo: md, origem: 'mila', status: 'PROPOSTO', fontes: { agenda: secoes.map(s => ({ id: s.id, n: s.itens.length })) } as any } });
  registrarAcaoAgente('mila', total ? `montou a Agenda do CS: ${total} conta(s) pedem ação nesta semana` : 'montou a Agenda do CS: nenhum gatilho nesta semana');
  if (total) {
    const { enviarAvisoGestao } = await import('./assistente-gestao.service');
    const resumo = secoes.filter(s => s.itens.length).map(s => `• ${s.titulo}: ${s.itens.length}`).join('\n');
    await enviarAvisoGestao(prisma, 'lead_qualificado', `💚 *Agenda do CS da semana (Mila)*\n${resumo}\n\nQuem, quando, o que fazer e a mensagem sugerida: Escritório › Painel da Mila. Nada foi enviado ao cliente.`, { somenteAprovadora: true }).catch(() => {});
  }
  return { doc, total };
}
