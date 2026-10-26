// Ajusta ao perfil (segmento do cliente + banco zerado/conversão) o checklist e os testes de conversão
// das implantações em aberto, criadas antes da separação por segmento (pedido da Jessica, 26/10/2026).
// Só sai item padrão ainda não feito que não cabe no perfil; item feito ou criado à mão fica.
// Uso (na VPS, pasta backend): npx tsx scripts/realinhar-perfil-implantacoes.ts            → só mostra
//                              npx tsx scripts/realinhar-perfil-implantacoes.ts --aplicar  → aplica
import { PrismaClient } from '@prisma/client';
import { ehLegado, descreverPerfil, perfilDe, checklistDoPerfil, onboardingItensDoPerfil, realinhamento } from '../src/lib/implantacao/portal';
import { realinharAoPerfil, segmentoDaImplantacao, obterConfigPortal } from '../src/services/implantacao-portal.service';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');

(async () => {
  const lista = await prisma.implantacao.findMany({
    where: { modulo: 'IMPLANTACAO', status: { notIn: ['CANCELADA', 'CONCLUIDA'] }, data_conclusao: null },
    select: { id: true, cliente_razao_social: true, cliente_id: true, cliente_cnpj: true, tipo_base: true, sistema_anterior: true, data_assinatura: true, onboarding_concluido_em: true, virada_fim_em: true },
  });
  const cfg = await obterConfigPortal(prisma);
  for (const imp of lista.filter(i => !ehLegado(i))) {
    const segmento = await segmentoDaImplantacao(prisma, imp);
    const p = perfilDe(segmento, imp.tipo_base);
    if (!aplicar) {
      const atuais = await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: imp.id }, select: { id: true, grupo: true, titulo: true, feito: true } });
      if (!atuais.length) { console.log(`- ${imp.cliente_razao_social} (${descreverPerfil(p)}): sem checklist ainda, nasce certo na designação`); continue; }
      const esperados = checklistDoPerfil(cfg.modelos, cfg.extras_sistema, segmento, imp.sistema_anterior, p);
      if (!imp.onboarding_concluido_em && atuais.some(a => a.grupo === 'ONBOARDING')) esperados.unshift({ grupo: 'ONBOARDING', itens: onboardingItensDoPerfil(p) });
      const r = realinhamento(atuais, esperados);
      const testes = p.zerado ? await prisma.implantacaoTeste.count({ where: { implantacao_id: imp.id, resultado: 'PENDENTE' } }) : 0;
      console.log(`- ${imp.cliente_razao_social} (segmento "${segmento || '—'}" → ${descreverPerfil(p)}): sai ${r.remover.length}, entra ${r.incluir.length}, testes de conversão a tirar ${testes}`);
      for (const id of r.remover) console.log(`    − ${atuais.find(a => a.id === id)!.grupo}: ${atuais.find(a => a.id === id)!.titulo}`);
      for (const x of r.incluir) console.log(`    + ${x.grupo}: ${x.titulo}`);
      continue;
    }
    const r = await realinharAoPerfil(prisma, imp.id, 'Ajuste por segmento');
    if (r && (r.removidos || r.incluidos || r.testes)) {
      await prisma.implantacaoAtividade.create({ data: { implantacao_id: imp.id, tipo: 'NOTA', descricao: `🧭 Checklist ajustado para ${descreverPerfil(r.perfil)} (${r.removidos} item(ns) tirado(s), ${r.incluidos} incluído(s))`, autor_nome: 'Sistema' } as any }).catch(() => {});
    }
    console.log(`- ${imp.cliente_razao_social}: ${r ? `${descreverPerfil(r.perfil)} · tirados ${r.removidos}, incluídos ${r.incluidos}, testes ${r.testes}` : 'nada a fazer'}`);
  }
  await prisma.$disconnect();
})();
