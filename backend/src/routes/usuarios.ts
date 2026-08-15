import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/middleware/auth';
import { enviarEmailBoasVindas, enviarEmailRedefinicaoSenha } from '@/services/email.service';
import { hashSenha } from '@/lib/seguranca';
import { CONTAS_SISTEMA } from '@/lib/usuarios';

// CEO e Supervisores podem ver, criar, editar, resetar senha e remover usuários
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
  // CEO = visão EXECUTIVA (só resultado/direção), apenas LEITURA. Não é super-admin:
  // não gerencia usuários, config nem operacional. O menu já restringe por role; o
  // preset reflete isso (antes liberava TUDO como admin, o que confundia no cadastro).
  CEO: {
    'Dashboard Geral': permVer('todos'),
    'Ranking': permVer('todos'),
    'Relatórios Comerciais': { ...permVazia(), ver: true, exportar: true, alcance: 'todos' },
    'Relatórios Financeiros': { ...permVazia(), ver: true, exportar: true, alcance: 'todos' },
    'Financeiro': permVer('todos'),
    'Comissões / Bônus': permVer('todos'),
  },

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

  TECNICO_IMPLANTACAO: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': permVer('todos'),
    'Contatos': permVer('todos'),
    'Histórico de Solicitações': permVer('proprio'),
    'Aplicativos & Ferramentas': permVer('todos'),
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

  // SDR = prospecção/qualificação, não fecha venda. Cadastra e trabalha os próprios
  // leads (criar/editar), mas sem Propostas/Contratos/Comissões — isso é do vendedor
  // depois que a supervisão distribui o lead qualificado (ver rota /leads/:id/distribuir-sdr).
  SDR: {
    'Dashboard Geral': permVer('todos'),
    'Empresas / Clientes': { ...permVazia(), ver: true, criar: true, alcance: 'proprio' },
    'Contatos': permVCE('proprio'),
    'Leads': permVCE('proprio'),
    'Comercial / Funil': permVer('proprio'),
    'Histórico de Solicitações': permVer('proprio'),
    'Aplicativos & Ferramentas': permVer('todos'),
  },
};

// ─── Senha aleatória segura (10 chars: maiúscula + minúscula + número + especial) ─
function gerarSenha(): string {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!';
  const all     = upper + lower + digits + special;
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
  cargo: z.enum(['CEO','SUPERVISAO_COMERCIAL','SUPERVISAO_TECNICA','TECNICO_SUPORTE','TECNICO_IMPLANTACAO','VENDEDOR','SDR']),
  classificacao: z.enum(['N1','N2','N3']).optional().nullable(),
  status: z.enum(['ATIVO','INATIVO','SUSPENSO']).default('ATIVO'),
  observacoes: z.string().optional().nullable(),
  modulos_permissao: z.record(z.any()).optional()
});

const AtualizarUsuarioSchema = CriarUsuarioSchema.partial().omit({ email: true });

