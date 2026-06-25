// Cria comissões pendentes para VendaAdicional que foram migradas sem comissão.
// Uso: node scripts/criar-comissoes-vendas-migradas.cjs [--apply]
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

function proximoMes() {
  const agora = new Date();
  const prox = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  console.log(apply ? '🔧 MODO: APLICAR' : '👁  MODO: DRY-RUN (use --apply para gravar)\n');

  // Busca vendas que vieram do módulo Ativos (origem_oportunidade_id preenchido)
  // e que não têm comissão vinculada
  const vendas = await prisma.vendaAdicional.findMany({
    where: { origem_oportunidade_id: { not: null } },
    include: {
      parceiro: true,
      cliente: { select: { razao_social: true, nome_fantasia: true, nome: true } },
    },
  });

  console.log(`Vendas do módulo Ativos encontradas: ${vendas.length}\n`);

  let criadas = 0;
  for (const v of vendas) {
    // Verifica se já tem comissão
    const jaTemComissao = await prisma.comissao.findFirst({
      where: { referencia_id: v.id, tipo: 'VENDA_ADICIONAL' },
    });

    const nomeCliente = v.cliente?.razao_social || v.cliente?.nome_fantasia || v.cliente?.nome || v.cliente_id;
    const nomeParceiro = v.parceiro?.nome || v.tipo_negocio || 'Expansão Interna';
    const comissaoValor = v.comissao_valor ?? 50;
    const periodo = proximoMes();

    if (jaTemComissao) {
      console.log(`  ⏭  ${nomeCliente} — ${nomeParceiro}: já tem comissão (${jaTemComissao.status})`);
      continue;
    }

    console.log(`  → ${nomeCliente} — ${nomeParceiro}`);
    console.log(`     Vendedor: ${v.vendedor_id} | Comissão: R$${comissaoValor} | Período: ${periodo} | Status venda: ${v.status}`);

    if (!apply) continue;

    try {
      // Comissão do vendedor
      const comissaoVendedor = await prisma.comissao.create({
        data: {
          responsavel_id: v.vendedor_id,
          tipo: 'VENDA_ADICIONAL',
          referencia_id: v.id,
          descricao: `Venda Adicional: ${nomeParceiro} — ${nomeCliente}`,
          valor_base: comissaoValor,
          percentual: 100,
          valor_comissao: comissaoValor,
          papel: 'VENDEDOR',
          periodo,
          // Se a venda já está CONFIRMADA → comissão já pode ser APROVADA
          status: v.status === 'CONFIRMADA' ? 'APROVADA' : 'PENDENTE',
          created_by: v.created_by || v.vendedor_id,
        },
      });
      console.log(`     ✅ Comissão vendedor criada: ${comissaoVendedor.id} (${comissaoVendedor.status})`);
      criadas++;
    } catch (e) {
      console.error(`     ❌ Erro ao criar comissão:`, e.message);
    }
  }

  if (!apply) {
    console.log(`\nℹ️  Dry-run — rode com --apply para criar as comissões.`);
  } else {
    console.log(`\n✅ ${criadas} comissão(ões) criada(s).`);
  }
}

main().finally(() => prisma.$disconnect());
