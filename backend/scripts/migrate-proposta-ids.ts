/**
 * MIGRAÇÃO DELIBERADA — reescreve os IDs de propostas/contratos ANTIGOS para o
 * novo formato rastreável "<3 do id do vendedor>-<CNPJ>" (contrato herda o id da proposta).
 *
 * ⚠️ NÃO roda no boot. Execute manualmente E SOMENTE APÓS BACKUP do banco:
 *
 *     # 1) BACKUP (exemplo MySQL):
 *     mysqldump -u USER -p NOME_DO_BANCO > backup_antes_migracao.sql
 *
 *     # 2) Simulação (não grava nada):
 *     cd backend && npx tsx scripts/migrate-proposta-ids.ts --dry-run
 *
 *     # 3) Migração real:
 *     cd backend && npx tsx scripts/migrate-proposta-ids.ts --apply
 *
 * O que faz, por proposta cujo id ainda NÃO está no formato novo:
 *   - calcula novoId = montarIdProposta(vendedor_id||created_by, cnpj) (+ sufixo se colidir);
 *   - atualiza em transação: PropostaHistorico.proposta_id, ContratoComercial.proposta_comercial_id,
 *     Comissao.referencia_id, e o id do contrato vinculado (para herdar o id), e por fim o id da proposta.
 *
 * Idempotente: propostas que já estão no formato novo são ignoradas.
 * NÃO altera public_token (logo, os links /p/[token] já enviados continuam válidos).
 */
import { PrismaClient } from '@prisma/client';
import { montarIdProposta } from '../src/lib/ids';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const DRY = !APPLY || process.argv.includes('--dry-run');

// Heurística: id "novo" tem o padrão <pref>-<digitos...>. cuid começa com 'c' e tem ~25 chars sem '-'.
function pareceFormatoNovo(id: string): boolean {
  return /^[a-z0-9]{1,3}-\d{6,}/.test(id) || /^[a-z0-9]{1,3}-scnpj\d+/.test(id);
}

async function main() {
  console.log(`\n=== Migração de IDs de proposta — modo: ${APPLY ? 'APPLY (grava)' : 'DRY-RUN (simulação)'} ===\n`);

  const propostas = await prisma.propostaComercial.findMany({
    select: { id: true, vendedor_id: true, created_by: true, cnpj: true, razao_social: true },
    orderBy: { created_at: 'asc' },
  });

  const usados = new Set<string>();
  // pré-carrega ids já existentes (inclui os que já estão no formato novo) para evitar colisão
  propostas.forEach(p => { if (pareceFormatoNovo(p.id)) usados.add(p.id); });

  let migradas = 0, ignoradas = 0, comContrato = 0;

  for (const p of propostas) {
    if (pareceFormatoNovo(p.id)) { ignoradas++; continue; }

    const base = montarIdProposta(p.vendedor_id || p.created_by, p.cnpj);
    let novoId = base, n = 1;
    while (usados.has(novoId)) { n++; novoId = `${base}-${n}`; }
    usados.add(novoId);

    const contrato = await prisma.contratoComercial.findFirst({
      where: { proposta_comercial_id: p.id }, select: { id: true },
    });

    console.log(`${p.id}  →  ${novoId}   (${p.razao_social || 's/ razão'})${contrato ? '  [+contrato]' : ''}`);

    if (APPLY && !DRY) {
      await prisma.$transaction(async (tx) => {
        // filhos primeiro (refs soltas)
        await tx.propostaHistorico.updateMany({ where: { proposta_id: p.id }, data: { proposta_id: novoId } });
        await tx.$executeRawUnsafe(`UPDATE Comissao SET referencia_id = ? WHERE referencia_id = ?`, novoId, p.id);
        if (contrato) {
          // contrato herda o id da proposta
          await tx.$executeRawUnsafe(`UPDATE ContratoComercial SET id = ?, proposta_comercial_id = ? WHERE id = ?`, novoId, novoId, contrato.id);
          await tx.$executeRawUnsafe(`UPDATE Comissao SET referencia_id = ? WHERE referencia_id = ?`, novoId, contrato.id);
        }
        // por fim, o id da proposta (raw para atualizar a PK)
        await tx.$executeRawUnsafe(`UPDATE PropostaComercial SET id = ? WHERE id = ?`, novoId, p.id);
      });
    }
    migradas++;
    if (contrato) comContrato++;
  }

  console.log(`\nResumo: ${migradas} a migrar, ${ignoradas} já no formato novo, ${comContrato} com contrato vinculado.`);
  if (!APPLY) console.log('\nNada foi gravado (dry-run). Rode com --apply após o backup para efetivar.\n');
}

main()
  .catch(e => { console.error('ERRO na migração:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
