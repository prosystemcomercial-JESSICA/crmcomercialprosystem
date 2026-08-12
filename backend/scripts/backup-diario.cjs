// Backup diário do banco de produção — exporta todas as tabelas como JSON.
// Rodado via Task Scheduler do Windows (logon + 17h todo dia), salva em uma
// pasta local sincronizada pelo MEGAsync (backup externo automático).
//
// Não depende de mysqldump (não instalado nesta máquina) — usa o próprio
// Prisma Client + SQL bruto pra descobrir e exportar todas as tabelas.
//
// Uso: DATABASE_URL="mysql://..." node scripts/backup-diario.cjs [pasta_destino]

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const DESTINO = process.argv[2] || 'C:/Users/prosy/MEGA/backup-crm';
const RETENCAO_DIAS = 14; // mantém os últimos 14 backups locais, apaga o resto

function serializar(_key, value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

async function main() {
  const prisma = new PrismaClient();
  const inicio = Date.now();

  const tabelas = await prisma.$queryRawUnsafe(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );

  const agora = new Date();
  const carimbo = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-08-12T17-00-00
  const pastaBackup = path.join(DESTINO, carimbo);
  fs.mkdirSync(pastaBackup, { recursive: true });

  const resumo = { data: agora.toISOString(), tabelas: {}, erros: [] };

  for (const { TABLE_NAME: tabela } of tabelas) {
    try {
      const linhas = await prisma.$queryRawUnsafe(`SELECT * FROM \`${tabela}\``);
      const conteudo = JSON.stringify(linhas, serializar, 2);
      fs.writeFileSync(path.join(pastaBackup, `${tabela}.json`), conteudo, 'utf8');
      resumo.tabelas[tabela] = linhas.length;
    } catch (err) {
      resumo.erros.push({ tabela, erro: err.message });
      console.error(`[BACKUP] Falha ao exportar ${tabela}:`, err.message);
    }
  }

  fs.writeFileSync(path.join(pastaBackup, '_resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');

  const totalLinhas = Object.values(resumo.tabelas).reduce((a, b) => a + b, 0);
  const duracaoSeg = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`[BACKUP] OK — ${Object.keys(resumo.tabelas).length} tabelas, ${totalLinhas} linhas, ${resumo.erros.length} erros, ${duracaoSeg}s`);
  console.log(`[BACKUP] Salvo em: ${pastaBackup}`);

  // Limpeza: apaga backups locais mais antigos que RETENCAO_DIAS (o Mega guarda o histórico completo).
  try {
    const pastas = fs.readdirSync(DESTINO, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
    const limite = new Date(agora.getTime() - RETENCAO_DIAS * 24 * 60 * 60 * 1000);
    for (const nome of pastas) {
      const dataPasta = new Date(nome.slice(0, 10)); // "2026-08-12" dos primeiros 10 chars
      if (!isNaN(dataPasta.getTime()) && dataPasta < limite) {
        fs.rmSync(path.join(DESTINO, nome), { recursive: true, force: true });
        console.log(`[BACKUP] Removido backup local antigo: ${nome}`);
      }
    }
  } catch (err) {
    console.error('[BACKUP] Falha na limpeza de backups antigos:', err.message);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[BACKUP] ERRO FATAL:', err);
  process.exit(1);
});
