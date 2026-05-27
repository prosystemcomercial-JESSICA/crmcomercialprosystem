import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { enviarEmailBoasVindas, enviarEmailRedefinicaoSenha } from '@/services/email.service';

// Apenas CEO pode criar/remover usuários
const APENAS_CEO = ['CEO'];
// Supervisores e CEO podem ver e editar usuários
const GESTORES = ['CEO', 'DIRETOR', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'ADMIN'];

// ─── Módulos disponíveis ──────────────────────────────────────
export const MODULOS = [
  'Dashboard Geral','Empresas / Clientes','Contatos','Histórico de Solicitações',
  'Nova Solicitação de Serviço','Atendimento / Suporte','Leads','Propostas',
  'Contratos','Comercial / Funil','Metas','Ranking','Relatórios Comerciais',
  'Relatórios Técnicos','Relatórios Financeiros','Financeiro','Comissões / Bônus',
  'Cancelamentos / Churn','Usuários e Permissões','Configurações do Sistema',
  'Integrações','Aplicativos & Ferramentas'
];

// ─── Permissões críticas (geram alerta) ──────────────────────
export const MODULOS_CRITICOS = [
  'Usuários e Permissões','Configurações do Sistema','Financeiro',
  'Relatórios Financeiros','Comissões / Bônus','Integrações'
];

// ─── Tipo de permissão por módulo ────────────────────────────
type Perm = { ver: boolean; criar: boolean; editar: boolean; excluir: boolean; exportar: boolean; administrar: boolean; alcance: 'proprio'|'grupo'|'todos' };
type ModulosPermissao = Record<string, Perm>;

const permVazia = (): Perm => ({ ver: false, criar: false, editar: false, excluir: false, exportar: false, administrar: false, alcance: 'proprio' });
const permVer = (alcance: Perm['alcance'] = 'todos'): Perm => ({ ...permVazia(), ver: true, alcance });
const permTotal = (): Perm => ({ ver: true, criar: true, editar: true, excluir: true, exportar: true, administrar: true, alcance: 'todos' });
const permVCE = (alcance: Perm['alcance'] = 'todos'): Perm => ({ ...permVazia(), ver: true, criar: true, editar: true, alcance });
const permVE = (alcance: Perm['alcance'] = 'todos'): Perm => ({ ...permVazia(), ver: true, editar: true, alcance });

// ─── Presets por cargo ────────────────────────────────────────
export const PRESETS: Record<string, ModulosPermissao> = {
  CEO: Object.fromEntries(MODULOS.map(m => [m, permTotal()])),

  SUPERVISAO_COMERCIAL: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': permVE('todos'),
    'Contatos': permVCE('todos'),
    'Histórico de Solicitações': permVer('todos'),
    'Leads': permVCE('grupo'),
    'Propostas': permVCE('grupo'),
    'Contratos': permVer('todos'),
    'Comercial / Funil': permVCE('grupo'),
    'Metas': permVE('todos'),
    'Ranking': permVer('todos'),
    'Relatórios Comerciais': { ...permVazia(), ver: true, exportar: true, alcance: 'todos' },
    'Cancelamentos / Churn': permVer('todos'),
    'Comissões / Bônus': permVer('grupo'),
    'Aplicativos & Ferramentas': permVer('todos'),
  },

  SUPERVISAO_TECNICA: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': permVE('todos'),
    'Contatos': permVCE('todos'),
    'Histórico de Solicitações': permVCE('todos'),
    'Nova Solicitação de Serviço': { ...permVazia(), criar: true, alcance: 'todos' },
    'Atendimento / Suporte': permVCE('todos'),
    'Relatórios Técnicos': { ...permVazia(), ver: true, exportar: true, alcance: 'todos' },
    'Cancelamentos / Churn': permVE('todos'),
    'Aplicativos & Ferramentas': permVer('todos'),
    'Integrações': permVer('todos'),
    'Ranking': permVer('todos'),
  },

  TECNICO_N1: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': permVer('todos'),
    'Contatos': permVer('todos'),
    'Histórico de Solicitações': { ...permVazia(), ver: true, criar: true, alcance: 'proprio' },
    'Nova Solicitação de Serviço': { ...permVazia(), criar: true, alcance: 'proprio' },
    'Atendimento / Suporte': { ...permVazia(), ver: true, criar: true, editar: true, alcance: 'proprio' },
    'Aplicativos & Ferramentas': permVer('todos'),
  },

  TECNICO_N2: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': permVE('todos'),
    'Contatos': permVCE('todos'),
    'Histórico de Solicitações': permVCE('todos'),
    'Nova Solicitação de Serviço': { ...permVazia(), criar: true, alcance: 'proprio' },
    'Atendimento / Suporte': permVCE('todos'),
    'Relatórios Técnicos': permVer('todos'),
    'Aplicativos & Ferramentas': permVer('todos'),
  },

  TECNICO_N3: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': permVE('todos'),
    'Contatos': permVCE('todos'),
    'Histórico de Solicitações': permVCE('todos'),
    'Nova Solicitação de Serviço': { ...permVazia(), criar: true, alcance: 'proprio' },
    'Atendimento / Suporte': permVCE('todos'),
    'Relatórios Técnicos': { ...permVazia(), ver: true, exportar: true, alcance: 'todos' },
    'Cancelamentos / Churn': permVer('todos'),
    'Integrações': permVE('todos'),
    'Aplicativos & Ferramentas': permVE('todos'),
  },

  VENDEDOR: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': { ...permVazia(), ver: true, criar: true, alcance: 'proprio' },
    'Contatos': permVCE('proprio'),
    'Leads': permVCE('proprio'),
    'Propostas': permVCE('proprio'),
    'Comercial / Funil': permVer('proprio'),
    'Contratos': permVer('proprio'),
    'Metas': permVer('proprio'),
    'Ranking': permVer('todos'),
    'Histórico de Solicitações': permVer('proprio'),
    'Aplicativos & Ferramentas': permVer('todos'),
    'Comissões / Bônus': permVer('proprio'),
  },
};

