import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Auditoria genérica de ações destrutivas/sensíveis, reaproveitando a mesma
 * tabela AuditoriaUsuario já usada em usuarios.ts. Nunca lança — auditoria
 * não pode derrubar a operação principal, mas SEMPRE deve ser chamada ANTES
 * de qualquer exclusão em massa (registra a tentativa mesmo que a exclusão
 * em si falhe no meio do caminho).
 *
 * Garante a própria tabela (CREATE TABLE IF NOT EXISTS) em vez de depender
 * da ordem de carregamento de rotas — usuarios.ts também cria essa mesma
 * tabela, mas este módulo não pode contar com ele já ter rodado primeiro.
 */
export async function registrarAuditoriaAcao(
  prisma: PrismaClient,
  ator: { id?: string; nome?: string; role?: string } | undefined,
  acao: string,
  alvo_id: string,
  alvo_nome: string,
  detalhes?: any
) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS AuditoriaUsuario (
        id CHAR(36) NOT NULL PRIMARY KEY,
        ator_id VARCHAR(255),
        ator_nome VARCHAR(255),
        ator_role VARCHAR(50),
        acao VARCHAR(100),
        alvo_id VARCHAR(255),
        alvo_nome VARCHAR(255),
        detalhes JSON,
        created_at DATETIME DEFAULT NOW()
      )
    `);
    const audId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO AuditoriaUsuario (id, ator_id, ator_nome, ator_role, acao, alvo_id, alvo_nome, detalhes) VALUES (?,?,?,?,?,?,?,?)`,
      audId, ator?.id || 'sistema', ator?.nome || 'sistema', ator?.role || '', acao, alvo_id, alvo_nome,
      detalhes ? JSON.stringify(detalhes) : null
    );
  } catch { /* auditoria não deve quebrar a operação principal */ }
}
