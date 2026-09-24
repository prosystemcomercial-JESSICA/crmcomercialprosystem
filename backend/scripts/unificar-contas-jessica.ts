/**
 * Unificação das contas da Jessica + ajustes de acesso (set/2026).
 *
 *   cd backend
 *   npx tsx scripts/unificar-contas-jessica.ts                 # DRY-RUN (padrão): só conta, não altera nada
 *   npx tsx scripts/unificar-contas-jessica.ts --aplicar       # aplica tudo numa transação
 *   npx tsx scripts/unificar-contas-jessica.ts --nome "Jessica Cardoso"   # nome final da conta (padrão: Jessica Cardoso)
 *
 * Usa DATABASE_URL. Acha os usuários por E-MAIL (nunca id fixo), aborta se a conta
 * mantida não for exatamente 1 linha ATIVA, nunca apaga linhas e pode rodar de
 * novo sem efeito (idempotente). O plano (SQL) vem de src/lib/unificacao-contas.ts.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  CONFIG_PADRAO, resolverContas, montarPlano, filtrarPorColunasExistentes, ddlFlagsFaltantes,
  ErroUnificacao, Passo, UsuarioLinha,
} from '../src/lib/unificacao-contas';

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const iNome = args.indexOf('--nome');
const NOME = iNome >= 0 ? args[iNome + 1] : undefined;

const num = (v: any) => Number(typeof v === 'bigint' ? v : v ?? 0);

async function colunasExistentes(prisma: PrismaClient): Promise<Set<string>> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
  );
  return new Set(rows.map(r => `${r.t}.${r.c}`));
}

async function contar(db: any, p: Passo): Promise<{ n: number; amostra: string[] }> {
  const r: any[] = await db.$queryRawUnsafe(p.contar.sql, ...p.contar.params);
  const n = num(r[0]?.n);
  let amostra: string[] = [];
  if (n > 0 && p.amostra) {
    const a: any[] = await db.$queryRawUnsafe(p.amostra.sql, ...p.amostra.params);
    amostra = a.map(x => String(x.id));
  }
  return { n, amostra };
}

function imprimir(titulo: string, linhas: { p: Passo; n: number; amostra: string[] }[]) {
  console.log(`\n=== ${titulo} ===`);
  for (const { p, n, amostra } of linhas) {
    const marca = p.aplicar.length === 0 ? '[info]' : n > 0 ? '[muda]' : '[ok]  ';
    console.log(`${marca} ${p.chave.padEnd(46)} ${String(n).padStart(6)}  ${p.descricao}`);
    if (amostra.length) console.log(`        amostra: ${amostra.join(', ')}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida.');
  const prisma = new PrismaClient();
  try {
    console.log(APLICAR ? '>>> MODO APLICAR — vai alterar o banco' : '>>> DRY-RUN — nada será alterado (use --aplicar)');

    const usuarios: UsuarioLinha[] = await prisma.$queryRawUnsafe(
      `SELECT id, email, nome, cargo, status FROM UsuarioCRM`
    );
    const contas = resolverContas(usuarios, { ...CONFIG_PADRAO, nomeFinal: NOME ?? CONFIG_PADRAO.nomeFinal });

    console.log(`\nConta mantida : ${contas.manter.email} (${contas.manter.id}) "${contas.manter.nome}" → nome final "${contas.nomeFinal}"`);
    console.log(`Mesclar ids   : ${contas.mesclarIds.join(', ') || '(nenhum)'}`);
    for (const u of contas.mescladasDb) console.log(`                ${u.id} = ${u.email} "${u.nome}" ${u.cargo} ${u.status}`);
    console.log(`Inativar      : ${contas.inativarIds.join(', ') || '(nenhum)'}`);
    console.log(`Somente leitura: ${contas.somenteLeituraIds.join(', ') || '(nenhum)'}`);
    console.log(`Sarah         : ${contas.sarah ? `${contas.sarah.id} (${contas.sarah.email})` : '(não encontrada)'}`);
    contas.avisos.forEach(a => console.log(`AVISO: ${a}`));

    let existentes = await colunasExistentes(prisma);
    const ddl = ddlFlagsFaltantes(existentes);
    if (ddl.length) {
      console.log(`\nColunas de flag ausentes em UsuarioCRM (${ddl.length}) — ${APLICAR ? 'criando agora (fora da transação)' : 'seriam criadas no --aplicar'}:`);
      ddl.forEach(s => console.log(`  ${s}`));
      if (APLICAR) {
        for (const s of ddl) await prisma.$executeRawUnsafe(s);
        existentes = await colunasExistentes(prisma);
      }
    }

    const plano = montarPlano(contas);
    const { ok, ausentes } = filtrarPorColunasExistentes(plano, existentes);
    if (ausentes.length) {
      console.log('\nPassos ignorados (tabela/coluna inexistente neste banco):');
      ausentes.forEach(a => console.log(`  - ${a.passo.chave}: falta ${a.faltam.join(', ')}`));
    }

    const antes = [];
    for (const p of ok) antes.push({ p, ...(await contar(prisma, p)) });
    imprimir('ANTES (linhas que mudariam)', antes);
    const total = antes.filter(x => x.p.aplicar.length).reduce((s, x) => s + x.n, 0);
    console.log(`\nTotal de linhas a alterar: ${total}`);

    if (!APLICAR) {
      console.log('\nDRY-RUN concluído. Nenhuma alteração feita.');
      return;
    }

    const resumo: Record<string, number> = {};
    await prisma.$transaction(async (tx) => {
      for (const p of ok) {
        if (!p.aplicar.length) continue;
        let afetadas = 0;
        for (const s of p.aplicar) afetadas += num(await tx.$executeRawUnsafe(s.sql, ...s.params));
        if (afetadas) resumo[p.chave] = afetadas;
      }
      if (existentes.has('AuditoriaUsuario.id')) {
        await tx.$executeRawUnsafe(
          `INSERT INTO AuditoriaUsuario (id, ator_id, ator_nome, ator_role, acao, alvo_id, alvo_nome, detalhes) VALUES (?,?,?,?,?,?,?,?)`,
          randomUUID(), 'script', 'unificar-contas-jessica', 'SISTEMA', 'UNIFICACAO_CONTAS',
          contas.manter.id, contas.nomeFinal,
          JSON.stringify({ mesclados: contas.mesclarIds, inativados: contas.inativarIds, somente_leitura: contas.somenteLeituraIds, sarah: contas.sarah?.id || null, linhas: resumo }),
        );
      }
    }, { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 });

    console.log('\nAplicado. Linhas afetadas por passo:');
    Object.entries(resumo).forEach(([k, v]) => console.log(`  ${k.padEnd(46)} ${v}`));

    const depois = [];
    for (const p of ok) depois.push({ p, ...(await contar(prisma, p)) });
    imprimir('DEPOIS (esperado 0, exceto [info] e conflitos de índice único)', depois);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  if (e instanceof ErroUnificacao) console.error(`\nABORTADO: ${e.message}`);
  else console.error(e);
  process.exit(1);
});
