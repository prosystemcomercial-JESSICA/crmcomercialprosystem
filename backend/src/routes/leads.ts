import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ownerWhere, scopeUserId, requireGestor, podeVerTudo } from '@/lib/scope';
import { auditarAlteracoesLead, calcularCicloLead } from '@/lib/lead-audit';
import { CONTAS_SISTEMA } from '@/lib/usuarios';
import { registrarMudancaTemperatura } from '@/lib/lead-temperatura';
import { bloqueadoParaFecharSeSDR, ehSDR } from '@/lib/sdr-restricoes';
import { calcularCompletude } from '@/lib/lead-completude';
import { acharPossiveisDuplicatas } from '@/lib/lead-dedupe';

const LeadSchema = z.object({
  nome:               z.string().min(1),
  razao_social:       z.string().optional(),
  nome_fantasia:      z.string().optional(),
  cnpj:               z.string().optional(),
  empresa:            z.string().optional(),
  segmento:           z.string().optional(),
  cidade:             z.string().optional(),
  estado:             z.string().optional(),
  endereco:           z.string().optional(),
  tipo_negocio:       z.string().optional(),
  qtd_lojas:          z.coerce.number().int().optional(),
  qtd_caixas:         z.coerce.number().int().optional(),
  sistema_atual:      z.string().optional(),
  tipo_oportunidade:  z.string().optional(),

  responsavel_nome:    z.string().optional(),
  responsavel_cargo:   z.string().optional(),
  cargo:               z.string().optional(),
  responsavel_telefone:z.string().optional(),
  responsavel_email:   z.string().email().optional().or(z.literal('')),
  email:               z.string().email().optional().or(z.literal('')),
  telefone:            z.string().optional(),
  responsavel_cpf:     z.string().optional(),
  responsavel_horario: z.string().optional(),

  vendedor_nome:       z.string().optional(),
  vendedor_telefone:   z.string().optional(),
  supervisor_nome:     z.string().optional(),
  campanha:            z.string().optional(),
  plano_indicado:      z.string().optional(),
  plano_interesse:     z.string().optional(),
  valor_setup:         z.coerce.number().optional(),
  valor_conversao:     z.coerce.number().optional(),
  mensalidade_estimada:z.coerce.number().optional(),
  entrada:             z.coerce.number().optional(),
  parcelamento:        z.coerce.number().int().optional(),
  validade_proposta:   z.string().datetime().optional(),
  observacoes_comerciais: z.string().optional(),
  condicao_especial:   z.string().optional(),

  frase_hero:          z.string().optional(),
  texto_valor:         z.string().optional(),
  segmento_proposta:   z.string().optional(),
  plano_recomendado:   z.string().optional(),
  modulos_inclusos:    z.array(z.string()).optional(),
  servicos_adicionais: z.array(z.string()).optional(),

  // Chave de coluna do kanban: dinâmica (tabela KanbanColuna, configurável pelo
  // usuário via "+ Coluna"), não um enum fixo — travar num enum aqui rejeitava
  // com 400 qualquer coluna customizada criada depois do deploy (ex.: "A retomar").
  etapa_comercial: z.string().optional(),
  origem:          z.string().default('MANUAL'),
  status:          z.string().optional(),
  etapa_funil:     z.string().optional(),
  temperatura:     z.enum(['FRIO','MORNO','QUENTE','MUITO_QUENTE']).optional(),
  valor_estimado:  z.coerce.number().optional(),
  probabilidade:   z.coerce.number().min(0).max(100).optional(),
  motivo_perda:    z.string().optional(),
  status_atendimento: z.string().optional(),
  responsavel_id:  z.string().optional(),
  proximo_contato: z.string().datetime().optional(),
  observacoes:     z.string().optional(),

  // UTM / campanha
  utm_source:    z.string().optional(),
  utm_medium:    z.string().optional(),
  utm_campaign:  z.string().optional(),
  utm_content:   z.string().optional(),
  utm_term:      z.string().optional(),
  fbclid:        z.string().optional(),
  gclid:         z.string().optional(),
  campaign_id:   z.string().optional(),
  adset_id:      z.string().optional(),
  ad_id:         z.string().optional(),
  campanha_nome: z.string().optional(),
  conjunto_nome: z.string().optional(),
  anuncio_nome:  z.string().optional(),
  plataforma:    z.string().optional(),
  link_origem:   z.string().optional(),
});

// No update todos os campos são opcionais. IMPORTANTE: a ficha do lead no front
// reenvia o objeto inteiro (`{...lead}`), que traz campos `null` vindos do banco
// e campos de sistema (id, datas, contadores). Sem tratamento, um único `null`
// num campo `.optional()` (que NÃO aceita null) derrubava TODO o safeParse → 400
// silencioso → "os dados não se mantinham". Aqui aceitamos null/'' como "não mexer"
// e ignoramos chaves não-editáveis ANTES do parse.
const UpdateLeadSchema = LeadSchema.partial();

// Campos de sistema/relacionamento que nunca devem ser gravados via PATCH da ficha.
const CAMPOS_NAO_EDITAVEIS = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'atribuido_em',
  'ultima_obs_at', 'deleted_at', 'deleted_by', 'deletado_motivo',
  '_count', 'observacoes', 'etiquetas', 'atividades', 'quadros',
  'criado_por', 'responsavel', 'createdAt', 'updatedAt',
]);

/** Limpa o corpo do PATCH: tira campos de sistema e converte null/'' em ausência. */
function sanitizarBodyLead(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (CAMPOS_NAO_EDITAVEIS.has(k)) continue;
    if (v === null || v === undefined) continue; // null = "não mexer neste campo"
    // Campos de data: o front pode mandar "2026-06-15" ou "2026-06-15T10:00"
    // (sem o Z final), o que o validador .datetime() do Zod rejeita. Normaliza
    // para ISO completo; se não der pra interpretar, ignora o campo.
    if ((k === 'validade_proposta' || k === 'proximo_contato') && typeof v === 'string') {
      if (v.trim() === '') continue;
      const d = new Date(v);
      if (isNaN(d.getTime())) continue;
      out[k] = d.toISOString();
      continue;
    }
    // Campos Json de array: o default antigo no banco era "{}" (objeto), então o
    // front reenviava {} e o z.array() rejeitava ("Expected array, received
    // object"), travando a ficha e a aba de planos da proposta. Normaliza p/ array.
    if (k === 'modulos_inclusos' || k === 'servicos_adicionais') {
      out[k] = Array.isArray(v) ? v : [];
      continue;
    }
    out[k] = v;
  }
  return out;
}

const ListLeadSchema = z.object({
  page:            z.coerce.number().default(0),
  limit:           z.coerce.number().default(50),
  status:          z.string().optional(),
  etapa_comercial: z.string().optional(),
  etapa_funil:     z.string().optional(),
  temperatura:     z.string().optional(),
  search:          z.string().optional(),
  responsavel_id:  z.string().optional(),
});

const ObservacaoSchema = z.object({
  tipo:                 z.string().min(1),
  descricao:            z.string().min(1),
  proxima_acao:         z.string().optional(),
  // Aceita qualquer string de data (incl. "YYYY-MM-DDTHH:mm" do datetime-local,
  // que o .datetime() do Zod rejeitava e derrubava o registro inteiro). Opcional.
  data_proximo_retorno: z.string().optional(),
  status_apos:          z.string().optional(),
  created_by_name:      z.string().optional(),
});

const OnboardingSchema = z.object({
  data_prevista_implantacao:   z.string().datetime().optional(),
  data_virada:                 z.string().optional(),
  sistema_anterior:            z.string().optional(),
  necessita_conversao:         z.boolean().optional(),
  responsavel_interno_nome:    z.string().optional(),
  responsavel_interno_telefone:z.string().optional(),
  horario_contato:             z.string().optional(),
  qtd_maquinas:                z.number().int().optional(),
  qtd_usuarios:                z.number().int().optional(),
  tem_certificado:             z.boolean().optional(),
  tem_contador:                z.boolean().optional(),
  nome_contador:               z.string().optional(),
  contato_contador:            z.string().optional(),
  usa_fiscal:                  z.boolean().optional(),
  usa_tef:                     z.boolean().optional(),
  usa_balanca:                 z.boolean().optional(),
  usa_etiqueta:                z.boolean().optional(),
  usa_convenio:                z.boolean().optional(),
  observacoes_tecnicas:        z.string().optional(),
  status:                      z.string().optional(),
});

