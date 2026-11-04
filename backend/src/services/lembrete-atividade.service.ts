import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { janelaLembrete, textoLembreteAtividade } from '@/lib/lembrete-atividade';

// Lembrete ao responsável de atividades de MARKETING (ex.: story que precisa ser postado
// pelo app). Vai do número da empresa para o telefone do usuário no CRM, mais o aviso no
// celular (push). Uma vez por atividade (trava no banco). Não cria atividade nenhuma.

/** Número escolhido pela pessoa só para estes lembretes (chave `lembrete_atividade.telefone.<usuarioId>`);
 *  sem ele, o telefone do cadastro do usuário. O número fica só no banco, nunca no Git. */
export async function telefoneDoLembrete(prisma: PrismaClient, usuarioId: string): Promise<string | null> {
  const cfg = await prisma.configuracaoIntegracao.findUnique({ where: { chave: `lembrete_atividade.telefone.${usuarioId}` } }).catch(() => null);
  const u = cfg?.valor ? null : await prisma.usuarioCRM.findUnique({ where: { id: usuarioId }, select: { telefone: true } });
  const fone = (cfg?.valor || u?.telefone || '').replace(/\D/g, '');
  return fone.length >= 10 ? fone : null;
}

export async function lembrarResponsavelAtividades(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const ats = await prisma.atividade.findMany({
    where: {
      vinculo_tipo: 'MARKETING', status: { in: ['PENDENTE', 'CONFIRMADA'] }, responsavel_id: { not: null },
      data_prevista: janelaLembrete(agora),
    },
    select: { id: true, titulo: true, descricao: true, data_prevista: true, responsavel_id: true, link_externo: true },
  });
  if (!ats.length) return 0;
  const inst = await obterInstanciaEmpresa(prisma);
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  const { enviarPush } = await import('./push.service');
  let n = 0;
  for (const a of ats) {
    if (!(await podeEnviarUmaVez(prisma, `lembrete_atividade_resp.${a.id}`, 24 * 30))) continue;
    const fone = await telefoneDoLembrete(prisma, a.responsavel_id!);
    const texto = textoLembreteAtividade({ ...a, data_prevista: a.data_prevista! });
    if (inst?.instance_token && fone) {
      try { await evo.enviarTexto(inst.instance_token, fone, texto); n++; }
      catch (e: any) { console.error(`[LEMBRETE-ATIV] WhatsApp ${a.id}:`, e?.message); }
    }
    const hora = a.data_prevista!.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    await enviarPush(prisma, [a.responsavel_id!], { titulo: `⏰ ${a.titulo} às ${hora}`.slice(0, 80), corpo: 'Abra a atividade para ver o link e a imagem.', url: '/atividades', tag: `ativ-${a.id}` })
      .catch((e: any) => console.error(`[LEMBRETE-ATIV] push ${a.id}:`, e?.message));
  }
  return n;
}
