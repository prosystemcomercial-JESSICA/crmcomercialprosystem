// Cria VendaAdicional para OportunidadeAtivos CONFIRMADAS que ficaram sem venda vinculada.
// Uso: node scripts/migrar-vendas-confirmadas.cjs [--apply]
//   sem --apply  → dry-run (só mostra o que faria)
//   --apply      → grava no banco
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
  console.log(apply ? '🔧 MODO: APLICAR' : '👁  MODO: DRY-RUN (use --apply para gravar)');

  const oprtsSemVenda = await prisma.oportunidadeAtivo.findMany({
    where: { status: 'CONFIRMADA', venda_adicional_id: null },
  }).catch(e => { console.error('Erro ao buscar oportunidades:', e.message); return []; });

  console.log(`\nEncontradas: ${oprtsSemVenda.length} oportunidade(s) confirmada(s) sem VendaAdicional\n`);
  if (oprtsSemVenda.length === 0) { console.log('✅ Nada a fazer.'); return; }

  let criadas = 0;
  for (const oport of oprtsSemVenda) {
    const cli = await prisma.cliente.findUnique({ where: { id: oport.cliente_id }, select: { razao_social: true, nome_fantasia: true } }).catch(() => null);
    const nomeCliente = cli?.razao_social || cli?.nome_fantasia || oport.cliente_id;
    const tipo = oport.parceiro_id ? 'INDICACAO' : 'EXPANSAO';
    console.log(`  → [${tipo}] ${nomeCliente} | categoria: ${oport.categoria || '-'} | acréscimo: R$${oport.acrescimo_mensal || 0}/mês | setup: R$${oport.valor_venda || 0}`);

    if (!apply) continue;

    try {
      const venda = await prisma.vendaAdicional.create({
        data: {
          cliente_id: oport.cliente_id,
          parceiro_id: oport.parceiro_id || null,
          vendedor_id: oport.vendedor_id,
          tipo_negocio: tipo,
          valor_venda: oport.valor_venda || undefined,
          acrescimo_mensal: oport.acrescimo_mensal || undefined,
          status: 'PENDENTE',
          observacoes: oport.observacao || undefined,
          origem_oportunidade_id: oport.id,
          created_by: oport.confirmado_por || oport.vendedor_id || oport.criado_por || 'migracao',
        },
      });
      await prisma.oportunidadeAtivo.update({
        where: { id: oport.id },
        data: { venda_adicional_id: venda.id },
      });
      console.log(`     ✅ VendaAdicional criada: ${venda.id}`);
      criadas++;
    } catch (e) {
      console.error(`     ❌ Erro em ${oport.id}:`, e.message);
    }
  }

  console.log(`\n${apply ? `✅ ${criadas}/${oprtsSemVenda.length} vendas criadas.` : `ℹ️  Dry-run: rode com --apply para criar ${oprtsSemVenda.length} venda(s).`}`);
}

main().finally(() => prisma.$disconnect());