// ─── Senha aleatória segura (10 chars: maiúscula + minúscula + número + especial) ─
function gerarSenha(): string {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!';
  const all     = upper + lower + digits + special;
  // Garante pelo menos 1 de cada categoria
  let senha = [
    upper[Math.floor(Math.random() * upper.length)],
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
    ...Array.from({ length: 3 }, () => all[Math.floor(Math.random() * all.length)])
  ];
  // Embaralha para não ficar previsível
  for (let i = senha.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [senha[i], senha[j]] = [senha[j], senha[i]];
  }
  return senha.join('');
}

// ─── Schemas ──────────────────────────────────────────────────
const CriarUsuarioSchema = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(8),
  email: z.string().email(),
  cargo: z.enum(['CEO','SUPERVISAO_COMERCIAL','SUPERVISAO_TECNICA','TECNICO_SUPORTE','VENDEDOR']),
  classificacao: z.enum(['N1','N2','N3']).optional().nullable(),
  status: z.enum(['ATIVO','INATIVO','SUSPENSO']).default('ATIVO'),
  observacoes: z.string().optional().nullable(),
  modulos_permissao: z.record(z.any()).optional()
});

const AtualizarUsuarioSchema = CriarUsuarioSchema.partial().omit({ email: true });

export async function usuariosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ─── Criar tabelas de forma não-bloqueante (não trava o startup) ──
  Promise.all([
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UsuarioCRM" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        telefone VARCHAR(50),
        senha VARCHAR(20) NOT NULL,
        cargo VARCHAR(50) NOT NULL,
        classificacao VARCHAR(5),
        status VARCHAR(20) DEFAULT 'ATIVO',
        observacoes TEXT,
        modulos_permissao JSONB DEFAULT '{}',
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `),
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditoriaUsuario" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ator_id VARCHAR(255),
        ator_nome VARCHAR(255),
        ator_role VARCHAR(50),
        acao VARCHAR(100),
        alvo_id VARCHAR(255),
        alvo_nome VARCHAR(255),
        detalhes JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  ]).catch(e => console.warn('[USUARIOS] Aviso ao criar tabelas:', e.message));

  // ─── Helper: registrar auditoria ────────────────────────────
  const auditoria = async (ator: any, acao: string, alvo_id: string, alvo_nome: string, detalhes?: any) => {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "AuditoriaUsuario" (ator_id, ator_nome, ator_role, acao, alvo_id, alvo_nome, detalhes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        ator?.id || 'sistema', ator?.nome || 'sistema', ator?.role || '', acao, alvo_id, alvo_nome,
        detalhes ? JSON.stringify(detalhes) : null
      );
    } catch { /* auditoria não deve quebrar a operação principal */ }
  };

  // ─── Helper: checar permissão de gestor ─────────────────────
  const checkGestor = (request: any, reply: any): boolean => {
    const user = (request as any).user;
    if (!user || !GESTORES.some(r => user.role?.includes(r))) {
      reply.status(403).send({ status: 'error', message: 'Apenas CEO e Supervisores podem gerenciar usuários' });
      return false;
    }
    return true;
  };

  const checkCeo = (request: any, reply: any): boolean => {
    const user = (request as any).user;
    if (!user || !APENAS_CEO.some(r => user.role?.includes(r))) {
      reply.status(403).send({ status: 'error', message: 'Apenas o CEO pode criar ou remover usuários' });
      return false;
    }
    return true;
  };

  // ─── GET /usuarios/presets — presets de permissão por cargo ──
  fastify.get('/usuarios/presets', { onRequest: requireAuth }, async (_request, reply) => {
    return reply.send({ status: 'success', data: { presets: PRESETS, modulos: MODULOS, modulos_criticos: MODULOS_CRITICOS } });
  });

  // ─── GET /usuarios — listar ──────────────────────────────────
  fastify.get('/usuarios', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "UsuarioCRM" ORDER BY created_at ASC`);
    return reply.send({ status: 'success', data: rows });
  });

  // ─── POST /usuarios — criar (apenas CEO) ────────────────────
  fastify.post('/usuarios', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkCeo(request, reply)) return;
    const ator = (request as any).user;

    const body = CriarUsuarioSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const { nome, telefone, email, cargo, classificacao, status, observacoes, modulos_permissao } = body.data;
    const senha = gerarSenha();

    const presetKey = cargo === 'TECNICO_SUPORTE'
      ? (classificacao ? `TECNICO_${classificacao}` : 'TECNICO_N1')
      : cargo;
    const permissoes = modulos_permissao || PRESETS[presetKey] || {};

    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `INSERT INTO "UsuarioCRM" (nome, email, telefone, senha, cargo, classificacao, status, observacoes, modulos_permissao, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING *`,
        nome, email, telefone, senha, cargo, classificacao || null,
        status, observacoes || null, JSON.stringify(permissoes), ator?.id || null
      );
      const novo = rows[0];
      await auditoria(ator, 'CRIOU_USUARIO', novo.id, nome, { cargo, classificacao });

      // Enviar email com credenciais automaticamente
      enviarEmailBoasVindas({ nome, email, senha, cargo })
        .then(r => { if (!r.ok) console.warn('[USUARIO] E-mail boas-vindas não enviado:', r.error); })
        .catch(e => console.error('[USUARIO] Erro ao enviar boas-vindas:', e));

      return reply.status(201).send({ status: 'success', data: { ...novo, senha_gerada: senha } });
    } catch (err: any) {
      if (err.code === '23505') return reply.status(409).send({ status: 'error', message: 'E-mail já cadastrado' });
      throw err;
    }
  });

  // ─── PATCH /usuarios/:id — atualizar ─────────────────────────
  fastify.patch('/usuarios/:id', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };

    const body = AtualizarUsuarioSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const sets: string[] = [];
    const vals: any[] = [];
    let n = 1;
    const d = body.data as any;
    for (const [key, val] of Object.entries(d)) {
      if (val !== undefined) {
        const isJson = key === 'modulos_permissao';
        sets.push(`${key} = $${n++}${isJson ? '::jsonb' : ''}`);
        vals.push(isJson ? JSON.stringify(val) : val);
      }
    }
    if (!sets.length) return reply.status(400).send({ status: 'error', message: 'Nenhum campo para atualizar' });

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    const rows: any[] = await prisma.$queryRawUnsafe(
      `UPDATE "UsuarioCRM" SET ${sets.join(', ')} WHERE id = $${n} RETURNING *`,
      ...vals
    );
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    await auditoria(ator, 'EDITOU_USUARIO', id, rows[0].nome, body.data);
    return reply.send({ status: 'success', data: rows[0] });
  });

  // ─── POST /usuarios/:id/desativar ────────────────────────────
  fastify.post('/usuarios/:id/desativar', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };

    const rows: any[] = await prisma.$queryRawUnsafe(
      `UPDATE "UsuarioCRM" SET status = 'INATIVO', updated_at = NOW() WHERE id = $1 RETURNING *`, id
    );
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    await auditoria(ator, 'DESATIVOU_USUARIO', id, rows[0].nome);
    return reply.send({ status: 'success', message: 'Usuário desativado' });
  });

  // ─── POST /usuarios/:id/redefinir-senha (apenas CEO) ────────
  fastify.post('/usuarios/:id/redefinir-senha', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkCeo(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };

    const novaSenha = gerarSenha();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `UPDATE "UsuarioCRM" SET senha = $1, updated_at = NOW() WHERE id = $2 RETURNING nome, email, cargo`,
      novaSenha, id
    );
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    await auditoria(ator, 'RESETOU_SENHA', id, rows[0].nome);

    // Envia email de redefinição de senha (template dedicado)
    enviarEmailRedefinicaoSenha({ nome: rows[0].nome, email: rows[0].email, senha: novaSenha, cargo: rows[0].cargo, solicitadoPor: 'admin' })
      .catch(e => console.error('[USUARIO] Erro ao enviar email de redefinição:', e));

    return reply.send({ status: 'success', data: { nova_senha: novaSenha, email: rows[0].email } });
  });

  // ─── GET /usuarios/auditoria — histórico de ações ────────────
  fastify.get('/usuarios/auditoria', { onRequest: requireAuth }, async (request, reply) => {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AuditoriaUsuario" ORDER BY created_at DESC LIMIT 200`
    );
    return reply.send({ status: 'success', data: rows });
  });

  // ─── DELETE /usuarios/:id (apenas CEO) ──────────────────────
  fastify.delete('/usuarios/:id', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkCeo(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };

    const rows: any[] = await prisma.$queryRawUnsafe(`DELETE FROM "UsuarioCRM" WHERE id = $1 RETURNING nome`, id);
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    await auditoria(ator, 'REMOVEU_USUARIO', id, rows[0].nome);
    return reply.send({ status: 'success', message: 'Usuário removido' });
  });
}
