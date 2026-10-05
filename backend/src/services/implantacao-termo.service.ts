// Relatório final e termo de aceite da implantação (portal completo, 05/10/2026).
// O termo é gerado na validação da supervisão e vai para o decisor assinar no ZapSign;
// a assinatura volta pelo mesmo webhook dos contratos (/webhook/zapsign).
import type { PrismaClient } from '@prisma/client';
import { gerarPdfImplantacao, type DadosRelatorioImplantacao } from '@/lib/implantacao-pdf';
import { TIPOS_SERVICO, gruposDoProgresso, statusAssistida } from '@/lib/implantacao/portal';
import { CONTATO_GERAL } from '@/lib/triagem/fluxo';

const NOME_GRUPO: Record<string, string> = { INSTALACAO: 'Instalação e configuração', CONVERSAO: 'Conversão dos dados', TREINAMENTO: 'Treinamento', SERVICO: 'Execução do serviço' };

export async function montarDadosRelatorio(prisma: PrismaClient, implantacaoId: string): Promise<DadosRelatorioImplantacao | null> {
  const i: any = await prisma.implantacao.findUnique({ where: { id: implantacaoId } });
  if (!i) return null;
  const [itens, testes, fases, ocorrencias, assistida, sessoes, inventario] = await Promise.all([
    prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: i.id } }),
    prisma.implantacaoTeste.findMany({ where: { implantacao_id: i.id }, orderBy: { created_at: 'asc' } }),
    prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: i.id }, orderBy: { ordem: 'asc' } }),
    prisma.implantacaoOcorrencia.findMany({ where: { implantacao_id: i.id }, orderBy: { aberta_em: 'asc' }, select: { titulo: true, situacao: true } }),
    prisma.implantacaoAssistida.findMany({ where: { implantacao_id: i.id }, select: { dia: true } }),
    prisma.implantacaoSessao.findMany({ where: { implantacao_id: i.id }, select: { inicio: true, fim: true } }),
    prisma.inventarioTecnico.findFirst({ where: i.cliente_id ? { cliente_id: i.cliente_id } : { cliente_cnpj: i.cliente_cnpj || '__nenhum__' }, orderBy: { updated_at: 'desc' } }),
  ]);
  const grupos = [...gruposDoProgresso(i.modulo, i.tipo_base).filter(g => g !== 'ONBOARDING'), ...(i.modulo === 'SERVICO' ? [] : ['TREINAMENTO'])];
  const c = i.coleta || {};
  const horas = Math.round(sessoes.reduce((t, s) => t + ((s.fim || new Date()).getTime() - s.inicio.getTime()), 0) / 36e5);
  const st = statusAssistida(i, assistida);
  return {
    cliente: i.cliente_razao_social, cnpj: i.cliente_cnpj, modulo: i.modulo, plano: i.plano, tecnico: i.tecnico_nome,
    tipo: i.modulo === 'SERVICO' ? `Serviço · ${(i.tipo_servico && TIPOS_SERVICO[i.tipo_servico]?.label) || 'outro'}` : i.tipo_base === 'BANCO_ZERADO' ? 'Implantação · banco zerado' : `Implantação · conversão${i.sistema_anterior ? ` de ${i.sistema_anterior}` : ''}`,
    assinatura: i.data_assinatura, virada: i.virada_fim_em, validacao: i.validado_em,
    decisor: c.decisor_nome || null, contato: [c.contato_nome, c.contato_telefone].filter(Boolean).join(' · ') || null,
    etapas: grupos.map(g => { const xs = itens.filter(x => x.grupo === g); return { nome: NOME_GRUPO[g] || g, feitos: xs.filter(x => x.feito).length, total: xs.length }; }).filter(e => e.total),
    testes: testes.filter(t => t.resultado !== 'NAO_APLICA'),
    treinamento: fases.filter(f => f.realizada_em).map(f => ({ ordem: f.ordem, nome: f.nome, realizada_em: f.realizada_em, participantes: (f.participantes as any) || null, confirmado_por: f.confirmado_por })),
    assistida: st ? { feitos: st.feitos, total: st.total } : null,
    correcoes: ocorrencias, horas: horas || null,
    equipamentos: ((inventario?.itens as any[]) || []).map(x => ({ tipo: x.tipo, descricao: x.descricao })),
    suporte: { telefone: CONTATO_GERAL },
  };
}

export async function pdfRelatorio(prisma: PrismaClient, implantacaoId: string, termo = false): Promise<Buffer | null> {
  const d = await montarDadosRelatorio(prisma, implantacaoId);
  return d ? gerarPdfImplantacao(d, termo) : null;
}

/** Quem assina o termo: o decisor (supervisão informa) ou, sem ele, o contato da ficha de coleta. */
export function signatarioDoTermo(i: any): { nome: string; telefone: string; email: string } | null {
  const c = i.coleta || {};
  const nome = (c.decisor_nome || c.contato_nome || '').trim();
  const telefone = String(c.decisor_telefone || c.contato_telefone || i.contato_whatsapp || '').replace(/\D/g, '');
  const email = (i.contato_email || '').trim();
  if (!nome || (!telefone && !email)) return null;
  return { nome, telefone: telefone.replace(/^55/, ''), email };
}

