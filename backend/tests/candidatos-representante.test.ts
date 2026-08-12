import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { candidatosRepresentanteRoutes } from '@/routes/candidatos-representante';

const RESPOSTAS_DETALHADAS_TESTE = {
  estrutura_empresa: { possui_equipe: true, qtd_pessoas: 3 },
  estrutura_comercial: { visita_presencial: true, canais: ['WHATSAPP'] },
  instalacao_implantacao: { realiza_instalacao: true },
  suporte: { presta_suporte: true, tipos: ['WHATSAPP'] },
  regiao_atuacao: { estados: ['ES'], cidades: [{ nome: 'Vitória/ES', tipo: 'PRESENCIAL' }] },
  experiencia_mercado: { tempo_atuacao: '5 anos', segmentos: ['FARMACIAS'] },
  marcas_atuais: { representa_outras: false, marcas: [] },
  capacidade_expansao: { prospectar_mes: '10', etapas_atua: ['PROSPECCAO', 'SUPORTE'] },
  apresentacao_operacao: 'Atuo há 5 anos na região com foco em farmácias.',
};

describe('Candidatos Representante Routes', () => {
  let fastify: FastifyInstance;
  let prisma: PrismaClient;
  let createdId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    fastify = Fastify();
    fastify.register(cors);
    fastify.register(helmet, { contentSecurityPolicy: false });
    fastify.register(async (fastify) => {
      fastify.register(candidatosRepresentanteRoutes, { prisma });
    });
    fastify.get('/health', async () => ({ status: 'ok' }));
  });

  afterAll(async () => {
    await prisma.candidatoRepresentante.deleteMany({ where: { email: 'candidato.teste@example.com' } });
    await prisma.$disconnect();
    await fastify.close();
  });

  it('POST /candidatos-representante creates a candidacy without auth', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/candidatos-representante',
      payload: {
        nome: 'Candidato Teste',
        empresa: 'Teste Comércio LTDA',
        telefone: '27999999999',
        email: 'candidato.teste@example.com',
        cidade: 'Vitória',
        estado: 'ES',
        perfil_desejado: 'REPRESENTANTE',
        respostas_detalhadas: RESPOSTAS_DETALHADAS_TESTE,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('success');
    expect(body.data.status).toBe('NOVO');
    expect(body.data.respostas_detalhadas.apresentacao_operacao).toBe('Atuo há 5 anos na região com foco em farmácias.');
    createdId = body.data.id;
  }, 15000);

  it('POST /candidatos-representante rejects invalid payload', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/candidatos-representante',
      payload: { nome: '' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('GET /candidatos-representante requires auth', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/candidatos-representante' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /candidatos-representante rejects invalid token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/candidatos-representante',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /candidatos-representante/:id requires auth', async () => {
    const response = await fastify.inject({ method: 'GET', url: `/candidatos-representante/${createdId}` });
    expect(response.statusCode).toBe(401);
  });

  it('PATCH /candidatos-representante/:id requires auth', async () => {
    const response = await fastify.inject({
      method: 'PATCH',
      url: `/candidatos-representante/${createdId}`,
      payload: { status: 'EM_ANALISE' },
    });
    expect(response.statusCode).toBe(401);
  });
});
