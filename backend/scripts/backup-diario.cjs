// Cópia legível do banco de produção: exporta todas as tabelas como JSON (uma linha do banco por linha do arquivo).
// Faz parte do backup do servidor (backend/scripts/backup-servidor.sh, cron 3h e 14h de Brasília), que antes
// gera o dump completo do MySQL (o arquivo usado para restaurar). Este JSON é a segunda via, para ler e conferir.
//
// 23/11/2026: a tabela WhatsappMensagem (fotos e PDFs em base64 na coluna midia_url, mais de 600 MB) falhava em todo
// backup desde 23/10 ("Failed to convert rust String into napi string": a tabela inteira não cabe numa string só).
// Agora cada tabela é lida em lotes de até ~40 MB, pela chave primária, e gravada aos poucos no arquivo.
// Qualquer tabela com erro faz o script sair com código 1 (o backup do servidor fica marcado como FALHA).
// A limpeza dos backups antigos saiu daqui: o backup-servidor.sh só apaga antigos depois de um backup que deu certo.
//
// Uso: DATABASE_URL="mysql://..." BACKUP_CARIMBO=2026-11-23T06-00-00 node scripts/backup-diario.cjs <pasta_destino>

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DESTINO = process.argv[2] || '/var/backups-comercial';
const LOTE_BYTES = 40 * 1024 * 1024; // alvo de tamanho de cada leitura
// Arquivos que os clientes enviam pela página de acompanhamento (Portal Técnico) ficam em disco,
// fora do banco: entram em cada backup como _arquivos-clientes.tar.gz.
const DIR_ARQUIVOS_CLIENTE = process.env.ARQUIVOS_CLIENTE_DIR || '/root/arquivos-clientes';

/** Compacta a pasta dos arquivos dos clientes dentro do backup. Devolve { arquivos, bytes } ou null se não houver nada. */
function backupArquivosClientes(pastaBackup) {
  if (!fs.existsSync(DIR_ARQUIVOS_CLIENTE)) return null;
  let arquivos = 0;
  const contar = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.isDirectory()) contar(path.join(dir, e.name)); else arquivos++; } };
  contar(DIR_ARQUIVOS_CLIENTE);
  if (!arquivos) return { arquivos: 0, bytes: 0 };
  const destino = path.join(pastaBackup, '_arquivos-clientes.tar.gz');
  execFileSync('tar', ['-czf', destino, '-C', path.dirname(DIR_ARQUIVOS_CLIENTE), path.basename(DIR_ARQUIVOS_CLIENTE)], { stdio: 'pipe' });
  execFileSync('tar', ['-tzf', destino], { stdio: 'pipe' }); // confere se o pacote abre
  return { arquivos, bytes: fs.statSync(destino).size };
}

function serializar(_key, value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

const q = nome => '`' + String(nome).replace(/`/g, '``') + '`';

/** Exporta uma tabela em lotes para <tabela>.json (grava num arquivo .parcial e só renomeia no fim). Devolve o nº de linhas. */
async function exportarTabela(prisma, pastaBackup, tabela, info) {
  const final = path.join(pastaBackup, `${tabela}.json`);
  const parcial = final + '.parcial';
  const fd = fs.openSync(parcial, 'w');
  let linhas = 0;
  try {
    const media = Math.max(Number(info.media || 0), 200);
    const lote = Math.max(1, Math.min(5000, Math.floor(LOTE_BYTES / media)));
    fs.writeSync(fd, '[\n');
    const gravar = rows => {
      for (const r of rows) {
        fs.writeSync(fd, (linhas ? ',\n' : '') + JSON.stringify(r, serializar));
        linhas++;
      }
    };
    if (info.pk.length === 1) {
      // Paginação pela chave primária: não pula nem repete linhas mesmo com inserções durante a leitura.
      const pk = info.pk[0];
      let ultimo = null;
      for (;;) {
        const rows = ultimo === null
          ? await prisma.$queryRawUnsafe(`SELECT * FROM ${q(tabela)} ORDER BY ${q(pk)} LIMIT ${lote}`)
          : await prisma.$queryRawUnsafe(`SELECT * FROM ${q(tabela)} WHERE ${q(pk)} > ? ORDER BY ${q(pk)} LIMIT ${lote}`, ultimo);
        gravar(rows);
        if (rows.length < lote) break;
        ultimo = rows[rows.length - 1][pk];
      }
    } else {
      const ordem = info.pk.length ? info.pk.map(q).join(', ') : '1';
      for (let offset = 0; ; offset += lote) {
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${q(tabela)} ORDER BY ${ordem} LIMIT ${lote} OFFSET ${offset}`);
        gravar(rows);
        if (rows.length < lote) break;
      }
    }
    fs.writeSync(fd, '\n]\n');
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(parcial, final);
  return linhas;
}

async function main() {
  const prisma = new PrismaClient();
  const inicio = Date.now();
  const agora = new Date();
  const carimbo = process.env.BACKUP_CARIMBO || agora.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-08-12T17-00-00
  const pastaBackup = path.join(DESTINO, carimbo);
  fs.mkdirSync(pastaBackup, { recursive: true });

  const tabelas = await prisma.$queryRawUnsafe(
    "SELECT TABLE_NAME AS nome, AVG_ROW_LENGTH AS media FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  const chaves = await prisma.$queryRawUnsafe(
    "SELECT TABLE_NAME AS tabela, COLUMN_NAME AS coluna FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY TABLE_NAME, ORDINAL_POSITION"
  );
  const pkPor = {};
  for (const c of chaves) (pkPor[c.tabela] ||= []).push(c.coluna);

  const resumo = { data: agora.toISOString(), carimbo, tabelas: {}, erros: [] };

  for (const t of tabelas) {
    try {
      resumo.tabelas[t.nome] = await exportarTabela(prisma, pastaBackup, t.nome, { media: t.media, pk: pkPor[t.nome] || [] });
    } catch (err) {
      resumo.erros.push({ tabela: t.nome, erro: String(err.message || err).slice(0, 500) });
      console.error(`[BACKUP-JSON] Falha ao exportar ${t.nome}:`, err.message);
    }
  }

  try {
    resumo.arquivos_clientes = backupArquivosClientes(pastaBackup);
  } catch (err) {
    resumo.erros.push({ tabela: '_arquivos-clientes', erro: err.message });
    console.error('[BACKUP-JSON] Falha ao compactar os arquivos dos clientes:', err.message);
  }

  fs.writeFileSync(path.join(pastaBackup, '_resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');
  await prisma.$disconnect();

  const totalLinhas = Object.values(resumo.tabelas).reduce((a, b) => a + b, 0);
  const duracaoSeg = ((Date.now() - inicio) / 1000).toFixed(1);
  const ac = resumo.arquivos_clientes;
  console.log(`[BACKUP-JSON] ${resumo.erros.length ? 'FALHA' : 'OK'}: ${Object.keys(resumo.tabelas).length} de ${tabelas.length} tabelas, ${totalLinhas} linhas, ${resumo.erros.length} erros, ${duracaoSeg}s`);
  console.log(`[BACKUP-JSON] Arquivos dos clientes: ${ac ? `${ac.arquivos} arquivo(s)${ac.arquivos ? `, ${(ac.bytes / 1048576).toFixed(1)} MB compactados` : ''}` : `pasta ${DIR_ARQUIVOS_CLIENTE} não existe`}`);
  if (resumo.erros.length) process.exit(1);
}

main().catch(err => {
  console.error('[BACKUP-JSON] ERRO FATAL:', err);
  process.exit(1);
});