export async function usuariosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ─── Criar tabelas de forma não-bloqueante (MySQL-compatible) ──
  Promise.all([
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS UsuarioCRM (
        id CHAR(36) NOT NULL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        telefone VARCHAR(50),
        senha VARCHAR(20) NOT NULL,
        cargo VARCHAR(50) NOT NULL,
        classificacao VARCHAR(5),
        status VARCHAR(20) DEFAULT 'ATIVO',
        observacoes TEXT,
        modulos_permissao JSON,
        created_by VARCHAR(255),
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW()
      )
    `),
    prisma.$executeRawUnsafe(`
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
    `)
  ]).catch(e => console.warn('[USUARIOS] Aviso ao criar tabelas:', e.message));

  // ─── Ajustes de segurança (não-bloqueante): caber hash bcrypt + flag de troca ──
  Promise.all([
    prisma.$executeRawUnsafe(`ALTER TABLE UsuarioCRM MODIFY COLUMN senha VARCHAR(255) NOT NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE UsuarioCRM ADD COLUMN precisa_trocar_senha TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {}),
  ]).catch(() => {});

  // ─── Helper: registrar auditoria ────────────────────────────
  const auditoria = async (ator: any, acao: string, alvo_id: string, alvo_nome: string, detalhes?: any) => {
    try {
      const audId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO AuditoriaUsuario (id, ator_id, ator_nome, ator_role, acao, alvo_id, alvo_nome, detalhes) VALUES (?,?,?,?,?,?,?,?)`,
        audId, ator?.id || 'sistema', ator?.nome || 'sistema', ator?.role || '', acao, alvo_id, alvo_nome,
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

  // ─── GET /usuarios/presets ────────────────────────────────────
  fastify.get('/usuarios/presets', { onRequest: requireAuth }, async (_request, reply) => {
    return reply.send({ status: 'success', data: { presets: PRESETS, modulos: MODULOS, modulos_criticos: MODULOS_CRITICOS } });
  });

  // ─── GET /usuarios/me — perfil completo do usuário logado (com telefone) ──
  // Usado para auto-preencher o vendedor (nome + telefone) ao gerar proposta.
  fastify.get('/usuarios/me', { onRequest: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, email, telefone, cargo FROM UsuarioCRM WHERE id = ? LIMIT 1`, user.id
    ).catch(() => []);
    // fallback: dados do token (admin mock fora do banco)
    const me = rows[0] || { id: user.id, nome: user.nome, email: user.email, telefone: null, cargo: user.role };
    return reply.send({ status: 'success', data: me });
  });

  // ─── GET /usuarios/vendedores — lista enxuta p/ atribuição de leads ──
  // Vendedores ATIVOS (id, nome). Usado pela supervisão no dropdown de atribuir.
  fastify.get('/usuarios/vendedores', { onRequest: requireAuth }, async (_request, reply) => {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, email FROM UsuarioCRM WHERE cargo = 'VENDEDOR' AND status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);
    // Contas de sistema que também vendem (ex.: Jessica/Diretora) aparecem no topo.
    Object.entries(CONTAS_SISTEMA).forEach(([id, info]) => {
      if (!rows.some(r => r.id === id)) rows.unshift({ id, nome: info.nome, email: null });
    });
    return reply.send({ status: 'success', data: rows });
  });

  // ─── GET /usuarios/responsaveis — usuários ATIVOS (id, nome, cargo) ──
  // Usado no dropdown de responsável das metas (nomes e cargos reais cadastrados).
  fastify.get('/usuarios/responsaveis', { onRequest: requireAuth }, async (_request, reply) => {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, cargo FROM UsuarioCRM WHERE status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);
    // inclui a conta admin do sistema (mock fora do banco), se não estiver no banco
    if (!rows.some(r => r.id === 'user-jessica')) {
      rows.unshift({ id: 'user-jessica', nome: 'Jessica', cargo: 'CEO' });
    }
    return reply.send({ status: 'success', data: rows });
  });

  // ─── GET /usuarios ───────────────────────────────────────────
  fastify.get('/usuarios', { onRequest: requireAuth }, async (request, reply) => {
    const ator = (request as any).user;
    const isGestor = ator && GESTORES.some(r => ator.role?.includes(r));
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM UsuarioCRM ORDER BY created_at ASC`);

    // Inclui a conta de administradora do sistema (mock fora do banco)
    const adminProSystem = {
      id: 'user-jessica',
      nome: 'Jessica',
      email: 'jessica@prosystemnet.com.br',
      cargo: 'CEO',
      status: 'ATIVO',
      classificacao: null,
      telefone: null,
      observacoes: null,
      modulos_permissao: null,
      created_by: null,
      created_at: new Date('2024-01-01'),
      updated_at: new Date()
    };
    const jaExiste = rows.some(r => r.id === 'user-jessica' || r.email === 'jessica@prosystemnet.com.br');
    const todosUsuarios = jaExiste ? rows : [adminProSystem, ...rows];

    // Não-gestores: devolve apenas campos básicos (id, nome, email, cargo, status)
    // para que possam convidar colegas na agenda sem ver permissões/observações
    if (!isGestor) {
      const basicos = todosUsuarios.map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cargo: u.cargo,
        classificacao: u.classificacao,
        status: u.status
      }));
      return reply.send({ status: 'success', data: basicos });
    }

    return reply.send({ status: 'success', data: todosUsuarios });
  });

  // ─── POST /usuarios (CEO e Supervisão Comercial) ────────────
  fastify.post('/usuarios', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const ator = (request as any).user;

    const body = CriarUsuarioSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const { nome, telefone, email, cargo, classificacao, status, observacoes, modulos_permissao } = body.data;
    const senha = gerarSenha();
    const novoId = randomUUID();

    const presetKey = cargo === 'TECNICO_SUPORTE'
      ? (classificacao ? `TECNICO_${classificacao}` : 'TECNICO_N1')
      : cargo;
    const permissoes = modulos_permissao || PRESETS[presetKey] || {};

    try {
      const senhaHash = await hashSenha(senha);   // armazena HASH; a senha plana só vai no e-mail/retorno
      await prisma.$executeRawUnsafe(
        `INSERT INTO UsuarioCRM (id, nome, email, telefone, senha, cargo, classificacao, status, observacoes, modulos_permissao, precisa_trocar_senha, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`,
        novoId, nome, email, telefone, senhaHash, cargo, classificacao || null,
        status, observacoes || null, JSON.stringify(permissoes), ator?.id || null
      );
      const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM UsuarioCRM WHERE id = ?`, novoId);
      const novo = rows[0];
      await auditoria(ator, 'CRIOU_USUARIO', novo.id, nome, { cargo, classificacao });

      enviarEmailBoasVindas({ nome, email, senha, cargo })
        .then(r => { if (!r.ok) console.warn('[USUARIO] E-mail boas-vindas não enviado:', r.error); })
        .catch(e => console.error('[USUARIO] Erro ao enviar boas-vindas:', e));

      return reply.status(201).send({ status: 'success', data: { ...novo, senha_gerada: senha } });
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry')) {
        return reply.status(409).send({ status: 'error', message: 'E-mail já cadastrado' });
      }
      throw err;
    }
  });

  // ─── PATCH /usuarios/:id ─────────────────────────────────────
  fastify.patch('/usuarios/:id', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };

    const body = AtualizarUsuarioSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const sets: string[] = [];
    const vals: any[] = [];
    const d = body.data as any;
    for (const [key, val] of Object.entries(d)) {
      if (val !== undefined) {
        const isJson = key === 'modulos_permissao';
        sets.push(`${key} = ?`);
        vals.push(isJson ? JSON.stringify(val) : val);
      }
    }
    if (!sets.length) return reply.status(400).send({ status: 'error', message: 'Nenhum campo para atualizar' });

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    await prisma.$executeRawUnsafe(
      `UPDATE UsuarioCRM SET ${sets.join(', ')} WHERE id = ?`,
      ...vals
    );
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM UsuarioCRM WHERE id = ?`, id);
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    await auditoria(ator, 'EDITOU_USUARIO', id, rows[0].nome, body.data);
    return reply.send({ status: 'success', data: rows[0] });
  });

  // ─── POST /usuarios/:id/desativar ────────────────────────────
  fastify.post('/usuarios/:id/desativar', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };

    await prisma.$executeRawUnsafe(
      `UPDATE UsuarioCRM SET status = 'INATIVO', updated_at = NOW() WHERE id = ?`, id
    );
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM UsuarioCRM WHERE id = ?`, id);
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    await auditoria(ator, 'DESATIVOU_USUARIO', id, rows[0].nome);
    return reply.send({ status: 'success', message: 'Usuário desativado' });
  });

  // ─── POST /usuarios/:id/redefinir-senha (CEO e Supervisão Comercial) ──
  fastify.post('/usuarios/:id/redefinir-senha', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };

    const novaSenha = gerarSenha();
    const novaHash = await hashSenha(novaSenha);   // HASH no banco; senha plana só no e-mail
    await prisma.$executeRawUnsafe(
      `UPDATE UsuarioCRM SET senha = ?, precisa_trocar_senha = 1, updated_at = NOW() WHERE id = ?`,
      novaHash, id
    );
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT nome, email, cargo FROM UsuarioCRM WHERE id = ?`, id);
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    await auditoria(ator, 'RESETOU_SENHA', id, rows[0].nome);

    enviarEmailRedefinicaoSenha({ nome: rows[0].nome, email: rows[0].email, senha: novaSenha, cargo: rows[0].cargo, solicitadoPor: 'admin' })
      .catch(e => console.error('[USUARIO] Erro ao enviar email de redefinição:', e));

    return reply.send({ status: 'success', data: { nova_senha: novaSenha, email: rows[0].email } });
  });

  // ─── GET /usuarios/auditoria ─────────────────────────────────
  fastify.get('/usuarios/auditoria', { onRequest: requireAuth }, async (request, reply) => {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM AuditoriaUsuario ORDER BY created_at DESC LIMIT 200`
    );
    return reply.send({ status: 'success', data: rows });
  });

  // ─── Vínculos de dados de negócio de um usuário ──────────────
  async function contarVinculosUsuario(id: string) {
    const [leads, atividades, comissoes, propostas, vendasAdicionais, contratos] = await Promise.all([
      prisma.lead.count({ where: { responsavel_id: id } }),
      prisma.atividade.count({ where: { responsavel_id: id } }),
      prisma.comissao.count({ where: { responsavel_id: id } }),
      prisma.propostaComercial.count({ where: { vendedor_id: id } }),
      prisma.vendaAdicional.count({ where: { OR: [{ vendedor_id: id }, { supervisao_id: id }] } }),
      prisma.contratoComercial.count({ where: { vendedor_id: id } }),
    ]);
    return { leads, atividades, comissoes, propostas, vendasAdicionais, contratos };
  }

  // ─── GET /usuarios/:id/vinculos (checagem antes de excluir) ─
  fastify.get('/usuarios/:id/vinculos', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const vinculos = await contarVinculosUsuario(id);
    const total = Object.values(vinculos).reduce((a, b) => a + b, 0);
    return reply.send({ status: 'success', data: { vinculos, total } });
  });

  // ─── DELETE /usuarios/:id (CEO e Supervisão Comercial) ──────
  fastify.delete('/usuarios/:id', { onRequest: requireAuth }, async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const ator = (request as any).user;
    const { id } = request.params as { id: string };
    const { confirmar_nome } = (request.query as { confirmar_nome?: string }) || {};

    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT nome FROM UsuarioCRM WHERE id = ?`, id);
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Usuário não encontrado' });
    const nome = rows[0].nome;

    const vinculos = await contarVinculosUsuario(id);
    const total = Object.values(vinculos).reduce((a, b) => a + b, 0);
    if (total > 0 && confirmar_nome?.trim() !== nome) {
      return reply.status(409).send({
        status: 'error',
        message: 'Usuário possui dados vinculados. Confirme digitando o nome exato para prosseguir.',
        data: { vinculos, total, nome },
      });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM UsuarioCRM WHERE id = ?`, id);
    await auditoria(ator, 'REMOVEU_USUARIO', id, nome + (total > 0 ? ` (com ${total} vínculo(s) de dados)` : ''));
    return reply.send({ status: 'success', message: 'Usuário removido' });
  });
}
