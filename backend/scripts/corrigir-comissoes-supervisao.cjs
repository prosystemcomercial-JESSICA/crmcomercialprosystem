// Corrige comissões de SUPERVISAO_VENDA_ADICIONAL que estão com responsavel_id errado.
// Move todas para o usuário com role SUPERVISAO/SUPERVISAO_COMERCIAL (Jessica).
// Uso: node scripts/corrigir-comissoes-supervisao.cjs [--apply]
const fs = require('fs'); const path = require('path');
try {
  const envPath = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { console.warn('Aviso: .env não encontrado:', e.message); }

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  console.log(apply ? '🔧 MODO: APLICAR' : '👁  MODO: DRY-RUN (use --apply para gravar)\n');

  // Busca a supervisora
  const supervisora = await prisma.usuarioCRM.findFirst({
    where: { role: { in: ['SUPERVISAO', 'SUPERVISAO_COMERCIAL'] }, ativo: true },
    orderBy: { nome: 'asc' },
  }).catch(() => null);

  if (!supervisora) { console.error('❌ Nenhuma supervisora encontrada com role SUPERVISAO.'); return; }
  console.log(`Supervisora encontrada: ${supervisora.nome} (${supervisora.id})\n`);

  // Busca todas comissões de supervisão que NÃO estão no nome da supervisora
  const comissoesErradas = await prisma.comissao.findMany({
    where: {
      tipo: 'SUPERVISAO_VENDA_ADICIONAL',
      NOT: { responsavel_id: supervisora.id },
    },
  });

  console.log(`Comissões de supervisão com responsável errado: ${comissoesErradas.length}\n`);

  for (const c of comissoesErradas) {
    console.log(`  → ID: ${c.id} | Responsável atual: ${c.responsavel_id} | ${c.descricao} | R$${c.valor_comissao} | ${c.status}`);
    if (!apply) continue;
    await prisma.comissao.update({
      where: { id: c.id },
      data: { responsavel_id: supervisora.id },
    });
    console.log(`     ✅ Corrigido para ${supervisora.nome}`);
  }

  // Também corrige o supervisao_id nas VendaAdicional
  const vendasErradas = await prisma.vendaAdicional.findMany({
    where: { supervisao_id: { not: supervisora.id, notIn: [null] } },
    select: { id: true, supervisao_id: true },
  }).catch(() => []);

  console.log(`\nVendas com supervisao_id errado: ${vendasErradas.length}`);
  for (const v of vendasErradas) {
    console.log(`  → VendaAdicional ${v.id} | supervisao_id atual: ${v.supervisao_id}`);
    if (!apply) continue;
    await prisma.vendaAdicional.update({
      where: { id: v.id },
      data: { supervisao_id: supervisora.id },
    }).catch(e => console.error(`     ❌ Erro:`, e.message));
    console.log(`     ✅ Corrigido`);
  }

  if (!apply) {
    console.log(`\nℹ️  Dry-run — rode com --apply para aplicar as correções.`);
  } else {
    console.log(`\n✅ Correções aplicadas.`);
  }
}

main().finally(() => prisma.$disconnect());
