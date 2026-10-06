import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo } from '@/lib/scope';
import { ehCargoTecnico } from '@/lib/implantacao/portal';
import { montarHistorico, CATEGORIAS_PRINT } from '@/lib/implantacao/historico';
import { registrarAuditoriaAcao } from '@/lib/auditoria';
import { salvarArquivoCliente } from '@/services/implantacao-portal.service';

/**
 * Prints e histórico do card do Portal Técnico (pedido da Jessica, 06/10/2026).
 * - Prints: colados (Ctrl+V) ou escolhidos no aparelho, por categoria (suporte, conversa, aviso, outro), cada um
 *   com a sua observação. Quem enviou (ou a gestão) edita a observação ou exclui; as duas ações vão para a
 *   auditoria (AuditoriaUsuario, ações CARD_*). Excluído some do card, mas a linha e a imagem ficam guardadas.
 * - Histórico: linha do tempo única (execução, pausas com motivo, esperas, recados, observações, prints) com um
 *   campo de observação que aceita print.
 */

const ehGestaoTecnica = (u: any) => podeVerTudo(u) || (u?.role || '').toUpperCase() === 'SUPERVISAO_TECNICA';
const CATEGORIAS = Object.keys(CATEGORIAS_PRINT) as [string, ...string[]];
const MAX_TEXTO = 3000;

