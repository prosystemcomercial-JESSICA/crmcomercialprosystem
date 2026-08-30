// backend/src/routes/backups.ts
//
// Backup manual sob demanda: qualquer usuário logado pode disparar um export
// completo do banco (POST /backups) e ver os 5 mais recentes (GET /backups).
// Roda no backend Railway, salvando em BACKUP_VOLUME_PATH (Railway Volume em
// produção). Independente do job local agendado (backup-diario.cjs + MEGA).

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/middleware/auth';
import { executarBackup, listarBackups } from '../lib/backup';

// Mutex em memória de processo único: evita duas execuções concorrentes de
// backup (DoS via múltiplos POSTs, colisão de timestamp na mesma pasta, e
// retenção apagando um backup que ainda está sendo escrito). Se o backend
// algum dia escalar para múltiplas réplicas no Railway, isso deixa de ser
// suficiente e será necessário um lock distribuído (ex.: via banco/Redis).
let backupEmAndamento = false;

export async function backupsRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const volumePath = process.env.BACKUP_VOLUME_PATH || './backups-local';

  fastify.post('/backups', { onRequest: [requireAuth] }, async (request, reply) => {
    if (backupEmAndamento) {
      return reply.status(409).send({ error: 'Backup já em andamento, aguarde terminar' });
    }
    backupEmAndamento = true;
    try {
      const resumo = await executarBackup(prisma, volumePath);
      return reply.send(resumo);
    } catch (err: any) {
      request.log.error(err, '[BACKUPS] Falha ao executar backup manual');
      return reply.status(500).send({ error: 'Falha ao executar backup' });
    } finally {
      backupEmAndamento = false;
    }
  });

  fastify.get('/backups', { onRequest: [requireAuth] }, async (request, reply) => {
    try {
      const backups = await listarBackups(volumePath);
      return reply.send(backups);
    } catch (err: any) {
      request.log.error(err, '[BACKUPS] Falha ao listar backups');
      return reply.status(500).send({ error: 'Falha ao listar backups' });
    }
  });
}
