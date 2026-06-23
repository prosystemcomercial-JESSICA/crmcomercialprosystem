import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

// ── Similaridade de strings (0.0 a 1.0) ──────────────────────────────────────
// Usa coeficiente de Dice sobre bigramas. Normaliza (lowercase, sem acentos,
// sem "ltda/eireli/me/sa/epp" e pontuação) para reduzir falsos negativos.
function normalizar(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(ltda?|eireli|me|sa|epp|ss|sc|cia|inc|s\.a\.?)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function bigramas(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}
function similaridade(a: string, b: string): number {
  const na = normalizar(a); const nb = normalizar(b);
  if (na === nb) return 1.0;
  const ba = bigramas(na); const bb = bigramas(nb);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  ba.forEach(g => { if (bb.has(g)) inter++; });
  return (2 * inter) / (ba.size + bb.size);
}

// Tenta casar o termo digitado com clientes da base usando similaridade ≥ 90%.
// Se mais de um cliente passar o limiar, NÃO associa (ambíguo).
async function buscarClienteExato(prisma: PrismaClient, termo: string): Promise<{ id: string; nome: string } | null> {
  if (!termo || termo.trim().length < 3) return null;
  const t = termo.trim();
  // Busca candidatos com contains para não varrer toda a tabela
  const candidatos = await prisma.cliente.findMany({
    where: {
      OR: [
        { razao_social: { contains: t.split(' ')[0] } }, // primeira palavra
        { nome_fantasia: { contains: t.split(' ')[0] } },
        { empresa: { contains: t.split(' ')[0] } },
        { nome: { contains: t.split(' ')[0] } },
      ],
    },
    select: { id: true, nome: true, razao_social: true, nome_fantasia: true, empresa: true },
    take: 50,
  }).catch(() => [] as any[]);

  const LIMIAR = 0.90;
  const aprovados: { id: string; nome: string; sim: number }[] = [];

  for (const c of candidatos) {
    const campos = [c.razao_social, c.nome_fantasia, c.empresa, c.nome].filter(Boolean) as string[];
    const melhor = Math.max(...campos.map(campo => similaridade(t, campo)));
    if (melhor >= LIMIAR) aprovados.push({ id: c.id, nome: c.razao_social || c.nome || '', sim: melhor });
  }

  // Só associa se houver exatamente UM cliente com similaridade suficiente
  if (aprovados.length === 1) return { id: aprovados[0].id, nome: aprovados[0].nome };
  return null; // 0 = não encontrou; >1 = ambíguo → supervisão decide
}

// ── Palavras críticas que acionam alerta mesmo com score alto ─────────────────
const PALAVRAS_CRITICAS = [
  'cancelar', 'cancela', 'cancelamento', 'sair', 'saindo',
  'trocar sistema', 'trocar de sistema', 'outro sistema',
  'muito ruim', 'péssimo', 'pessimo', 'horrível', 'horrivel',
  'demora', 'demorou muito', 'suporte fraco', 'não resolve', 'nao resolve',
  'insatisfeito', 'insatisfeita', 'caro demais', 'muito caro',
  'problema recorrente', 'sempre acontece', 'todo mês', 'toda semana',
];

function temPalavraCritica(texto?: string | null): boolean {
  if (!texto) return false;
  const lower = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return PALAVRAS_CRITICAS.some(p =>
    lower.includes(p.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  );
}

// ── Fórmula de score 0-100 ────────────────────────────────────────────────────
// | Bloco                        | Peso |
// | Nota do atendimento (1-5★)  |  25  |
// | Solicitação resolvida        |  20  |
// | Rapidez                      |  15  |
// | Conhecimento do técnico      |  15  |
// | Nota geral ProSystem (1-5★) |  15  |
// | Conhecimento das ferramentas |  10  |
// | Total                        | 100  |
function calcScore(d: {
  nota_atendimento: number; nota_conhecimento: number; nota_geral: number;
  resolucao?: string; rapidez?: string;
  conhece_plus: boolean; conhece_dashboard: boolean; conhece_mensageria: boolean; conhece_gerencial: boolean;
}): number {
  // Notas em estrelas (1-5) → pontos
  const pontoAtend = Math.round(((d.nota_atendimento - 1) / 4) * 25); // 0-25
  const pontoConhec = Math.round(((d.nota_conhecimento - 1) / 4) * 15); // 0-15
  const pontoGeral = Math.round(((d.nota_geral - 1) / 4) * 15); // 0-15

  // Resolução (0-20)
  const pontoResolucao = (() => {
    switch (d.resolucao) {
      case 'totalmente':     return 20;
      case 'parcialmente':   return 12;
      case 'nao_resolveu':   return 3;
      case 'nao_sei':        return 8;
      default:               return 12; // campo não preenchido → neutro
    }
  })();

  // Rapidez (0-15)
  const pontoRapidez = (() => {
    switch (d.rapidez) {
      case 'muito_rapido':    return 15;
      case 'esperado':        return 12;
      case 'demorou_pouco':   return 7;
      case 'demorou_muito':   return 2;
      default:                return 10; // neutro
    }
  })();

  // Conhecimento de ferramentas (0-10)
  const ferramentasConhecidas = [d.conhece_plus, d.conhece_dashboard, d.conhece_mensageria, d.conhece_gerencial].filter(Boolean).length;
  const pontoFerramentas = ferramentasConhecidas >= 3 ? 10 : ferramentasConhecidas >= 1 ? 7 : 3;

  return Math.min(100, pontoAtend + pontoResolucao + pontoRapidez + pontoConhec + pontoGeral + pontoFerramentas);
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const nota = z.coerce.number().int().min(1).max(5);
const RespostaSchema = z.object({
  identificacao: z.string().min(1),
  respondente_nome: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  cargo_respondente: z.enum(['dono', 'gerente', 'balconista', 'financeiro', 'outro']).optional(),

  // Notas obrigatórias (estrelas)
  nota_atendimento: nota,
  nota_conhecimento: nota,
  nota_geral: nota,
  // Legado compat
  nota_eficiencia: nota.optional(),

  // Botões de escolha
  resolucao: z.enum(['totalmente', 'parcialmente', 'nao_resolveu', 'nao_sei']).optional(),
  rapidez: z.enum(['muito_rapido', 'esperado', 'demorou_pouco', 'demorou_muito']).optional(),

  // Ferramentas (booleanos)
  conhece_plus: z.coerce.boolean().optional(),
  conhece_dashboard: z.coerce.boolean().optional(),
  conhece_mensageria: z.coerce.boolean().optional(),
  conhece_gerencial: z.coerce.boolean().optional(),

  // Interesse comercial
  interesse_comercial: z.enum(['sim', 'talvez', 'nao']).optional(),

  recado: z.string().optional(),
  // Legados
  nota_suporte: z.coerce.number().int().min(1).max(5).optional(),
  nota_sistema: z.coerce.number().int().min(1).max(5).optional(),
  conhece_plano: z.coerce.boolean().optional(),
  observacao: z.string().optional(),
  sugestoes: z.string().optional(),
});

export async function pesquisaRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ===== PÚBLICO — cliente responde a pesquisa =====
  fastify.post('/pesquisa/responder', async (request, reply) => {
    const body = RespostaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Preencha as notas e a identificação.' });
    const d = body.data;

    // Score 0-100
    const score = calcScore({
      nota_atendimento: d.nota_atendimento,
      nota_conhecimento: d.nota_conhecimento,
      nota_geral: d.nota_geral,
      resolucao: d.resolucao,
      rapidez: d.rapidez,
      conhece_plus: d.conhece_plus ?? false,
      conhece_dashboard: d.conhece_dashboard ?? false,
      conhece_mensageria: d.conhece_mensageria ?? false,
      conhece_gerencial: d.conhece_gerencial ?? false,
    });

    // Média legado (1-5)
    const notaEfic = d.nota_eficiencia ?? d.nota_atendimento;
    const notas = [d.nota_atendimento, notaEfic, d.nota_conhecimento, d.nota_geral];
    const media = notas.reduce((s, n) => s + n, 0) / notas.length;

    // Alertas especiais — mesmo com score alto
    const problemaNaoResolvido = d.resolucao === 'nao_resolveu';
    const demorouMuito = d.rapidez === 'demorou_muito';
    const notaBaixa = d.nota_atendimento <= 2 || d.nota_geral <= 2;
    const notaMedia = d.nota_atendimento === 3 || d.nota_geral === 3;
    const nenhumaFerramenta = !d.conhece_plus && !d.conhece_dashboard && !d.conhece_mensageria && !d.conhece_gerencial;
    const palavrasCriticas = temPalavraCritica(d.recado);

    const alertaMotivos: string[] = [];
    if (problemaNaoResolvido) alertaMotivos.push('Problema não resolvido');
    if (demorouMuito) alertaMotivos.push('Demorou muito');
    if (notaBaixa) alertaMotivos.push('Nota baixa no atendimento');
    if (notaMedia) alertaMotivos.push('Nota regular (3 estrelas)');
    if (nenhumaFerramenta) alertaMotivos.push('Não conhece nenhuma ferramenta');
    if (palavrasCriticas) alertaMotivos.push('Palavras críticas no comentário');

    const alertaEspecial = alertaMotivos.length > 0;

    // Criticidade legado — mantida para compatibilidade
    const desconheceAlgo = !d.conhece_plus || !d.conhece_dashboard || !d.conhece_mensageria || !d.conhece_gerencial;
    const critico = notaBaixa || desconheceAlgo || problemaNaoResolvido || score < 70;

    const respondenteÉDono = d.cargo_respondente === 'dono';

    // ── 1) Salva a pesquisa IMEDIATAMENTE — sem esperar busca de cliente ──────
    let pesquisa: any;
    try {
      pesquisa = await prisma.pesquisaSatisfacao.create({
        data: {
          identificacao: d.identificacao,
          respondente_nome: d.respondente_nome,
          email: d.email,
          whatsapp: d.whatsapp,
          cargo_respondente: d.cargo_respondente,
          nota_atendimento: d.nota_atendimento,
          nota_eficiencia: notaEfic,
          nota_conhecimento: d.nota_conhecimento,
          nota_geral: d.nota_geral,
          resolucao: d.resolucao,
          rapidez: d.rapidez,
          interesse_comercial: d.interesse_comercial,
          recado: d.recado,
          conhece_plus: d.conhece_plus ?? false,
          conhece_dashboard: d.conhece_dashboard ?? false,
          conhece_mensageria: d.conhece_mensageria ?? false,
          conhece_gerencial: d.conhece_gerencial ?? false,
          nota_suporte: d.nota_suporte ?? d.nota_atendimento,
          nota_sistema: d.nota_sistema ?? d.nota_geral,
          conhece_plano: d.conhece_plano ?? false,
          observacao: d.observacao,
          sugestoes: d.sugestoes,
          score,
          critico,
          media,
          alerta_especial: alertaEspecial,
          alerta_motivo: alertaMotivos.length > 0 ? alertaMotivos.join(' · ') : null,
          ip_address: (request.headers['x-forwarded-for'] as string)?.split(',')[0] || request.ip,
        },
      });
    } catch (e: any) {
      console.error('[PESQUISA] ERRO ao salvar:', JSON.stringify({ code: e?.code, msg: e?.message, meta: e?.meta }));
      return reply.status(500).send({ status: 'error', message: `Erro ao salvar: ${e?.code ?? ''} ${e?.message ?? ''}`.trim() });
    }

    // ── 2) Responde ao cliente sem esperar nada mais ───────────────────────────
    const categoria = score >= 90 ? 'excelente' : score >= 80 ? 'bom' : score >= 70 ? 'atencao' : 'churn';
    reply.send({
      status: 'success',
      data: { id: pesquisa.id, score, categoria, obrigado: true, interesse_comercial: d.interesse_comercial },
    });

    // ── 3) Pós-processamento em background (não bloqueia o cliente) ───────────
    setImmediate(async () => {
      try {
        const cliente = await buscarClienteExato(prisma, d.identificacao);

        // Vincula a pesquisa ao cliente encontrado
        if (cliente) {
          await prisma.pesquisaSatisfacao.update({
            where: { id: pesquisa.id },
            data: { cliente_id: cliente.id, cliente_casado: true },
          }).catch(() => {});

          // Atualiza ficha com radar de produtos
          const fichaUpd: any = {};
          if (d.conhece_plus !== undefined) fichaUpd.apresentou_plus = d.conhece_plus;
          if (d.conhece_dashboard !== undefined) fichaUpd.conhece_dashboard = d.conhece_dashboard;
          if (d.conhece_mensageria !== undefined) fichaUpd.conhece_mensageria = d.conhece_mensageria;
          if (d.conhece_gerencial !== undefined) fichaUpd.conhece_gerencial = d.conhece_gerencial;
          if (critico || alertaEspecial) fichaUpd.risco_atencao = true;
          if (Object.keys(fichaUpd).length) {
            await prisma.cliente.update({ where: { id: cliente.id }, data: fichaUpd }).catch(() => {});
          }

          // Abertura automática de caso de churn
          const deveAbrirChurn = score < 70 || notaBaixa || problemaNaoResolvido;
          if (deveAbrirChurn) {
            const motivoPrincipal = notaBaixa
              ? `Nota baixa na pesquisa (score ${score}/100)`
              : problemaNaoResolvido
                ? `Problema não resolvido (score ${score}/100)`
                : `Score baixo de satisfação (${score}/100)`;
            const riskScore = respondenteÉDono ? Math.min(100, 100 - score + 15) : 100 - score;
            const descricaoChurn = [
              `📊 Score de satisfação: ${score}/100`,
              `👤 Cargo do respondente: ${d.cargo_respondente ?? 'não informado'}`,
              `✅ Problema resolvido: ${d.resolucao ?? 'não informado'}`,
              `⚡ Rapidez: ${d.rapidez ?? 'não informado'}`,
              `⭐ Nota atendimento: ${d.nota_atendimento}/5`,
              `⭐ Nota técnico: ${d.nota_conhecimento}/5`,
              `⭐ Nota geral ProSystem: ${d.nota_geral}/5`,
              d.recado ? `💬 Comentário: "${d.recado}"` : null,
              alertaMotivos.length > 0 ? `⚠️ Alertas: ${alertaMotivos.join(', ')}` : null,
            ].filter(Boolean).join('\n');

            const caso = await prisma.casoChurn.create({
              data: { clienteId: cliente.id, status: 'NOVO', risk_score: riskScore, motivo_principal: motivoPrincipal, created_by: 'pesquisa-satisfacao', descricao: descricaoChurn },
            }).catch((e: any) => { console.error('[PESQUISA] abrir caso churn:', e?.message); return null; });

            if (caso) {
              await prisma.pesquisaSatisfacao.update({ where: { id: pesquisa.id }, data: { caso_churn_id: caso.id } }).catch(() => {});
              await prisma.cliente.update({ where: { id: cliente.id }, data: { risco_atencao: true } }).catch(() => {});
            }
          }
        }
      } catch (e: any) {
        console.error('[PESQUISA] erro pós-processamento background:', e?.message);
      }
    });
  });

  // ===== GESTÃO — lista de respostas (painel) =====
  fastify.get('/pesquisa', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      critico: z.coerce.boolean().optional(),
      cliente_id: z.string().optional(),
      score_min: z.coerce.number().optional(),
      score_max: z.coerce.number().optional(),
    }).safeParse(request.query);
    const where: any = {};
    if (q.success && q.data.critico) where.critico = true;
    if (q.success && q.data.cliente_id) where.cliente_id = q.data.cliente_id;
    if (q.success && (q.data.score_min !== undefined || q.data.score_max !== undefined)) {
      where.score = {};
      if (q.data.score_min !== undefined) where.score.gte = q.data.score_min;
      if (q.data.score_max !== undefined) where.score.lte = q.data.score_max;
    }

    const respostas = await prisma.pesquisaSatisfacao.findMany({
      where, orderBy: { created_at: 'desc' }, take: 500,
    });

    const total = respostas.length;
    const criticos = respostas.filter(r => r.critico).length;
    const alertas = respostas.filter((r: any) => r.alerta_especial).length;
    const excelentes = respostas.filter((r: any) => r.score >= 90).length;
    const emAtencao = respostas.filter((r: any) => r.score >= 70 && r.score < 80).length;
    const mediaSuporte = total ? respostas.reduce((s, r) => s + r.nota_suporte, 0) / total : 0;
    const mediaSistema = total ? respostas.reduce((s, r) => s + r.nota_sistema, 0) / total : 0;
    const scoresMedio = total ? Math.round(respostas.reduce((s: number, r: any) => s + (r.score || 0), 0) / total) : 0;
    const naoConhecePlano = respostas.filter(r => !r.conhece_plano).length;

    return reply.send({
      status: 'success',
      data: {
        respostas,
        resumo: {
          total, criticos, alertas, excelentes, em_atencao: emAtencao,
          nao_conhece_plano: naoConhecePlano,
          score_medio: scoresMedio,
          media_suporte: Math.round(mediaSuporte * 10) / 10,
          media_sistema: Math.round(mediaSistema * 10) / 10,
        },
      },
    });
  });

  // ===== Respostas de um cliente específico (ficha) =====
  fastify.get('/pesquisa/cliente/:clienteId', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };
    const respostas = await prisma.pesquisaSatisfacao.findMany({
      where: { cliente_id: clienteId }, orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: respostas });
  });

  // ===== GESTÃO — respostas que NÃO casaram com nenhum cliente da base =====
  fastify.get('/pesquisa/nao-casadas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const respostas = await prisma.pesquisaSatisfacao.findMany({
      where: { cliente_casado: false }, orderBy: { created_at: 'desc' }, take: 300,
    });
    return reply.send({ status: 'success', data: respostas });
  });

  // ===== GESTÃO — vincular manualmente uma resposta a um cliente =====
  fastify.post('/pesquisa/:id/vincular', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ cliente_id: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe o cliente.' });

    const [pesquisa, cliente] = await Promise.all([
      prisma.pesquisaSatisfacao.findUnique({ where: { id } }),
      prisma.cliente.findUnique({ where: { id: body.data.cliente_id }, select: { id: true } }),
    ]);
    if (!pesquisa) return reply.status(404).send({ status: 'error', message: 'Pesquisa não encontrada' });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    const score = (pesquisa as any).score ?? 0;
    let casoChurnId = pesquisa.caso_churn_id || undefined;

    // Abre caso de churn se score < 70 e ainda não tem caso
    if ((pesquisa.critico || score < 70) && !casoChurnId) {
      try {
        const caso = await prisma.casoChurn.create({
          data: {
            clienteId: cliente.id, status: 'NOVO',
            risk_score: 100 - score,
            motivo_principal: score < 70
              ? `Score baixo de satisfação (${score}/100)`
              : !pesquisa.conhece_plano ? 'Não conhece diferenciais do plano' : 'Baixa satisfação na pesquisa',
            created_by: 'pesquisa-satisfacao',
          },
        });
        casoChurnId = caso.id;
        await prisma.cliente.update({ where: { id: cliente.id }, data: { risco_atencao: true } }).catch(() => {});
      } catch (e: any) { console.error('[PESQUISA] vincular/churn:', e?.message); }
    }

    const atualizada = await prisma.pesquisaSatisfacao.update({
      where: { id },
      data: { cliente_id: cliente.id, cliente_casado: true, caso_churn_id: casoChurnId },
    });
    return reply.send({ status: 'success', data: atualizada });
  });
}
