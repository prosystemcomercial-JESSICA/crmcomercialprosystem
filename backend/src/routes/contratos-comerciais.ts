import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId, requireGestor } from '@/lib/scope';
import { gerarContratoPdf } from '@/lib/contrato-pdf';
import { criarImplantacaoEComissoes, criarComissaoValidada, ComissaoValidationError } from '@/lib/comissao-fluxo';
import { resolverNomesUsuarios } from '@/lib/usuarios';

// ── Helpers ────────────────────────────────────────────────────────────────────

export function fmtBRL(v?: number | null): string {
  if (v == null) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const DEZENAS = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa'];
const ESPECIAIS = ['onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove'];
const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis',
  'sete', 'oito', 'nove'];

function numPartes(n: number): string {
  if (n === 0) return 'zero';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (d === 1 && u > 0) partes.push(ESPECIAIS[u - 1]);
  else {
    if (d) partes.push(DEZENAS[d]);
    if (u) partes.push(UNIDADES[u]);
  }
  return partes.join(' e ');
}

export function numPorExtenso(valor: number): string {
  const inteiro = Math.round(valor * 100) / 100;
  const reais = Math.floor(inteiro);
  const centavos = Math.round((inteiro - reais) * 100);
  const partes: string[] = [];
  if (reais > 0) {
    const milhar = Math.floor(reais / 1000);
    const resto = reais % 1000;
    const txtMilhar = milhar ? `${numPartes(milhar)} ${milhar === 1 ? 'mil' : 'mil'}` : '';
    const txtResto = resto ? numPartes(resto) : '';
    const txt = [txtMilhar, txtResto].filter(Boolean).join(' e ');
    partes.push(`${txt} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) partes.push(`${numPartes(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.join(' e ') || 'zero reais';
}

function gerarClausulaSetup(contrato: any): string {
  const total = contrato.valor_setup_total || 0;
  const entrada = contrato.valor_setup_entrada || 0;
  const parcelas = contrato.setup_parcelas || 0;
  const valorParcela = contrato.valor_setup_parcela || 0;

  if (total === 0) return '';

  if (contrato.setup_a_vista || parcelas <= 1) {
    return `3.5 - INSTALAÇÃO: Será cobrado pela instalação o valor de ${fmtBRL(total)} ` +
      `(${numPorExtenso(total)}) à vista, que deverá ser paga no ato da instalação. ` +
      `Esse valor não será reembolsável, salvo em caso de falhas técnicas não resolvidas.`;
  }

  const saldo = total - entrada;
  const numExtenso = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze'];
  const parcExt = numExtenso[parcelas] || String(parcelas);

  return `3.5 - INSTALAÇÃO: Será cobrado pela instalação o valor de ${fmtBRL(total)} ` +
    `(${numPorExtenso(total)}), sendo entrada de ${fmtBRL(entrada)} ` +
    `(${numPorExtenso(entrada)}), com o saldo restante parcelado em ${parcExt} ` +
    `${parcelas === 1 ? 'vez' : 'vezes'} de ${fmtBRL(valorParcela)} ` +
    `(${numPorExtenso(valorParcela)}), a serem pagas conforme condição aprovada ` +
    `na proposta comercial. Esse valor não será reembolsável, salvo em caso de ` +
    `falhas técnicas não resolvidas.`;
}

// Extrai o dia (1-31) de um campo de vencimento que pode vir como "25", "dia 25",
// "25/06/2026" ou uma data ISO. Retorna undefined se não der pra inferir.
function parseDiaVencimento(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  // dd/mm/yyyy ou dd-mm-yyyy → pega o primeiro grupo
  const br = s.match(/^(\d{1,2})[\/\-]/);
  if (br) { const d = Number(br[1]); if (d >= 1 && d <= 31) return d; }
  // ISO yyyy-mm-dd → pega o dia
  const iso = s.match(/^\d{4}-\d{2}-(\d{2})/);
  if (iso) { const d = Number(iso[1]); if (d >= 1 && d <= 31) return d; }
  // qualquer número solto de 1-2 dígitos ("dia 25", "25")
  const num = s.match(/(\d{1,2})/);
  if (num) { const d = Number(num[1]); if (d >= 1 && d <= 31) return d; }
  return undefined;
}

// Escolhe a mensalidade real conforme o plano selecionado na proposta.
function mensalidadeDoPlano(p: any): number | undefined {
  const plano = String(p.plano_selecionado || '').toUpperCase();
  if (plano.includes('PLUS')) return p.mensalidade_plus ?? p.mensalidade_pro ?? undefined;
  if (plano.includes('PRO'))  return p.mensalidade_pro  ?? p.mensalidade_plus ?? undefined;
  // PERSONALIZADO / outros: usa o que estiver preenchido
  return p.mensalidade_plus ?? p.mensalidade_pro ?? undefined;
}

async function gerarNumeroContrato(prisma: PrismaClient): Promise<{ numero: string; seq: number; ano: number }> {
  const ano = new Date().getFullYear();
  const seq = await prisma.$transaction(async (tx) => {
    const atual = await tx.contratoSequencia.upsert({
      where: { ano },
      create: { ano, ultima_seq: 27, updated_at: new Date() },
      update: {},
    });
    const nova = await tx.contratoSequencia.update({
      where: { ano },
      data: { ultima_seq: { increment: 1 }, updated_at: new Date() },
    });
    return nova.ultima_seq;
  });
  return { numero: `${seq}/${ano}`, seq, ano };
}

const COMISSAO_VENDEDOR_PCT = 15; // 15% sobre o setup/instalação

// Próximo mês no formato "YYYY-MM" (competência padrão da comissão).
function proximoMesYM(): string {
  const d = new Date(); const dt = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

// Aplica os efeitos de ASSINATURA do contrato (idempotente):
//  - calcula a comissão do vendedor (15% do setup) e grava no contrato;
//  - registra signed_at/status ASSINADO;
//  - marca a proposta de origem como CONTRATO_ASSINADO e o lead como GANHO (alimenta o funil).
// A META só conta contratos ASSINADOS (ver lib/meta-progress.ts).
async function aplicarAssinatura(prisma: PrismaClient, contratoId: string, signedFileUrl?: string | null) {
  const c = await prisma.contratoComercial.findUnique({ where: { id: contratoId } });
  if (!c) return null;

  const setup = Number(c.valor_setup_total || 0);
  const pct = c.comissao_vendedor_pct ?? COMISSAO_VENDEDOR_PCT;
  const comissao = Math.round(setup * (pct / 100) * 100) / 100;
  const agora = new Date();

  const atualizado = await prisma.contratoComercial.update({
    where: { id: contratoId },
    data: {
      status: 'ASSINADO',
      zapsign_status: 'signed',
      zapsign_signed_file_url: signedFileUrl ?? c.zapsign_signed_file_url ?? null,
      signed_at: c.signed_at || agora,
      comissao_vendedor_pct: pct,
      comissao_vendedor_valor: comissao,
      recuado_at: null,
      recuo_motivo: null,
    },
  });

  // Proposta de origem → CONTRATO_ASSINADO; lead casado por CNPJ → GANHO no fechamento.
  if (c.proposta_comercial_id) {
    const p = await prisma.propostaComercial.findUnique({ where: { id: c.proposta_comercial_id } }).catch(() => null);
    if (p) {
      await prisma.propostaComercial.update({
        where: { id: p.id },
        data: { status: 'CONTRATO_ASSINADO' },
      }).catch(() => {});

      const cnpjDigits = (p.cnpj || c.cnpj || '').replace(/\D/g, '');
      if (cnpjDigits) {
        const candidatos = await prisma.lead.findMany({
          where: { cnpj: { not: null } }, select: { id: true, cnpj: true }, take: 2000,
        }).catch(() => [] as any[]);
        const lead = candidatos.find((l: any) => (l.cnpj || '').replace(/\D/g, '') === cnpjDigits);
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              etapa_funil: 'FECHAMENTO', etapa_comercial: 'FECHADO', status: 'GANHO',
              status_atendimento: 'FECHADO',
              fechamento_data: agora,
              fechamento_mrr: Number(c.mensalidade || 0),
              fechamento_valor_inst: setup,
              fechamento_plano: c.plano_contratado || null,
            } as any,
          }).catch(() => {});
        }
      }
    }
  }

  // Cria a Implantação (acompanhamento) e as comissões em estágio A_RECEBER
  // (vendedor 15% + supervisão 5% sobre o setup). O mês de pagamento é definido
  // depois, quando a supervisão informar a data do 1º vencimento.
  await criarImplantacaoEComissoes(prisma, contratoId).catch(() => {});

  return atualizado;
}

// Recuo / distrato (cliente assinou e desistiu): sai da meta e estorna a comissão.
async function aplicarRecuo(prisma: PrismaClient, contratoId: string, motivo?: string) {
  const c = await prisma.contratoComercial.findUnique({ where: { id: contratoId } });
  if (!c) return null;
  const agora = new Date();

  const atualizado = await prisma.contratoComercial.update({
    where: { id: contratoId },
    data: {
      status: 'RECUADO',
      zapsign_status: 'refused',
      recuado_at: agora,
      recuo_motivo: motivo || null,
      comissao_vendedor_valor: 0, // estorna a comissão
    },
  });

  // Estorna o fluxo de comissão: cancela as comissões e a implantação do contrato.
  await prisma.comissao.updateMany({
    where: { referencia_id: contratoId, tipo: 'CONTRATO' },
    data: { status: 'CANCELADA', estagio: 'CANCELADA' } as any,
  }).catch(() => {});
  await prisma.implantacao.updateMany({
    where: { contrato_id: contratoId },
    data: { status: 'CANCELADA' },
  }).catch(() => {});

  // Proposta volta a PERDIDA; lead casado por CNPJ → PERDIDO (sai da meta).
  if (c.proposta_comercial_id) {
    const p = await prisma.propostaComercial.findUnique({ where: { id: c.proposta_comercial_id } }).catch(() => null);
    if (p) {
      await prisma.propostaComercial.update({ where: { id: p.id }, data: { status: 'PERDIDA' } }).catch(() => {});
      const cnpjDigits = (p.cnpj || c.cnpj || '').replace(/\D/g, '');
      if (cnpjDigits) {
        const candidatos = await prisma.lead.findMany({
          where: { cnpj: { not: null } }, select: { id: true, cnpj: true }, take: 2000,
        }).catch(() => [] as any[]);
        const lead = candidatos.find((l: any) => (l.cnpj || '').replace(/\D/g, '') === cnpjDigits);
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'PERDIDO', status_atendimento: 'PERDIDO' } as any,
          }).catch(() => {});
        }
      }
    }
  }

  return atualizado;
}