/** Gera o termo e manda para assinatura no ZapSign. Devolve o motivo quando não dá para enviar. */
export async function enviarTermoAceite(prisma: PrismaClient, implantacaoId: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const i: any = await prisma.implantacao.findUnique({ where: { id: implantacaoId } });
  if (!i) return { ok: false, motivo: 'Demanda não encontrada' };
  if (i.aceite_status === 'ASSINADO') return { ok: false, motivo: 'O termo já foi assinado.' };
  const quem = signatarioDoTermo(i);
  if (!quem) return { ok: false, motivo: 'Informe o decisor (nome e telefone) ou o contato da ficha de coleta para enviar o termo.' };
  const { getZapSignConfig, ZAPSIGN_BASE } = await import('@/routes/contratos-comerciais');
  const zap = await getZapSignConfig(prisma);
  if (!zap.token) return { ok: false, motivo: 'ZapSign não configurado (Configurações > Integrações > ZapSign).' };
  const pdf = await pdfRelatorio(prisma, i.id, true);
  if (!pdf) return { ok: false, motivo: 'Não foi possível gerar o termo.' };
  const signer: any = { name: quem.nome, auth_mode: 'assinaturaTela', send_automatic_email: !!quem.email, send_automatic_whatsapp: !!quem.telefone };
  if (quem.email) signer.email = quem.email;
  if (quem.telefone) { signer.phone_country = '55'; signer.phone_number = quem.telefone; }
  try {
    const r = await fetch(`${ZAPSIGN_BASE[zap.env]}/docs/`, {
      method: 'POST', headers: { Authorization: `Bearer ${zap.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Termo de aceite – ${i.cliente_razao_social}`, base64_pdf: pdf.toString('base64'), signers: [signer], external_id: `implantacao:${i.id}`, lang: 'pt-br' }),
    });
    const j: any = await r.json();
    if (!r.ok) return { ok: false, motivo: `ZapSign recusou: ${JSON.stringify(j).slice(0, 200)}` };
    await prisma.implantacao.update({ where: { id: i.id }, data: { aceite_status: 'ENVIADO', aceite_doc_token: String(j.token || j.open_id || ''), aceite_sign_url: j.signers?.[0]?.sign_url || null, aceite_enviado_em: new Date() } });
    await prisma.implantacaoAtividade.create({ data: { implantacao_id: i.id, tipo: 'NOTA', descricao: `✍️ Termo de aceite enviado para ${quem.nome} assinar (ZapSign${quem.telefone ? ', WhatsApp' : ''}${quem.email ? ', e-mail' : ''})`, autor_nome: 'Sistema' } }).catch(() => null);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, motivo: `Erro ao falar com o ZapSign: ${e?.message || 'falha'}` };
  }
}

/** Webhook do ZapSign: se o documento é um termo de aceite, registra assinatura ou recusa. Devolve true se tratou. */
export async function tratarWebhookTermo(prisma: PrismaClient, docToken: string, signedUrl?: string | null): Promise<boolean> {
  const i = await prisma.implantacao.findFirst({ where: { aceite_doc_token: docToken } });
  if (!i) return false;
  let doc: any = null;
  try { const { obterDoc } = await import('@/services/zapsign.service'); doc = await obterDoc(docToken); } catch { return true; } // sem conferência: não age
  const status = String(doc?.status || '');
  if (status === 'signed' && i.aceite_status !== 'ASSINADO') {
    await prisma.implantacao.update({ where: { id: i.id }, data: { aceite_status: 'ASSINADO', aceite_assinado_em: new Date(), aceite_pdf_url: doc?.signed_file || signedUrl || null } });
    await prisma.implantacaoAtividade.create({ data: { implantacao_id: i.id, tipo: 'NOTA', descricao: '✅ Termo de aceite assinado pelo cliente', autor_nome: 'ZapSign' } }).catch(() => null);
    const { avisarEquipe } = await import('./implantacao-portal.service');
    await avisarEquipe(prisma, `✅ ${i.cliente_razao_social} assinou o termo de aceite. A demanda pode ser finalizada.`, i.id).catch(() => {});
  } else if (status === 'refused' && i.aceite_status !== 'RECUSADO') {
    await prisma.implantacao.update({ where: { id: i.id }, data: { aceite_status: 'RECUSADO' } });
    await prisma.implantacaoAtividade.create({ data: { implantacao_id: i.id, tipo: 'NOTA', descricao: '⚠️ O cliente recusou o termo de aceite no ZapSign', autor_nome: 'ZapSign' } }).catch(() => null);
    const { avisarEquipe } = await import('./implantacao-portal.service');
    await avisarEquipe(prisma, `⚠️ ${i.cliente_razao_social} recusou o termo de aceite. Vale ligar para entender o que faltou.`, i.id).catch(() => {});
  }
  return true;
}
