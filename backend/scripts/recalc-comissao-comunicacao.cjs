// Recalcula comissões das comunicações já lançadas: vendedor 15% + supervisão 5%
// sobre o SETUP (valor_venda). NÃO mexe em comissões já PAGAS. Idempotente.
// Uso: node scripts/recalc-comissao-comunicacao.js [--apply]
//   sem --apply  → dry-run (só mostra o que mudaria)
//   --apply      → grava as alterações no banco
// Carrega o .env manualmente (sem depender de dotenv).
const fs = require('fs'); const path = require('path');
try {
  const envPath = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { console.warn('Aviso: não consegui ler .env:', e.message); }
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

function mesSeguinteDe(d) {
  const base = d ? new Date(d) : new Date();
  const dt = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

(async () => {
  const vendas = await prisma.vendaAdicional.findMany({
    where: { parceiro: { categoria: 'COMUNICACAO' }, status: { not: 'CANCELADO' } },
    include: { parceiro: true, cliente: { select: { nome: true } } },
  });

  console.log(`\n=== ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada gravado)'} — ${vendas.length} comunicações encontradas ===\n`);

  let afetadas = 0, vendUpd = 0, supCriadas = 0, supUpd = 0, pagas = 0, semSetup = 0;

  for (const v of vendas) {
    const setup = Number(v.valor_venda || 0);
    const cliente = v.cliente?.nome || '(sem nome)';
    if (setup <= 0) { semSetup++; console.log(`• ${cliente}: SEM setup — ignorado`); continue; }

    const cVendNovo = +(setup * 0.15).toFixed(2);
    const cSupNovo = +(setup * 0.05).toFixed(2);
    let tocou = false;
    const linhas = [];

    // Vendedor
    const cVend = await prisma.comissao.findFirst({
      where: { referencia_id: v.id, tipo: 'VENDA_ADICIONAL', responsavel_id: v.vendedor_id || undefined },
    });
    if (cVend) {
      if (cVend.status === 'PAGA') { pagas++; linhas.push(`  vendedor: JÁ PAGA (${brl(cVend.valor_comissao)}) — preservada`); }
      else {
        linhas.push(`  vendedor: ${brl(cVend.valor_comissao)} → ${brl(cVendNovo)} (15%)`);
        if (APPLY) await prisma.comissao.update({ where: { id: cVend.id }, data: { valor_base: setup, percentual: 15, valor_comissao: cVendNovo, papel: 'VENDEDOR' } });
        vendUpd++; tocou = true;
      }
    } else linhas.push(`  vendedor: (sem comissão registrada)`);

    // Supervisão
    if (v.supervisao_id) {
      const cSup = await prisma.comissao.findFirst({ where: { referencia_id: v.id, tipo: 'SUPERVISAO_VENDA_ADICIONAL' } });
      if (cSup) {
        if (cSup.status === 'PAGA') { pagas++; linhas.push(`  supervisão: JÁ PAGA (${brl(cSup.valor_comissao)}) — preservada`); }
        else {
          linhas.push(`  supervisão: ${brl(cSup.valor_comissao)} → ${brl(cSupNovo)} (5%)`);
          if (APPLY) await prisma.comissao.update({ where: { id: cSup.id }, data: { valor_base: setup, percentual: 5, valor_comissao: cSupNovo, papel: 'SUPERVISAO' } });
          supUpd++; tocou = true;
        }
      } else if (cSupNovo > 0) {
        linhas.push(`  supervisão: CRIAR ${brl(cSupNovo)} (5%)`);
        if (APPLY) await prisma.comissao.create({ data: {
          responsavel_id: v.supervisao_id, tipo: 'SUPERVISAO_VENDA_ADICIONAL', referencia_id: v.id,
          descricao: `Supervisão — ${v.parceiro.nome}: ${cliente}`, valor_base: setup, percentual: 5,
          valor_comissao: cSupNovo, papel: 'SUPERVISAO', periodo: mesSeguinteDe(v.primeiro_vencimento),
          status: 'APROVADA', created_by: 'script-recalc',
        } });
        supCriadas++; tocou = true;
      }
    } else linhas.push(`  supervisão: (venda sem supervisao_id)`);

    // Atualiza os snapshots EXIBIDOS na tela (lista lê estes campos da venda):
    //  comissao_valor = comissão do vendedor (15% do setup); comissao_supervisao_valor = 5%.
    if (APPLY && tocou) await prisma.vendaAdicional.update({ where: { id: v.id }, data: { comissao_valor: cVendNovo, comissao_supervisao_valor: cSupNovo } }).catch(() => {});
    if (tocou) afetadas++;

    console.log(`• ${cliente} — setup ${brl(setup)}`);
    linhas.forEach(l => console.log(l));
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Comunicações: ${vendas.length} | afetadas: ${afetadas} | sem setup: ${semSetup}`);
  console.log(`Vendedor atualizadas: ${vendUpd} | Supervisão atualizadas: ${supUpd} | Supervisão criadas: ${supCriadas} | já pagas preservadas: ${pagas}`);
  console.log(APPLY ? '\n✅ Alterações GRAVADAS no banco.' : '\n⚠ DRY-RUN — nada foi gravado. Rode com --apply para aplicar.');

  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERRO:', e.message); await prisma.$disconnect(); process.exit(1); });
