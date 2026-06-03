import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId } from '@/lib/scope';
import { gerarContratoPdf } from '@/lib/contrato-pdf';

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
  status: z.enum(['A_GERAR','GERADO','ENVIADO_ASSINATURA','AGUARDANDO_ASSINATURA','ASSINADO','PENDENTE_CORRECAO','CANCELADO']).optional(),
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

  // Migração idempotente: garante a coluna gerado_at (timestamp de geração do PDF).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ContratoComercial ADD COLUMN gerado_at DATETIME NULL`
  ).catch(() => {});

  // ── LIST (kanban grouped)
  fastify.get('/contratos-comerciais', async (request, reply) => {
    const query = (request.query as any);
    const { status, search, page = 0, limit = 200 } = query;

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

    const contrato = await prisma.contratoComercial.update({ where: { id }, data: payload });
    return reply.send({ status: 'ok', data: contrato });
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
      await prisma.contratoComercial.update({
        where: { id: c.id },
        data: {
          status: 'ASSINADO',
          zapsign_status: 'signed',
          zapsign_signed_file_url: body?.document?.signed_file_url || null,
          signed_at: new Date(),
        },
      });
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
    // Instalação (cláusula 3.5) = valor de implantação da proposta (NÃO o valor_final, que é o total do negócio).
    const valorInstalacao = p.valor_implantacao ?? undefined;

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