async function getZapSignConfig(prisma: PrismaClient) {
  const configs = await prisma.configuracaoIntegracao.findMany({
    where: { chave: { startsWith: 'ZAPSIGN_' } },
  });
  const map: Record<string, string> = {};
  configs.forEach(c => { map[c.chave] = c.valor; });

  // Fallback para variáveis de ambiente
  return {
    token: map['ZAPSIGN_API_TOKEN'] || process.env.ZAPSIGN_API_TOKEN || '',
    orgId: map['ZAPSIGN_ORG_ID']   || process.env.ZAPSIGN_ORG_ID   || '',
    env:  (map['ZAPSIGN_ENVIRONMENT'] || process.env.ZAPSIGN_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    templates: {
      Pro:          map['ZAPSIGN_TEMPLATE_PRO']        || '',
      Plus:         map['ZAPSIGN_TEMPLATE_PLUS']       || '',
      'Farma Pro':  map['ZAPSIGN_TEMPLATE_FARMA_PRO']  || '',
      'Farma Plus': map['ZAPSIGN_TEMPLATE_FARMA_PLUS'] || '',
      'Padaria Pro':  map['ZAPSIGN_TEMPLATE_PADARIA_PRO']  || '',
      'Padaria Plus': map['ZAPSIGN_TEMPLATE_PADARIA_PLUS'] || '',
    } as Record<string, string>,
  };
}

const ZAPSIGN_BASE = {
  // Host correto da API ZapSign é api.zapsign.com.br (não app.* — esse é o painel web).
  sandbox: 'https://sandbox.api.zapsign.com.br/api/v1',
  production: 'https://api.zapsign.com.br/api/v1',
};

// ── Schemas Zod ───────────────────────────────────────────────────────────────

const CreateContratoSchema = z.object({
  proposta_comercial_id: z.string().optional(),
  razao_social: z.string().min(1),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  numero_endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  representante_nome: z.string().optional(),
  representante_cpf: z.string().optional(),
  representante_email: z.string().optional(),
  representante_telefone: z.string().optional(),
  representante_cargo: z.string().optional(),
  plano_contratado: z.string().optional(),
  software_nome: z.string().optional(),
  software_versao: z.string().optional(),
  mensalidade: z.number().optional(),
  dia_vencimento: z.number().int().optional(),
  valor_setup_total: z.number().optional(),
  valor_setup_entrada: z.number().optional(),
  setup_parcelas: z.number().int().optional(),
  valor_setup_parcela: z.number().optional(),
  setup_a_vista: z.boolean().optional(),
  setup_condicao_especial: z.string().optional(),
  vendedor_nome: z.string().optional(),
  supervisor_nome: z.string().optional(),
  campanha: z.string().optional(),
  condicao_especial: z.string().optional(),
  data_contrato: z.string().optional(),
  modelo_contrato: z.string().optional(),
  created_by: z.string().optional(),
});

const UpdateContratoComercialSchema = z.object({
  status: z.enum(['A_GERAR','GERADO','ENVIADO_ASSINATURA','AGUARDANDO_ASSINATURA','ASSINADO','PENDENTE_CORRECAO','CANCELADO','RECUADO']).optional(),
  razao_social: z.string().optional(),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  numero_endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  representante_nome: z.string().optional(),
  representante_cpf: z.string().optional(),
  representante_email: z.string().optional(),
  representante_telefone: z.string().optional(),
  representante_cargo: z.string().optional(),
  plano_contratado: z.string().optional(),
  software_nome: z.string().optional(),
  software_versao: z.string().optional(),
  mensalidade: z.number().optional(),
  dia_vencimento: z.number().int().optional(),
  valor_setup_total: z.number().optional(),
  valor_setup_entrada: z.number().optional(),
  setup_parcelas: z.number().int().optional(),
  valor_setup_parcela: z.number().optional(),
  setup_a_vista: z.boolean().optional(),
  setup_condicao_especial: z.string().optional(),
  vendedor_id: z.string().optional(),
  vendedor_nome: z.string().optional(),
  supervisor_nome: z.string().optional(),
  condicao_especial: z.string().optional(),
  data_contrato: z.string().optional(),
  zapsign_signing_url: z.string().optional(),
  zapsign_signed_file_url: z.string().optional(),
  zapsign_status: z.string().optional(),
  signed_at: z.string().optional(),
});

// ── Rotas ────────────────────────────────────────────────────────────────────

export async function contratosComerciais(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Migração idempotente: colunas de geração, vendedor, comissão e recuo/distrato.
  await Promise.all([
    prisma.$executeRawUnsafe(`ALTER TABLE ContratoComercial ADD COLUMN gerado_at DATETIME NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE ContratoComercial ADD COLUMN vendedor_id VARCHAR(255) NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE ContratoComercial ADD COLUMN comissao_vendedor_pct DOUBLE NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE ContratoComercial ADD COLUMN comissao_vendedor_valor DOUBLE NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE ContratoComercial ADD COLUMN recuado_at DATETIME NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE ContratoComercial ADD COLUMN recuo_motivo TEXT NULL`).catch(() => {}),
  ]);

  // ── LIST (kanban grouped)
  fastify.get('/contratos-comerciais', async (request, reply) => {
    const query = (request.query as any);
    const { status, search } = query;
    const page = Number(query.page) || 0;
    const limit = Number(query.limit) || 200;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { razao_social: { contains: search, mode: 'insensitive' } },
        { vendedor_nome: { contains: search, mode: 'insensitive' } },
        { numero_contrato: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Escopo: gestor vê todos. Vendedor vê o contrato se ELE gerou
    // OU se é o vendedor da proposta de origem (supervisor pode ter gerado por ele).
    const scopeId = scopeUserId(request);
    if (scopeId !== null) {
      const minhasPropostas = await prisma.propostaComercial.findMany({
        where: { OR: [{ vendedor_id: scopeId }, { created_by: scopeId }] },
        select: { id: true },
      });
      const propostaIds = minhasPropostas.map(p => p.id);
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { created_by: scopeId },
            ...(propostaIds.length ? [{ proposta_comercial_id: { in: propostaIds } }] : []),
          ],
        },
      ];
    }

    const [contratos, total] = await Promise.all([
      prisma.contratoComercial.findMany({
        where, skip: page * limit, take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.contratoComercial.count({ where }),
    ]);

    const byStatus: Record<string, any[]> = {};
    contratos.forEach(c => {
      if (!byStatus[c.status]) byStatus[c.status] = [];
      byStatus[c.status].push(c);
    });

    return reply.send({ status: 'ok', data: { contratos, byStatus, total } });
  });

  // ── GET ONE
  fastify.get('/contratos-comerciais/:id', async (request, reply) => {
    const { id } = request.params as any;
    const c = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });
    return reply.send({ status: 'ok', data: c });
  });

  // ── DADOS PARA REVISÃO: contrato com campos VAZIOS completados a partir do lead
  //    de origem (casado por CNPJ). Não grava nada — só sugere o preenchimento.
  fastify.get('/contratos-comerciais/:id/dados-revisao', async (request, reply) => {
    const { id } = request.params as any;
    const c = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });

    const dados: any = { ...c };
    const cnpjDigits = (c.cnpj || '').replace(/\D/g, '');
    if (cnpjDigits) {
      const candidatos = await prisma.lead.findMany({
        where: { cnpj: { not: null }, deleted_at: null },
        select: {
          cnpj: true, razao_social: true, nome_fantasia: true, cidade: true, estado: true,
          endereco: true,
          responsavel_nome: true, responsavel_cpf: true, responsavel_email: true,
          responsavel_telefone: true, responsavel_cargo: true,
        },
        take: 2000,
      }).catch(() => [] as any[]);
      const lead: any = candidatos.find((l: any) => (l.cnpj || '').replace(/\D/g, '') === cnpjDigits);
      if (lead) {
        // Mapa lead → campos do contrato; preenche só onde o contrato está vazio.
        const map: Record<string, any> = {
          razao_social: lead.razao_social, nome_fantasia: lead.nome_fantasia,
          cidade: lead.cidade, estado: lead.estado, endereco: lead.endereco,
          representante_nome: lead.responsavel_nome, representante_cpf: lead.responsavel_cpf,
          representante_email: lead.responsavel_email, representante_telefone: lead.responsavel_telefone,
          representante_cargo: lead.responsavel_cargo,
        };
        for (const [campo, val] of Object.entries(map)) {
          if ((dados[campo] === null || dados[campo] === undefined || dados[campo] === '') && val) {
            dados[campo] = val;
          }
        }
      }
    }
    return reply.send({ status: 'ok', data: dados });
  });

  // ── RESUMO P/ ASSINATURA (e-mail): recolhe os dados do LEAD → PROPOSTA →
  // CONTRATO e monta o texto no PADRÃO da Jessica, pronto p/ copiar. Funciona
  // para contratos já assinados também. Campo sem dado = fica em branco.
  fastify.get('/contratos-comerciais/:id/resumo-assinatura', async (request, reply) => {
    const { id } = request.params as any;
    const c: any = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });

    // Proposta vinculada (máquinas, datas de aceite, origem).
    const p: any = c.proposta_comercial_id
      ? await prisma.propostaComercial.findUnique({ where: { id: c.proposta_comercial_id } }).catch(() => null)
      : null;

    // Lead casado por CNPJ (dígitos) — traz início do contato, origem, fechamento
    // e o onboarding técnico (máquinas, balança, financeiro, certificado, contador).
    const cnpjDigits = (c.cnpj || p?.cnpj || '').replace(/\D/g, '');
    let lead: any = null, onb: any = null;
    if (cnpjDigits) {
      const cands = await prisma.lead.findMany({
        where: { cnpj: { not: null }, deleted_at: null },
        include: { onboarding: true } as any, take: 3000,
      }).catch(() => [] as any[]);
      lead = cands.find((l: any) => (l.cnpj || '').replace(/\D/g, '') === cnpjDigits) || null;
      onb = lead?.onboarding || null;
    }

    // ── Helpers de formatação ──
    const d = (x: any) => x ? new Date(x).toLocaleDateString('pt-BR') : '';
    const brl = (v: any) => (v == null || v === '') ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const simNao = (b: any) => b === true ? 'Sim' : (b === false ? 'Não' : '');
    const ou = (...xs: any[]) => { for (const x of xs) if (x !== null && x !== undefined && `${x}`.trim() !== '') return x; return ''; };

    // Datas do ciclo.
    const inicio = ou(lead?.created_at);
    const fechamento = ou(lead?.fechamento_data, p?.data_aceite, c.data_contrato);
    let tempo = '';
    if (inicio && fechamento) {
      const dias = Math.max(0, Math.round((new Date(fechamento).getTime() - new Date(inicio).getTime()) / 86400000));
      tempo = `${dias} dia${dias === 1 ? '' : 's'}`;
    }

    // Endereço completo (contrato → lead).
    const endereco = ou(
      [ou(c.endereco), c.numero_endereco ? ', ' + c.numero_endereco : '', c.bairro ? ' - ' + c.bairro : '',
        (c.cidade || c.estado) ? ' - ' + [c.cidade, c.estado].filter(Boolean).join('-') : '', c.cep ? ' ' + c.cep : '']
        .join('').trim(),
      lead?.endereco,
    );

    // Estrutura / instalação (onboarding técnico do lead).
    const maquinas = ou(onb?.qtd_maquinas, p?.maquinas, lead?.qtd_caixas);
    const balanca = onb ? simNao(onb.usa_balanca) : '';
    const financeiro = onb ? simNao(onb.usa_fiscal) : ''; // "Utiliza Financeiro?" — flag fiscal/financeiro do onboarding
    const tipoBase = ou(c.tipo_base) === 'CONVERSAO' || lead?.onboarding?.necessita_conversao
      ? ('Conversão' + (ou(c.sistema_anterior, onb?.sistema_anterior) ? ' (de ' + ou(c.sistema_anterior, onb?.sistema_anterior) + ')' : ''))
      : 'Banco zerado';
    const dataInstalacao = ou(onb?.data_prevista_implantacao);

    // Valores.
    const mensalidade = ou(c.mensalidade, p?.mensalidade_plus, p?.mensalidade_pro);
    const setupTotal = ou(c.valor_setup_total, lead?.fechamento_valor_inst);
    const entrada = ou(c.valor_setup_entrada, lead?.fechamento_valor_entrada);
    const parcelas = ou(c.setup_parcelas, lead?.fechamento_parcelas_inst);
    const valorParcela = ou(c.valor_setup_parcela);
    let implantacaoLinha = '';
    if (setupTotal) {
      const partes = [];
      if (entrada) partes.push('entrada de ' + brl(entrada));
      if (parcelas && valorParcela) partes.push(parcelas + 'x ' + brl(valorParcela));
      implantacaoLinha = brl(setupTotal) + (partes.length ? ' (' + partes.join(' + ') + ')' : '');
    }
    const formaEntrada = ou(lead?.fechamento_forma_entrada);

    // Origem do lead (rótulo + observação).
    const ORIGEM_LABEL: Record<string, string> = {
      MANUAL: 'Manual', WHATSAPP: 'WhatsApp', INDICACAO: 'Indicação', PROSPECCAO: 'Prospecção (Ativo)',
      VISITA: 'Visita', TRAFEGO: 'Tráfego pago', CLIENTE_ANTIGO: 'Cliente antigo', PASSIVO: 'Passivo',
    };
    const origemRot = ou(ORIGEM_LABEL[(lead?.origem || '').toUpperCase()], lead?.origem, p?.origem);
    const origemObs = ou(lead?.observacoes_comerciais, lead?.observacoes);

    // Contabilidade (onboarding).
    const contadorNome = ou(onb?.nome_contador);
    const contadorContato = ou(onb?.contato_contador);
    const certificadoEnviado = onb?.tem_certificado === true;

    const plano = ou(c.plano_contratado, p?.plano_selecionado);
    const L: string[] = [];
    L.push(`📅 Início do contato: ${d(inicio)}`);
    L.push(`📅 Fechamento: ${d(fechamento)}`);
    L.push(`⏱️ Tempo de fechamento: ${tempo}`);
    L.push('');
    L.push(`Origem do lead: ${origemRot}${origemObs ? ' - ' + origemObs : ''}`);
    L.push('');
    L.push('📌 CADASTRO DE NOVO CLIENTE');
    L.push('');
    L.push(`Plano: ${plano}`);
    L.push('');
    L.push('Dados da Empresa');
    L.push(`•    Razão Social: ${ou(c.razao_social, p?.razao_social)}`);
    L.push(`•    Nome Fantasia: ${ou(c.nome_fantasia, p?.nome_fantasia)}`);
    L.push(`•    CNPJ: ${ou(c.cnpj, p?.cnpj)}`);
    L.push(`•    Endereço: ${endereco}`);
    L.push('');
    L.push('Dados do Responsável');
    L.push(`•   Nome Completo: ${ou(c.representante_nome, p?.responsavel_nome, lead?.responsavel_nome)}`);
    L.push(`•  CPF: ${ou(c.representante_cpf, p?.responsavel_cpf, lead?.responsavel_cpf)}`);
    L.push(`•  E-mail (para envio de boleto): ${ou(c.representante_email, p?.responsavel_email, lead?.responsavel_email)}`);
    L.push(`•  Telefones de contato: ${ou(c.representante_telefone, p?.responsavel_telefone, lead?.responsavel_telefone)}`);
    L.push('');
    L.push('Estrutura e Utilização');
    L.push(`•    Quantidade de Máquinas: ${maquinas}`);
    L.push(`•    Integração com balança: ${balanca}`);
    L.push(`•    Atende aos pré-requisitos de instalação? ${onb ? 'Sim' : ''}`);
    L.push(`•    Utiliza Financeiro? ${financeiro}`);
    L.push('');
    L.push('Funcionamento da Loja');
    L.push(`•    Horário de Funcionamento: ${ou(onb?.horario_contato, lead?.responsavel_horario)}`);
    L.push(`•    Data prevista para Instalação: ${tipoBase}${dataInstalacao ? ' - Instalação marcada para ' + d(dataInstalacao) : ''}`);
    L.push(`•    Mensalidade: ${brl(mensalidade)}`);
    L.push(`•    Implantação (a prazo): ${implantacaoLinha}`);
    L.push(`•    Comprovante de entrada: ${formaEntrada ? 'Pagamento realizado no ' + formaEntrada : ''}`);
    L.push('');
    L.push('Documentos');
    L.push(`•    Certificado Digital: [${certificadoEnviado ? 'x' : ' '}] Enviado | [${certificadoEnviado ? ' ' : 'x'}] A enviar | Senha: _____________`);
    L.push('');
    L.push('Contabilidade:');
    L.push(`•    Nome do contador: ${contadorNome}`);
    L.push('•    CPF: ');
    L.push('•    CRC do contador: ');
    L.push(`•    E-mail: `);
    L.push(`•    Telefone de contato: ${contadorContato}`);
    L.push('');
    L.push('Dados da Empresa:');
    L.push('•    Código CSC (Produção): ');

    const texto = L.join('\n');
    return reply.send({ status: 'success', data: { texto } });
  });

  // ── TROCA DE CNPJ (venda adicional) ─────────────────────────────────────────
  // Cliente desativa um CNPJ e migra p/ outro: MESMO cadastro, MESMA mensalidade/
  // plano, cobra uma TAXA do serviço. Faz tudo: (1) snapshot dos dados ANTIGOS na
  // ficha (nada se perde); (2) atualiza o cadastro com os novos dados; (3) cria a
  // VendaAdicional (taxa) com comissão 15% vendedor + 5% supervisão; (4) gera um
  // ContratoComercial novo do plano atual com os novos dados.
  fastify.post('/contratos-comerciais/troca-cnpj', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = (request as any).user;
    const body = z.object({
      cliente_id: z.string().min(1, 'Selecione o cliente'),
      taxa: z.number().nonnegative().default(0),         // taxa do serviço (setup)
      vendedor_id: z.string().optional(),                // vendedor da venda/comissão
      // forma de pagamento da taxa
      taxa_entrada: z.number().optional(),
      taxa_parcelas: z.number().int().min(1).max(24).optional(),
      taxa_primeiro_venc: z.string().optional(),
      // NOVOS dados cadastrais (tudo muda)
      cnpj_novo: z.string().min(1, 'Informe o novo CNPJ'),
      razao_social_nova: z.string().optional(),
      nome_fantasia_nova: z.string().optional(),
      inscricao_nova: z.string().optional(),
      cep: z.string().optional(),
      endereco: z.string().optional(),
      numero_end: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
      estado: z.string().optional(),
      telefone: z.string().optional(),
      email: z.string().optional(),
      motivo: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });
    const b = body.data;

    const atual: any = await prisma.cliente.findUnique({ where: { id: b.cliente_id } });
    if (!atual) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    const vendedorId = b.vendedor_id || user?.id || 'system';
    const nomes = await resolverNomesUsuarios(prisma, [vendedorId]).catch(() => ({} as any));
    const vendedorNome = nomes[vendedorId] || user?.nome || null;

    try {
      // 1) Snapshot dos dados ANTIGOS — histórico estruturado + evento completo na ficha.
      await (prisma as any).historicoCnpjCliente.create({
        data: {
          cliente_id: b.cliente_id,
          cnpj_anterior: atual.cnpj, razao_social_anterior: atual.razao_social,
          nome_fantasia_anterior: atual.nome_fantasia, inscricao_anterior: atual.inscricao_estadual,
          cnpj_novo: b.cnpj_novo, razao_social_nova: b.razao_social_nova ?? atual.razao_social,
          nome_fantasia_nova: b.nome_fantasia_nova ?? atual.nome_fantasia,
          motivo: b.motivo, trocado_por: user?.id, trocado_por_nome: user?.nome,
        },
      }).catch(() => {});
      const dadosAntigos = {
        cnpj: atual.cnpj, razao_social: atual.razao_social, nome_fantasia: atual.nome_fantasia,
        inscricao_estadual: atual.inscricao_estadual, cep: atual.cep, endereco: atual.endereco,
        numero_end: atual.numero_end, bairro: atual.bairro, cidade: atual.cidade, estado: atual.estado,
        telefone: atual.telefone || atual.telefone1, email: atual.email,
      };
      await (prisma as any).eventoCliente.create({
        data: {
          cliente_id: b.cliente_id, tipo: 'TROCA_CNPJ',
          titulo: `🔄 Troca de CNPJ: ${atual.cnpj || '(vazio)'} → ${b.cnpj_novo}`,
          descricao: `Dados ANTIGOS preservados:\n${Object.entries(dadosAntigos).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}${b.motivo ? '\nMotivo: ' + b.motivo : ''}`,
          metadados: { antes: dadosAntigos, depois: { cnpj: b.cnpj_novo, razao_social: b.razao_social_nova, nome_fantasia: b.nome_fantasia_nova } },
          feito_por: user?.id, feito_por_nome: user?.nome,
        },
      }).catch(() => {});

      // 2) Atualiza o cadastro com os NOVOS dados (mantém código/plano/mensalidade).
      const cliente = await prisma.cliente.update({
        where: { id: b.cliente_id },
        data: {
          cnpj: b.cnpj_novo,
          ...(b.razao_social_nova ? { razao_social: b.razao_social_nova } : {}),
          ...(b.nome_fantasia_nova ? { nome_fantasia: b.nome_fantasia_nova } : {}),
          ...(b.inscricao_nova ? { inscricao_estadual: b.inscricao_nova } : {}),
          ...(b.cep ? { cep: b.cep } : {}), ...(b.endereco ? { endereco: b.endereco } : {}),
          ...(b.numero_end ? { numero_end: b.numero_end } : {}), ...(b.bairro ? { bairro: b.bairro } : {}),
          ...(b.cidade ? { cidade: b.cidade } : {}), ...(b.estado ? { estado: b.estado } : {}),
          ...(b.telefone ? { telefone: b.telefone, telefone1: b.telefone } : {}),
          ...(b.email ? { email: b.email } : {}),
        },
      });

      // 3) Parceiro "TROCA_CNPJ" (cria se não existir) + VendaAdicional (taxa) +
      //    comissões 15% vendedor / 5% supervisão sobre a taxa.
      let parceiro = await prisma.parceiro.findFirst({ where: { categoria: 'TROCA_CNPJ' } }).catch(() => null);
      if (!parceiro) {
        parceiro = await prisma.parceiro.create({
          data: { nome: 'Troca de CNPJ', categoria: 'TROCA_CNPJ', pitch: 'Migração de CNPJ mantendo o cadastro/plano; cobra taxa de serviço.', comissao_valor: 0, comissao_supervisao_pct: 5, ativo: true },
        });
      }
      const comissaoVend = Math.round((b.taxa * 0.15) * 100) / 100;
      const venda = await prisma.vendaAdicional.create({
        data: {
          cliente_id: b.cliente_id, parceiro_id: parceiro.id, vendedor_id: vendedorId, vendedor_nome: vendedorNome,
          tipo_negocio: 'INDICACAO', valor_venda: b.taxa,
          setup_forma: b.taxa_entrada ? 'ENTRADA_PARCELAS' : (b.taxa_parcelas ? 'PARCELADO' : undefined),
          setup_entrada: b.taxa_entrada ?? undefined, setup_parcelas: b.taxa_parcelas ?? undefined,
          setup_primeiro_venc: b.taxa_primeiro_venc ? new Date(b.taxa_primeiro_venc) : undefined,
          observacoes: `Troca de CNPJ: ${atual.cnpj || '(vazio)'} → ${b.cnpj_novo}`,
          comissao_valor: comissaoVend, status: 'PENDENTE', created_by: user?.id || 'system',
        } as any,
      }).catch(() => null);
      // Comissão do vendedor (15% da taxa).
      if (venda && b.taxa > 0) {
        await criarComissaoValidada(prisma, {
          responsavel_id: vendedorId, tipo: 'VENDA_ADICIONAL', referencia_id: venda.id,
          descricao: `Troca de CNPJ — ${b.razao_social_nova || atual.razao_social || cliente.nome}`,
          valor_base: b.taxa, percentual: 15, valor_comissao: comissaoVend, papel: 'VENDEDOR',
          periodo: proximoMesYM(), status: 'PENDENTE', created_by: user?.id || 'system',
        }).catch(e => {
          if (e instanceof ComissaoValidationError) console.error(`[TROCA-CNPJ] ${e.message}`);
          else throw e;
        });
        // Supervisão 5% (cada gestor comercial ativo: SUPERVISAO_COMERCIAL ou ADMIN/Diretora).
        const sups: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM UsuarioCRM WHERE cargo IN ('SUPERVISAO_COMERCIAL','ADMIN') AND status='ATIVO'`).catch(() => []);
        const comissaoSup = Math.round((b.taxa * 0.05) * 100) / 100;
        for (const s of sups) {
          await criarComissaoValidada(prisma, {
            responsavel_id: s.id, tipo: 'SUPERVISAO_VENDA_ADICIONAL', referencia_id: venda.id,
            descricao: `Supervisão — Troca de CNPJ: ${cliente.razao_social || cliente.nome}`,
            valor_base: b.taxa, percentual: 5, valor_comissao: comissaoSup, papel: 'SUPERVISAO',
            periodo: proximoMesYM(), status: 'PENDENTE', created_by: user?.id || 'system',
          }).catch(e => {
            if (e instanceof ComissaoValidationError) console.error(`[TROCA-CNPJ] ${e.message}`);
            else throw e;
          });
        }
      }

      // 4) Gera o ContratoComercial novo (mesmo plano do cliente) com os NOVOS dados.
      const { numero, seq, ano } = await gerarNumeroContrato(prisma);
      const contrato = await prisma.contratoComercial.create({
        data: {
          numero_contrato: numero, sequencia: seq, ano,
          cliente_id: b.cliente_id,
          razao_social: b.razao_social_nova || cliente.razao_social || cliente.nome,
          nome_fantasia: b.nome_fantasia_nova || cliente.nome_fantasia || undefined,
          cnpj: b.cnpj_novo, endereco: b.endereco || cliente.endereco || undefined,
          numero_endereco: b.numero_end || cliente.numero_end || undefined,
          bairro: b.bairro || cliente.bairro || undefined,
          cidade: b.cidade || cliente.cidade || undefined,
          estado: b.estado || cliente.estado || undefined,
          cep: b.cep || cliente.cep || undefined,
          plano_contratado: cliente.plano || undefined,    // MESMO plano
          mensalidade: cliente.mensalidade_base || undefined, // MESMA mensalidade
          valor_setup_total: b.taxa || undefined,           // taxa do serviço
          valor_setup_entrada: b.taxa_entrada ?? undefined,
          setup_parcelas: b.taxa_parcelas ?? undefined,
          vendedor_id: vendedorId, vendedor_nome: vendedorNome,
          tipo_servico: 'TROCA_CNPJ', // NÃO é cliente novo — é serviço de troca de CNPJ
          condicao_especial: `Troca de CNPJ (de ${atual.cnpj || '(vazio)'}). Mesmo plano/mensalidade. Taxa de serviço.`,
          status: 'A_GERAR', created_by: user?.id || 'system',
        } as any,
      }).catch(() => null);

      // Resumo PRONTO P/ COPIAR (financeiro / WhatsApp) — no padrão da gestão.
      const brlR = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const dataBr = (s?: string) => { if (!s) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; };
      const razaoAntiga = atual.razao_social || atual.nome_fantasia || atual.nome || '';
      const razaoNova = b.razao_social_nova || cliente.razao_social || cliente.nome_fantasia || '';
      const cod = atual.codigo ? `${atual.codigo}  - ` : '';
      let condicoes = '';
      if (b.taxa_entrada && b.taxa_parcelas) {
        condicoes = `Entrada de R$ ${brlR(b.taxa_entrada)} + ${b.taxa_parcelas}X R$ ${brlR((b.taxa - (b.taxa_entrada || 0)) / b.taxa_parcelas)}`;
      } else if (b.taxa_parcelas && b.taxa_parcelas > 1) {
        condicoes = `${b.taxa_parcelas}X R$ ${brlR(b.taxa / b.taxa_parcelas)}`;
      } else {
        condicoes = `R$ ${brlR(b.taxa)} à vista`;
      }
      const venc = b.taxa_primeiro_venc ? `Primeiro vencimento para ${dataBr(b.taxa_primeiro_venc)} no valor de ${condicoes}` : `Condições: ${condicoes}`;
      const resumo = [
        'Lançar cobrança troca de CNPJ',
        '',
        `${cod}ANTIGO ${razaoAntiga}   - NOVO ${razaoNova}`,
        `CNPJ: ${b.cnpj_novo}`,
        '',
        'A negociação ficou definida da seguinte forma:',
        `R$ ${brlR(b.taxa)} pela troca de CNPJ;`,
        'Condições de pagamento:',
        venc,
        '',
        '',
        'Os dados já foram trocados no suporte e CRM',
      ].join('\n');

      // Texto para o técnico responsável: instruções de troca de CNPJ no sistema.
      const tecnico = atual.grupo_tecnico || null;
      const endNovo = [b.endereco, b.numero_end, b.bairro, b.cidade, b.estado].filter(Boolean).join(', ');
      const endAntigo = [atual.endereco, atual.numero_end, atual.bairro, atual.cidade, atual.estado].filter(Boolean).join(', ');
      const resumo_tecnico = [
        tecnico ? `Responsável técnico: ${tecnico}` : 'Responsável técnico: (não definido no cadastro)',
        '',
        '📋 DEMANDA — Troca de CNPJ no sistema',
        '',
        '▸ CLIENTE',
        `  Código: ${atual.codigo || '(sem código)'}`,
        `  CNPJ ANTIGO: ${atual.cnpj || '(vazio)'}`,
        `  Razão Social ANTIGA: ${razaoAntiga}`,
        atual.nome_fantasia ? `  Nome Fantasia ANTIGO: ${atual.nome_fantasia}` : '',
        atual.inscricao_estadual ? `  Inscrição Est. ANTIGA: ${atual.inscricao_estadual}` : '',
        endAntigo ? `  Endereço ANTIGO: ${endAntigo}` : '',
        '',
        '▸ NOVOS DADOS',
        `  CNPJ NOVO: ${b.cnpj_novo}`,
        b.razao_social_nova ? `  Razão Social NOVA: ${b.razao_social_nova}` : '',
        b.nome_fantasia_nova ? `  Nome Fantasia NOVO: ${b.nome_fantasia_nova}` : '',
        b.inscricao_nova ? `  Inscrição Est. NOVA: ${b.inscricao_nova}` : '',
        endNovo ? `  Endereço NOVO: ${endNovo}` : '',
        b.cep ? `  CEP: ${b.cep}` : '',
        b.telefone ? `  Telefone: ${b.telefone}` : '',
        b.email ? `  E-mail: ${b.email}` : '',
        b.motivo ? `  Motivo: ${b.motivo}` : '',
        '',
        'Por favor, atualize o cadastro no sistema com os novos dados acima.',
        'Os dados já foram atualizados no CRM.',
      ].filter(l => l !== '').join('\n');

      // Persiste os resumos PRONTOS na venda para que possam ser reabertos/copiados
      // a qualquer momento (o botão "Resumo" na tabela de Vendas Adicionais). Guarda
      // como JSON em observacoes; um marcador permite o endpoint resumo-financeiro
      // devolver o texto exato — sem regenerar (o CNPJ antigo já foi sobrescrito).
      if (venda) {
        await prisma.vendaAdicional.update({
          where: { id: venda.id },
          data: {
            observacoes: JSON.stringify({
              tipo: 'TROCA_CNPJ',
              resumo,
              resumo_tecnico,
              tecnico_responsavel: tecnico,
              cnpj_antigo: atual.cnpj || null,
              cnpj_novo: b.cnpj_novo,
            }),
          },
        }).catch(() => {});
      }

      return reply.send({ status: 'success', data: { cliente, venda, contrato, resumo, resumo_tecnico, tecnico_responsavel: tecnico }, message: 'Troca de CNPJ registrada: cadastro atualizado (antigo guardado na ficha), venda/comissão e contrato gerados.' });
    } catch (err: any) {
      console.error('[POST /contratos-comerciais/troca-cnpj]', err);
      return reply.status(500).send({ status: 'error', message: 'Erro ao processar a troca de CNPJ' });
    }
  });

  // ── CREATE
  fastify.post('/contratos-comerciais', async (request, reply) => {
    const parse = CreateContratoSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ status: 'error', message: parse.error.message });
    const data = parse.data;

    // Gera número sequencial
    const { numero, seq, ano } = await gerarNumeroContrato(prisma);

    // Rastreabilidade: o contrato HERDA o id da proposta de origem (mesmo id da proposta).
    // Se já existir um contrato com esse id (regerar), cai no cuid() padrão para não colidir.
    let contratoId: string | undefined = data.proposta_comercial_id || undefined;
    if (contratoId) {
      const jaExiste = await prisma.contratoComercial.findUnique({ where: { id: contratoId }, select: { id: true } });
      if (jaExiste) contratoId = undefined;  // deixa o Prisma gerar cuid()
    }

    const contrato = await prisma.contratoComercial.create({
      data: {
        ...(contratoId ? { id: contratoId } : {}),
        numero_contrato: numero,
        sequencia: seq,
        ano,
        status: 'A_GERAR',
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        cnpj: data.cnpj,
        endereco: data.endereco,
        numero_endereco: data.numero_endereco,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        cep: data.cep,
        representante_nome: data.representante_nome,
        representante_cpf: data.representante_cpf,
        representante_email: data.representante_email,
        representante_telefone: data.representante_telefone,
        representante_cargo: data.representante_cargo,
        plano_contratado: data.plano_contratado,
        software_nome: data.software_nome || 'SOLUTION – FRENTE DE LOJA',
        software_versao: data.software_versao || data.plano_contratado || '',
        mensalidade: data.mensalidade,
        dia_vencimento: data.dia_vencimento,
        valor_setup_total: data.valor_setup_total,
        valor_setup_entrada: data.valor_setup_entrada,
        setup_parcelas: data.setup_parcelas,
        valor_setup_parcela: data.valor_setup_parcela,
        setup_a_vista: data.setup_a_vista ?? (!data.setup_parcelas || data.setup_parcelas <= 1),
        setup_condicao_especial: data.setup_condicao_especial,
        vendedor_nome: data.vendedor_nome,
        supervisor_nome: data.supervisor_nome,
        campanha: data.campanha,
        condicao_especial: data.condicao_especial,
        data_contrato: data.data_contrato ? new Date(data.data_contrato) : new Date(),
        modelo_contrato: data.modelo_contrato || data.plano_contratado || '',
        proposta_comercial_id: data.proposta_comercial_id,
        created_by: data.created_by || 'system',
      },
    });

    return reply.status(201).send({ status: 'ok', data: contrato });
  });

  // ── UPDATE
  fastify.patch('/contratos-comerciais/:id', async (request, reply) => {
    const { id } = request.params as any;
    const parse = UpdateContratoComercialSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ status: 'error', message: parse.error.message });

    const payload: any = { ...parse.data, updated_at: new Date() };
    if (payload.data_contrato) payload.data_contrato = new Date(payload.data_contrato);
    if (payload.signed_at) payload.signed_at = new Date(payload.signed_at);

    // Troca de vendedor: resolve o nome (UsuarioCRM + contas de sistema) e reaponta
    // a comissão de venda já existente, p/ o contrato contar na meta do vendedor certo.
    if (payload.vendedor_id) {
      const nomes = await resolverNomesUsuarios(prisma, [payload.vendedor_id]);
      if (nomes[payload.vendedor_id]) payload.vendedor_nome = nomes[payload.vendedor_id];
      await prisma.comissao.updateMany({
        where: { referencia_id: id, tipo: 'CONTRATO', papel: 'VENDEDOR' },
        data: { responsavel_id: payload.vendedor_id },
      }).catch(() => {});
    }

    // Marcar como ASSINADO (fluxo manual) → aplica comissão + move proposta/lead (entra na meta).
    if (payload.status === 'ASSINADO') {
      const atual = await prisma.contratoComercial.findUnique({ where: { id } });
      if (atual) {
        // grava o link/assinatura informados antes de aplicar os efeitos
        await prisma.contratoComercial.update({
          where: { id },
          data: {
            zapsign_signed_file_url: payload.zapsign_signed_file_url ?? atual.zapsign_signed_file_url ?? null,
            signed_at: payload.signed_at || atual.signed_at || new Date(),
          },
        });
        const contrato = await aplicarAssinatura(prisma, id, payload.zapsign_signed_file_url);
        return reply.send({ status: 'ok', data: contrato });
      }
    }

    const contrato = await prisma.contratoComercial.update({ where: { id }, data: payload });
    return reply.send({ status: 'ok', data: contrato });
  });

  // ── GERAR CADASTRO DO CLIENTE a partir do contrato assinado ─────────────────
  // A gestão informa o código do cliente + contatos adicionais; o resto vem do
  // contrato (razão, fantasia, CNPJ, plano, mensalidade, setup). Idempotente:
  // não duplica (procura por código → CNPJ → razão social). Atualiza se já existir.
  fastify.post('/contratos-comerciais/:id/gerar-cliente', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      codigo: z.string().optional(),
      telefone: z.string().optional(),
      telefone2: z.string().optional(),
      email: z.string().optional(),
      grupo_tecnico: z.string().optional(),
      segmento: z.string().optional(),
      observacoes: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const ct: any = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!ct) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });
    const b = body.data;

    // Setup total: usa valor_setup_total, ou entrada + (parcelas × valor parcela).
    const setupTotal = ct.valor_setup_total
      ?? ((Number(ct.valor_setup_entrada || 0)) + (Number(ct.setup_parcelas || 0) * Number(ct.valor_setup_parcela || 0)) || null);

    // Monta os dados do cliente a partir do contrato + o que a gestão informou.
    const dados: any = {
      nome: ct.nome_fantasia || ct.razao_social,
      razao_social: ct.razao_social,
      nome_fantasia: ct.nome_fantasia || null,
      cnpj: ct.cnpj || null,
      codigo: b.codigo || null,
      telefone: b.telefone || ct.representante_telefone || null,
      telefone2: b.telefone2 || null,
      email: b.email || ct.representante_email || null,
      plano: ct.plano_contratado || null,
      mensalidade_base: ct.mensalidade ?? null,
      valor_instalacao: setupTotal,
      situacao: 'ATIVA',
      segmento: b.segmento || null,
      grupo_tecnico: b.grupo_tecnico || null,
      observacoes: b.observacoes || `Cadastro gerado do contrato ${ct.numero_contrato || id}.`,
      data_entrada: new Date(),
    };
    Object.keys(dados).forEach(k => dados[k] === null && delete dados[k]);

    // Dedupe: código → CNPJ → razão social.
    let existente = null as any;
    if (b.codigo) existente = await prisma.cliente.findFirst({ where: { codigo: b.codigo } });
    if (!existente && ct.cnpj) existente = await prisma.cliente.findFirst({ where: { cnpj: ct.cnpj } });
    if (!existente && ct.razao_social) existente = await prisma.cliente.findFirst({ where: { razao_social: ct.razao_social } });

    let cliente;
    if (existente) {
      // Atualiza só campos vazios + sempre setup/mensalidade/plano do contrato.
      const upd: any = { mensalidade_base: dados.mensalidade_base, valor_instalacao: dados.valor_instalacao, plano: dados.plano };
      for (const k of ['codigo', 'telefone', 'telefone2', 'email', 'segmento', 'grupo_tecnico']) {
        if (dados[k] && (existente[k] == null || existente[k] === '')) upd[k] = dados[k];
      }
      Object.keys(upd).forEach(k => upd[k] == null && delete upd[k]);
      cliente = await prisma.cliente.update({ where: { id: existente.id }, data: upd });
    } else {
      cliente = await prisma.cliente.create({ data: dados });
    }

    // Marca no contrato que o cadastro foi gerado (rastreabilidade).
    await prisma.contratoComercial.update({ where: { id }, data: { cliente_id: cliente.id } as any }).catch(() => {});

    return reply.send({ status: 'success', data: cliente, message: existente ? 'Cliente atualizado a partir do contrato.' : 'Cliente criado a partir do contrato.' });
  });

  // ── RECUO / DISTRATO (cliente assinou e desistiu) — sai da meta e estorna comissão
  fastify.post('/contratos-comerciais/:id/recuar', async (request, reply) => {
    const { id } = request.params as any;
    const motivo = (request.body as any)?.motivo as string | undefined;
    const c = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });
    const atualizado = await aplicarRecuo(prisma, id, motivo);
    return reply.send({ status: 'ok', data: atualizado });
  });

  // ── DELETE
  fastify.delete('/contratos-comerciais/:id', async (request, reply) => {
    await prisma.contratoComercial.delete({ where: { id: (request.params as any).id } });
    return reply.send({ status: 'ok' });
  });

  // ── GERAR PREVIEW (texto das cláusulas)
  fastify.get('/contratos-comerciais/:id/preview', async (request, reply) => {
    const { id } = request.params as any;
    const c = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Não encontrado' });

    const dataFmt = new Date(c.data_contrato).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const clausulaSetup = gerarClausulaSetup(c);

    const preview = {
      identificacao: `A Empresa ${c.razao_social}${c.nome_fantasia ? ` (${c.nome_fantasia})` : ''}` +
        `${c.endereco ? `, com sede à ${c.endereco}` : ''}` +
        `${c.numero_endereco ? `, N° ${c.numero_endereco}` : ''}` +
        `${c.bairro ? `, ${c.bairro}` : ''}` +
        `${c.cidade ? `, ${c.cidade}` : ''}` +
        `${c.estado ? `, ${c.estado}` : ''}` +
        `${c.cep ? ` – CEP: ${c.cep}` : ''}` +
        `${c.cnpj ? `, inscrita no CNPJ: ${c.cnpj}` : ''}` +
        `, e representada por seu representante legal abaixo assinado.`,

      clausula31: c.mensalidade
        ? `3.1 - VALOR DO CONTRATO: O valor para a concessão do SOFTWARE: ${c.software_nome || 'SOLUTION – FRENTE DE LOJA'}, ` +
          `versão ${c.software_versao || c.plano_contratado || ''}, será de ${fmtBRL(c.mensalidade)} ` +
          `(${numPorExtenso(c.mensalidade)}) mensais, que deverá ser pago em moeda corrente nacional ` +
          `pela CONTRATANTE através de boleto mensal emitido pela CONTRATADA.`
        : '',

      clausula33: c.dia_vencimento
        ? `3.3 - DATA DO PAGAMENTO: O pagamento se dará no dia ${c.dia_vencimento} de cada mês.`
        : '',

      clausula35: clausulaSetup,

      dataLocal: `${c.cidade || 'Vitória'}, ${dataFmt}.`,

      assinatura: `${c.razao_social}\n${c.representante_nome || ''}${c.representante_cpf ? ` – CPF: ${c.representante_cpf}` : ''}\nCONTRATANTE`,

      numero_contrato: c.numero_contrato,
    };

    return reply.send({ status: 'ok', data: preview });
  });

  // ── ENVIAR PARA ZAPSIGN
  // Suporta dois modos:
  //   1. Template: usa modelo pré-cadastrado na ZapSign (campo zapsign_template_token ou configurado por plano)
  //   2. Upload:   recebe url_pdf ou base64_pdf no body e envia direto
  fastify.post('/contratos-comerciais/:id/enviar-zapsign', async (request, reply) => {
    const { id } = request.params as any;
    const body: any = request.body || {};
    const c = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Não encontrado' });

    const zap = await getZapSignConfig(prisma);
    if (!zap.token) {
      return reply.status(400).send({
        status: 'error',
        message: 'Token ZapSign não configurado. Acesse Configurações > Integrações > ZapSign.',
      });
    }

    const base = ZAPSIGN_BASE[zap.env];

    const signers: any[] = [];
    if (c.representante_nome) {
      signers.push({
        name: c.representante_nome,
        email: c.representante_email || '',
        phone_country: '55',
        phone_number: (c.representante_telefone || '').replace(/\D/g, ''),
        auth_mode: 'assinaturaTela',
        send_automatic_email: !!(c.representante_email),
        send_automatic_whatsapp: !!(c.representante_telefone),
      });
    }

    const docName = `Contrato ${c.numero_contrato} – ${c.razao_social}`;
    let zapEndpoint: string;
    let zapBody: any;

    // Modo 1 — template ZapSign (DOCX cadastrado na conta)
    const templateToken = body.template_token
      || c.zapsign_template_token
      || zap.templates[c.plano_contratado || '']
      || zap.templates['Pro'];

    if (templateToken && !body.url_pdf && !body.base64_pdf) {
      zapEndpoint = `${base}/models/${templateToken}/create-doc/`;
      zapBody = { name: docName, signers };
    } else if (body.url_pdf) {
      // Modo 2 — URL pública de um PDF
      zapEndpoint = `${base}/docs/`;
      zapBody = { name: docName, url_pdf: body.url_pdf, signers };
    } else if (body.base64_pdf) {
      // Modo 3 — PDF base64
      zapEndpoint = `${base}/docs/`;
      zapBody = { name: docName, base64_pdf: body.base64_pdf, signers };
    } else {
      return reply.status(400).send({
        status: 'error',
        message: 'Nenhum modelo ZapSign configurado para este plano. Configure em Configurações > Integrações > ZapSign, ou envie url_pdf/base64_pdf no corpo da requisição.',
      });
    }

    let zapRes: any;
    try {
      const response = await fetch(zapEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${zap.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zapBody),
      });
      zapRes = await response.json();
      if (!response.ok) {
        return reply.status(400).send({ status: 'error', message: `ZapSign: ${JSON.stringify(zapRes)}` });
      }
    } catch (e: any) {
      return reply.status(500).send({ status: 'error', message: `Erro ao chamar ZapSign: ${e.message}` });
    }

    const docToken = zapRes.token || String(zapRes.open_id || '');
    const signer   = zapRes.signers?.[0];

    const updated = await prisma.contratoComercial.update({
      where: { id },
      data: {
        status: 'ENVIADO_ASSINATURA',
        zapsign_doc_token:    docToken || null,
        zapsign_signer_token: signer?.token ? String(signer.token) : null,
        zapsign_signing_url:  signer?.sign_url || null,
        zapsign_status:       'pending',
        sent_to_sign_at:      new Date(),
      },
    });

    return reply.send({ status: 'ok', data: updated, zapsign: zapRes });
  });

  // ── GERAR PDF DO CONTRATO (download/preview)
  // Reproduz o modelo padrão por plano com os dados da proposta/contrato.
  fastify.get('/contratos-comerciais/:id/pdf', async (request, reply) => {
    const { id } = request.params as any;
    const c = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Não encontrado' });

    const pdf = await gerarContratoPdf(c as any);
    const filename = `Contrato_${(c.numero_contrato || id).replace(/[^\w.-]/g, '_')}.pdf`;
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${filename}"`)
      .send(pdf);
  });

  // ── GERAR + ENVIAR (1 clique): gera o PDF a partir do modelo e envia à ZapSign.
  // Marca o contrato como GERADO (com o PDF) e dispara a assinatura.
  fastify.post('/contratos-comerciais/:id/gerar-e-enviar', async (request, reply) => {
    const { id } = request.params as any;
    const c = await prisma.contratoComercial.findUnique({ where: { id } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Não encontrado' });

    if (!c.representante_nome) {
      return reply.status(400).send({
        status: 'error',
        message: 'Contrato sem representante (nome) para assinar. Preencha o representante legal antes de enviar.',
      });
    }

    const zap = await getZapSignConfig(prisma);
    if (!zap.token) {
      return reply.status(400).send({
        status: 'error',
        message: 'Token ZapSign não configurado. Acesse Configurações > Integrações > ZapSign.',
      });
    }

    // 1) Gera o PDF do contrato a partir do modelo padrão.
    let base64Pdf: string;
    try {
      const pdf = await gerarContratoPdf(c as any);
      base64Pdf = pdf.toString('base64');
      await prisma.contratoComercial.update({
        where: { id },
        data: { status: 'GERADO', gerado_at: new Date() },
      });
    } catch (e: any) {
      return reply.status(500).send({ status: 'error', message: `Falha ao gerar o PDF: ${e.message}` });
    }

    // 2) Envia o PDF (base64) à ZapSign para assinatura.
    const base = ZAPSIGN_BASE[zap.env];
    const signers: any[] = [{
      name: c.representante_nome,
      email: c.representante_email || '',
      phone_country: '55',
      phone_number: (c.representante_telefone || '').replace(/\D/g, ''),
      auth_mode: 'assinaturaTela',
      send_automatic_email: !!c.representante_email,
      send_automatic_whatsapp: !!c.representante_telefone,
    }];
    const docName = `Contrato ${c.numero_contrato} – ${c.razao_social}`;

    let zapRes: any;
    try {
      const response = await fetch(`${base}/docs/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${zap.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: docName, base64_pdf: base64Pdf, signers }),
      });
      zapRes = await response.json();
      if (!response.ok) {
        return reply.status(400).send({ status: 'error', message: `ZapSign: ${JSON.stringify(zapRes)}` });
      }
    } catch (e: any) {
      return reply.status(500).send({ status: 'error', message: `Erro ao chamar ZapSign: ${e.message}` });
    }

    const docToken = zapRes.token || String(zapRes.open_id || '');
    const signer = zapRes.signers?.[0];

    const updated = await prisma.contratoComercial.update({
      where: { id },
      data: {
        status: 'ENVIADO_ASSINATURA',
        zapsign_doc_token: docToken || null,
        zapsign_signer_token: signer?.token ? String(signer.token) : null,
        zapsign_signing_url: signer?.sign_url || null,
        zapsign_status: 'pending',
        sent_to_sign_at: new Date(),
      },
    });

    return reply.send({ status: 'ok', data: updated, zapsign: zapRes });
  });

  // ── WEBHOOK ZAPSIGN
  fastify.post('/webhook/zapsign', async (request, reply) => {
    const body: any = request.body;
    const docToken = body?.document?.token || body?.token;
    if (!docToken) return reply.send({ ok: true });

    const c = await prisma.contratoComercial.findFirst({
      where: { zapsign_doc_token: String(docToken) },
    });
    if (!c) return reply.send({ ok: true });

    const eventStatus = body?.event_action || body?.document?.status || '';
    if (eventStatus === 'doc_signed' || eventStatus === 'signed') {
      // Assinatura confirmada → calcula comissão, move proposta/lead (entra na meta).
      await aplicarAssinatura(prisma, c.id, body?.document?.signed_file_url || null);
    } else if (eventStatus === 'doc_refused' || eventStatus === 'refused') {
      await prisma.contratoComercial.update({
        where: { id: c.id },
        data: { status: 'PENDENTE_CORRECAO', zapsign_status: 'refused' },
      });
    }

    return reply.send({ ok: true });
  });

  // ── AUTO-CREATE a partir de PropostaComercial aceita
  fastify.post('/contratos-comerciais/from-proposta/:propostaId', async (request, reply) => {
    const { propostaId } = request.params as any;

    const existing = await prisma.contratoComercial.findFirst({
      where: { proposta_comercial_id: propostaId },
    });
    if (existing) {
      return reply.send({ status: 'ok', data: existing, already_exists: true });
    }

    const p = await prisma.propostaComercial.findUnique({ where: { id: propostaId } });
    if (!p) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });

    const { numero, seq, ano } = await gerarNumeroContrato(prisma);

    const setupAVista = !p.parcelas || p.parcelas <= 1;
    // Instalação (cláusula 3.5) = VALOR FINAL negociado (o "valor especial negociado"
    // da proposta = implantação + conversão − desconto). Fallback p/ valor_implantacao.
    const valorInstalacao = p.valor_final ?? p.valor_implantacao ?? undefined;

    // Rastreabilidade: o contrato HERDA o id da proposta de origem.
    // Se já existir um registro com esse id (regerar), cai no cuid() padrão.
    let contratoId: string | undefined = propostaId;
    const jaExisteId = await prisma.contratoComercial.findUnique({ where: { id: propostaId }, select: { id: true } });
    if (jaExisteId) contratoId = undefined;

    const contrato = await prisma.contratoComercial.create({
      data: {
        ...(contratoId ? { id: contratoId } : {}),
        numero_contrato: numero,
        sequencia: seq,
        ano,
        status: 'A_GERAR',
        proposta_comercial_id: propostaId,
        razao_social: p.razao_social,
        nome_fantasia: p.nome_fantasia || undefined,
        cnpj: p.cnpj || undefined,
        cidade: p.cidade || undefined,
        estado: p.estado || undefined,
        representante_nome: p.responsavel_nome || undefined,
        representante_cpf: p.responsavel_cpf || undefined,
        representante_email: p.responsavel_email || undefined,
        representante_telefone: p.responsavel_telefone || undefined,
        representante_cargo: p.responsavel_cargo || undefined,
        plano_contratado: p.plano_selecionado || undefined,
        software_nome: 'SOLUTION – FRENTE DE LOJA',
        software_versao: p.plano_selecionado || undefined,
        mensalidade: mensalidadeDoPlano(p),
        dia_vencimento: parseDiaVencimento(p.data_vencimento),
        valor_setup_total: valorInstalacao,
        valor_setup_entrada: p.entrada || undefined,
        setup_parcelas: p.parcelas || undefined,
        valor_setup_parcela: p.valor_parcela || undefined,
        setup_a_vista: setupAVista,
        vendedor_id: p.vendedor_id || p.created_by || undefined,
        vendedor_nome: p.vendedor_nome || undefined,
        supervisor_nome: p.supervisor_nome || undefined,
        campanha: p.campanha || undefined,
        condicao_especial: p.condicao_especial || undefined,
        modelo_contrato: p.plano_selecionado || undefined,
        created_by: p.created_by || 'system',
      },
    });

    // Atualiza proposta com status e data_contrato_gerado
    await prisma.propostaComercial.update({
      where: { id: propostaId },
      data: { data_contrato_gerado: new Date() },
    });

    return reply.status(201).send({ status: 'ok', data: contrato });
  });

  // ── CONFIGURAÇÕES INTEGRAÇÕES (ZapSign e outros)
  fastify.get('/configuracoes/integracoes', async (_request, reply) => {
    const configs = await prisma.configuracaoIntegracao.findMany();
    const map: Record<string, string> = {};
    configs.forEach(c => { map[c.chave] = c.valor; });
    return reply.send({ status: 'ok', data: map });
  });

  fastify.put('/configuracoes/integracoes', async (request, reply) => {
    const body = request.body as Record<string, string>;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ status: 'error', message: 'Body inválido' });
    }
    for (const [chave, valor] of Object.entries(body)) {
      await prisma.configuracaoIntegracao.upsert({
        where: { chave },
        create: { chave, valor, updated_at: new Date(), updated_by: 'user' },
        update: { valor, updated_at: new Date(), updated_by: 'user' },
      });
    }
    return reply.send({ status: 'ok' });
  });
}