const ExecucaoSchema = z.object({
  tecnico_nome:              z.string().optional(),
  tecnico_id:                z.string().optional(),
  supervisora_nome:          z.string().optional(),
  data_prevista_inicio:      z.string().datetime().optional(),
  data_prevista_conclusao:   z.string().datetime().optional(),
  prioridade:                z.enum(['BAIXA','NORMAL','ALTA','URGENTE']).optional(),
  tipo_execucao:             z.string().optional(),
  status:                    z.string().optional(),
  observacoes_supervisao:    z.string().optional(),
  checklist:                 z.any().optional(),
});

async function registrarObsSistema(
  prisma: PrismaClient,
  leadId: string,
  tipo: string,
  descricao: string,
  userId = 'system',
) {
  await prisma.leadObservacao.create({
    data: { lead_id: leadId, tipo, descricao, created_by: userId, created_by_name: 'Sistema' },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { ultima_obs_at: new Date() } });
}

export async function leadsRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ── Colunas de atribuição (não-bloqueante; padrão raw do projeto) ──
  // atribuido_em: quando a supervisão atribuiu o lead ao vendedor.
  // atribuicao_vista: o vendedor já viu/tratou o "novo lead recebido"?
  // OBS: `Lead` é palavra reservada no MySQL 8 → SEMPRE com crase no SQL cru.
  Promise.all([
    prisma.$executeRawUnsafe('ALTER TABLE `Lead` ADD COLUMN atribuido_em DATETIME NULL').catch(() => {}),
    prisma.$executeRawUnsafe('ALTER TABLE `Lead` ADD COLUMN atribuicao_vista TINYINT(1) NOT NULL DEFAULT 1').catch(() => {}),
    // Exclusão lógica (soft-delete): lead sai de tudo, fica só na auditoria.
    prisma.$executeRawUnsafe('ALTER TABLE `Lead` ADD COLUMN deleted_at DATETIME NULL').catch(() => {}),
    prisma.$executeRawUnsafe('ALTER TABLE `Lead` ADD COLUMN deleted_by VARCHAR(255) NULL').catch(() => {}),
    prisma.$executeRawUnsafe('ALTER TABLE `Lead` ADD COLUMN motivo_exclusao TEXT NULL').catch(() => {}),
  ]).catch(() => {});

  // ── Atribuir / distribuir leads (SUPERVISÃO) ──────────────────────────────
  // Atribui 1 ou vários leads a um vendedor (seta responsavel_id + vendedor_nome,
  // marca atribuido_em e zera atribuicao_vista → vira alerta no sininho do vendedor).
  fastify.post('/leads/atribuir', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({
      lead_ids: z.array(z.string()).min(1),
      vendedor_id: z.string().min(1),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe lead_ids e vendedor_id' });

    // Aceita: (a) qualquer usuário ATIVO do banco (vendedor, ou diretor/CEO que
    // também vende) OU (b) conta de sistema (ex.: Jessica/Diretora, user-jessica),
    // que NÃO está em UsuarioCRM — o dropdown lista as duas, então a atribuição
    // precisa aceitar as duas (antes exigia cargo='VENDEDOR' e dava 404 silencioso).
    let vendedor: { id: string; nome: string } | null = null;
    const vend: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE id = ? AND status = 'ATIVO' LIMIT 1`, body.data.vendedor_id
    ).catch(() => []);
    if (vend.length) {
      vendedor = { id: vend[0].id, nome: vend[0].nome };
    } else if (CONTAS_SISTEMA[body.data.vendedor_id]) {
      vendedor = { id: body.data.vendedor_id, nome: CONTAS_SISTEMA[body.data.vendedor_id].nome };
    }
    if (!vendedor) return reply.status(404).send({ status: 'error', message: 'Vendedor não encontrado ou inativo' });

    const placeholders = body.data.lead_ids.map(() => '?').join(',');
    await prisma.$executeRawUnsafe(
      `UPDATE \`Lead\` SET responsavel_id = ?, vendedor_nome = ?, atribuido_em = NOW(), atribuicao_vista = 0, updated_at = NOW()
       WHERE id IN (${placeholders})`,
      vendedor.id, vendedor.nome, ...body.data.lead_ids
    );
    return reply.send({ status: 'success', data: { atribuidos: body.data.lead_ids.length, vendedor: vendedor.nome } });
  });

  // Distribui igualmente os leads SEM responsável entre os vendedores ativos (round-robin).
  fastify.post('/leads/distribuir', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({
      // opcional: restringir a leads de campanha (sem vendedor) ou a uma lista
      lead_ids: z.array(z.string()).optional(),
      vendedor_ids: z.array(z.string()).optional(),
    }).safeParse(request.body);
    const data = body.success ? body.data : {};

    // Vendedores-alvo
    let vendedores: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE cargo = 'VENDEDOR' AND status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);
    if (data.vendedor_ids?.length) vendedores = vendedores.filter(v => data.vendedor_ids!.includes(v.id));
    if (!vendedores.length) return reply.status(400).send({ status: 'error', message: 'Nenhum vendedor ativo para distribuir' });

    // Leads-alvo: os informados, ou todos sem responsável e ainda em aberto
    const leads = await prisma.lead.findMany({
      where: data.lead_ids?.length
        ? { id: { in: data.lead_ids } }
        : { responsavel_id: null, etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] } },
      select: { id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!leads.length) return reply.send({ status: 'success', data: { distribuidos: 0, por_vendedor: {} } });

    const porVendedor: Record<string, number> = {};
    for (let i = 0; i < leads.length; i++) {
      const v = vendedores[i % vendedores.length];
      await prisma.$executeRawUnsafe(
        `UPDATE \`Lead\` SET responsavel_id = ?, vendedor_nome = ?, atribuido_em = NOW(), atribuicao_vista = 0, updated_at = NOW() WHERE id = ?`,
        v.id, v.nome, leads[i].id
      );
      porVendedor[v.nome] = (porVendedor[v.nome] || 0) + 1;
    }
    return reply.send({ status: 'success', data: { distribuidos: leads.length, por_vendedor: porVendedor } });
  });

  // ── Kanban PRÓPRIO do SDR (etapa_sdr) — separado do funil comercial do
  // vendedor (etapa_comercial). Cada SDR só vê os leads que ele mesmo criou
  // e que ainda não foram distribuídos (etapa_sdr preenchida = passou por um SDR).
  fastify.get('/leads/meu-funil-sdr', async (request, reply) => {
    const user = (request as any).user;
    if (!ehSDR(user?.role) && !podeVerTudo(user)) {
      return reply.status(403).send({ status: 'error', message: 'Restrito a SDR ou supervisão.' });
    }
    const filtroSdrId = podeVerTudo(user) ? (request.query as any)?.sdr_id : user?.id;
    const leads = await prisma.lead.findMany({
      where: {
        deleted_at: null,
        etapa_sdr: { not: null },
        ...(filtroSdrId ? { created_by: filtroSdrId } : {}),
      },
      orderBy: { updated_at: 'desc' },
      include: {
        _count: { select: { atividades: true, propostas: true, observacoes_lead: true } },
        etiquetas_lead: { include: { etiqueta: { select: { id: true, nome: true, cor: true } } } },
      },
    });
    // Some do kanban do SDR assim que distribuído (responsavel_id != created_by);
    // reaparece só via devolver-sdr.
    const visiveis = leads.filter(l => !l.responsavel_id || l.responsavel_id === l.created_by);
    const grouped: Record<string, any[]> = { NOVO_LEAD: [], PRIMEIRO_CONTATO: [], EM_QUALIFICACAO: [], QUALIFICADO: [] };
    for (const lead of visiveis) {
      const etapa = grouped[lead.etapa_sdr || ''] ? lead.etapa_sdr! : 'NOVO_LEAD';
      grouped[etapa].push({ ...lead, completude_pct: calcularCompletude(lead) });
    }
    return reply.send({ status: 'success', data: { leads: grouped } });
  });

  // ── Mover lead dentro do kanban do SDR (drag-and-drop) ────────────────────
  fastify.patch('/leads/:id/etapa-sdr', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ etapa_sdr: z.enum(['NOVO_LEAD', 'PRIMEIRO_CONTATO', 'EM_QUALIFICACAO', 'QUALIFICADO']) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Etapa inválida' });
    const user = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, created_by: true, responsavel_id: true, etapa_sdr: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
    // Só o próprio SDR que criou o lead (ou gestão) pode mover — e só enquanto
    // não tiver sido distribuído (responsavel_id ainda é o próprio SDR ou vazio).
    const podeMover = podeVerTudo(user) || (ehSDR(user?.role) && lead.created_by === user?.id);
    if (!podeMover) return reply.status(403).send({ status: 'error', message: 'Sem permissão para mover este lead.' });
    if (lead.responsavel_id && lead.responsavel_id !== lead.created_by) {
      return reply.status(409).send({ status: 'error', message: 'Lead já distribuído para um vendedor — não pode mais ser movido no funil do SDR.' });
    }

    const updated = await prisma.lead.update({ where: { id }, data: { etapa_sdr: body.data.etapa_sdr } });
    return reply.send({ status: 'success', data: updated });
  });

  // ── Distribuição SDR → Vendedor (com trilha em LeadHistorico) ─────────────
  fastify.post('/leads/:id/distribuir-sdr', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ para_usuario_id: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe para_usuario_id' });
    const ator = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, nome: true, responsavel_id: true, created_by: true, etapa_comercial: true, etapa_sdr: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    const vend: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE id = ? AND status = 'ATIVO' LIMIT 1`, body.data.para_usuario_id
    ).catch(() => []);
    if (!vend.length) return reply.status(404).send({ status: 'error', message: 'Vendedor não encontrado ou inativo' });

    const etapaAnterior = lead.etapa_comercial;
    // Entra no funil do vendedor em QUALIFICADO (não reseta para NOVO_LEAD —
    // isso fazia o card parecer que "voltou pro início", confundindo com o
    // kanban do SDR). etapa_sdr NÃO é tocada aqui: fica como histórico de onde
    // o SDR parou, usado por /devolver-sdr para o lead reaparecer no kanban
    // dele exatamente de onde saiu, caso precise voltar.
    const etapaDestino = 'QUALIFICADO';

    await prisma.lead.update({
      where: { id },
      data: {
        responsavel_id: vend[0].id,
        vendedor_nome: vend[0].nome,
        atribuido_em: new Date(),
        atribuicao_vista: false,
        etapa_comercial: etapaDestino,
      },
    });

    // ETIQUETA "SDR: <nome>" — identifica de onde o lead veio no quadro do
    // vendedor. Uma etiqueta por SDR, criada na primeira distribuição e
    // reaproveitada depois (mesmo padrão da etiqueta automática "Cliente Convertido").
    const sdr: any[] = lead.created_by
      ? await prisma.$queryRawUnsafe(`SELECT id, nome FROM UsuarioCRM WHERE id = ? LIMIT 1`, lead.created_by).catch(() => [])
      : [];
    if (sdr.length) {
      try {
        const nomeEtiqueta = `SDR: ${sdr[0].nome}`;
        let etq = await prisma.etiqueta.findFirst({ where: { nome: nomeEtiqueta, sistema: true } });
        if (!etq) {
          etq = await prisma.etiqueta.create({
            data: { nome: nomeEtiqueta, cor: '#7c3aed', tipo: 'LEAD', sistema: true, descricao: `Lead prospectado pelo SDR ${sdr[0].nome}.`, created_by: 'system' },
          });
        }
        await prisma.leadEtiquetaAplicada.upsert({
          where: { lead_id_etiqueta_id: { lead_id: id, etiqueta_id: etq.id } },
          create: { lead_id: id, etiqueta_id: etq.id },
          update: {},
        });
      } catch (e: any) { console.error('[ETIQUETA-SDR]', e?.message); }
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO LeadHistorico (id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      randomUUID(), id, lead.nome, 'DISTRIBUICAO_SDR', etapaAnterior, etapaDestino,
      ator?.id || null, ator?.nome || 'Sistema',
      JSON.stringify({ de_usuario_id: lead.responsavel_id || null, para_usuario_id: vend[0].id, para_usuario_nome: vend[0].nome }),
    ).catch(() => {});

    return reply.send({ status: 'success', data: { lead_id: id, vendedor: vend[0].nome } });
  });

  // ── Devolução SDR ← Supervisão (com motivo + observação de sistema) ───────
  fastify.post('/leads/:id/devolver-sdr', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ motivo: z.string().min(5, 'Descreva o motivo (mínimo 5 caracteres)') }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Motivo obrigatório' });
    const ator = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, nome: true, created_by: true, responsavel_id: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    await prisma.lead.update({
      where: { id },
      data: { responsavel_id: lead.created_by, atribuido_em: new Date(), atribuicao_vista: false },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO LeadHistorico (id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      randomUUID(), id, lead.nome, 'DEVOLUCAO_SDR', null, null,
      ator?.id || null, ator?.nome || 'Sistema',
      JSON.stringify({ de_usuario_id: lead.responsavel_id || null, para_usuario_id: lead.created_by, motivo: body.data.motivo }),
    ).catch(() => {});

    await prisma.leadObservacao.create({
      data: {
        lead_id: id, tipo: 'SISTEMA',
        descricao: `Lead devolvido pela supervisão: ${body.data.motivo}`,
        created_by: ator?.id || 'system', created_by_name: ator?.nome || 'Sistema',
      },
    });

    return reply.send({ status: 'success', data: { lead_id: id, devolvido_para: lead.created_by } });
  });

  // ── Leads qualificados prontos para distribuir (SDR → supervisão → vendedor) ──
  // Filtra por etapa_sdr (kanban próprio do SDR), não etapa_comercial — desde
  // que distribuir-sdr passou a setar etapa_comercial=QUALIFICADO também no
  // vendedor, usar esse campo aqui pegaria leads já distribuídos de novo.
  // A condição extra (responsavel_id == created_by, ou seja, ainda com o
  // próprio SDR) garante que um lead já distribuído não volte pra fila.
  fastify.get('/leads/prontos-para-distribuir', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const candidatos = await prisma.lead.findMany({
      where: { etapa_sdr: 'QUALIFICADO', deleted_at: null },
      orderBy: { created_at: 'asc' },
    });
    // Prisma não compara duas colunas da mesma linha diretamente — filtra em
    // memória (volume é baixo: fila de distribuição, não a base toda).
    const leads = candidatos.filter(l => !l.responsavel_id || l.responsavel_id === l.created_by);
    const data = leads.map(l => ({ ...l, completude_pct: calcularCompletude(l) }));
    return reply.send({ status: 'success', data });
  });

  // ── AUDITORIA / TRILHA do lead (entrada → assinatura, tempo por etapa) ─────
  fastify.get('/leads/:id/auditoria', async (request, reply) => {
    const { id } = request.params as { id: string };
    // Escopo: vendedor só audita os próprios leads; gestor, qualquer um.
    const esc = ownerWhere(request, 'Lead');
    const lead = await prisma.lead.findFirst({ where: { id, ...esc }, select: { id: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado ou sem acesso' });

    // Trilha completa (todas as ações: etapas, alterações de dados, atribuição…)
    const trilha: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes, created_at
       FROM LeadHistorico WHERE lead_id = ? ORDER BY created_at ASC`, id
    ).catch(() => []);
    // Observações do sistema também entram na trilha (coluna/temperatura/contatos)
    const obs = await prisma.leadObservacao.findMany({
      where: { lead_id: id }, orderBy: { created_at: 'asc' },
      select: { id: true, tipo: true, descricao: true, created_by_name: true, created_at: true,
                coluna_anterior: true, coluna_nova: true, temperatura_anterior: true, temperatura_nova: true },
    });
    const ciclo = await calcularCicloLead(prisma, id);

    return reply.send({ status: 'success', data: { trilha, observacoes: obs, ciclo } });
  });

  // ── RELATÓRIO DE CICLO DE VENDAS (agregado, SUPERVISÃO) ───────────────────
  fastify.get('/leads/ciclo-vendas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = request.query as { data_inicio?: string; data_fim?: string };

    const where: any = {};
    if (q.data_inicio || q.data_fim) {
      where.created_at = {};
      if (q.data_inicio) where.created_at.gte = new Date(q.data_inicio);
      if (q.data_fim) where.created_at.lte = new Date(q.data_fim);
    }
    const leads = await prisma.lead.findMany({
      where, select: { id: true }, orderBy: { created_at: 'desc' }, take: 1000,
    });

    // Acumula tempo por etapa e ciclo total dos leads que já fecharam (assinatura)
    const porEtapa: Record<string, { totalDias: number; n: number }> = {};
    let ciclosFechados: number[] = [];
    let fechados = 0, emAberto = 0;

    for (const l of leads) {
      const c = await calcularCicloLead(prisma, l.id);
      if (!c) continue;
      for (const e of c.etapas) {
        if (!porEtapa[e.etapa]) porEtapa[e.etapa] = { totalDias: 0, n: 0 };
        porEtapa[e.etapa].totalDias += e.dias;
        porEtapa[e.etapa].n += 1;
      }
      if (c.assinado_em && c.ciclo_dias != null) { ciclosFechados.push(c.ciclo_dias); fechados++; }
      else if (c.em_aberto) emAberto++;
    }

    const tempo_medio_por_etapa = Object.entries(porEtapa)
      .map(([etapa, v]) => ({ etapa, dias_medio: +(v.totalDias / Math.max(1, v.n)).toFixed(1), amostras: v.n }))
      .sort((a, b) => b.dias_medio - a.dias_medio);
    const ciclo_medio_dias = ciclosFechados.length
      ? +(ciclosFechados.reduce((s, d) => s + d, 0) / ciclosFechados.length).toFixed(1) : 0;
    const ciclo_min = ciclosFechados.length ? +Math.min(...ciclosFechados).toFixed(1) : 0;
    const ciclo_max = ciclosFechados.length ? +Math.max(...ciclosFechados).toFixed(1) : 0;

    return reply.send({
      status: 'success',
      data: {
        total_leads: leads.length,
        fechados, em_aberto: emAberto,
        ciclo_medio_dias, ciclo_min, ciclo_max,
        tempo_medio_por_etapa,
      },
    });
  });

  // List leads ────────────────────────────────────────────────────────────
  fastify.get('/leads', async (request, reply) => {
    const q = ListLeadSchema.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });
    const { page, limit, status, etapa_comercial, etapa_funil, temperatura, search, responsavel_id } = q.data;

    const where: any = {};
    if (status) where.status = status;
    if (etapa_comercial) where.etapa_comercial = etapa_comercial;
    if (etapa_funil) where.etapa_funil = etapa_funil;
    if (temperatura) where.temperatura = temperatura;
    if (responsavel_id) where.responsavel_id = responsavel_id;
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { razao_social: { contains: search, mode: 'insensitive' } },
        { empresa: { contains: search, mode: 'insensitive' } },
        { responsavel_email: { contains: search, mode: 'insensitive' } },
        { responsavel_telefone: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Escopo: vendedor só vê os próprios leads; gestor vê todos.
    // (usa AND para não conflitar com o OR da busca textual)
    const escopo = ownerWhere(request, 'Lead');
    if (escopo.OR || escopo.responsavel_id || escopo.created_by) {
      where.AND = [...(where.AND || []), escopo];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where, skip: page * limit, take: limit,
        orderBy: { updated_at: 'desc' },
        include: { _count: { select: { atividades: true, propostas: true, observacoes_lead: true } } },
      }),
      prisma.lead.count({ where }),
    ]);

    const leadsComCompletude = leads.map(lead => ({ ...lead, completude_pct: calcularCompletude(lead) }));

    return reply.send({ status: 'success', data: { leads: leadsComCompletude, total, page, limit } });
  });

  // ── Kanban — all leads grouped by etapa_comercial ─────────────────────────
  fastify.get('/leads/kanban', async (request, reply) => {
    // Filtro opcional por vendedor (Total x por usuário) — só faz efeito p/ gestor;
    // vendedor já fica limitado ao próprio funil pelo ownerWhere.
    const q = request.query as { responsavel_id?: string };
    const user = (request as any).user;
    const filtroResp = q.responsavel_id && podeVerTudo(user) ? { responsavel_id: q.responsavel_id } : {};
    const leads = await prisma.lead.findMany({
      where: { ...ownerWhere(request, 'Lead'), ...filtroResp },  // vendedor: só o próprio funil
      orderBy: { updated_at: 'desc' },
      include: {
        _count: { select: { atividades: true, propostas: true, observacoes_lead: true } },
        execucao: { select: { status: true, tecnico_nome: true } },
        etiquetas_lead: {
          include: { etiqueta: { select: { id: true, nome: true, cor: true } } },
        },
      },
    });

    // Fetch all active columns from DB (user-configured)
    let colunas = await prisma.kanbanColuna.findMany({
      where: { ativa: true }, orderBy: { ordem: 'asc' },
    });

    // Salvaguarda: se o quadro não tem nenhuma coluna (base nova ou seed não rodou),
    // cria as padrão na hora — senão o lead criado fica órfão (card invisível).
    if (colunas.length === 0) {
      const PADRAO = [
        { chave: 'NOVO_LEAD',          nome: 'Novo Lead',          cor: '#6b7280', ordem: 0 },
        { chave: 'PRIMEIRO_CONTATO',   nome: 'Primeiro Contato',   cor: '#2563eb', ordem: 1 },
        { chave: 'EM_ATENDIMENTO',     nome: 'Em Atendimento',     cor: '#7c3aed', ordem: 2 },
        { chave: 'AGUARDANDO_RETORNO', nome: 'Aguardando Retorno', cor: '#d97706', ordem: 3 },
        { chave: 'PROPOSTA_A_GERAR',   nome: 'Proposta a Gerar',   cor: '#0891b2', ordem: 4 },
        { chave: 'PROPOSTA_ENVIADA',   nome: 'Proposta Enviada',   cor: '#4B8EC8', ordem: 5 },
        { chave: 'EM_NEGOCIACAO',      nome: 'Em Negociação',      cor: '#dc2626', ordem: 6 },
        { chave: 'FECHADO',            nome: 'Fechado',            cor: '#15803d', ordem: 7 },
        { chave: 'PERDIDO',            nome: 'Perdido',            cor: '#9ca3af', ordem: 8 },
      ];
      await prisma.kanbanColuna.createMany({
        data: PADRAO.map(c => ({ ...c, created_by: 'system' })),
        skipDuplicates: true,
      }).catch(() => {});
      colunas = await prisma.kanbanColuna.findMany({ where: { ativa: true }, orderBy: { ordem: 'asc' } });
    }

    const grouped: Record<string, any[]> = {};
    for (const col of colunas) grouped[col.chave] = [];

    // Mapeia etapas legadas/órfãs (que não têm coluna própria) para uma coluna válida,
    // para o lead NUNCA sumir do quadro. Ex.: 'ACEITO' (fluxo antigo) → FECHADO/GANHO.
    const chaves = new Set(colunas.map(c => c.chave));
    const primeiraChave = colunas[0]?.chave;
    const mapEtapa = (etapa: string | null, status: string | null): string => {
      if (etapa && chaves.has(etapa)) return etapa;
      if (status === 'GANHO' && chaves.has('FECHADO')) return 'FECHADO';
      if (status === 'PERDIDO' && chaves.has('PERDIDO')) return 'PERDIDO';
      if (etapa === 'ACEITO') return chaves.has('FECHADO') ? 'FECHADO' : (chaves.has('EM_NEGOCIACAO') ? 'EM_NEGOCIACAO' : primeiraChave);
      return chaves.has('NOVO_LEAD') ? 'NOVO_LEAD' : primeiraChave;
    };

    for (const lead of leads) {
      const col = mapEtapa(lead.etapa_comercial, (lead as any).status);
      if (!grouped[col]) grouped[col] = [];
      grouped[col].push({ ...lead, completude_pct: calcularCompletude(lead) });
    }

    return reply.send({ status: 'success', data: { leads: grouped, colunas } });
  });

  // ── Lead detail ───────────────────────────────────────────────────────────
  fastify.get('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        atividades:    { orderBy: { created_at: 'desc' } },
        propostas:     { orderBy: { created_at: 'desc' } },
        contrato:      true,
        onboarding:    true,
        execucao:      true,
        observacoes_lead: { orderBy: { created_at: 'desc' } },
        etiquetas_lead: { include: { etiqueta: true } },
        _count: { select: { atividades: true, propostas: true, observacoes_lead: true } },
      },
    });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    // Vendedor abriu o lead recém-atribuído → marca como visto (some do sininho).
    const uid = (request as any).user?.id;
    if (uid && (lead.responsavel_id === uid || lead.created_by === uid)) {
      prisma.$executeRawUnsafe(`UPDATE \`Lead\` SET atribuicao_vista = 1 WHERE id = ? AND atribuicao_vista = 0`, id).catch(() => {});
    }

    return reply.send({ status: 'success', data: { ...lead, completude_pct: calcularCompletude(lead) } });
  });

  // ── Create lead ───────────────────────────────────────────────────────────
  fastify.post('/leads', async (request, reply) => {
    const body = LeadSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    if (bloqueadoParaFecharSeSDR(user?.role, body.data.etapa_comercial)) {
      return reply.status(403).send({ status: 'error', message: 'SDR não pode fechar leads — encaminhe para um vendedor.' });
    }
    const data: any = { ...body.data, created_by: user?.id || 'system' };
    if (data.email === '') delete data.email;
    if (data.responsavel_email === '') delete data.responsavel_email;
    // Campos Json obrigatórios no schema — default vazio
    if (data.modulos_inclusos === undefined) data.modulos_inclusos = {};
    if (data.servicos_adicionais === undefined) data.servicos_adicionais = {};

    // ATRIBUIÇÃO AUTOMÁTICA: lead gerado por um VENDEDOR já nasce atribuído a ele
    // (responsavel_id + vendedor_nome), p/ aparecer no nome dele no quadro de
    // supervisão/CEO. Gestor que cria pode atribuir a outro (respeita o enviado).
    if (!data.responsavel_id && user?.id && !podeVerTudo(user)) {
      data.responsavel_id = user.id;
      if (!data.vendedor_nome && user?.nome) data.vendedor_nome = user.nome;
      if (!data.atribuido_em) data.atribuido_em = new Date();
    }

    // Lead cadastrado por um SDR nasce no kanban PRÓPRIO dele (etapa_sdr), não
    // no funil comercial do vendedor — etapa_comercial fica no default do
    // schema e só passa a valer quando a supervisão distribui o lead.
    if (ehSDR(user?.role) && !data.etapa_sdr) {
      data.etapa_sdr = 'NOVO_LEAD';
    }

    // ANTI-DUPLICAÇÃO (clique duplo/retry): MESMO usuário + MESMO nome nos
    // últimos 10s é quase certamente o mesmo clique processado 2x — devolve o
    // lead já existente. Janela curta pra não barrar homônimos legítimos.
    const duplicadoRapido = await prisma.lead.findFirst({
      where: {
        created_by: data.created_by,
        nome: data.nome,
        deleted_at: null,
        created_at: { gte: new Date(Date.now() - 10_000) },
      },
      orderBy: { created_at: 'desc' },
    });
    if (duplicadoRapido) {
      return reply.status(201).send({ status: 'success', data: duplicadoRapido });
    }

    // ANTI-DUPLICAÇÃO (mesmo CNPJ já cadastrado): sem limite de tempo — CNPJ é
    // identificador único de empresa, então reenviar o mesmo lead minutos/horas
    // depois (ex.: SDR não percebendo que já salvou) também é bloqueado.
    if (data.cnpj) {
      const cnpjLimpo = String(data.cnpj).replace(/\D/g, '');
      if (cnpjLimpo) {
        const rows = await prisma.$queryRaw<Array<{ id: string; nome: string }>>`
          SELECT id, nome FROM \`Lead\`
          WHERE deleted_at IS NULL
            AND REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ${cnpjLimpo}
          LIMIT 1
        `;
        const duplicadoCnpj = rows[0];
        if (duplicadoCnpj) {
          return reply.status(409).send({
            status: 'error',
            message: `Já existe um lead cadastrado para este CNPJ: "${duplicadoCnpj.nome}".`,
            data: duplicadoCnpj,
          });
        }
      }
    }

    // AVISO (não bloqueio) por telefone/e-mail já cadastrado em outro lead —
    // diferente do CNPJ, pode ser contato legítimo repetido (ex.: mesmo
    // celular usado por dois responsáveis). `?confirmar_duplicata=true` pula
    // essa checagem, para o vendedor confirmar "é intencional, criar mesmo assim".
    const confirmarDuplicata = (request.query as any)?.confirmar_duplicata === 'true';
    if (!confirmarDuplicata) {
      const duplicatas = await acharPossiveisDuplicatas(prisma, data);
      if (duplicatas.length > 0) {
        return reply.status(200).send({
          status: 'aviso_duplicata',
          message: duplicatas.map(d => `Já existe um lead com o mesmo ${d.campo}: "${d.lead.nome}".`).join(' '),
          duplicatas,
        });
      }
    }

    const lead = await prisma.lead.create({ data });

    await registrarObsSistema(prisma, lead.id, 'SISTEMA', 'Lead cadastrado no CRM.', user?.id);

    return reply.status(201).send({ status: 'success', data: lead });
  });

  // ── Webhook externo (gerador de leads automatizado, ex.: ChatGPT/Zapier) ───
  // Rota de sistema-para-sistema, sem sessão de usuário e SEM chave de acesso
  // (decisão explícita do usuário — qualquer chamada externa é aceita).
  // Aceita qualquer JSON: os campos conhecidos do Lead são mapeados direto;
  // tudo que sobra (não bate com nenhuma coluna) é anexado em `observacoes`
  // como texto formatado, pra nada que o gerador retornar se perca.
  fastify.post('/leads/webhook-externo', async (request, reply) => {
    const bodyBruto = request.body as Record<string, any> | null;
    if (!bodyBruto || typeof bodyBruto !== 'object') {
      return reply.status(400).send({ status: 'error', message: 'Corpo da requisição deve ser um objeto JSON' });
    }

    const body = LeadSchema.partial({ origem: true }).safeParse(bodyBruto);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });
    if (!body.data.nome) {
      return reply.status(400).send({ status: 'error', message: 'Campo "nome" é obrigatório' });
    }

    // Campos reconhecidos pelo schema (já mapeados em body.data) não entram de
    // novo no "sobra" — só o que o gerador mandou e o Lead não tem coluna pra.
    const camposReconhecidos = new Set(Object.keys(LeadSchema.shape));
    const camposExtras = Object.fromEntries(
      Object.entries(bodyBruto).filter(([chave]) => !camposReconhecidos.has(chave))
    );

    const data: any = { ...body.data, created_by: 'system', origem: body.data.origem || 'CHATGPT' };
    if (data.email === '') delete data.email;
    if (data.responsavel_email === '') delete data.responsavel_email;
    if (data.modulos_inclusos === undefined) data.modulos_inclusos = {};
    if (data.servicos_adicionais === undefined) data.servicos_adicionais = {};

    if (Object.keys(camposExtras).length > 0) {
      const extrasFormatados = Object.entries(camposExtras)
        .map(([chave, valor]) => `${chave}: ${typeof valor === 'object' ? JSON.stringify(valor) : valor}`)
        .join('\n');
      data.observacoes = [data.observacoes, `[Dados adicionais do gerador de leads]\n${extrasFormatados}`]
        .filter(Boolean)
        .join('\n\n');
    }

    // ANTI-DUPLICAÇÃO: mesmo CNPJ (se veio) já cadastrado.
    if (data.cnpj) {
      const cnpjLimpo = String(data.cnpj).replace(/\D/g, '');
      if (cnpjLimpo) {
        const rows = await prisma.$queryRaw<Array<{ id: string; nome: string }>>`
          SELECT id, nome FROM \`Lead\`
          WHERE deleted_at IS NULL
            AND REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ${cnpjLimpo}
          LIMIT 1
        `;
        if (rows[0]) {
          return reply.status(409).send({
            status: 'error',
            message: `Já existe um lead cadastrado para este CNPJ: "${rows[0].nome}".`,
            data: rows[0],
          });
        }
      }
    }

    // ANTI-DUPLICAÇÃO: mesmo telefone ou email já cadastrado (o gerador externo
    // não garante CNPJ, então telefone/email são o identificador mais confiável).
    if (data.telefone || data.email) {
      const duplicadoContato = await prisma.lead.findFirst({
        where: {
          deleted_at: null,
          OR: [
            data.telefone ? { telefone: data.telefone } : undefined,
            data.email ? { email: data.email } : undefined,
          ].filter(Boolean) as any,
        },
        select: { id: true, nome: true },
      });
      if (duplicadoContato) {
        return reply.status(409).send({
          status: 'error',
          message: `Já existe um lead cadastrado com este contato: "${duplicadoContato.nome}".`,
          data: duplicadoContato,
        });
      }
    }

    const lead = await prisma.lead.create({ data });
    await registrarObsSistema(prisma, lead.id, 'SISTEMA', 'Lead recebido via webhook externo (gerador automático).');

    return reply.status(201).send({ status: 'success', data: lead });
  });

  // ── Update lead ───────────────────────────────────────────────────────────
  fastify.patch('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const limpo = sanitizarBodyLead(request.body);
    const body = UpdateLeadSchema.safeParse(limpo);
    if (!body.success) {
      // Loga o motivo REAL (campo + erro) para nunca mais falhar em silêncio,
      // e devolve a mensagem ao front para o usuário ver o que travou.
      const issues = body.error.issues.map(i => `${i.path.join('.') || '(raiz)'}: ${i.message}`);
      console.warn('[PATCH /leads] validação falhou:', issues.join(' | '));
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos', detalhes: issues });
    }

    const user = (request as any).user;
    if (bloqueadoParaFecharSeSDR(user?.role, body.data.etapa_comercial)) {
      return reply.status(403).send({ status: 'error', message: 'SDR não pode fechar leads — encaminhe para um vendedor.' });
    }
    try {
      const data: any = { ...body.data };
      if (data.email === '') delete data.email;
      if (data.responsavel_email === '') delete data.responsavel_email;

      // Snapshot completo ANTES (para auditoria campo-a-campo)
      const before = await prisma.lead.findUnique({ where: { id } });
      const lead = await prisma.lead.update({ where: { id }, data });

      // Trilha de auditoria: registra cada campo alterado (quem, quando, de→para)
      if (before) {
        await auditarAlteracoesLead(prisma, id, before.nome, before as any, data, { id: user?.id, nome: user?.nome });
      }

      // Auto-register column change
      if (before && data.etapa_comercial && data.etapa_comercial !== before.etapa_comercial) {
        await prisma.leadObservacao.create({
          data: {
            lead_id: id, tipo: 'SISTEMA',
            descricao: `Coluna alterada: ${before.etapa_comercial} → ${data.etapa_comercial}`,
            coluna_anterior: before.etapa_comercial,
            coluna_nova: data.etapa_comercial,
            created_by: user?.id || 'system', created_by_name: 'Sistema',
          },
        });
        await prisma.lead.update({ where: { id }, data: { ultima_obs_at: new Date() } });

        // ETIQUETA AUTOMÁTICA: lead que chega na etapa de fechamento vira
        // "Cliente Convertido" (radar de conversões). Idempotente.
        const ETAPAS_FECHAMENTO = ['CONTRATO_ASSINADO', 'ACEITO', 'FECHADO', 'CONTRATO_EM_ANDAMENTO'];
        if (ETAPAS_FECHAMENTO.includes(data.etapa_comercial)) {
          try {
            let etq = await prisma.etiqueta.findFirst({ where: { nome: 'Cliente Convertido', sistema: true } });
            if (!etq) {
              etq = await prisma.etiqueta.create({
                data: { nome: 'Cliente Convertido', cor: '#15803d', tipo: 'CLIENTE', sistema: true, descricao: 'Aplicada automaticamente quando o lead fecha contrato.', created_by: 'system' },
              });
            }
            await prisma.leadEtiquetaAplicada.upsert({
              where: { lead_id_etiqueta_id: { lead_id: id, etiqueta_id: etq.id } },
              create: { lead_id: id, etiqueta_id: etq.id },
              update: {},
            });
          } catch (e: any) { console.error('[ETIQUETA-AUTO]', e?.message); }
        }
      }

      // Auto-register temperature change
      if (before && data.temperatura) {
        await registrarMudancaTemperatura(prisma, {
          leadId: id,
          temperaturaAnterior: before.temperatura,
          temperaturaNova: data.temperatura,
          autorId: user?.id,
          autorNome: user?.nome || 'Sistema',
        });
      }

      // Ao mover pra etapa PERDIDO, sincroniza status_atendimento E status (campo raiz
      // usado em filtros de pipeline/dashboard — sem isso o lead some do funil visual
      // mas continua contando como "ativo" em qualquer relatório que filtre por status).
      if (data.etapa_comercial === 'PERDIDO') {
        const syncData: any = {};
        if (!data.status_atendimento) syncData.status_atendimento = 'PERDIDO';
        if (!data.status) syncData.status = 'PERDIDO';
        if (Object.keys(syncData).length > 0) {
          await prisma.lead.update({ where: { id }, data: syncData });
        }
      }

      return reply.send({ status: 'success', data: lead });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });

  // ── Delete lead ───────────────────────────────────────────────────────────
  // Exclusão LÓGICA: o lead sai de TODOS os resultados (listas, quadro, dashboard,
  // metas) mas permanece na AUDITORIA/trilha. Registra ator, data e motivo.
  fastify.delete('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const motivo = (request.body as any)?.motivo as string | undefined;
    const ator = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, nome: true, etapa_funil: true, responsavel_id: true, created_by: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    // Gestão comercial exclui qualquer lead. Vendedor só pode excluir o próprio
    // (responsável ou quem criou) — evita apagar lead de colega por engano/má-fé.
    const ehDono = ator?.id && (lead.responsavel_id === ator.id || lead.created_by === ator.id);
    if (!podeVerTudo(ator) && !ehDono) {
      return reply.status(403).send({ status: 'error', message: 'Você só pode excluir leads pelos quais é responsável' });
    }
    if (!motivo || !motivo.trim()) {
      return reply.status(400).send({ status: 'error', message: 'Informe o motivo da exclusão' });
    }

    await prisma.$executeRawUnsafe(
      'UPDATE `Lead` SET deleted_at = NOW(), deleted_by = ?, motivo_exclusao = ?, updated_at = NOW() WHERE id = ?',
      ator?.id || 'sistema', motivo || null, id,
    );

    // Registra na trilha/auditoria do lead.
    await prisma.$executeRawUnsafe(
      `INSERT INTO LeadHistorico (id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      randomUUID(), id, lead.nome || null, 'EXCLUIU_LEAD',
      lead.etapa_funil || null, lead.etapa_funil || null,
      ator?.id || null, ator?.nome || 'Sistema',
      JSON.stringify({ motivo: motivo || null }),
    ).catch(() => {});

    return reply.send({ status: 'success', message: 'Lead excluído (mantido apenas na auditoria)' });
  });

  // ── Observações (timeline) ────────────────────────────────────────────────
  fastify.get('/leads/:id/observacoes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const obs = await prisma.leadObservacao.findMany({
      where: { lead_id: id },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: obs });
  });

  fastify.post('/leads/:id/observacoes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ObservacaoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    // Converte a data (se vier) com segurança; string inválida vira undefined.
    const { data_proximo_retorno, ...resto } = body.data;
    let proximoRetorno: Date | undefined;
    if (data_proximo_retorno) {
      const dt = new Date(data_proximo_retorno);
      if (!isNaN(dt.getTime())) proximoRetorno = dt;
    }
    const obs = await prisma.leadObservacao.create({
      data: {
        lead_id: id,
        ...resto,
        data_proximo_retorno: proximoRetorno,
        created_by: user?.id || 'system',
        created_by_name: body.data.created_by_name || user?.nome || 'Usuário',
      },
    });

    const update: any = { ultima_obs_at: new Date() };
    if (proximoRetorno) update.proximo_contato = proximoRetorno;
    if (body.data.status_apos) {
      const etapaMap: Record<string, string> = {
        'EM_NEGOCIACAO': 'EM_NEGOCIACAO', 'ACEITO': 'ACEITO',
        'PROPOSTA_ENVIADA': 'PROPOSTA_ENVIADA', 'PERDIDO': 'PERDIDO',
      };
      if (etapaMap[body.data.status_apos]) update.etapa_comercial = etapaMap[body.data.status_apos];
    }
    await prisma.lead.update({ where: { id }, data: update });

    return reply.status(201).send({ status: 'success', data: obs });
  });

  // ── Onboarding ────────────────────────────────────────────────────────────
  fastify.get('/leads/:id/onboarding', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ob = await prisma.leadOnboarding.findUnique({ where: { lead_id: id } });
    return reply.send({ status: 'success', data: ob });
  });

  fastify.put('/leads/:id/onboarding', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = OnboardingSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const data: any = { ...body.data };
    if (data.data_prevista_implantacao) data.data_prevista_implantacao = new Date(data.data_prevista_implantacao);

    const ob = await prisma.leadOnboarding.upsert({
      where:  { lead_id: id },
      create: { lead_id: id, ...data, created_by: user?.id || 'system' },
      update: data,
    });

    if (data.status === 'CONCLUIDO') {
      await registrarObsSistema(prisma, id, 'SISTEMA', 'Onboarding concluído.', user?.id);
    }

    return reply.send({ status: 'success', data: ob });
  });

  // ── Enviar para execução técnica ──────────────────────────────────────────
  fastify.post('/leads/:id/enviar-execucao', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const existing = await prisma.execucaoTecnica.findUnique({ where: { lead_id: id } });
    if (!existing) {
      await prisma.execucaoTecnica.create({
        data: { lead_id: id, status: 'AGUARDANDO_DESIGNACAO', created_by: user?.id || 'system' },
      });
    }
    await prisma.lead.update({ where: { id }, data: { etapa_comercial: 'EXECUCAO_TECNICA' } });
    await registrarObsSistema(prisma, id, 'SISTEMA', 'Card enviado para Execução Técnica.', user?.id);

    return reply.send({ status: 'success', message: 'Enviado para execução' });
  });

  // ── Execução técnica ──────────────────────────────────────────────────────
  fastify.get('/leads/:id/execucao', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ex = await prisma.execucaoTecnica.findUnique({ where: { lead_id: id } });
    return reply.send({ status: 'success', data: ex });
  });

  fastify.put('/leads/:id/execucao', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ExecucaoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const data: any = { ...body.data };
    if (data.data_prevista_inicio)    data.data_prevista_inicio    = new Date(data.data_prevista_inicio);
    if (data.data_prevista_conclusao) data.data_prevista_conclusao = new Date(data.data_prevista_conclusao);

    const ex = await prisma.execucaoTecnica.upsert({
      where:  { lead_id: id },
      create: { lead_id: id, ...data, created_by: user?.id || 'system' },
      update: data,
    });

    if (data.tecnico_nome) {
      await registrarObsSistema(prisma, id, 'SISTEMA', `Técnico designado: ${data.tecnico_nome}.`, user?.id);
    }
    if (data.status === 'FINALIZADO') {
      await registrarObsSistema(prisma, id, 'SISTEMA', 'Execução técnica finalizada.', user?.id);
    }

    return reply.send({ status: 'success', data: ex });
  });

  // ── Gerar proposta a partir do lead ──────────────────────────────────────
  fastify.post('/leads/:id/gerar-proposta', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    const crypto = await import('crypto');
    const token = crypto.default.randomBytes(20).toString('hex');

    const proposta = await prisma.propostaComercial.create({
      data: {
        razao_social:      lead.razao_social || lead.empresa || lead.nome,
        nome_fantasia:     lead.nome_fantasia || undefined,
        cnpj:              lead.cnpj || undefined,
        segmento:          lead.segmento || undefined,
        cidade:            lead.cidade || undefined,
        estado:            lead.estado || undefined,
        maquinas:          lead.qtd_caixas || undefined,
        tipo_loja:         lead.tipo_oportunidade || undefined,
        sistema_atual:     lead.sistema_atual || undefined,
        responsavel_nome:  lead.responsavel_nome || lead.nome,
        responsavel_telefone: lead.responsavel_telefone || lead.telefone || undefined,
        responsavel_email: lead.responsavel_email || lead.email || undefined,
        responsavel_cargo: lead.responsavel_cargo || lead.cargo || undefined,
        responsavel_horario: lead.responsavel_horario || undefined,
        vendedor_nome:     lead.vendedor_nome || undefined,
        vendedor_telefone: lead.vendedor_telefone || undefined,
        supervisor_nome:   lead.supervisor_nome || undefined,
        campanha:          lead.campanha || undefined,
        validade:          lead.validade_proposta || undefined,
        origem:            lead.origem || undefined,
        plano_selecionado: lead.plano_indicado || undefined,
        plano_recomendado: lead.plano_recomendado || undefined,
        mensalidade_plus:  lead.mensalidade_estimada || undefined,
        modulos_inclusos:  lead.modulos_inclusos,
        servicos_adicionais: lead.servicos_adicionais,
        valor_implantacao: lead.valor_setup || undefined,
        valor_conversao:   lead.valor_conversao || undefined,
        entrada:           lead.entrada || undefined,
        parcelas:          lead.parcelamento || undefined,
        condicao_especial: lead.condicao_especial || undefined,
        observacoes_comerciais: lead.observacoes_comerciais || undefined,
        frase_hero:        lead.frase_hero || undefined,
        texto_valor:       lead.texto_valor || undefined,
        public_token:      token,
        status:            'RASCUNHO',
        created_by:        user?.id || 'system',
        created_by_name:   user?.nome || undefined,
      },
    });

    await prisma.lead.update({ where: { id }, data: { etapa_comercial: 'PROPOSTA_A_GERAR' } });
    await registrarObsSistema(prisma, id, 'SISTEMA', `Proposta gerada automaticamente (ID: ${proposta.id}).`, user?.id);

    return reply.status(201).send({ status: 'success', data: proposta });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  fastify.get('/leads/stats/resumo', async (request, reply) => {
    // Vendedor: estatísticas só dos próprios leads; gestor: de todos.
    const esc = ownerWhere(request, 'Lead');
    const [total, novos, qualificados, ganhos, perdidos, emContato] = await Promise.all([
      prisma.lead.count({ where: { ...esc } }),
      prisma.lead.count({ where: { etapa_comercial: 'NOVO_LEAD', ...esc } }),
      prisma.lead.count({ where: { status: 'QUALIFICADO', ...esc } }),
      prisma.lead.count({ where: { status: 'GANHO', ...esc } }),
      prisma.lead.count({ where: { etapa_comercial: 'PERDIDO', ...esc } }),
      prisma.lead.count({ where: { etapa_comercial: 'EM_ATENDIMENTO', ...esc } }),
    ]);

    const [valorPipeline, valorGanho] = await Promise.all([
      prisma.lead.aggregate({ _sum: { valor_estimado: true }, where: { status: { notIn: ['GANHO','PERDIDO'] }, ...esc } }),
      prisma.lead.aggregate({ _sum: { valor_estimado: true }, where: { status: 'GANHO', ...esc } }),
    ]);

    return reply.send({
      status: 'success',
      data: {
        total, novos, qualificados, ganhos, perdidos, emContato,
        valor_pipeline: valorPipeline._sum.valor_estimado || 0,
        valor_ganho:    valorGanho._sum.valor_estimado || 0,
        taxa_conversao: total > 0 ? ((ganhos / total) * 100).toFixed(1) : '0',
      },
    });
  });

  // ── Fechar venda (marcar lead como ACEITO/GANHO) ──────────────────────────
  const FechamentoSchema = z.object({
    plano: z.enum(['BASIC', 'MEI', 'PRO', 'PLUS']),
    valor_instalacao: z.number().min(0),
    mrr: z.number().min(0),
    valor_entrada: z.number().min(0),
    forma_entrada: z.enum(['PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA']),
    parcelas_instalacao: z.number().int().min(1).max(36).default(1),
    data_1cob: z.string().datetime().optional(),
    observacoes: z.string().optional()
  });

  fastify.post('/leads/:id/fechar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    if ((user?.role || '').toUpperCase() === 'SDR') {
      return reply.status(403).send({ status: 'error', message: 'SDR não pode fechar leads — encaminhe para um vendedor.' });
    }
    const body = FechamentoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: {
          status: 'GANHO',
          etapa_funil: 'FECHAMENTO',
          etapa_comercial: 'ACEITO',
          status_atendimento: 'ACEITO',
          fechamento_plano: body.data.plano,
          fechamento_valor_inst: body.data.valor_instalacao,
          fechamento_mrr: body.data.mrr,
          fechamento_valor_entrada: body.data.valor_entrada,
          fechamento_forma_entrada: body.data.forma_entrada,
          fechamento_parcelas_inst: body.data.parcelas_instalacao,
          fechamento_data_1cob: body.data.data_1cob ? new Date(body.data.data_1cob) : null,
          fechamento_obs: body.data.observacoes || null,
          fechamento_data: new Date(),
          fechamento_por: user?.id || 'system'
        }
      });
      await registrarObsSistema(prisma, id, 'FECHAMENTO',
        `Lead fechado — Plano ${body.data.plano} | Instalação R$ ${body.data.valor_instalacao.toFixed(2)} | MRR R$ ${body.data.mrr.toFixed(2)}`,
        user?.id);
      return reply.send({ status: 'success', data: lead });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });

  // ── Métricas comerciais (MRR, instalação, médias, ranking) ────────────────
  fastify.get('/leads/metricas-comerciais', async (request, reply) => {
    const q = request.query as { data_inicio?: string; data_fim?: string };
    const where: any = { status: 'GANHO', fechamento_data: { not: null } };
    if (q.data_inicio || q.data_fim) {
      where.fechamento_data = { not: null };
      if (q.data_inicio) where.fechamento_data.gte = new Date(q.data_inicio);
      if (q.data_fim) where.fechamento_data.lte = new Date(q.data_fim);
    }
    // Escopo: gestor vê o ranking de todos; vendedor só os próprios fechamentos.
    // fail-closed: anônimo cai em '__no_user__' (não vaza nada).
    const scopeId = scopeUserId(request);
    if (scopeId !== null) where.fechamento_por = scopeId;

    const ganhos = await prisma.lead.findMany({
      where,
      select: {
        id: true, nome: true, razao_social: true,
        fechamento_plano: true, fechamento_valor_inst: true, fechamento_mrr: true,
        fechamento_valor_entrada: true, fechamento_forma_entrada: true,
        fechamento_parcelas_inst: true, fechamento_data: true, fechamento_por: true
      }
    });

    // Mapa de usuários
    const usuariosRaw: any[] = await prisma.$queryRawUnsafe(`SELECT id, nome, email, cargo FROM UsuarioCRM`);
    const userMap: Record<string, any> = {};
    for (const u of usuariosRaw) userMap[u.id] = u;
    userMap['user-jessica'] = { id: 'user-jessica', nome: 'Jessica', email: 'jessica@prosystemnet.com.br', cargo: 'CEO' };

    // Totais
    let totalInstalacao = 0, totalMRR = 0, totalEntrada = 0;
    const porPlano: Record<string, { count: number; mrr: number; inst: number }> = {};
    const porVendedor: Record<string, any> = {};
    const porForma: Record<string, number> = {};

    for (const g of ganhos) {
      const inst = Number(g.fechamento_valor_inst || 0);
      const mrr = Number(g.fechamento_mrr || 0);
      const ent = Number(g.fechamento_valor_entrada || 0);
      totalInstalacao += inst;
      totalMRR += mrr;
      totalEntrada += ent;

      const plano = g.fechamento_plano || 'OUTRO';
      if (!porPlano[plano]) porPlano[plano] = { count: 0, mrr: 0, inst: 0 };
      porPlano[plano].count += 1;
      porPlano[plano].mrr += mrr;
      porPlano[plano].inst += inst;

      const forma = g.fechamento_forma_entrada || 'OUTRO';
      porForma[forma] = (porForma[forma] || 0) + 1;

      const vid = g.fechamento_por || 'sem-vendedor';
      if (!porVendedor[vid]) {
        const u = userMap[vid] || {};
        porVendedor[vid] = {
          id: vid,
          nome: u.nome ? u.nome.split(' ')[0] : 'Vendedor',
          cargo: u.cargo || '',
          fechamentos: 0, mrr_total: 0, inst_total: 0
        };
      }
      porVendedor[vid].fechamentos += 1;
      porVendedor[vid].mrr_total += mrr;
      porVendedor[vid].inst_total += inst;
    }

    const total = ganhos.length;
    const ranking = Object.values(porVendedor).sort((a: any, b: any) => b.mrr_total - a.mrr_total);

    return reply.send({
      status: 'success',
      data: {
        total_fechamentos: total,
        total_instalacao: Math.round(totalInstalacao * 100) / 100,
        total_mrr: Math.round(totalMRR * 100) / 100,
        total_entrada: Math.round(totalEntrada * 100) / 100,
        media_instalacao: total > 0 ? Math.round((totalInstalacao / total) * 100) / 100 : 0,
        media_mrr: total > 0 ? Math.round((totalMRR / total) * 100) / 100 : 0,
        media_entrada: total > 0 ? Math.round((totalEntrada / total) * 100) / 100 : 0,
        por_plano: porPlano,
        por_forma_entrada: porForma,
        ranking_vendedores: ranking
      }
    });
  });

  // ── ZapSign: enviar contrato para assinatura ──────────────────────────────
  fastify.post('/leads/:id/enviar-contrato', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    if (!lead.fechamento_plano) {
      return reply.status(400).send({ status: 'error', message: 'Lead precisa estar fechado (status ACEITO) para enviar contrato' });
    }

    try {
      const { getTemplateIdParaPlano, criarDocPorTemplate, formatBRL, formatDate } = await import('../services/zapsign.service.js');

      const templateId = getTemplateIdParaPlano(lead.fechamento_plano);
      if (!templateId) {
        return reply.status(400).send({
          status: 'error',
          message: `Template ZapSign do plano ${lead.fechamento_plano} ainda não foi configurado. Suba o modelo no painel ZapSign e configure ZAPSIGN_TPL_${lead.fechamento_plano} no Railway.`
        });
      }

      // Busca nome do vendedor
      let vendedorNome = 'Equipe ProSystem';
      if (lead.fechamento_por) {
        const rows: any[] = await prisma.$queryRawUnsafe(`SELECT nome FROM UsuarioCRM WHERE id = ? LIMIT 1`, lead.fechamento_por);
        if (rows.length) vendedorNome = rows[0].nome;
        else if (lead.fechamento_por === 'user-jessica') vendedorNome = 'Jessica';
      }

      const data: Record<string, string> = {
        cliente_nome: lead.responsavel_nome || lead.nome || '',
        cliente_razao_social: lead.razao_social || lead.empresa || lead.nome || '',
        cliente_cnpj: lead.cnpj || '',
        cliente_endereco: lead.endereco || '',
        cliente_cidade_uf: `${lead.cidade || ''}${lead.estado ? ' / ' + lead.estado : ''}`,
        cliente_email: lead.responsavel_email || lead.email || '',
        cliente_telefone: lead.responsavel_telefone || lead.telefone || '',
        plano: lead.fechamento_plano,
        valor_instalacao: formatBRL(lead.fechamento_valor_inst || 0),
        valor_mensal_mrr: formatBRL(lead.fechamento_mrr || 0),
        valor_entrada: formatBRL(lead.fechamento_valor_entrada || 0),
        forma_pagamento_entrada: lead.fechamento_forma_entrada || '',
        parcelas_instalacao: `${lead.fechamento_parcelas_inst || 1}x`,
        data_1_cobranca: formatDate(lead.fechamento_data_1cob),
        data_assinatura: formatDate(new Date()),
        vendedor_nome: vendedorNome,
      };

      // Limpa telefone do cliente (apenas dígitos para ZapSign)
      const rawPhone = (lead.responsavel_telefone || lead.telefone || '').replace(/\D/g, '');
      const phoneCountry = rawPhone.startsWith('55') ? '55' : '55';
      const phoneNumber = rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone;

      const result = await criarDocPorTemplate({
        template_id: templateId,
        signer: {
          name: lead.responsavel_nome || lead.nome || 'Cliente',
          email: lead.responsavel_email || lead.email || undefined,
          phone_country: phoneCountry,
          phone_number: phoneNumber || undefined,
          auth_mode: 'assinaturaTela',
          send_via_email: !!(lead.responsavel_email || lead.email),
          send_via_whatsapp: !!phoneNumber,
        },
        data,
        doc_name: `Contrato ProSystem - ${lead.razao_social || lead.nome} - ${lead.fechamento_plano}`,
        external_id: lead.id,
      });

      // Salva referência do contrato no lead
      const updated = await prisma.lead.update({
        where: { id },
        data: {
          zapsign_doc_token: result.token || result.open_id || null,
          zapsign_doc_status: 'pending',
          zapsign_signed_url: result.signers?.[0]?.sign_url || null,
          zapsign_enviado_em: new Date(),
        }
      });

      await registrarObsSistema(prisma, id, 'CONTRATO',
        `Contrato ${lead.fechamento_plano} enviado via ZapSign para ${lead.responsavel_nome || lead.nome}.`,
        user?.id);

      return reply.send({
        status: 'success',
        data: {
          lead: updated,
          zapsign: result,
          sign_url: result.signers?.[0]?.sign_url || null
        }
      });
    } catch (err: any) {
      fastify.log.error('[ZapSign] erro: ' + (err?.message || err));
      return reply.status(500).send({ status: 'error', message: err?.message || 'Erro ao enviar contrato' });
    }
  });

  // Status do contrato (consulta direta no ZapSign)
  fastify.get('/leads/:id/contrato-status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
    if (!lead.zapsign_doc_token) return reply.send({ status: 'success', data: { status: 'not_sent' } });

    try {
      const { obterDoc } = await import('../services/zapsign.service.js');
      const doc = await obterDoc(lead.zapsign_doc_token);
      const novoStatus = doc.status || 'pending';

      // Atualiza status local se mudou
      if (novoStatus !== lead.zapsign_doc_status || doc.signed_file_url) {
        await prisma.lead.update({
          where: { id },
          data: {
            zapsign_doc_status: novoStatus,
            zapsign_signed_file_url: doc.signed_file_url || lead.zapsign_signed_file_url
          }
        });
      }
      return reply.send({ status: 'success', data: doc });
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err?.message });
    }
  });

  // Listar templates configurados (admin)
  fastify.get('/zapsign/templates', async (request, reply) => {
    const user = (request as any).user;
    const ADMIN = ['CEO','ADMIN','SUPERVISAO','SUPERVISAO_COMERCIAL','SUPERVISAO_TECNICA','GERENTE','DIRETOR'];
    if (!user || !ADMIN.includes((user.role || '').toUpperCase())) {
      return reply.status(403).send({ status: 'error', message: 'Apenas administradores' });
    }
    try {
      const { listarTemplates } = await import('../services/zapsign.service.js');
      const data = await listarTemplates();
      return reply.send({ status: 'success', data });
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err?.message });
    }
  });

  // ── Funil (legado) ────────────────────────────────────────────────────────
  fastify.get('/leads/funil', async (request, reply) => {
    const etapas = ['PROSPECCAO','QUALIFICACAO','APRESENTACAO','PROPOSTA','NEGOCIACAO','FECHAMENTO'];
    const funil = await Promise.all(etapas.map(async (etapa) => {
      const leads = await prisma.lead.findMany({
        where: { etapa_funil: etapa, status: { notIn: ['GANHO','PERDIDO'] } },
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { atividades: true, propostas: true } } },
      });
      return { etapa, leads, total: leads.length, valor_total: leads.reduce((s, l) => s + (l.valor_estimado || 0), 0) };
    }));
    return reply.send({ status: 'success', data: funil });
  });
}