export async function implantacaoRegistrosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  const exigirLogin = (request: any, reply: any) => { const u = getUser(request); if (!u) { reply.status(401).send({ status: 'error', message: 'Faça login' }); return null; } return u; };
  /** Demanda acessível ao usuário (técnico: só as dele; gestão: todas). */
  const demanda = async (u: any, id: string) => {
    const imp = await prisma.implantacao.findUnique({ where: { id }, select: { id: true, tecnico_id: true, cliente_razao_social: true } });
    if (!imp) return null;
    if (ehCargoTecnico(u?.role) && imp.tecnico_id !== u.id && !ehGestaoTecnica(u)) return null;
    return imp;
  };
  const publico = (r: any, u: any) => {
    const { imagem_caminho, ...resto } = r;
    return { ...resto, tem_imagem: !!imagem_caminho, pode_mexer: ehGestaoTecnica(u) || r.autor_id === u.id };
  };
  const ator = (u: any) => ({ id: u.id, nome: u.nome, role: u.role });

  // ── Lista (prints e observações do histórico). excluidos=1: só a gestão, para conferir o que foi apagado.
  fastify.get('/implantacoes/:id/registros', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const excluidos = (request.query as any)?.excluidos === '1' && ehGestaoTecnica(u);
    const lista = await prisma.implantacaoRegistro.findMany({ where: { implantacao_id: imp.id, excluido_em: excluidos ? { not: null } : null }, orderBy: { created_at: 'desc' }, take: 300 });
    return reply.send({ status: 'success', data: lista.map(r => publico(r, u)) });
  });

  // ── Novo print (imagem obrigatória) ou observação do histórico (texto e/ou print).
  fastify.post('/implantacoes/:id/registros', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({
      tipo: z.enum(['PRINT', 'OBS']),
      categoria: z.enum(CATEGORIAS).optional().nullable(),
      texto: z.string().trim().max(MAX_TEXTO).optional().nullable(),
      imagem: z.string().max(22 * 1024 * 1024).optional().nullable(),
      nome: z.string().trim().max(150).optional().nullable(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos.' });
    const d = b.data;
    if (d.imagem && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(d.imagem)) return reply.status(400).send({ status: 'error', message: 'Envie uma imagem (PNG, JPG, WEBP ou GIF).' });
    if (d.tipo === 'PRINT' && !d.imagem) return reply.status(400).send({ status: 'error', message: 'Cole ou escolha o print.' });
    if (d.tipo === 'OBS' && !d.texto && !d.imagem) return reply.status(400).send({ status: 'error', message: 'Escreva a observação ou cole um print.' });
    let arq: Awaited<ReturnType<typeof salvarArquivoCliente>> | null = null;
    if (d.imagem) {
      const ext = /^data:image\/(\w+)/.exec(d.imagem)?.[1]?.replace('jpeg', 'jpg') || 'png';
      const nome = (d.nome || `print-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`).replace(/\.\w+$/, '') + `.${ext}`;
      try { arq = await salvarArquivoCliente(imp.id, 'print', nome, d.imagem); }
      catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Não foi possível salvar o print.' }); }
    }
    const r = await prisma.implantacaoRegistro.create({
      data: {
        implantacao_id: imp.id, tipo: d.tipo, categoria: d.tipo === 'PRINT' ? (d.categoria || 'OUTRO') : (d.imagem ? d.categoria || null : null),
        texto: d.texto || null, autor_id: u.id, autor_nome: u.nome || null,
        ...(arq ? { imagem_caminho: arq.caminho, imagem_nome: arq.nome, imagem_mime: arq.mime, imagem_tamanho: arq.tamanho } : {}),
      },
    });
    return reply.status(201).send({ status: 'success', data: publico(r, u) });
  });

  /** Registro que o usuário pode alterar: quem escreveu ou a gestão. */
  const meu = async (u: any, rid: string) => {
    const r = await prisma.implantacaoRegistro.findUnique({ where: { id: rid } });
    if (!r || r.excluido_em || !(await demanda(u, r.implantacao_id))) return { erro: 404 as const };
    if (!ehGestaoTecnica(u) && r.autor_id !== u.id) return { erro: 403 as const };
    return { r };
  };
  const rotulo = (r: any, cliente: string) => `${cliente} · ${r.tipo === 'PRINT' ? (CATEGORIAS_PRINT[r.categoria] || 'Print') : 'Observação do histórico'}`;

  // ── Editar a observação (o texto anterior fica na auditoria).
  fastify.patch('/implantacoes/registros/:rid', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const m = await meu(u, (request.params as any).rid);
    if ('erro' in m) return reply.status(m.erro ?? 404).send({ status: 'error', message: m.erro === 403 ? 'Só quem escreveu (ou a gestão) pode editar.' : 'Registro não encontrado' });
    const b = z.object({ texto: z.string().trim().max(MAX_TEXTO) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Texto inválido.' });
    if (m.r.tipo === 'OBS' && !b.data.texto && !m.r.imagem_caminho) return reply.status(400).send({ status: 'error', message: 'A observação não pode ficar vazia. Para tirar, use Excluir.' });
    if ((m.r.texto || '') === b.data.texto) return reply.send({ status: 'success', data: publico(m.r, u) });
    const imp = await prisma.implantacao.findUnique({ where: { id: m.r.implantacao_id }, select: { cliente_razao_social: true } });
    await registrarAuditoriaAcao(prisma, ator(u), 'CARD_EDITOU_REGISTRO', m.r.id, rotulo(m.r, imp?.cliente_razao_social || 'Demanda'),
      { implantacao_id: m.r.implantacao_id, autor_original: m.r.autor_nome, antes: m.r.texto || '', depois: b.data.texto, imagem: m.r.imagem_nome || null });
    const r = await prisma.implantacaoRegistro.update({ where: { id: m.r.id }, data: { texto: b.data.texto || null, editado_em: new Date(), editado_por: u.nome || u.id } });
    return reply.send({ status: 'success', data: publico(r, u) });
  });

  // ── Excluir: some do card; a linha e a imagem continuam guardadas e a exclusão vai para a auditoria.
  fastify.delete('/implantacoes/registros/:rid', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const m = await meu(u, (request.params as any).rid);
    if ('erro' in m) return reply.status(m.erro ?? 404).send({ status: 'error', message: m.erro === 403 ? 'Só quem escreveu (ou a gestão) pode excluir.' : 'Registro não encontrado' });
    const motivo = String((request.body as any)?.motivo || '').trim().slice(0, 300) || null;
    const imp = await prisma.implantacao.findUnique({ where: { id: m.r.implantacao_id }, select: { cliente_razao_social: true } });
    await registrarAuditoriaAcao(prisma, ator(u), 'CARD_EXCLUIU_REGISTRO', m.r.id, rotulo(m.r, imp?.cliente_razao_social || 'Demanda'),
      { implantacao_id: m.r.implantacao_id, autor_original: m.r.autor_nome, criado_em: m.r.created_at, texto: m.r.texto || '', imagem: m.r.imagem_nome || null, motivo });
    await prisma.implantacaoRegistro.update({ where: { id: m.r.id }, data: { excluido_em: new Date(), excluido_por: u.nome || u.id, excluido_motivo: motivo } });
    return reply.send({ status: 'success' });
  });

  // ── Imagem do print (excluído: só a gestão vê).
  fastify.get('/implantacoes/registros/:rid/imagem', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const r = await prisma.implantacaoRegistro.findUnique({ where: { id: (request.params as any).rid } });
    if (!r?.imagem_caminho || !(await demanda(u, r.implantacao_id)) || (r.excluido_em && !ehGestaoTecnica(u))) return reply.status(404).send({ status: 'error', message: 'Imagem não encontrada' });
    const { readFile } = await import('fs/promises');
    const buf = await readFile(r.imagem_caminho).catch(() => null);
    if (!buf) return reply.status(404).send({ status: 'error', message: 'Imagem não encontrada no servidor' });
    reply.header('Content-Type', r.imagem_mime || 'image/png');
    reply.header('Cache-Control', 'private, max-age=86400');
    reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(r.imagem_nome || 'print.png')}"`);
    return reply.send(buf);
  });

  // ── Histórico completo do card.
  fastify.get('/implantacoes/:id/historico', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const [atividades, registros, observacoes, recados] = await Promise.all([
      prisma.implantacaoAtividade.findMany({ where: { implantacao_id: imp.id }, orderBy: { created_at: 'desc' }, take: 1000 }),
      prisma.implantacaoRegistro.findMany({ where: { implantacao_id: imp.id, excluido_em: null }, orderBy: { created_at: 'desc' }, take: 500 }),
      prisma.implantacaoObservacao.findMany({ where: { implantacao_id: imp.id, OR: [{ privada: false }, { privada: true, autor_id: u.id }] }, orderBy: { created_at: 'desc' }, take: 500 }),
      prisma.avisoTecnico.findMany({ where: { implantacao_id: imp.id }, orderBy: { created_at: 'desc' }, take: 300 }),
    ]);
    const eventos = montarHistorico({ ator: { id: u.id, gestao: ehGestaoTecnica(u) }, atividades, registros, observacoes, recados });
    return reply.send({ status: 'success', data: eventos });
  });
}
